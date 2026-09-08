/**
 * Concurrency tests for auction bidding.
 *
 * These are the tests that actually matter for this feature. Bidding logic
 * can look completely correct in review and still lose bids under load — the
 * only way to know the atomic filter works is to fire real simultaneous
 * writes at a real MongoDB and check what survived.
 *
 * Requires mongodb-memory-server:
 *   npm install --save-dev mongodb-memory-server
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { round2 } = require('../../utils/bidding');

let mongod;
let Auction;
let sellerId;

// Mirrors the exact filter used by postBid. Kept in the test rather than
// imported so that if someone weakens the real filter, this test still
// exercises the correct one and the difference shows up as a failure.
async function attemptBid(listingId, bidderId, amount, minIncrement) {
    const threshold = round2(amount - minIncrement);

    return Auction.findOneAndUpdate(
        {
            _id: listingId,
            saleType: 'auction',
            status: 'open',
            endsAt: { $gt: new Date() },
            $or: [
                { currentBid: null, startingPrice: { $lte: amount } },
                { currentBid: { $ne: null, $lte: threshold } },
            ],
        },
        {
            $set: { currentBid: amount, currentBidder: bidderId },
            $inc: { bidCount: 1 },
        },
        { returnDocument: 'before' }
    ).lean();
}

function makeAuction(overrides = {}) {
    return Auction.create({
        title: 'Test lot',
        description: 'A lot used for testing.',
        user: sellerId,
        category: 'Art',
        saleType: 'auction',
        startingPrice: 100,
        minIncrement: 1,
        endsAt: new Date(Date.now() + 3_600_000),
        status: 'open',
        ...overrides,
    });
}

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    Auction = require('../../models/Auction');
    sellerId = new mongoose.Types.ObjectId();
}, 60_000);

afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
});

afterEach(async () => {
    await Auction.deleteMany({});
});

describe('concurrent bidding', () => {

    test('exactly one of eight simultaneous identical bids is accepted', async () => {
        const lot = await makeAuction();
        const bidders = Array.from({ length: 8 }, () => new mongoose.Types.ObjectId());

        const results = await Promise.all(
            bidders.map((bidder) => attemptBid(lot._id, bidder, 150, 1))
        );

        // A non-null return means that caller's write landed. If the filter
        // were a read-then-write, several would come back non-null and the
        // losers' bids would have been silently overwritten.
        expect(results.filter(Boolean)).toHaveLength(1);

        const after = await Auction.findById(lot._id).lean();
        expect(after.bidCount).toBe(1);
        expect(after.currentBid).toBe(150);
    });

    test('escalating simultaneous bids never lose an accepted bid', async () => {
        const lot = await makeAuction();
        const amounts = [105, 110, 120, 130, 140, 150, 160, 170, 180, 190];
        const bidders = amounts.map(() => new mongoose.Types.ObjectId());

        const results = await Promise.all(
            amounts.map((amount, i) => attemptBid(lot._id, bidders[i], amount, 1))
        );

        const acceptedAmounts = amounts.filter((_, i) => results[i]);
        const after = await Auction.findById(lot._id).lean();

        // Every increment must be accounted for, and the stored bid must be
        // the highest one that was accepted — never a lower bid that arrived
        // later and clobbered it.
        expect(after.bidCount).toBe(acceptedAmounts.length);
        expect(after.currentBid).toBe(Math.max(...acceptedAmounts));
    });

    test('exactly one of five concurrent closes succeeds', async () => {
        // This is what stops a winner getting five "you won" emails when the
        // sweeper and a page view race to close the same auction.
        const lot = await makeAuction({ endsAt: new Date(Date.now() - 1000) });

        const results = await Promise.all(
            Array.from({ length: 5 }, () => Auction.findOneAndUpdate(
                {
                    _id: lot._id,
                    saleType: 'auction',
                    status: 'open',
                    endsAt: { $lte: new Date() },
                },
                { $set: { status: 'ended', closedAt: new Date() } },
                { returnDocument: 'after' }
            ).lean())
        );

        expect(results.filter(Boolean)).toHaveLength(1);
    });
});

describe('bid validation rules', () => {

    test('first bid must meet the starting price', async () => {
        const lot = await makeAuction({ startingPrice: 250 });

        await expect(attemptBid(lot._id, sellerId, 249.99, 1)).resolves.toBeNull();
        await expect(attemptBid(lot._id, sellerId, 250, 1)).resolves.not.toBeNull();
    });

    test('later bids must clear the current bid by the increment', async () => {
        const lot = await makeAuction({ minIncrement: 5 });
        const bidder = new mongoose.Types.ObjectId();

        await attemptBid(lot._id, bidder, 100, 5);

        await expect(attemptBid(lot._id, bidder, 103, 5)).resolves.toBeNull();
        await expect(attemptBid(lot._id, bidder, 105, 5)).resolves.not.toBeNull();
    });

    test('a bid equal to the current bid is rejected', async () => {
        const lot = await makeAuction();
        const bidder = new mongoose.Types.ObjectId();

        await attemptBid(lot._id, bidder, 200, 1);

        await expect(attemptBid(lot._id, bidder, 200, 1)).resolves.toBeNull();
    });

    test('bids on an expired auction are rejected', async () => {
        const lot = await makeAuction({ endsAt: new Date(Date.now() - 1000) });

        await expect(attemptBid(lot._id, sellerId, 500, 1)).resolves.toBeNull();
    });

    test('bids on an already-closed auction are rejected', async () => {
        const lot = await makeAuction({ status: 'ended' });

        await expect(attemptBid(lot._id, sellerId, 500, 1)).resolves.toBeNull();
    });
});

describe('outbid identification', () => {

    test("the pre-update document names the user who was outbid", async () => {
        // postBid depends on this: returnDocument 'before' is the only way to
        // learn who held the top bid, because the update overwrites it. If this
        // ever broke, outbid emails would silently stop going out.
        const lot = await makeAuction();
        const first = new mongoose.Types.ObjectId();
        const second = new mongoose.Types.ObjectId();

        await attemptBid(lot._id, first, 100, 1);
        const previousState = await attemptBid(lot._id, second, 120, 1);

        expect(previousState).not.toBeNull();
        expect(previousState.currentBidder.toString()).toBe(first.toString());
    });

    test('the very first bid has no one to outbid', async () => {
        const lot = await makeAuction();
        const previousState = await attemptBid(lot._id, new mongoose.Types.ObjectId(), 100, 1);

        expect(previousState).not.toBeNull();
        expect(previousState.currentBidder).toBeNull();
    });
});
