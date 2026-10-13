const express = require('express');
const request = require('supertest');

/**
 * Rate limits on the account forms. Without them, a script can try passwords
 * against the login form as fast as the server answers, or make the signup
 * and reset forms send thousands of emails from the AstroAuction address.
 * Comments and bids are limited too, per account, so one account can't
 * flood a listing.
 *
 * Each test loads the limiters fresh, because their counts live in memory
 * and would otherwise carry over from one test to the next.
 */
let loginLimiter;
let authLimiter;
let commentLimiter;
let messageLimiter;
let bidLimiter;

beforeEach(() => {
    jest.resetModules();
    ({ loginLimiter, authLimiter, commentLimiter, messageLimiter, bidLimiter } = require('../../middleware/rateLimiters'));
});

// A one-route app with stand-ins for what Passport and the view engine
// provide in the real app.
function buildApp(limiter, { loginSucceeds = false } = {}) {
    const app = express();
    app.set('trust proxy', 1);
    app.use((req, res, next) => {
        req.isAuthenticated = () => loginSucceeds;
        res.render = (view) => res.send(`rendered ${view}`);
        next();
    });
    app.post('/form', limiter, (req, res) => res.redirect('/next'));
    return app;
}

async function postTimes(app, times, ip = '203.0.113.1') {
    const responses = [];
    for (let i = 0; i < times; i++) {
        responses.push(await request(app).post('/form').set('X-Forwarded-For', ip));
    }
    return responses;
}

describe('loginLimiter', () => {
    test('allows 10 failed logins, then shows the "too many attempts" page', async () => {
        const app = buildApp(loginLimiter);

        const allowed = await postTimes(app, 10);
        const [blocked] = await postTimes(app, 1);

        expect(allowed.every((response) => response.status === 302)).toBe(true);
        expect(blocked.status).toBe(429);
        expect(blocked.text).toBe('rendered errors/429.ejs');
    });

    test('never counts successful logins', async () => {
        const app = buildApp(loginLimiter, { loginSucceeds: true });

        const responses = await postTimes(app, 15);

        expect(responses.every((response) => response.status === 302)).toBe(true);
    });
});

describe('authLimiter', () => {
    test('allows 20 requests, then shows the "too many attempts" page', async () => {
        const app = buildApp(authLimiter);

        const allowed = await postTimes(app, 20);
        const [blocked] = await postTimes(app, 1);

        expect(allowed.every((response) => response.status === 302)).toBe(true);
        expect(blocked.status).toBe(429);
        expect(blocked.text).toBe('rendered errors/429.ejs');
    });

    test('counts each IP address separately', async () => {
        const app = buildApp(authLimiter);
        await postTimes(app, 21, '203.0.113.1');

        const [otherVisitor] = await postTimes(app, 1, '203.0.113.2');

        expect(otherVisitor.status).toBe(302);
    });
});

describe('comments, messages and bids are limited per account', () => {
    // Everyone at the store shares one IP address, so these count each
    // logged-in account instead. The X-Test-User header picks the account.
    function buildAccountApp(limiter) {
        const app = express();
        app.set('trust proxy', 1);
        app.use((req, res, next) => {
            req.user = { id: req.get('X-Test-User') };
            res.render = (view) => res.send(`rendered ${view}`);
            next();
        });
        app.post('/form', limiter, (req, res) => res.redirect('/next'));
        return app;
    }

    async function postAs(app, user, times) {
        const responses = [];
        for (let i = 0; i < times; i++) {
            responses.push(await request(app).post('/form').set('X-Test-User', user).set('X-Forwarded-For', '203.0.113.1'));
        }
        return responses;
    }

    test('allows 10 comments, then shows the "too many attempts" page', async () => {
        const app = buildAccountApp(commentLimiter);

        const allowed = await postAs(app, 'lani', 10);
        const [blocked] = await postAs(app, 'lani', 1);

        expect(allowed.every((response) => response.status === 302)).toBe(true);
        expect(blocked.status).toBe(429);
        expect(blocked.text).toBe('rendered errors/429.ejs');
    });

    // Arranging a pickup can take some back and forth
    test('allows 20 messages, then shows the "too many attempts" page', async () => {
        const app = buildAccountApp(messageLimiter);

        const allowed = await postAs(app, 'lani', 20);
        const [blocked] = await postAs(app, 'lani', 1);

        expect(allowed.every((response) => response.status === 302)).toBe(true);
        expect(blocked.status).toBe(429);
    });

    // A bidding war near the end of an auction needs room
    test('allows 30 bids, then shows the "too many attempts" page', async () => {
        const app = buildAccountApp(bidLimiter);

        const allowed = await postAs(app, 'lani', 30);
        const [blocked] = await postAs(app, 'lani', 1);

        expect(allowed.every((response) => response.status === 302)).toBe(true);
        expect(blocked.status).toBe(429);
    });

    test('one account reaching the limit does not block another on the same Wi-Fi', async () => {
        const app = buildAccountApp(commentLimiter);
        await postAs(app, 'lani', 11);

        const [otherAccount] = await postAs(app, 'kai', 1);

        expect(otherAccount.status).toBe(302);
    });
});
