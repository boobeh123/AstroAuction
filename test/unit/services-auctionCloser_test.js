jest.mock('../../models/Auction');
jest.mock('../../config/mailer');

const Auction = require('../../models/Auction');
const {
    sendAuctionWonEmail,
    sendAuctionEndedSellerEmail,
} = require('../../config/mailer');
const {
    closeAuctionIfDue,
    closeExpiredAuctions,
    startAuctionCloser,
    stopAuctionCloser,
} = require('../../services/auctionCloser');
const { mockQuery } = require('./helpers-mocks');

const seller = { _id: 'seller1', email: 'seller@example.com', displayName: 'Seller' };
const winner = { _id: 'winner1', email: 'winner@example.com', displayName: 'Winner' };

function closedListing(overrides = {}) {
    return {
        _id: 'lot1',
        title: 'Vintage lamp',
        saleType: 'auction',
        status: 'ended',
        currentBid: 150,
        user: seller,
        currentBidder: winner,
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    sendAuctionWonEmail.mockResolvedValue(undefined);
    sendAuctionEndedSellerEmail.mockResolvedValue(undefined);
});

afterEach(() => {
    stopAuctionCloser();
});

describe('closeAuctionIfDue', () => {
    test('claims the auction with a filter that requires it to still be open', async () => {
        Auction.findOneAndUpdate.mockReturnValue(mockQuery(closedListing()));

        await closeAuctionIfDue('lot1');

        const [filter, update, options] = Auction.findOneAndUpdate.mock.calls[0];

        // These four conditions are what make closing safe under concurrency.
        // If `status: 'open'` ever left this filter, a second sweeper could
        // re-close an already-closed auction and send duplicate emails.
        expect(filter._id).toBe('lot1');
        expect(filter.saleType).toBe('auction');
        expect(filter.status).toBe('open');
        expect(filter.endsAt.$lte).toBeInstanceOf(Date);

        expect(update.$set.status).toBe('ended');
        expect(update.$set.closedAt).toBeInstanceOf(Date);

        // 'after' is required — the caller needs the post-close state,
        // including who the winning bidder was.
        expect(options.returnDocument).toBe('after');
    });

    test('returns null and sends nothing when the filter matches no document', async () => {
        // This is the losing side of a close race: another process already
        // flipped the status, so this caller must stay silent.
        Auction.findOneAndUpdate.mockReturnValue(mockQuery(null));

        const result = await closeAuctionIfDue('lot1');

        expect(result).toBeNull();
        expect(sendAuctionWonEmail).not.toHaveBeenCalled();
        expect(sendAuctionEndedSellerEmail).not.toHaveBeenCalled();
    });

    test('emails both the winner and the seller when there was a bid', async () => {
        Auction.findOneAndUpdate.mockReturnValue(mockQuery(closedListing()));

        await closeAuctionIfDue('lot1');

        expect(sendAuctionWonEmail).toHaveBeenCalledTimes(1);
        expect(sendAuctionWonEmail.mock.calls[0][0]).toBe(winner);

        expect(sendAuctionEndedSellerEmail).toHaveBeenCalledTimes(1);
        const [sellerArg, , winnerName] = sendAuctionEndedSellerEmail.mock.calls[0];
        expect(sellerArg).toBe(seller);
        expect(winnerName).toBe('Winner');
    });

    test('emails only the seller when the auction ended with no bids', async () => {
        Auction.findOneAndUpdate.mockReturnValue(
            mockQuery(closedListing({ currentBidder: null, currentBid: null }))
        );

        await closeAuctionIfDue('lot1');

        expect(sendAuctionWonEmail).not.toHaveBeenCalled();
        expect(sendAuctionEndedSellerEmail).toHaveBeenCalledTimes(1);

        // A null winner name is what tells the template to render the
        // "no bids, consider relisting" copy instead of a sale confirmation.
        const [, , winnerName] = sendAuctionEndedSellerEmail.mock.calls[0];
        expect(winnerName).toBeNull();
    });

    test('a failed winner email does not prevent the seller email', async () => {
        Auction.findOneAndUpdate.mockReturnValue(mockQuery(closedListing()));
        sendAuctionWonEmail.mockRejectedValue(new Error('SMTP unavailable'));

        await expect(closeAuctionIfDue('lot1')).resolves.not.toThrow();

        expect(sendAuctionEndedSellerEmail).toHaveBeenCalledTimes(1);
    });

    test('skips a recipient with no email address', async () => {
        Auction.findOneAndUpdate.mockReturnValue(
            mockQuery(closedListing({ currentBidder: { _id: 'x', displayName: 'No Email' } }))
        );

        await closeAuctionIfDue('lot1');

        expect(sendAuctionWonEmail).not.toHaveBeenCalled();
        expect(sendAuctionEndedSellerEmail).toHaveBeenCalledTimes(1);
    });
});

