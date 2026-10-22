const fs = require('fs');
const path = require('path');

/**
 * Settings in server.js and package.json that are easy to undo by accident.
 * server.js connects to the database as soon as it loads, so these read its
 * source instead of running it.
 */
const SERVER = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
const PACKAGE = require('../../package.json');

// True when version a.b.c is the same as or newer than minimum
function atLeast(version, minimum) {
    const have = version.split('.').map(Number);
    const need = minimum.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (have[i] !== need[i]) return have[i] > need[i];
    }
    return true;
}

// A compressed form post would go through Node's zlib, where the Oct 21
// 2026 Node security release fixed a Brotli bug that let a crafted body run
// code. No browser compresses a form post, so the parser refuses them
// (server-compressedBodies_test.js shows what the option does).
test('the form parser refuses compressed request bodies', () => {
    expect(SERVER).toMatch(/express\.urlencoded\(\{[^}]*inflate:\s*false[^}]*\}\)/);
});

// Railway's builder installs exactly the Node version in engines. A range
// like "24.x" let Nixpacks pick whatever 24.x it had, so the security
// release might never arrive. Bump the pin; don't loosen it.
test('Node is pinned to an exact version, no older than the Oct 2026 security release', () => {
    const pinned = PACKAGE.engines.node;

    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/);
    expect(atLeast(pinned, '24.22.1')).toBe(true);
});

// No page uses inline styles, so the Content-Security-Policy doesn't allow
// them. main.js still sets styles through JavaScript, which the policy
// doesn't block.
test("the Content-Security-Policy doesn't allow inline styles", () => {
    const styleSrc = SERVER.match(/styleSrc:\s*\[([\s\S]*?)\]/)[1];

    expect(styleSrc).not.toContain("'unsafe-inline'");
});

// Nothing in the app sends JSON, so there's no JSON body parser to attack
test("there's no JSON body parser", () => {
    expect(SERVER).not.toContain('express.json(');
});

// connect-flash (2013) calls Node's deprecated util.isArray.
// middleware/flash.js has the same API.
test('flash messages come from middleware/flash.js, not connect-flash', () => {
    expect(SERVER).not.toContain("require('connect-flash')");
    expect(SERVER).toContain("require('./middleware/flash')");
});
