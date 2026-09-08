jest.mock('../../models/Auction');
jest.mock('../../models/Comment');
jest.mock('../../models/Bid');
jest.mock('../../middleware/cloudinary');
jest.mock('../../config/mailer');
jest.mock('../../services/auctionCloser');

const mongoose = require('mongoose');
const Auction = require('../../models/Auction');
const Bid = require('../../models/Bid');
const { sendOutbidEmail } = require('../../config/mailer');
const auctionController = require('../../controllers/auction');
const { mockRequest, mockResponse, mockQuery } = require('./helpers-mocks');

const LOT_ID = '507f1f77bcf86cd799439011';
const SELLER_ID = '507f1f77bcf86cd799439012';
const BIDDER_ID = '507f1f77bcf86cd799439013';
const RIVAL_ID = '507f1f77bcf86cd799439014';

function liveAuction(overrides = {}) {
    return {
        _id: LOT_ID,
        title: 'Vintage lamp',
        saleType: 'auction',
        status: 'open',
        startingPrice: 100,
        minIncrement: 5,
        currentBid: null,
        currentBidder: null,
        bidCount: 0,
        endsAt: new Date(Date.now() + 3_600_000),
        user: SELLER_ID,
        ...overrides,
    };
}

function bidRequest(amount, userId = BIDDER_ID) {
    return mockRequest({
        params: { id: LOT_ID },
        body: { amount },
        user: { id: userId },
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    sendOutbidEmail.mockResolvedValue(undefined);
    Bid.create.mockResolvedValue({});
});

describe('postBid — rejections before any write', () => {
    test('404s on a malformed listing id', async () => {
        const req = mockRequest({ params: { id: 'not-an-objectid' }, user: { id: BIDDER_ID } });
        const res = mockResponse();

        await auctionController.postBid(req, res);

        expect(res.statusCode).toBe(404);
        expect(Auction.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('404s when the listing does not exist', async () => {
        Auction.findById.mockReturnValue(mockQuery(null));

        const res = mockResponse();
        await auctionController.postBid(bidRequest('150'), res);

        expect(res.statusCode).toBe(404);
        expect(Auction.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('refuses a bid on a fixed-price listing', async () => {
        Auction.findById.mockReturnValue(mockQuery(liveAuction({ saleType: 'fixed', price: 50 })));

        const req = bidRequest('150');
        const res = mockResponse();
        await auctionController.postBid(req, res);

        expect(req.flashed.errors[0].msg).toMatch(/not an auction/i);
        expect(Auction.findOneAndUpdate).not.toHaveBeenCalled();
    });

    // Shill bidding is the most damaging form of marketplace fraud: a seller
    // inflating their own item's price. This has to be refused regardless of
    // how the request was formed.
    test('refuses a seller bidding on their own listing', async () => {
        Auction.findById.mockReturnValue(mockQuery(liveAuction()));

        const req = bidRequest('150', SELLER_ID);
        const res = mockResponse();
        await auctionController.postBid(req, res);

        expect(req.flashed.errors[0].msg).toMatch(/your own listing/i);
        expect(Auction.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('refuses a bid on an auction whose clock has run out', async () => {
        Auction.findById.mockReturnValue(
            mockQuery(liveAuction({ endsAt: new Date(Date.now() - 1000) }))
        );

        const req = bidRequest('150');
        const res = mockResponse();
        await auctionController.postBid(req, res);

        expect(req.flashed.errors[0].msg).toMatch(/ended/i);
        expect(Auction.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('refuses a bid on an auction already marked ended', async () => {
        Auction.findById.mockReturnValue(mockQuery(liveAuction({ status: 'ended' })));

        const req = bidRequest('150');
        const res = mockResponse();
        await auctionController.postBid(req, res);

        expect(req.flashed.errors[0].msg).toMatch(/ended/i);
        expect(Auction.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test.each([
        ['empty string', ''],
        ['non-numeric text', 'one hundred'],
        ['negative', '-50'],
        ['zero', '0'],
        ['an object (injection shape)', { $gt: 0 }],
    ])('refuses %s as a bid amount', async (_label, amount) => {
        Auction.findById.mockReturnValue(mockQuery(liveAuction()));

        const req = bidRequest(amount);
        const res = mockResponse();
        await auctionController.postBid(req, res);

        expect(req.flashed.errors[0].msg).toMatch(/valid bid/i);
        expect(Auction.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('refuses a first bid below the starting price, naming the minimum', async () => {
        Auction.findById.mockReturnValue(mockQuery(liveAuction()));

        const req = bidRequest('99');
        const res = mockResponse();
        await auctionController.postBid(req, res);

        // The message has to state the actual figure — "too low" alone leaves
        // the user guessing at what would be accepted.
        expect(req.flashed.errors[0].msg).toContain('$100.00');
        expect(Auction.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('refuses a raise that does not clear the increment', async () => {
        Auction.findById.mockReturnValue(
            mockQuery(liveAuction({ currentBid: 100, currentBidder: RIVAL_ID, bidCount: 1 }))
        );

        const req = bidRequest('102');
        const res = mockResponse();
        await auctionController.postBid(req, res);

        expect(req.flashed.errors[0].msg).toContain('$105.00');
        expect(Auction.findOneAndUpdate).not.toHaveBeenCalled();
    });
});

describe('postBid — the atomic update', () => {
    test('puts every legality condition inside the query filter', async () => {
        Auction.findById.mockReturnValue(mockQuery(liveAuction()));
        Auction.findOneAndUpdate.mockReturnValue(mockQuery(liveAuction()));

        await auctionController.postBid(bidRequest('150'), mockResponse());

        const [filter, update, options] = Auction.findOneAndUpdate.mock.calls[0];

        // This is the core safety property of the whole feature. If any of
        // these conditions moved out of the filter and into an if-statement
        // above the call, the check and the write would stop being atomic and
        // simultaneous bids could overwrite each other.
        expect(filter._id).toBe(LOT_ID);
        expect(filter.saleType).toBe('auction');
        expect(filter.status).toBe('open');
        expect(filter.endsAt.$gt).toBeInstanceOf(Date);
        expect(Array.isArray(filter.$or)).toBe(true);

        expect(update.$set.currentBid).toBe(150);
        expect(update.$set.currentBidder).toBe(BIDDER_ID);
        expect(update.$inc.bidCount).toBe(1);

        // 'before' is load-bearing twice over: a non-null return proves this
        // bid won the race, and the returned document still holds the
        // previous bidder, who is the person to notify.
        expect(options.returnDocument).toBe('before');
    });

    test('the no-bids branch requires the amount to meet the starting price', async () => {
        Auction.findById.mockReturnValue(mockQuery(liveAuction()));
        Auction.findOneAndUpdate.mockReturnValue(mockQuery(liveAuction()));

        await auctionController.postBid(bidRequest('150'), mockResponse());

        const [filter] = Auction.findOneAndUpdate.mock.calls[0];
        const firstBidBranch = filter.$or.find((b) => b.currentBid === null);

        expect(firstBidBranch).toBeDefined();
        expect(firstBidBranch.startingPrice.$lte).toBe(150);
    });

    test('the has-bids branch requires clearing the current bid by the increment', async () => {
        Auction.findById.mockReturnValue(
            mockQuery(liveAuction({ currentBid: 100, currentBidder: RIVAL_ID, bidCount: 1 }))
        );
        Auction.findOneAndUpdate.mockReturnValue(mockQuery(liveAuction({ currentBidder: null })));

        await auctionController.postBid(bidRequest('120'), mockResponse());

        const [filter] = Auction.findOneAndUpdate.mock.calls[0];
        const raiseBranch = filter.$or.find((b) => b.currentBid && b.currentBid.$ne === null);

        // 120 - 5 = 115: the stored bid must be at or below this for the
        // raise to be legal.
        expect(raiseBranch.currentBid.$lte).toBe(115);
    });

    test('records a Bid history row only after the update is accepted', async () => {
        Auction.findById.mockReturnValue(mockQuery(liveAuction()));
        Auction.findOneAndUpdate.mockReturnValue(mockQuery(liveAuction()));

        await auctionController.postBid(bidRequest('150'), mockResponse());

        expect(Bid.create).toHaveBeenCalledWith({
            auction: LOT_ID,
            user: BIDDER_ID,
            amount: 150,
        });
    });

    test('writes no history row and warns the user when the bid loses the race', async () => {
        Auction.findById.mockReturnValue(mockQuery(liveAuction()));
        Auction.findOneAndUpdate.mockReturnValue(mockQuery(null));

        const req = bidRequest('150');
        const res = mockResponse();
        await auctionController.postBid(req, res);

        expect(Bid.create).not.toHaveBeenCalled();
        expect(req.flashed.errors[0].msg).toMatch(/not accepted/i);
        expect(res.redirectedTo).toBe(`/auction/viewAuction/${LOT_ID}`);
    });

    test('confirms the accepted bid with its amount', async () => {
        Auction.findById.mockReturnValue(mockQuery(liveAuction()));
        Auction.findOneAndUpdate.mockReturnValue(mockQuery(liveAuction()));

        const req = bidRequest('150');
        const res = mockResponse();
        await auctionController.postBid(req, res);

        expect(req.flashed.success[0]).toContain('$150.00');
        expect(res.redirectedTo).toBe(`/auction/viewAuction/${LOT_ID}`);
    });
});

describe('postBid — outbid notification', () => {
    test('emails the bidder who was displaced', async () => {
        const displaced = { _id: { toString: () => RIVAL_ID }, email: 'rival@example.com' };

        Auction.findById.mockReturnValue(
            mockQuery(liveAuction({ currentBid: 100, currentBidder: RIVAL_ID, bidCount: 1 }))
        );
        Auction.findOneAndUpdate.mockReturnValue(
            mockQuery(liveAuction({ currentBid: 100, currentBidder: displaced }))
        );

        await auctionController.postBid(bidRequest('120'), mockResponse());

        expect(sendOutbidEmail).toHaveBeenCalledTimes(1);
        const [recipient, listing, amount] = sendOutbidEmail.mock.calls[0];
        expect(recipient).toBe(displaced);
        expect(listing._id).toBe(LOT_ID);
        expect(amount).toBe(120);
    });

    test('sends nothing on the first bid, when there is nobody to displace', async () => {
        Auction.findById.mockReturnValue(mockQuery(liveAuction()));
        Auction.findOneAndUpdate.mockReturnValue(mockQuery(liveAuction({ currentBidder: null })));

        await auctionController.postBid(bidRequest('150'), mockResponse());

        expect(sendOutbidEmail).not.toHaveBeenCalled();
    });

    test('does not email you for outbidding yourself', async () => {
        // Raising your own already-winning bid is legitimate, but being told
        // you outbid yourself would be nonsense.
        const self = { _id: { toString: () => BIDDER_ID }, email: 'bidder@example.com' };

        Auction.findById.mockReturnValue(
            mockQuery(liveAuction({ currentBid: 100, currentBidder: BIDDER_ID, bidCount: 1 }))
        );
        Auction.findOneAndUpdate.mockReturnValue(
            mockQuery(liveAuction({ currentBid: 100, currentBidder: self }))
        );

        await auctionController.postBid(bidRequest('120', BIDDER_ID), mockResponse());

        expect(sendOutbidEmail).not.toHaveBeenCalled();
    });

    // The bid is already committed by this point. A mail failure must not
    // turn a successful bid into an error page.
    test('a failing outbid email still leaves the bid confirmed', async () => {
        const displaced = { _id: { toString: () => RIVAL_ID }, email: 'rival@example.com' };

        Auction.findById.mockReturnValue(
            mockQuery(liveAuction({ currentBid: 100, currentBidder: RIVAL_ID, bidCount: 1 }))
        );
        Auction.findOneAndUpdate.mockReturnValue(
            mockQuery(liveAuction({ currentBid: 100, currentBidder: displaced }))
        );
        sendOutbidEmail.mockRejectedValue(new Error('SMTP down'));

        const req = bidRequest('120');
        const res = mockResponse();

        await expect(auctionController.postBid(req, res)).resolves.not.toThrow();

        expect(req.flashed.success).toBeDefined();
        expect(res.redirectedTo).toBe(`/auction/viewAuction/${LOT_ID}`);
    });
});

describe('postBid — failure handling', () => {
    test('renders the 500 page if the database throws', async () => {
        Auction.findById.mockImplementation(() => { throw new Error('connection lost'); });

        const res = mockResponse();
        await auctionController.postBid(bidRequest('150'), res);

        expect(res.statusCode).toBe(500);
        expect(res.rendered).toBe('errors/500.ejs');
    });
});

describe('postComment', () => {
    const Comment = require('../../models/Comment');

    beforeEach(() => {
        Comment.create.mockResolvedValue({});
        Auction.exists.mockResolvedValue(true);
    });

    test('404s on a malformed listing id', async () => {
        const req = mockRequest({ params: { id: 'bad' }, body: { body: 'hi' }, user: { id: BIDDER_ID } });
        const res = mockResponse();

        await auctionController.postComment(req, res);

        expect(res.statusCode).toBe(404);
        expect(Comment.create).not.toHaveBeenCalled();
    });

    test('404s when the listing does not exist', async () => {
        Auction.exists.mockResolvedValue(false);

        const req = mockRequest({ params: { id: LOT_ID }, body: { body: 'hi' }, user: { id: BIDDER_ID } });
        const res = mockResponse();

        await auctionController.postComment(req, res);

        expect(res.statusCode).toBe(404);
        expect(Comment.create).not.toHaveBeenCalled();
    });

    test('rejects an empty or whitespace-only comment', async () => {
        for (const body of ['', '   ', '\n\t ']) {
            jest.clearAllMocks();
            Comment.create.mockResolvedValue({});
            Auction.exists.mockResolvedValue(true);

            const req = mockRequest({ params: { id: LOT_ID }, body: { body }, user: { id: BIDDER_ID } });
            await auctionController.postComment(req, mockResponse());

            expect(Comment.create).not.toHaveBeenCalled();
        }
    });

    test('rejects a non-string body (injection shape)', async () => {
        const req = mockRequest({
            params: { id: LOT_ID },
            body: { body: { $ne: null } },
            user: { id: BIDDER_ID },
        });

        await auctionController.postComment(req, mockResponse());

        expect(Comment.create).not.toHaveBeenCalled();
    });

    test('rejects a comment over the length cap', async () => {
        const req = mockRequest({
            params: { id: LOT_ID },
            body: { body: 'x'.repeat(1001) },
            user: { id: BIDDER_ID },
        });

        await auctionController.postComment(req, mockResponse());

        expect(Comment.create).not.toHaveBeenCalled();
        expect(req.flashed.errors[0].msg).toMatch(/1000/);
    });

    test('stores a valid comment trimmed', async () => {
        const req = mockRequest({
            params: { id: LOT_ID },
            body: { body: '  Is this still available?  ' },
            user: { id: BIDDER_ID },
        });
        const res = mockResponse();

        await auctionController.postComment(req, res);

        expect(Comment.create).toHaveBeenCalledWith({
            body: 'Is this still available?',
            user: BIDDER_ID,
            auction: LOT_ID,
        });
        expect(res.redirectedTo).toBe(`/auction/viewAuction/${LOT_ID}`);
    });
});
