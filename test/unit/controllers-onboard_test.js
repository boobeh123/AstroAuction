jest.mock('../../model/User');

const User = require('../../model/User');
const onboardController = require('../../controllers/onboard');
const { validateOnboard } = require('../../middleware/validators');
const { mockRequest, mockResponse, runValidators } = require('./helpers-mocks');

const USER_ID = '507f1f77bcf86cd799439013';

// Runs the route's validators first, the way Express does
async function postOnboard(displayName, user = { id: USER_ID, onboardingComplete: false }) {
    const req = mockRequest({ body: { displayName }, user });
    const res = mockResponse();
    await runValidators(validateOnboard, req);
    await onboardController.postOnboard(req, res);
    return { req, res };
}

beforeEach(() => {
    jest.clearAllMocks();
    User.findByIdAndUpdate.mockResolvedValue({});
});

describe('postOnboard', () => {
    test('saves the trimmed display name and finishes onboarding', async () => {
        const { res } = await postOnboard('  Kai  ');

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(USER_ID, {
            displayName: 'Kai',
            onboardingComplete: true,
        });
        expect(res.redirectedTo).toBe('/auction');
    });

    // The onboarding page tells people names are 2 to 25 characters, but
    // the server used to accept a single character.
    test('sends a 1-character name back to the form', async () => {
        const { req, res } = await postOnboard('K');

        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(res.redirectedTo).toBe('/onboard');
        expect(req.flashed.errors).toContainEqual({ msg: 'Display name must be at least 2 characters.' });
    });

    test('sends someone who already finished onboarding to the home page', async () => {
        const { res } = await postOnboard('Kai', { id: USER_ID, onboardingComplete: true });

        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(res.redirectedTo).toBe('/');
    });
});
