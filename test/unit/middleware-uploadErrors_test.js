const express = require('express');
const request = require('supertest');
const multer = require('multer');
const upload = require('../../middleware/multer');
const handleUploadErrors = require('../../middleware/handleUploadErrors');
const { mockRequest, mockResponse } = require('./helpers-mocks');

/**
 * Two layers here.
 *
 * The unit tests call the middleware directly with each error shape, which is
 * fast and pins the exact message a user sees.
 *
 * The end-to-end tests push a real oversized file through a real express app
 * with real multer. Those matter because the wiring depends on something
 * subtle: express identifies error handlers by function arity, so a factory
 * that returned a three-argument function would never be reached and every
 * rejection would fall through to the 500 page exactly as before. Only an
 * actual request proves that works.
 */

function multerError(code, message = 'multer failure') {
    const err = new multer.MulterError(code);
    err.message = message;
    return err;
}

describe('handleUploadErrors — message selection', () => {
    function run(err, redirectTo = '/auction') {
        const req = mockRequest();
        const res = mockResponse();
        const next = jest.fn();

        handleUploadErrors(redirectTo)(err, req, res, next);

        return { req, res, next };
    }

    test('explains an oversized file and names the actual limit', () => {
        const { req, res } = run(multerError('LIMIT_FILE_SIZE'));

        const msg = req.flashed.errors[0].msg;
        // The figure is read from multer's config rather than hardcoded, so
        // the message cannot contradict the rule being enforced.
        expect(msg).toContain('10MB');
        expect(msg).toMatch(/phone/i);
        expect(res.redirectedTo).toBe('/auction');
    });

    test('explains too many files and names the actual cap', () => {
        const { req } = run(multerError('LIMIT_FILE_COUNT'));

        expect(req.flashed.errors[0].msg).toContain('10 photos');
    });

    test('explains an unsupported file type', () => {
        const err = new Error('File type is not supported');
        err.code = upload.INVALID_FILE_TYPE;

        const { req } = run(err);

        expect(req.flashed.errors[0].msg).toMatch(/JPG and PNG/i);
    });

    test('gives a vague message for a field-name mismatch', () => {
        // This one is a wiring bug, not user error. Telling the visitor about
        // form field names would be noise; the console line carries the
        // detail a developer needs.
        const { req } = run(multerError('LIMIT_UNEXPECTED_FILE'));

        expect(req.flashed.errors[0].msg).toMatch(/something went wrong/i);
    });

    test('falls back to a generic message for an unrecognised multer code', () => {
        const { req } = run(multerError('LIMIT_PART_COUNT'));

        expect(req.flashed.errors[0].msg).toMatch(/could not be processed/i);
    });

    test('redirects to whichever path the factory was given', () => {
        const { res } = run(multerError('LIMIT_FILE_SIZE'), '/profile');

        expect(res.redirectedTo).toBe('/profile');
    });

    // Without this, an unrelated failure arriving here would be swallowed and
    // reported to the user as an upload problem, hiding the real error from
    // the central handler.
    test('passes a non-upload error through to the central error handler', () => {
        const { req, res, next } = run(new Error('database connection lost'));

        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0].message).toBe('database connection lost');
        expect(res.redirect).not.toHaveBeenCalled();
        expect(req.flash).not.toHaveBeenCalled();
    });

    test('passes through an error with an unrelated code', () => {
        const err = new Error('permission denied');
        err.code = 'EACCES';

        const { next, res } = run(err);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.redirect).not.toHaveBeenCalled();
    });
});

describe('handleUploadErrors — real uploads through express', () => {
    function buildApp() {
        const app = express();

        app.use((req, res, next) => {
            req.flash = jest.fn();
            req.flashed = [];
            res.locals = {};
            next();
        });

        app.post(
            '/auction',
            upload.array('file', 10),
            handleUploadErrors('/auction'),
            (req, res) => res.status(200).send('uploaded')
        );

        // Stands in for errorHandler.js. If anything reaches here, the
        // middleware failed to catch it and the user would have seen a 500.
        app.use((err, req, res, next) => {
            res.status(500).send('FELL THROUGH TO 500');
        });

        return app;
    }

    test('a file over the size limit redirects instead of 500ing', async () => {
        const oversized = Buffer.alloc(11 * 1024 * 1024, 0);

        const res = await request(buildApp())
            .post('/auction')
            .attach('file', oversized, { filename: 'huge.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auction');
        expect(res.text).not.toContain('FELL THROUGH TO 500');
    });

    test('a disallowed file type redirects instead of 500ing', async () => {
        const res = await request(buildApp())
            .post('/auction')
            .attach('file', Buffer.from('not really a pdf'), {
                filename: 'notes.pdf',
                contentType: 'application/pdf',
            });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auction');
    });

    test('more files than the cap redirects instead of 500ing', async () => {
        const req = request(buildApp()).post('/auction');

        for (let i = 0; i < 12; i += 1) {
            req.attach('file', Buffer.from('x'), {
                filename: `photo${i}.jpg`,
                contentType: 'image/jpeg',
            });
        }

        const res = await req;

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auction');
    });

    // The other half of the contract: the middleware must be invisible when
    // nothing went wrong. If express ran it on success, every valid upload
    // would redirect and no listing would ever be created.
    test('a valid upload passes straight through to the controller', async () => {
        const res = await request(buildApp())
            .post('/auction')
            .attach('file', Buffer.from('pretend jpeg bytes'), {
                filename: 'photo.jpg',
                contentType: 'image/jpeg',
            });

        expect(res.status).toBe(200);
        expect(res.text).toBe('uploaded');
    });

    test('a request with no file at all passes through', async () => {
        const res = await request(buildApp())
            .post('/auction')
            .field('title', 'A listing with no photos');

        expect(res.status).toBe(200);
        expect(res.text).toBe('uploaded');
    });
});
