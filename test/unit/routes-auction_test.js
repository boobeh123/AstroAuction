jest.mock('../../controllers/auction');

const express = require('express');
const request = require('supertest');
const auctionController = require('../../controllers/auction');

/**
 * These tests answer one question: is each route wired to the middleware it
 * is supposed to be wired to?
 *
 * That is a security property, not a cosmetic one. A controller can contain
 * perfect ownership and validation logic and still be wide open if someone
 * drops `ensureAuth` from the route while refactoring. Nothing in the
 * controller unit tests would catch that — the guard lives in the router.
 *
 * The controllers are mocked to bare 200 responses so a failure here can only
 * mean the wiring is wrong, never that a handler misbehaved.
 */
function buildApp({ authenticated }) {
    const app = express();
    app.use(express.urlencoded({ extended: true }));

    // Stand in for Passport. The real ensureAuth calls req.isAuthenticated(),
    // so this is the only thing it needs to make a decision.
    app.use((req, res, next) => {
        req.isAuthenticated = () => authenticated;
        req.user = authenticated ? { id: '507f1f77bcf86cd799439013' } : null;
        req.flash = () => {};
        next();
    });

    // Required after the middleware above so the router picks up the fake
    // auth state rather than a real session.
    const auctionRoutes = require('../../routes/auction');
    app.use('/auction', auctionRoutes);

    return app;
}

beforeEach(() => {
    jest.clearAllMocks();

    Object.keys(auctionController).forEach((handler) => {
        auctionController[handler].mockImplementation((req, res) => res.status(200).send('ok'));
    });
});

describe('public routes', () => {
    test('GET /auction is reachable without logging in', async () => {
        await request(buildApp({ authenticated: false })).get('/auction').expect(200);

        expect(auctionController.getAuction).toHaveBeenCalled();
    });

    test('GET /auction/viewAuction/:id is reachable without logging in', async () => {
        // Browsing has to stay open — requiring an account to look at listings
        // would defeat the point of a public marketplace.
        await request(buildApp({ authenticated: false }))
            .get('/auction/viewAuction/507f1f77bcf86cd799439011')
            .expect(200);

        expect(auctionController.getDetailedAuction).toHaveBeenCalled();
    });
});

describe('guarded routes reject anonymous requests', () => {
    // Every one of these mutates data or spends money. None may run for a
    // visitor who is not logged in. ensureAuth redirects rather than 401s,
    // so a 302 to / is the expected rejection.
    test.each([
        ['POST', '/auction', 'postAuction'],
        ['POST', '/auction/viewAuction/507f1f77bcf86cd799439011/comments', 'postComment'],
        ['POST', '/auction/viewAuction/507f1f77bcf86cd799439011/bids', 'postBid'],
        ['DELETE', '/auction/deleteAuction/507f1f77bcf86cd799439011', 'deleteAuction'],
    ])('%s %s is blocked', async (method, path, handlerName) => {
        const app = buildApp({ authenticated: false });
        const res = await request(app)[method.toLowerCase()](path);

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/');

        // The critical assertion: the handler must never have been entered.
        expect(auctionController[handlerName]).not.toHaveBeenCalled();
    });
});

describe('guarded routes admit authenticated requests', () => {
    test('POST /auction/viewAuction/:id/bids reaches postBid when logged in', async () => {
        await request(buildApp({ authenticated: true }))
            .post('/auction/viewAuction/507f1f77bcf86cd799439011/bids')
            .send({ amount: '150' })
            .expect(200);

        expect(auctionController.postBid).toHaveBeenCalled();
    });

    test('POST /auction/viewAuction/:id/comments reaches postComment when logged in', async () => {
        await request(buildApp({ authenticated: true }))
            .post('/auction/viewAuction/507f1f77bcf86cd799439011/comments')
            .send({ body: 'Is this available?' })
            .expect(200);

        expect(auctionController.postComment).toHaveBeenCalled();
    });

    test('DELETE /auction/deleteAuction/:id reaches deleteAuction when logged in', async () => {
        await request(buildApp({ authenticated: true }))
            .delete('/auction/deleteAuction/507f1f77bcf86cd799439011')
            .expect(200);

        expect(auctionController.deleteAuction).toHaveBeenCalled();
    });
});

describe('route parameters', () => {
    test('the listing id reaches the handler as req.params.id', async () => {
        let captured = null;
        auctionController.postBid.mockImplementation((req, res) => {
            captured = req.params.id;
            res.status(200).send('ok');
        });

        await request(buildApp({ authenticated: true }))
            .post('/auction/viewAuction/507f1f77bcf86cd799439011/bids')
            .send({ amount: '150' });

        expect(captured).toBe('507f1f77bcf86cd799439011');
    });

    test('bids and comments are separate endpoints on the same listing', async () => {
        const app = buildApp({ authenticated: true });

        await request(app).post('/auction/viewAuction/507f1f77bcf86cd799439011/bids').send({ amount: '150' });
        await request(app).post('/auction/viewAuction/507f1f77bcf86cd799439011/comments').send({ body: 'hi' });

        expect(auctionController.postBid).toHaveBeenCalledTimes(1);
        expect(auctionController.postComment).toHaveBeenCalledTimes(1);
    });
});

describe('unmatched routes', () => {
    test('an undefined method on a known path is not handled', async () => {
        const res = await request(buildApp({ authenticated: true }))
            .put('/auction/viewAuction/507f1f77bcf86cd799439011/bids');

        expect(res.status).toBe(404);
    });
});
