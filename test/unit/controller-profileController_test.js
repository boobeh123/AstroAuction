jest.mock('../../model/User');
jest.mock('../../model/Auction');
jest.mock('../../config/cloudinary');
jest.mock('../../services/listingCleanup');

const User = require('../../model/User');
const Auction = require('../../model/Auction');
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
        cloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });
    });

    test("deletes the user's listings, profile photo and account, then logs them out", async () => {
        const req = deleteRequest();
        const res = mockResponse();
        await profileController.deleteProfile(req, res);

        expect(deleteListings).toHaveBeenCalledWith(LISTINGS);
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
