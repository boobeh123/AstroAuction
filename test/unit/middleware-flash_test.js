const express = require('express');
const session = require('express-session');
const request = require('supertest');
const flash = require('../../middleware/flash');

/**
 * The session-backed messages that replaced connect-flash, which was last
 * released in 2013 and calls Node's deprecated util.isArray. A plain object
 * stands in for req.session first; the tests at the bottom run it with the
 * real express-session, the way server.js wires it.
 */
describe('flash middleware', () => {
    let req;
    let next;

    beforeEach(() => {
        req = { session: {} };
        next = jest.fn();
        flash(req, {}, next);
    });

    test('adds req.flash and moves on', () => {
        expect(typeof req.flash).toBe('function');
        expect(next).toHaveBeenCalledTimes(1);
    });

    test('queues a message and returns how many of that type are queued', () => {
        expect(req.flash('success', 'Your bid of $25.00 has been placed.')).toBe(1);
        expect(req.flash('success', 'Profile updated.')).toBe(2);
        expect(req.session.flash).toEqual({ success: ['Your bid of $25.00 has been placed.', 'Profile updated.'] });
    });

    // Validation errors arrive as [{ msg }, ...] from formErrors()
    test('queues each item of a list', () => {
        expect(req.flash('errors', [{ msg: 'Enter a title.' }, { msg: 'Choose a category.' }])).toBe(2);
        expect(req.flash('errors')).toEqual([{ msg: 'Enter a title.' }, { msg: 'Choose a category.' }]);
    });

    test('returns one type oldest first, clears it, and leaves the other types queued', () => {
        req.flash('info', 'First');
        req.flash('info', 'Second');
        req.flash('errors', { msg: 'Still here.' });

        expect(req.flash('info')).toEqual(['First', 'Second']);
        expect(req.flash('info')).toEqual([]);
        expect(req.session.flash).toEqual({ errors: [{ msg: 'Still here.' }] });
    });

    // An unchanged session isn't saved, so a visitor gets no cookie
    test('leaves the session alone when reading with nothing queued', () => {
        expect(req.flash('success')).toEqual([]);
        expect(req.flash('errors')).toEqual([]);
        expect(req.session).toEqual({});
    });

    // req.session is missing when the session store can't be reached
    test('reads as empty when the request has no session at all', () => {
        delete req.session;

        expect(req.flash('info')).toEqual([]);
    });

    // passport's req.login() and req.logout() replace the session
    test('writes to the session the request has at the time of the call', () => {
        const oldSession = req.session;
        req.session = {};

        req.flash('errors', { msg: 'Please verify your email first.' });

        expect(req.session.flash.errors).toHaveLength(1);
        expect(oldSession).toEqual({});
    });

    test('throws rather than lose a message when there is no session', () => {
        delete req.session;

        expect(() => req.flash('success', 'Saved.')).toThrow('req.flash() needs a session to keep messages in');
    });

    test('throws when called without a type', () => {
        expect(() => req.flash()).toThrow(TypeError);
        expect(() => req.flash('', 'Saved.')).toThrow(TypeError);
    });
});

describe('with express-session, the way server.js wires it', () => {
    // server.js reads all four types on every request to show them
    function buildApp() {
        const app = express();
        app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
        app.use(flash);
        app.get('/', (req, res) => {
            res.json(['success', 'errors', 'error', 'info'].map((type) => req.flash(type)));
        });
        app.get('/save', (req, res) => {
            req.flash('success', 'Profile updated.');
            res.redirect('/');
        });
        return app;
    }

    // connect-flash created session.flash on every read, which once gave
    // every visitor, bots included, a cookie and a session in the database
    test('a visitor with nothing queued gets no session cookie', async () => {
        const response = await request(buildApp()).get('/').expect(200);

        expect(response.headers['set-cookie']).toBeUndefined();
    });

    test('a message shows on the next page, and only once', async () => {
        const agent = request.agent(buildApp());
        await agent.get('/save').expect(302);

        const first = await agent.get('/').expect(200);
        const second = await agent.get('/').expect(200);

        expect(first.body[0]).toEqual(['Profile updated.']);
        expect(second.body[0]).toEqual([]);
    });
});
