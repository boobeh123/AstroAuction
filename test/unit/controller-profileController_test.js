jest.mock('../../model/User');
jest.mock('../../model/Auction');
jest.mock('../../model/Message');
jest.mock('../../config/cloudinary');
jest.mock('../../services/listingCleanup');

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const User = require('../../model/User');
const Auction = require('../../model/Auction');
const Message = require('../../model/Message');
const cloudinary = require('../../config/cloudinary');
const { deleteListings } = require('../../services/listingCleanup');
const profileController = require('../../controller/profileController');
const { validateProfileEdit } = require('../../middleware/validators');
const { mockRequest, mockResponse, mockQuery, runValidators } = require('./helpers-mocks');

const USER_ID = '507f1f77bcf86cd799439013';

// Runs the route's validators first, the way Express does
async function updateProfile(userName) {
    const req = mockRequest({ params: { id: USER_ID }, body: { userName }, user: { _id: USER_ID } });
    const res = mockResponse();
    await runValidators(validateProfileEdit, req);
    await profileController.updateProfile(req, res);
    return { req, res };
}

beforeEach(() => {
    jest.clearAllMocks();
    User.findByIdAndUpdate.mockResolvedValue({});
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('updateProfile', () => {
    // The edit form names its display name field "userName"
    test('saves the trimmed name from the form', async () => {
        const { res } = await updateProfile('  Lani  ');

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(USER_ID, { displayName: 'Lani' });
        expect(res.redirectedTo).toBe('/profile');
    });

    test.each([
        ['an empty name', '', 'Please enter a display name.'],
        ['a 26-character name', 'x'.repeat(26), 'Display name cannot be longer than 25 characters.'],
        ['a list instead of text', ['Lani', 'Kai'], 'Please enter a display name.'],
    ])('sends %s back to the form', async (_label, userName, message) => {
        const { req, res } = await updateProfile(userName);

        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(res.redirectedTo).toBe('/profile/edit');
        expect(req.flashed.errors).toContainEqual({ msg: message });
    });
});

describe('uploadProfilePicture', () => {
    const NEW_PHOTO = { secure_url: 'https://res.cloudinary.com/demo/new.jpg', public_id: 'new-photo' };
    let tempFile;

    // A real temp file, like the one multer writes, so the tests can check
    // that it's removed afterwards
    beforeEach(async () => {
        tempFile = path.join(os.tmpdir(), `profile-photo-test-${process.pid}-${Date.now()}`);
        await fs.writeFile(tempFile, 'not really a photo');
        User.findById.mockReturnValue(mockQuery({ _id: USER_ID, cloudinaryId: 'old-photo' }));
        cloudinary.uploader.upload.mockResolvedValue(NEW_PHOTO);
        cloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(async () => {
        await fs.rm(tempFile, { force: true });
    });

    function uploadRequest(file = { path: tempFile }) {
        return mockRequest({ user: { id: USER_ID }, file });
    }

    const exists = (file) => fs.access(file).then(() => true, () => false);

    test('saves the new photo, then deletes the old one', async () => {
        const res = mockResponse();
        await profileController.uploadProfilePicture(uploadRequest(), res);

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(USER_ID, {
            image: NEW_PHOTO.secure_url,
            cloudinaryId: 'new-photo',
        });
        expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('old-photo');
        // The old photo is deleted only once the new one is saved
        expect(cloudinary.uploader.destroy.mock.invocationCallOrder[0])
            .toBeGreaterThan(User.findByIdAndUpdate.mock.invocationCallOrder[0]);
        expect(res.redirectedTo).toBe('/profile');
        expect(await exists(tempFile)).toBe(false);
    });

    // The form requires a file, but a request doesn't have to come from the
    // form. This used to delete the current photo, then crash with a 500.
    test('without a file, keeps the current photo and asks for one', async () => {
        const req = uploadRequest(null);
        const res = mockResponse();
        await profileController.uploadProfilePicture(req, res);

        expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
        expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
        expect(res.redirectedTo).toBe('/profile');
        expect(req.flashed.errors[0].msg).toMatch(/choose a photo/i);
    });

    test('when the upload fails, keeps the current photo', async () => {
        cloudinary.uploader.upload.mockRejectedValue(new Error('Cloudinary is down'));

        await expect(profileController.uploadProfilePicture(uploadRequest(), mockResponse()))
            .rejects.toThrow('Cloudinary is down');

        expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(await exists(tempFile)).toBe(false);
    });

    // The new photo is already saved by then, so this isn't worth an error page
    test('logs an old photo that fails to delete, and carries on', async () => {
        cloudinary.uploader.destroy.mockRejectedValue(new Error('Cloudinary is down'));

        const res = mockResponse();
        await profileController.uploadProfilePicture(uploadRequest(), res);

        expect(res.redirectedTo).toBe('/profile');
        expect(console.error).toHaveBeenCalled();
    });

    test('a first photo has no old one to delete', async () => {
        User.findById.mockReturnValue(mockQuery({ _id: USER_ID, cloudinaryId: '' }));

        await profileController.uploadProfilePicture(uploadRequest(), mockResponse());

        expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
        expect(User.findByIdAndUpdate).toHaveBeenCalled();
    });
});

describe('deleteProfile', () => {
    const LISTINGS = [{ _id: 'lamp', cloudinaryIds: ['lamp-1'] }];

    function deleteRequest(id = USER_ID) {
        const req = mockRequest({ params: { id }, user: { _id: USER_ID } });
        req.logout = jest.fn((callback) => callback());
        return req;
    }

    beforeEach(() => {
        User.findById.mockReturnValue(mockQuery({ _id: USER_ID, cloudinaryId: 'avatar-1' }));
        User.deleteOne.mockResolvedValue({});
        Auction.exists.mockResolvedValue(null);
        Auction.find.mockReturnValue(mockQuery(LISTINGS));
        deleteListings.mockResolvedValue();
        Message.deleteMany.mockResolvedValue({});
        cloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });
    });

    test("deletes the user's listings, messages, profile photo and account, then logs them out", async () => {
        const req = deleteRequest();
        const res = mockResponse();
        await profileController.deleteProfile(req, res);

        expect(deleteListings).toHaveBeenCalledWith(LISTINGS);
        expect(Message.deleteMany).toHaveBeenCalledWith({ $or: [{ sender: USER_ID }, { recipient: USER_ID }] });
        expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('avatar-1');
        expect(User.deleteOne).toHaveBeenCalledWith({ _id: USER_ID });
        expect(req.logout).toHaveBeenCalled();
        expect(res.redirectedTo).toBe('/');
    });

    // Bidders on their open auction, or the seller whose auction they are
    // winning, are still waiting on this account.
    test('refuses while the user is in the middle of an auction', async () => {
        Auction.exists.mockResolvedValue({ _id: 'lamp' });

        const req = deleteRequest();
        const res = mockResponse();
        await profileController.deleteProfile(req, res);

        expect(res.redirectedTo).toBe('/profile');
        expect(req.flashed.errors[0].msg).toMatch(/can't delete your account/i);
        expect(deleteListings).not.toHaveBeenCalled();
        expect(Message.deleteMany).not.toHaveBeenCalled();
        expect(User.deleteOne).not.toHaveBeenCalled();
    });

    test('looks for open auctions that have bids or that the user is winning', async () => {
        await profileController.deleteProfile(deleteRequest(), mockResponse());

        const filter = Auction.exists.mock.calls[0][0];
        expect(filter.saleType).toBe('auction');
        expect(filter.status).toBe('open');
        expect(filter.$or[0].user).toBe(USER_ID);
        expect(filter.$or[0].bidCount.$gt).toBe(0);
        expect(filter.$or[1].currentBidder).toBe(USER_ID);
    });

    // The 403 page explains the refusal. The flash message it used to set as
    // well only showed up later, on whatever page the user opened next.
    test("refuses another user's account with the 403 page alone", async () => {
        const req = deleteRequest('507f1f77bcf86cd799439099');
        const res = mockResponse();
        await profileController.deleteProfile(req, res);

        expect(res.statusCode).toBe(403);
        expect(res.rendered).toBe('errors/403.ejs');
        expect(req.flash).not.toHaveBeenCalled();
        expect(User.deleteOne).not.toHaveBeenCalled();
    });
});
