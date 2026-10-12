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
jest.mock('../../config/cloudinary');

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const connectDB = require('../../config/database');
const mailer = require('../../config/mailer');
const cloudinary = require('../../config/cloudinary');
const Auction = require('../../model/Auction');
const User = require('../../model/User');
const Comment = require('../../model/Comment');
const Bid = require('../../model/Bid');
const Message = require('../../model/Message');
const auctionController = require('../../controller/auctionController');
const authController = require('../../controller/authController');
const profileController = require('../../controller/profileController');
const { closeExpiredAuctions } = require('../../services/auctionCloser');
const { validateBid, validateListing, validateMessage, validateResetPassword } = require('../../middleware/validators');
const { mockRequest, mockResponse, runValidators } = require('./helpers-mocks');

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
    await Promise.all([Auction.deleteMany({}), User.deleteMany({}), Comment.deleteMany({}), Bid.deleteMany({}), Message.deleteMany({})]);
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
        const placeBid = async (amount) => {
            const req = mockRequest({
                params: { id: lot._id.toString() },
                body: { amount: String(amount) },
                user: { id: new mongoose.Types.ObjectId().toString() },
            });
            await runValidators(validateBid, req);
            await auctionController.postBid(req, mockResponse());
        };

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

        await runValidators(validateResetPassword, req);
        await authController.postResetPassword(req, res, jest.fn());

        expect(res.redirectedTo).toBe('/');
        const after = await User.findById(user._id);
        expect(after.password).not.toBe(user.password);
        expect(after.passwordResetToken).toBeUndefined();
        // endStaleSessions uses this to sign the account out everywhere else
        expect(after.passwordChangedAt).toBeInstanceOf(Date);
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

describe('creating a listing', () => {
    let tempDir;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'astro-uploads-'));
        cloudinary.uploader.upload.mockReset();
        cloudinary.uploader.upload.mockImplementation(async (filePath) => ({
            secure_url: `https://res.cloudinary.com/demo/image/upload/${path.basename(filePath)}`,
            public_id: path.basename(filePath),
        }));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    // Stand-ins for the photos multer saves to disk before the controller runs
    async function tempPhotos(count) {
        const files = [];
        for (let i = 0; i < count; i++) {
            const filePath = path.join(tempDir, `photo${i}.jpg`);
            await fs.writeFile(filePath, 'not really a photo');
            files.push({ path: filePath });
        }
        return files;
    }

    async function postListing(body, files) {
        const req = mockRequest({ body, files, user: { id: new mongoose.Types.ObjectId().toString() } });
        const res = mockResponse();
        await runValidators(validateListing, req);
        await auctionController.postAuction(req, res);
        return { req, res };
    }

    const fileExists = (filePath) => fs.access(filePath).then(() => true, () => false);

    // The listing used to be checked only after its photos were uploaded,
    // so a rejected listing left its photos in Cloudinary with nothing in
    // the database pointing at them.
    test('a rejected listing uploads no photos and still deletes the temp files', async () => {
        const files = await tempPhotos(2);

        const { req, res } = await postListing({
            title: '',
            description: 'Hand-turned bowl.',
            category: 'Art',
            saleType: 'fixed',
            price: '25',
        }, files);

        expect(res.redirectedTo).toBe('/auction');
        expect(req.flashed.errors).toContainEqual({ msg: 'Enter a title for your listing.' });
        expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
        expect(await Auction.countDocuments()).toBe(0);
        for (const file of files) {
            expect(await fileExists(file.path)).toBe(false);
        }
    });

    test('a valid auction is saved with its photos', async () => {
        const files = await tempPhotos(2);

        await postListing({
            title: '  Koa wood bowl  ',
            description: 'Hand-turned bowl.',
            category: 'Art',
            saleType: 'auction',
            startingPrice: '100',
            minIncrement: '',
            durationDays: '7',
            video: '',
        }, files);

        const saved = await Auction.findOne().lean();
        expect(saved).toMatchObject({
            title: 'Koa wood bowl',
            saleType: 'auction',
            startingPrice: 100,
            minIncrement: 1, // an empty increment means $1.00
            status: 'open',
            cloudinaryIds: ['photo0.jpg', 'photo1.jpg'],
        });
        const sevenDaysMs = 7 * 24 * ONE_HOUR_MS;
        expect(Math.abs(saved.endsAt.getTime() - Date.now() - sevenDaysMs)).toBeLessThan(60_000);
        for (const file of files) {
            expect(await fileExists(file.path)).toBe(false);
        }
    });
});

