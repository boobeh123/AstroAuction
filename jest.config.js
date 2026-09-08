/**
 * Two environments, because this codebase has two kinds of code.
 *
 * Server tests run in `node`. Client tests need a DOM, and since Jest 28 the
 * jsdom environment ships as a separate package rather than being bundled —
 * hence the jest-environment-jsdom devDependency. Note that Jest validates
 * EVERY project's config at startup, so a missing jsdom package fails the
 * whole run, including server-only tests that never needed a DOM.
 *
 * Splitting the two with `projects` rather than setting jsdom globally
 * matters for accuracy: running server code in a jsdom environment would hand
 * it a `window` object it will never have in production, so a test could pass
 * here and the code still fail on the server.
 *
 * Tests live flat in test/unit/, prefixed by the layer they cover. The client
 * suite is identified by its `public-` prefix rather than by directory.
 *
 * testMatch covers BOTH naming conventions in this repo —
 * `loginValidation.test.js` (dot) and `utils-bidding_test.js` (underscore).
 * An earlier version of this file matched only the underscore form under
 * __tests__/, which silently excluded loginValidation.test.js: it stopped
 * running without ever reporting a failure, which is the worst way for a test
 * to disappear.
 */
module.exports = {
    projects: [
        {
            displayName: 'server',
            testEnvironment: 'node',
            testMatch: [
                '**/test/unit/**/*_test.js',
                '**/?(*.)+(spec|test).[jt]s',
            ],
            // The client suite needs a DOM, so it must not also be collected
            // here and run under node, where `document` does not exist.
            //
            // Careful: passing --testPathIgnorePatterns on the command line
            // REPLACES this list rather than adding to it, which would pull
            // the client tests back into this project and fail them all.
            testPathIgnorePatterns: [
                '/node_modules/',
                'public-.*_test\\.js$',
            ],
        },
        {
            displayName: 'client',
            testEnvironment: 'jsdom',
            testMatch: ['**/test/unit/**/public-*_test.js'],
            setupFiles: ['<rootDir>/test/unit/helpers-jsdom-setup.js'],
        },
    ],
};
