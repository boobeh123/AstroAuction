// ESLint settings. The project is CommonJS ("type": "commonjs" in
// package.json), so this file uses require/module.exports like the rest of
// the backend.
const js = require('@eslint/js');
const globals = require('globals');
const { defineConfig, globalIgnores } = require('eslint/config');

module.exports = defineConfig([
  globalIgnores(['coverage/']),

  js.configs.recommended,

  // An unused argument is allowed when its name starts with an underscore.
  // Express recognises error handlers by their four arguments
  // (err, req, res, next), so `next` has to stay even when it isn't used.
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Server code runs in Node.
  {
    files: ['**/*.js'],
    ignores: ['public/**'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },

  // Browser code is loaded with plain <script defer> tags, not as modules.
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: globals.browser,
    },
  },

  // main.js hands one helper to its Jest tests through module.exports,
  // behind a typeof check that is always false in the browser.
  {
    files: ['public/js/main.js'],
    languageOptions: {
      globals: { module: 'readonly' },
    },
  },

  // Tests run under Jest. The client suite also gets a browser DOM (jsdom).
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
  {
    files: ['test/unit/public-*_test.js', 'test/unit/helpers-jsdom-setup.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
]);