describe('closeExpiredAuctions', () => {
    test('queries only for open auctions past their end time', async () => {
        Auction.find.mockReturnValue(mockQuery([]));

        await closeExpiredAuctions();

        const [filter] = Auction.find.mock.calls[0];
        expect(filter.saleType).toBe('auction');
        expect(filter.status).toBe('open');
        expect(filter.endsAt.$lte).toBeInstanceOf(Date);
    });

    test('does no work and closes nothing when none are due', async () => {
        Auction.find.mockReturnValue(mockQuery([]));

        const count = await closeExpiredAuctions();

        expect(count).toBe(0);
        expect(Auction.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test('closes every due auction and reports the count', async () => {
        Auction.find.mockReturnValue(mockQuery([{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]));
        Auction.findOneAndUpdate.mockReturnValue(mockQuery(closedListing()));

        const count = await closeExpiredAuctions();

        expect(Auction.findOneAndUpdate).toHaveBeenCalledTimes(3);
        expect(count).toBe(3);
    });

    test('counts only the auctions it actually claimed', async () => {
        // Two of the three were closed by another process between the find
        // and the claim — a normal race, not an error.
        Auction.find.mockReturnValue(mockQuery([{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]));
        Auction.findOneAndUpdate
            .mockReturnValueOnce(mockQuery(closedListing()))
            .mockReturnValueOnce(mockQuery(null))
            .mockReturnValueOnce(mockQuery(null));

        const count = await closeExpiredAuctions();

        expect(count).toBe(1);
    });

    test('one auction failing does not abort the rest of the sweep', async () => {
        Auction.find.mockReturnValue(mockQuery([{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]));
        Auction.findOneAndUpdate
            .mockImplementationOnce(() => { throw new Error('connection reset'); })
            .mockReturnValueOnce(mockQuery(closedListing()))
            .mockReturnValueOnce(mockQuery(closedListing()));

        const count = await closeExpiredAuctions();

        expect(count).toBe(2);
        expect(Auction.findOneAndUpdate).toHaveBeenCalledTimes(3);
    });
});

describe('startAuctionCloser / stopAuctionCloser', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Auction.find.mockReturnValue(mockQuery([]));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('sweeps immediately on start rather than waiting a full interval', async () => {
        // Auctions that expired while the app was down need catching up at
        // boot; waiting 60s would delay every one of those notifications.
        startAuctionCloser();

        expect(Auction.find).toHaveBeenCalledTimes(1);
    });

    test('sweeps again on each interval', async () => {
        startAuctionCloser();
        expect(Auction.find).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(60_000);
        expect(Auction.find).toHaveBeenCalledTimes(2);

        jest.advanceTimersByTime(60_000);
        expect(Auction.find).toHaveBeenCalledTimes(3);
    });

    test('starting twice does not create a second interval', async () => {
        startAuctionCloser();
        startAuctionCloser();

        jest.advanceTimersByTime(60_000);

        // One initial sweep plus one interval tick. The `if (sweepTimer)`
        // guard sits before the initial sweep, so the second call returns
        // without doing anything at all — no duplicate boot sweep, and no
        // second interval doubling database load for the process lifetime.
        expect(Auction.find).toHaveBeenCalledTimes(2);
    });

    test('stopping halts further sweeps', async () => {
        startAuctionCloser();
        stopAuctionCloser();

        jest.advanceTimersByTime(180_000);

        expect(Auction.find).toHaveBeenCalledTimes(1);
    });

    test('stopping when not started is safe', () => {
        expect(() => stopAuctionCloser()).not.toThrow();
    });
});
