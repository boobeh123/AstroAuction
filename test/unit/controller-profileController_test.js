jest.mock('../../model/User');
jest.mock('../../middleware/cloudinary');

const User = require('../../model/User');
const profileController = require('../../controller/profileController');
const { validateProfileEdit } = require('../../middleware/validators');
const { mockRequest, mockResponse, runValidators } = require('./helpers-mocks');

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
