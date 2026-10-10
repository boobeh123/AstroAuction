/**
 * Checks that need a real MongoDB, connected the way the app connects.
 *
 * config/database.js turns on Mongoose's sanitizeFilter guard, which rewrites
 * any { $operator: ... } object in a query into a plain value. That stops a
 * request from sneaking operators like $ne into a query, but it also rewrites
 * the operators the app uses on purpose unless they're wrapped in
 * mongoose.trusted(). A missing wrapper doesn't throw an error. The query just
 * quietly matches nothing: bids get refused, auctions never close, and every
 * email link looks expired.
 *
 * So these tests run the real controllers and services against a real
 * database, with the guard on, and check that each query still finds what it
 * should.
 */
jest.mock('../../config/mailer');
jest.mock('../../middleware/cloudinary');

const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const connectDB = require('../../config/database');
const mailer = require('../../config/mailer');
const Auction = require('../../models/Auction');
const User = require('../../models/User');
const auctionController = require('../../controllers/auction');
const authController = require('../../controllers/auth');
const { closeExpiredAuctions } = require('../../services/auctionCloser');
const { mockRequest, mockResponse } = require('./helpers-mocks');

const ONE_HOUR_MS = 3_600_000;
const TOKEN = '0123456789abcdef0123456789abcdef01234567';
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

let mongod;

function makeAuction(overrides = {}) {
    return Auction.create({
        title: 'Test lot',
        description: 'A lot used for testing.',
        user: new mongoose.Types.ObjectId(),
        category: 'Art',
        saleType: 'auction',
        startingPrice: 100,
        minIncrement: 1,
        endsAt: new Date(Date.now() + ONE_HOUR_MS),
        status: 'open',
        ...overrides,
    });
}

function makeUser(overrides = {}) {
    return User.create({
        email: 'bidder@example.com',
        password: 'correct-horse-battery',
        ...overrides,
    });
}

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.DB_STRING = mongod.getUri();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await connectDB();

    mailer.sendOutbidEmail.mockResolvedValue();
    mailer.sendAuctionWonEmail.mockResolvedValue();
    mailer.sendAuctionEndedSellerEmail.mockResolvedValue();
}, 60_000);

afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
    jest.restoreAllMocks();
});

afterEach(async () => {
    await Promise.all([Auction.deleteMany({}), User.deleteMany({})]);
});

describe('the sanitizeFilter guard', () => {
    test('is on: an operator sent in place of an email is refused, not run', async () => {
        await makeUser();

        // What a request body like {"email": {"$ne": ""}} would put in a query.
        // Without the guard, it would match the first account in the database.
        // With it, the operator is treated as the email value itself, which
        // isn't a string, so Mongoose refuses to run the query at all.
        await expect(User.findOne({ email: { $ne: '' } })).rejects.toThrow('Cast to string failed');
    });
});

describe("the app's own operators still work with the guard on", () => {
    test('the auction closer closes an auction whose time is up', async () => {
        const lot = await makeAuction({ endsAt: new Date(Date.now() - 1000) });

        await expect(closeExpiredAuctions()).resolves.toBe(1);

        const after = await Auction.findById(lot._id).lean();
        expect(after.status).toBe('ended');
    });

    test('a first bid and a raise are both accepted', async () => {
        const lot = await makeAuction();
        const placeBid = (amount) => auctionController.postBid(
            mockRequest({
                params: { id: lot._id.toString() },
                body: { amount: String(amount) },
                user: { id: new mongoose.Types.ObjectId().toString() },
            }),
            mockResponse()
        );

        await placeBid(150); // the first-bid branch: startingPrice $lte
        await placeBid(160); // the raise branch: currentBid $ne and $lte

        const after = await Auction.findById(lot._id).lean();
        expect(after.currentBid).toBe(160);
        expect(after.bidCount).toBe(2);
    });

    test('a valid verification link still finds its account', async () => {
        const user = await makeUser({
            verificationToken: hashToken(TOKEN),
            verificationTokenExpires: Date.now() + ONE_HOUR_MS,
        });
        const res = mockResponse();

        await authController.getVerified(mockRequest({ params: { token: TOKEN } }), res);

        expect(res.redirectedTo).toBe('/');
        expect((await User.findById(user._id)).emailVerified).toBe(true);
    });

    test('a valid password reset link still opens the reset form', async () => {
        await makeUser({
            passwordResetToken: hashToken(TOKEN),
            passwordResetExpires: Date.now() + ONE_HOUR_MS,
        });
        const res = mockResponse();

        await authController.getResetPassword(mockRequest({ params: { token: TOKEN } }), res);

        expect(res.rendered).toBe('resetPassword.ejs');
    });

    test('a valid password reset link still changes the password', async () => {
        const user = await makeUser({
            passwordResetToken: hashToken(TOKEN),
            passwordResetExpires: Date.now() + ONE_HOUR_MS,
        });
        const req = mockRequest({
            params: { token: TOKEN },
            body: { password: 'a-brand-new-password', confirmPassword: 'a-brand-new-password' },
        });
        req.login = jest.fn((loggedInUser, callback) => callback());
        const res = mockResponse();

        await authController.postResetPassword(req, res, jest.fn());

        expect(res.redirectedTo).toBe('/');
        const after = await User.findById(user._id);
        expect(after.password).not.toBe(user.password);
        expect(after.passwordResetToken).toBeUndefined();
    });

    test('highlighting a listing clears the previous highlight', async () => {
        const previous = await makeAuction({ highlightedAt: new Date() });
        const next = await makeAuction();
        const res = mockResponse();

        await auctionController.postToggleHighlight(
            mockRequest({ params: { id: next._id.toString() } }),
            res
        );

        expect(res.redirectedTo).toBe('/auction');
        expect((await Auction.findById(previous._id).lean()).highlightedAt).toBeNull();
        expect((await Auction.findById(next._id).lean()).highlightedAt).toBeInstanceOf(Date);
    });
});
