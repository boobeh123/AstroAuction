const http = require('http');
const zlib = require('zlib');
const express = require('express');

/**
 * server.js parses forms with express.urlencoded({ extended: false,
 * inflate: false }). Without inflate: false, body-parser decompresses a
 * request body sent with Content-Encoding: br or gzip through Node's zlib,
 * and the Oct 21 2026 Node security release fixed a Brotli decoder bug that
 * let a crafted body run code on the server. No browser compresses a form
 * post, so a compressed body is turned away before anything decodes it.
 * server-config_test.js checks that server.js keeps the option.
 *
 * These send raw bytes with Node's http module: supertest changes a Buffer
 * body sent as a form, so the server never got the compressed bytes.
 */
const FORM = 'email=lani%40example.com&password=correct-horse';

function buildApp(parserOptions) {
    const app = express();
    const reached = [];
    app.use(express.urlencoded(parserOptions));
    app.post('/login', (req, res) => {
        reached.push(req.body);
        res.send('ok');
    });
    // Stands in for middleware/errorHandler.js, which keeps an error's status
    app.use((err, req, res, _next) => res.status(err.status || 500).send(err.message));
    return { app, reached };
}

// Posts the bytes to the app on a free local port and resolves with the status
async function post(app, body, encoding) {
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
        return await new Promise((resolve, reject) => {
            const headers = { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length };
            if (encoding) headers['Content-Encoding'] = encoding;
            const req = http.request({ host: '127.0.0.1', port: server.address().port, method: 'POST', path: '/login', headers }, (res) => {
                res.resume();
                res.on('end', () => resolve(res.statusCode));
            });
            req.on('error', reject);
            req.end(body);
        });
    } finally {
        server.close();
    }
}

describe("server.js's form parser", () => {
    const options = { extended: false, inflate: false };

    test('refuses a Brotli-compressed body with a 415, before the route', async () => {
        const { app, reached } = buildApp(options);

        expect(await post(app, zlib.brotliCompressSync(FORM), 'br')).toBe(415);
        expect(reached).toEqual([]);
    });

    test('refuses a gzip-compressed body too', async () => {
        const { app, reached } = buildApp(options);

        expect(await post(app, zlib.gzipSync(FORM), 'gzip')).toBe(415);
        expect(reached).toEqual([]);
    });

    test('still reads a normal form post', async () => {
        const { app, reached } = buildApp(options);

        expect(await post(app, Buffer.from(FORM))).toBe(200);
        expect(reached).toEqual([{ email: 'lani@example.com', password: 'correct-horse' }]);
    });
});

// The default that server.js used before: the same body goes through Node's
// Brotli decoder and reaches the route
test('without inflate: false, a Brotli body would be decompressed', async () => {
    const { app, reached } = buildApp({ extended: false });

    expect(await post(app, zlib.brotliCompressSync(FORM), 'br')).toBe(200);
    expect(reached).toEqual([{ email: 'lani@example.com', password: 'correct-horse' }]);
});
