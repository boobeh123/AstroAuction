const errorHandler = require('../../middleware/errorHandler');
const { mockRequest, mockResponse } = require('./helpers-mocks');

/**
 * The error handler used to answer every error with 500 and the "Server
 * Error" page, even for a missing page or a request it couldn't read. It now
 * passes on the error's own status and shows the matching page. Anything
 * without a usable error status is still treated as a server fault.
 */
beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

function errorWithStatus(status) {
    const err = new Error('Something failed');
    err.status = status;
    return err;
}

describe('errorHandler', () => {
    test.each([
        [404, 'errors/404.ejs'],
        [403, 'errors/403.ejs'],
        [400, 'errors/500.ejs'],
        [413, 'errors/500.ejs'],
        [503, 'errors/500.ejs'],
    ])('an error with status %i gets that status and %s', (status, view) => {
        const res = mockResponse();

        errorHandler(errorWithStatus(status), mockRequest(), res, jest.fn());

        expect(res.statusCode).toBe(status);
        expect(res.rendered).toBe(view);
    });

    test.each([
        ['no status', undefined],
        ['a redirect status', 302],
        ['a status that is not a number', 'oops'],
    ])('an error with %s is treated as a 500', (_label, status) => {
        const res = mockResponse();

        errorHandler(errorWithStatus(status), mockRequest(), res, jest.fn());

        expect(res.statusCode).toBe(500);
        expect(res.rendered).toBe('errors/500.ejs');
    });

    test('hands the error back to Express when the response has already started', () => {
        const res = mockResponse();
        res.headersSent = true;
        const next = jest.fn();
        const err = errorWithStatus(404);

        errorHandler(err, mockRequest(), res, next);

        expect(next).toHaveBeenCalledWith(err);
        expect(res.render).not.toHaveBeenCalled();
    });

    test('logs the full error for the server logs', () => {
        const err = errorWithStatus(500);

        errorHandler(err, mockRequest(), mockResponse(), jest.fn());

        expect(console.error).toHaveBeenCalledWith(err.stack);
    });
});
