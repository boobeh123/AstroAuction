jest.mock('../../models/User');
// Only the transport is faked. The real templates in config/mailer.js run,
// so these tests see the exact HTML a user would receive.
jest.mock('nodemailer');

const nodemailer = require('nodemailer');
const User = require('../../models/User');
const authController = require('../../controllers/auth');
const { mockRequest, mockResponse } = require('./helpers-mocks');

/**
 * Verification and password reset links are keys to someone's account.
 *
 * They used to be built from the request's Host header, which whoever sends
 * the request controls. A forged Host on a password reset request would email
 * the real account owner a working reset link pointing at someone else's
 * site. These tests pin every emailed link to APP_URL.
 */
const APP_URL = 'https://astroauction.up.railway.app';
const FORGED_HOST = 'evil.example';
const originalAppUrl = process.env.APP_URL;

let sendMail;

beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_URL = APP_URL;
    sendMail = jest.fn().mockResolvedValue({});
    nodemailer.createTransport.mockReturnValue({ sendMail });
});

afterAll(() => {
    if (originalAppUrl === undefined) {
        delete process.env.APP_URL;
    } else {
        process.env.APP_URL = originalAppUrl;
    }
});

// A request whose Host header has been tampered with.
function forgedHostRequest(overrides = {}) {
    const req = mockRequest(overrides);
    req.protocol = 'https';
    req.get = jest.fn((header) => (header.toLowerCase() === 'host' ? FORGED_HOST : undefined));
    return req;
}

function emailedHtml() {
    expect(sendMail).toHaveBeenCalledTimes(1);
    return sendMail.mock.calls[0][0].html;
}

describe('passwords must be at least 8 characters', () => {
    const SEVEN_CHARS = 'abc1234';

    test('postSignup rejects a 7-character password before touching the database', async () => {
        const req = mockRequest({
            body: { email: 'newbidder@example.com', password: SEVEN_CHARS, confirmPassword: SEVEN_CHARS },
        });
        const res = mockResponse();

        await authController.postSignup(req, res, jest.fn());

        expect(req.flashed.errors[0]).toContainEqual({ msg: 'Password must be at least 8 characters long' });
        expect(User.findOne).not.toHaveBeenCalled();
        expect(res.redirect).toHaveBeenCalledTimes(1);
    });

    test('postResetPassword rejects a 7-character password before looking up the token', async () => {
        const req = mockRequest({
            params: { token: 'abc123' },
            body: { password: SEVEN_CHARS, confirmPassword: SEVEN_CHARS },
        });
        const res = mockResponse();

        await authController.postResetPassword(req, res, jest.fn());

        expect(req.flashed.errors[0]).toContainEqual({ msg: 'Password must be at least 8 characters long.' });
        expect(User.findOne).not.toHaveBeenCalled();
        expect(res.redirectedTo).toBe('/recover/abc123');
    });
});

describe('emailed links ignore the Host header', () => {
    test('postSignup builds the verification link from APP_URL', async () => {
        User.findOne.mockResolvedValue(null);

        // req.login takes a callback, and the email is sent inside it, so the
        // test waits on that callback rather than on postSignup alone.
        let loginCallbackDone;
        const req = forgedHostRequest({
            body: {
                email: 'newbidder@example.com',
                password: 'correct-horse',
                confirmPassword: 'correct-horse',
            },
        });
        req.login = jest.fn((user, callback) => {
            loginCallbackDone = callback();
        });
        const res = mockResponse();

        await authController.postSignup(req, res, jest.fn());
        await loginCallbackDone;

        const html = emailedHtml();
        expect(html).toContain(`href="${APP_URL}/verify/`);
        expect(html).not.toContain(FORGED_HOST);
        expect(res.redirectedTo).toBe('/onboard');
    });

    test('postResendVerification builds the verification link from APP_URL', async () => {
        User.findByIdAndUpdate.mockResolvedValue({});
        const req = forgedHostRequest({
            user: { _id: 'abc123', email: 'bidder@example.com', emailVerified: false },
        });
        const res = mockResponse();

        await authController.postResendVerification(req, res);

        const html = emailedHtml();
        expect(html).toContain(`href="${APP_URL}/verify/`);
        expect(html).not.toContain(FORGED_HOST);
        expect(res.redirectedTo).toBe('/profile');
    });

    test('postForgetPassword builds the reset link from APP_URL', async () => {
        User.findOne.mockResolvedValue({
            email: 'bidder@example.com',
            save: jest.fn().mockResolvedValue(),
        });
        const req = forgedHostRequest({ body: { email: 'bidder@example.com' } });
        const res = mockResponse();

        await authController.postForgetPassword(req, res);

        const html = emailedHtml();
        expect(html).toContain(`href="${APP_URL}/recover/`);
        expect(html).not.toContain(FORGED_HOST);
        expect(res.redirectedTo).toBe('/recover');
    });
});
