const { ensureAuth, ensureAuctioneer } = require('../../middleware/auth');
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

    test('redirects an unauthenticated request to the login page', () => {
        const req = mockRequest({ isAuthenticated: () => false });
        const res = mockResponse();
        const next = jest.fn();

        ensureAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.redirectedTo).toBe('/login');
    });

    // The guard must not fall through to next() on a redirect. If it did, the
    // controller would run anyway and hit `req.user.id` on a null user,
    // throwing a 500 instead of cleanly bouncing the visitor to login.
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
        expect(res.redirectedTo).toBe('/login');
    });
});

describe('ensureAuctioneer', () => {
    function run(user) {
        const req = mockRequest({ user, isAuthenticated: () => Boolean(user) });
        const res = mockResponse();
        const next = jest.fn();

        ensureAuctioneer(req, res, next);

        return { req, res, next };
    }

    test('admits an admin', () => {
        const { res, next } = run({ id: 'a1', role: 'admin' });

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.render).not.toHaveBeenCalled();
    });

    test('admits an auctioneer', () => {
        const { res, next } = run({ id: 'a2', role: 'auctioneer' });

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.render).not.toHaveBeenCalled();
    });

    // The default role assigned at signup. Every ordinary account holds this,
    // so this is the case that actually protects the endpoint.
    test('rejects the default user role with 403', () => {
        const { res, next } = run({ id: 'u1', role: 'user' });

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
        expect(res.rendered).toBe('errors/403.ejs');
    });

    // Accounts created before the role field was added to UserSchema have no
    // role at all. Those must fail closed, not fall through on a loose check.
    test('rejects a user with no role field at all', () => {
        const { res, next } = run({ id: 'u2' });

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
    });

    test('rejects an unrecognised role', () => {
        // Guards against a typo made while editing the value directly in
        // Atlas — 'admn' must not somehow satisfy the check.
        const { res, next } = run({ id: 'u3', role: 'admn' });

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
    });

    // Should never happen in practice, since ensureAuth runs first and would
    // have redirected already. Asserted anyway so the middleware can't throw
    // on a null dereference if it were ever mounted without that guard.
    test('rejects a request with no user rather than throwing', () => {
        const req = mockRequest({ user: null });
        const res = mockResponse();
        const next = jest.fn();

        expect(() => ensureAuctioneer(req, res, next)).not.toThrow();
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
    });

    test('is case-sensitive about the role value', () => {
        // MongoDB stores exactly what you type. 'Admin' with a capital A is a
        // different string and must not pass.
        const { next } = run({ id: 'u4', role: 'Admin' });

        expect(next).not.toHaveBeenCalled();
    });
});