describe('password hashing', () => {
    // A bcrypt hash starts with its version and cost: $2b$12$ means cost 12
    test('new passwords are hashed with bcrypt cost 12', async () => {
        const user = await makeUser();

        expect(user.password).toMatch(/^\$2b\$12\$/);
    });

    test('a password hashed at the old cost of 10 still logs in', async () => {
        const oldHash = await bcrypt.hash('correct-horse-battery', 10);
        // Write the old hash straight to the database, skipping the save hook
        const { insertedId } = await User.collection.insertOne({
            email: 'longtime@example.com',
            password: oldHash,
        });
        const user = await User.findById(insertedId);

        const isMatch = await new Promise((resolve, reject) => {
            user.comparePassword('correct-horse-battery', (err, ok) => (err ? reject(err) : resolve(ok)));
        });

        expect(isMatch).toBe(true);
    });
});

describe('the logged-in user that every page receives', () => {
    // config/passport.js registers its deserializeUser on whatever passport
    // object it's given, so a stand-in can capture it
    function captureDeserializer() {
        let deserialize;
        require('../../config/passport')({
            use: () => {},
            serializeUser: () => {},
            deserializeUser: (fn) => {
                deserialize = fn;
            },
        });
        return (id) => new Promise((resolve, reject) => {
            deserialize(id, (err, user) => (err ? reject(err) : resolve(user)));
        });
    }

    test('has no password or token hashes', async () => {
        const user = await makeUser({
            verificationToken: hashToken(TOKEN),
            verificationTokenExpires: Date.now() + ONE_HOUR_MS,
            passwordResetToken: hashToken(TOKEN),
            passwordResetExpires: Date.now() + ONE_HOUR_MS,
        });

        const loaded = await captureDeserializer()(user.id);

        expect(loaded.email).toBe(user.email);
        expect(loaded.password).toBeUndefined();
        expect(loaded.verificationToken).toBeUndefined();
        expect(loaded.passwordResetToken).toBeUndefined();
        // The Resend verification button's cooldown reads this one
        expect(loaded.verificationTokenExpires).toBeInstanceOf(Date);
    });
});

describe('indexes', () => {
    // Mongoose creates these when the app starts. They keep the listing page,
    // a listing's comments and the account-deletion checks fast as data grows.
    async function indexKeys(Model) {
        await Model.syncIndexes();
        return (await Model.listIndexes()).map((index) => index.key);
    }

    test("a listing's comments are indexed, oldest first", async () => {
        expect(await indexKeys(Comment)).toContainEqual({ auction: 1, createdAt: 1 });
    });

    test('listings are indexed for the newest-first page, and by seller and top bidder', async () => {
        const keys = await indexKeys(Auction);

        expect(keys).toContainEqual({ createdAt: -1, _id: -1 });
        expect(keys).toContainEqual({ user: 1 });
        expect(keys).toContainEqual({ currentBidder: 1 });
    });

    test("a listing's messages are indexed oldest first, and by sender and recipient", async () => {
        const keys = await indexKeys(Message);

        expect(keys).toContainEqual({ auction: 1, createdAt: 1 });
        expect(keys).toContainEqual({ sender: 1 });
        expect(keys).toContainEqual({ recipient: 1 });
    });
});

describe('messages between the winner and the seller', () => {
    async function endedSale() {
        const seller = await makeUser({ email: 'seller@example.com', displayName: 'Lani' });
        const winner = await makeUser({ email: 'winner@example.com', displayName: 'Kai' });
        const lot = await makeAuction({
            user: seller._id,
            status: 'ended',
            endsAt: new Date(Date.now() - ONE_HOUR_MS),
            bidCount: 1,
            currentBid: 150,
            currentBidder: winner._id,
        });
        return { seller, winner, lot };
    }

    async function sendMessage(lot, sender, body) {
        const req = mockRequest({ params: { id: lot._id.toString() }, body: { body }, user: { id: sender._id.toString() } });
        const res = mockResponse();
        await runValidators(validateMessage, req);
        await auctionController.postMessage(req, res);
        return res;
    }

    async function openListing(lot, viewer) {
        const req = mockRequest({ params: { id: lot._id.toString() }, user: { id: viewer._id.toString() } });
        const res = mockResponse();
        await auctionController.getDetailedAuction(req, res);
        return res.renderedLocals.conversation;
    }

    test("the winner's message reaches the seller, and opening it marks it read", async () => {
        const { seller, winner, lot } = await endedSale();

        const res = await sendMessage(lot, winner, 'Pickup Saturday?');
        expect(res.redirectedTo).toBe(`/auction/viewAuction/${lot._id}#messages`);

        const conversation = await openListing(lot, seller);
        expect(conversation.other).toEqual({ displayName: 'Kai' });
        expect(conversation.messages.map((message) => message.body)).toEqual(['Pickup Saturday?']);

        const saved = await Message.findOne({ auction: lot._id }).lean();
        expect(saved.recipient.toString()).toBe(seller._id.toString());
        expect(saved.readAt).toBeInstanceOf(Date);
    });

    test("opening the listing doesn't mark your own messages as read", async () => {
        const { winner, lot } = await endedSale();
        await sendMessage(lot, winner, 'Pickup Saturday?');

        await openListing(lot, winner);

        expect((await Message.findOne({ auction: lot._id }).lean()).readAt).toBeNull();
    });
});

