/**
 * Test doubles shared across the unit suites.
 *
 * These deliberately avoid a real database. The one place that genuinely
 * needs MongoDB is __tests__/integration/bidding_test.js, where the whole
 * point is observing real concurrent writes. Everything else is faster and
 * more precise with the data layer mocked.
 */

/**
 * A minimal stand-in for an Express response.
 *
 * status() and render() return `this` so chained calls like
 * res.status(404).render(...) work exactly as they do in the controllers.
 * Every call is recorded so tests can assert on what the handler actually did.
 */
function mockResponse() {
    const res = {
        statusCode: null,
        rendered: null,
        renderedLocals: null,
        redirectedTo: null,
        headersSent: false,
    };

    res.status = jest.fn((code) => {
        res.statusCode = code;
        return res;
    });

    res.render = jest.fn((view, locals) => {
        res.rendered = view;
        res.renderedLocals = locals || null;
        return res;
    });

    res.redirect = jest.fn((url) => {
        res.redirectedTo = url;
        return res;
    });

    return res;
}

/**
 * A minimal stand-in for an Express request.
 *
 * flash() records messages by key rather than discarding them, so tests can
 * assert that the user was told *why* something was rejected — not just that
 * a redirect happened.
 */
function mockRequest(overrides = {}) {
    const flashed = {};

    const req = {
        params: {},
        body: {},
        query: {},
        user: null,
        files: undefined,
        file: undefined,
        flashed,
        ...overrides,
    };

    req.flash = jest.fn((key, value) => {
        if (!flashed[key]) flashed[key] = [];
        flashed[key].push(value);
    });

    req.isAuthenticated = req.isAuthenticated || jest.fn(() => Boolean(req.user));

    return req;
}

/**
 * Builds a mock of Mongoose's chainable query API.
 *
 * Calls like Auction.findById(id).populate(...).lean() return a thenable
 * query object, not a promise, until the chain terminates. This reproduces
 * that shape: every chain method returns the same object, and awaiting it
 * resolves to `result`.
 */
function mockQuery(result) {
    const query = {
        populate: jest.fn(() => query),
        lean: jest.fn(() => query),
        select: jest.fn(() => query),
        sort: jest.fn(() => query),
        limit: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
        catch: (reject) => Promise.resolve(result).catch(reject),
    };

    return query;
}

module.exports = { mockResponse, mockRequest, mockQuery };
