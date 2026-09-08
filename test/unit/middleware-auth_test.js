const { ensureAuth } = require('../../middleware/auth');
const { mockRequest, mockResponse } = require('./helpers-mocks');

describe('ensureAuth', () => {
    test('calls next() for an authenticated request', () => {
        const req = mockRequest({ isAuthenticated: () => true });
        const res = mockResponse();
        const next = jest.fn();

        ensureAuth(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.redirect).not.toHaveBeenCalled();
    });

    test('redirects an unauthenticated request to the home page', () => {
        const req = mockRequest({ isAuthenticated: () => false });
        const res = mockResponse();
        const next = jest.fn();

        ensureAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.redirectedTo).toBe('/');
    });

    // The guard must not fall through to next() on a redirect. If it did, the
    // controller would run anyway and hit `req.user.id` on a null user,
    // throwing a 500 instead of cleanly bouncing the visitor home.
    test('never both redirects and continues', () => {
        const req = mockRequest({ isAuthenticated: () => false });
        const res = mockResponse();
        const next = jest.fn();

        ensureAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.redirect).toHaveBeenCalledTimes(1);
    });

    test('relies on isAuthenticated() rather than the presence of req.user', () => {
        // Passport sets both, but the contract is isAuthenticated(). A session
        // that is present but not authenticated must still be rejected.
        const req = mockRequest({
            user: { id: 'abc123' },
            isAuthenticated: () => false,
        });
        const res = mockResponse();
        const next = jest.fn();

        ensureAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.redirectedTo).toBe('/');
    });
});
