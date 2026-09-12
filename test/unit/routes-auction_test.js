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
const LOT = '507f1f77bcf86cd799439011';

function buildApp({ authenticated, role = 'user' }) {
    const app = express();
    app.use(express.urlencoded({ extended: true }));

    // Stands in for Passport. ensureAuth reads isAuthenticated(); the newer
    // ensureAuctioneer reads req.user.role, so both have to be simulated here.
    app.use((req, res, next) => {
        req.isAuthenticated = () => authenticated;
        req.user = authenticated ? { id: '507f1f77bcf86cd799439013', role } : null;
        req.flash = () => {};
        next();
    });

    // Required after the middleware above so the router picks up the fake
    // auth state rather than a real session.
    const auctionRoutes = require('../../routes/auction');
    app.use('/auction', auctionRoutes);

    // ensureAuctioneer renders errors/403.ejs on rejection. No view engine is
    // configured here, so that render throws — this catches it and reports
    // the status the middleware actually chose, which is what's under test.
    // Without it a legitimate 403 would surface as a confusing 500.
    app.use((err, req, res, next) => {
        res.status(res.statusCode === 403 ? 403 : 500).send('render failed');
    });

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
            .get(`/auction/viewAuction/${LOT}`)
            .expect(200);

        expect(auctionController.getDetailedAuction).toHaveBeenCalled();
    });
});

describe('guarded routes reject anonymous requests', () => {
    // Every one of these mutates data or spends money. None may run for a
    // visitor who is not logged in. ensureAuth redirects rather than 401s,
    // so a 302 to /login is the expected rejection.
    test.each([
        ['POST', '/auction', 'postAuction'],
        ['POST', `/auction/postComment/${LOT}`, 'postComment'],
        ['POST', `/auction/postBid/${LOT}`, 'postBid'],
        ['POST', `/auction/toggleSpotlight/${LOT}`, 'postToggleHighlight'],
        ['DELETE', `/auction/deleteAuction/${LOT}`, 'deleteAuction'],
    ])('%s %s is blocked', async (method, path, handlerName) => {
        const app = buildApp({ authenticated: false });
        const res = await request(app)[method.toLowerCase()](path);

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');

        // The critical assertion: the handler must never have been entered.
        expect(auctionController[handlerName]).not.toHaveBeenCalled();
    });
});

describe('guarded routes admit authenticated requests', () => {
    test('POST /auction/postBid/:id reaches postBid when logged in', async () => {
        await request(buildApp({ authenticated: true }))
            .post(`/auction/postBid/${LOT}`)
            .send({ amount: '150' })
            .expect(200);

        expect(auctionController.postBid).toHaveBeenCalled();
    });

    test('POST /auction/postComment/:id reaches postComment when logged in', async () => {
        await request(buildApp({ authenticated: true }))
            .post(`/auction/postComment/${LOT}`)
            .send({ body: 'Is this available?' })
            .expect(200);

        expect(auctionController.postComment).toHaveBeenCalled();
    });

    test('DELETE /auction/deleteAuction/:id reaches deleteAuction when logged in', async () => {
        await request(buildApp({ authenticated: true }))
            .delete(`/auction/deleteAuction/${LOT}`)
            .expect(200);

        expect(auctionController.deleteAuction).toHaveBeenCalled();
    });
});

describe('spotlight route is gated by role, not just by login', () => {
    // The button is hidden from non-auctioneers in the template, but hiding a
    // button is not access control — anyone can POST to the URL directly.
    // These tests are what prove the endpoint itself is protected.
    test('an ordinary logged-in user cannot toggle the spotlight', async () => {
        const res = await request(buildApp({ authenticated: true, role: 'user' }))
            .post(`/auction/toggleSpotlight/${LOT}`);

        expect(res.status).toBe(403);
        expect(auctionController.postToggleHighlight).not.toHaveBeenCalled();
    });

    test('a user with no role cannot toggle the spotlight', async () => {
        const res = await request(buildApp({ authenticated: true, role: undefined }))
            .post(`/auction/toggleSpotlight/${LOT}`);

        expect(res.status).toBe(403);
        expect(auctionController.postToggleHighlight).not.toHaveBeenCalled();
    });

    test('an admin can toggle the spotlight', async () => {
        await request(buildApp({ authenticated: true, role: 'admin' }))
            .post(`/auction/toggleSpotlight/${LOT}`)
            .expect(200);

        expect(auctionController.postToggleHighlight).toHaveBeenCalled();
    });

    test('an auctioneer can toggle the spotlight', async () => {
        await request(buildApp({ authenticated: true, role: 'auctioneer' }))
            .post(`/auction/toggleSpotlight/${LOT}`)
            .expect(200);

        expect(auctionController.postToggleHighlight).toHaveBeenCalled();
    });

    // Order matters: ensureAuth must run before ensureAuctioneer. If they were
    // swapped, an anonymous request would hit the role check first and get a
    // 403 instead of being sent to log in — and ensureAuctioneer would be
    // reading .role off a null user.
    test('anonymous requests are redirected to login, not 403d', async () => {
        const res = await request(buildApp({ authenticated: false, role: 'admin' }))
            .post(`/auction/toggleSpotlight/${LOT}`);

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
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
            .post(`/auction/postBid/${LOT}`)
            .send({ amount: '150' });

        expect(captured).toBe(LOT);
    });

    test('bids, comments and spotlight are separate endpoints', async () => {
        const app = buildApp({ authenticated: true, role: 'admin' });

        await request(app).post(`/auction/postBid/${LOT}`).send({ amount: '150' });
        await request(app).post(`/auction/postComment/${LOT}`).send({ body: 'hi' });
        await request(app).post(`/auction/toggleSpotlight/${LOT}`);

        expect(auctionController.postBid).toHaveBeenCalledTimes(1);
        expect(auctionController.postComment).toHaveBeenCalledTimes(1);
        expect(auctionController.postToggleHighlight).toHaveBeenCalledTimes(1);
    });
});

describe('unmatched routes', () => {
    test('an undefined method on a known path is not handled', async () => {
        const res = await request(buildApp({ authenticated: true }))
            .put(`/auction/postBid/${LOT}`);

        expect(res.status).toBe(404);
    });

    // These were the paths before the routes were renamed. Asserting they no
    // longer resolve is what makes this suite catch a view still posting to
    // an old URL — a form pointing at a dead route fails silently with a 404
    // page and nothing in the logs to explain it.
    test('the pre-rename bid and comment paths no longer resolve', async () => {
        const app = buildApp({ authenticated: true });

        const bids = await request(app).post(`/auction/viewAuction/${LOT}/bids`);
        const comments = await request(app).post(`/auction/viewAuction/${LOT}/comments`);

        expect(bids.status).toBe(404);
        expect(comments.status).toBe(404);
    });
});