describe('deleting an account', () => {
    // The checks behind this use $gt and $in, which the sanitizeFilter guard
    // would quietly neutralize without mongoose.trusted(). Only a real
    // database shows whether they match.
    async function deleteAccount(user) {
        const req = mockRequest({ params: { id: user._id.toString() }, user });
        req.logout = (callback) => callback();
        const res = mockResponse();
        await profileController.deleteProfile(req, res);
        return res;
    }

    test("removes its listings with their comments, messages and bids, and nobody else's", async () => {
        const seller = await makeUser({ email: 'seller@example.com' });
        const buyer = new mongoose.Types.ObjectId();
        const ended = await makeAuction({ user: seller._id, status: 'ended', bidCount: 1, currentBid: 150, currentBidder: buyer });
        const fixed = await makeAuction({ user: seller._id, saleType: 'fixed', price: 40 });
        const someoneElses = await makeAuction();
        await Comment.create({ body: 'Still available?', user: buyer, auction: fixed._id });
        await Message.create({ body: 'Pickup Saturday?', sender: buyer, recipient: seller._id, auction: ended._id });
        await Bid.create({ auction: ended._id, user: buyer, amount: 150 });
        await Bid.create({ auction: someoneElses._id, user: buyer, amount: 150 });

        const res = await deleteAccount(seller);

        expect(res.redirectedTo).toBe('/');
        expect(await User.exists({ _id: seller._id })).toBeNull();
        expect(await Auction.countDocuments({ user: seller._id })).toBe(0);
        expect(await Comment.countDocuments({ auction: fixed._id })).toBe(0);
        expect(await Message.countDocuments({ auction: ended._id })).toBe(0);
        expect(await Bid.countDocuments({ auction: ended._id })).toBe(0);
        expect(await Auction.exists({ _id: someoneElses._id })).not.toBeNull();
        expect(await Bid.countDocuments({ auction: someoneElses._id })).toBe(1);
    });

    // A winner's conversations are on other people's listings, which stay
    test("removes the messages it sent and received on other people's listings, and nobody else's", async () => {
        const winner = await makeUser({ email: 'winner@example.com' });
        const seller = new mongoose.Types.ObjectId();
        const lot = await makeAuction({ user: seller, status: 'ended', bidCount: 1, currentBid: 150, currentBidder: winner._id });
        const otherLot = await makeAuction({ status: 'ended', bidCount: 1, currentBid: 90, currentBidder: new mongoose.Types.ObjectId() });
        await Message.create({ body: 'Pickup Saturday?', sender: winner._id, recipient: seller, auction: lot._id });
        await Message.create({ body: 'Saturday works.', sender: seller, recipient: winner._id, auction: lot._id });
        await Message.create({ body: 'Unrelated', sender: new mongoose.Types.ObjectId(), recipient: new mongoose.Types.ObjectId(), auction: otherLot._id });

        await deleteAccount(winner);

        expect(await Message.countDocuments({ auction: lot._id })).toBe(0);
        expect(await Message.countDocuments({ auction: otherLot._id })).toBe(1);
        expect(await Auction.exists({ _id: lot._id })).not.toBeNull();
    });

    test('is refused while the account has an open auction with bids', async () => {
        const seller = await makeUser({ email: 'seller@example.com' });
        const lot = await makeAuction({
            user: seller._id,
            bidCount: 1,
            currentBid: 150,
            currentBidder: new mongoose.Types.ObjectId(),
        });

        const res = await deleteAccount(seller);

        expect(res.redirectedTo).toBe('/profile');
        expect(await User.exists({ _id: seller._id })).not.toBeNull();
        expect(await Auction.exists({ _id: lot._id })).not.toBeNull();
    });

    test('is refused while the account is the top bidder on an open auction', async () => {
        const bidder = await makeUser();
        await makeAuction({ bidCount: 1, currentBid: 150, currentBidder: bidder._id });

        const res = await deleteAccount(bidder);

        expect(res.redirectedTo).toBe('/profile');
        expect(await User.exists({ _id: bidder._id })).not.toBeNull();
    });
});
