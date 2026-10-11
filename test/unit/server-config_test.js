const fs = require('fs');
const path = require('path');

/**
 * Settings in server.js that are easy to undo by accident. server.js
 * connects to the database as soon as it loads, so these read its source
 * instead of running it.
 */
const SERVER = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

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
