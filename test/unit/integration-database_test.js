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

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const connectDB = require('../../config/database');
const mailer = require('../../config/mailer');
const cloudinary = require('../../middleware/cloudinary');
const Auction = require('../../model/Auction');
const User = require('../../model/User');
const auctionController = require('../../controllers/auction');
const authController = require('../../controllers/auth');
const { closeExpiredAuctions } = require('../../services/auctionCloser');
const { validateBid, validateListing, validateResetPassword } = require('../../middleware/validators');
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
