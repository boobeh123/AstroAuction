# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Two sites for The Lost And Found LLC, a reuse store in Wahiawa, HI:

- **AstroAuction**, the Express app: a local marketplace with fixed-price listings and timed auctions. The store owner livestreams sales and "spotlights" the listing being sold, which puts a Live Now banner across the site. Live at https://astroauction.up.railway.app, built by Railway with Nixpacks on Node 24 (pinned through `engines` in package.json).
- **The Lost And Found page**, a static site: `index.html`, `public/css/stylesstatic.css` and `public/js/mainstatic.js`. Live at https://astroauction.netlify.app. Netlify publishes the repo root, so this page links `/public/...` paths, while the Express app serves `public/` at `/` (for example `/css/styles.css`).

Both sites redeploy on every merge to `master`. Changes go through a branch and a pull request to `master`, one at a time: start the next branch from `master` after the previous PR has merged, never on top of an open PR.

README.md is mostly Bobby's patch log, newest first. It doesn't need updating on every push. After a batch of changes merges, add a Version History entry in the same format as the earlier ones (heading, release date, developer's notes, the 123-dash separator), and update any other section the changes affect.

## Commands

```bash
npm run dev                                  # node --watch server.js, NODE_ENV=development
npm start
npm run lint                                 # ESLint 10, flat config in eslint.config.js
npm test                                     # Jest, every suite, --runInBand
npm test -- test/unit/utils-bidding_test.js  # one file
npm test -- -t "formatTimeRemaining"         # tests whose name matches
```

- Local setup: copy `config/.env.example` to `config/.env`; it lists every variable. `server.js` loads `./config/.env` relative to the working directory, so run commands from the repo root. Use a local MongoDB and test credentials: the production values point at the live database and the store's Gmail account.
- Don't run `npm run format`. Most files aren't Prettier-formatted, so it would reformat dozens of them. Match the style of the file you're editing.
- Don't pass `--testPathIgnorePatterns`. It replaces the pattern in jest.config.js that keeps the client tests out of the node project, and they all fail.

## Architecture

Requests flow `routes/<name>Routes.js` → middleware → `controller/<name>Controller.js` → `model/<Name>.js` → `views/*.ejs`. Route files only wire things together:

```js
router.post('/', ensureAuth, ensureVerified, upload.array('file', 10), handleUploadErrors('/auction'), validateListing, auctionController.postAuction);
```

On multipart forms, multer must come before the validators, because multer is what parses the fields.

**server.js** sets up, in order:
1. dotenv, then `trust proxy` (Railway's proxy; secure cookies and per-IP rate limits depend on it)
2. helmet with an explicit CSP, then morgan
3. `urlencoded({ extended: false })`, static files, `method-override`
4. sessions stored in MongoDB (connect-mongo over Mongoose's client), Passport, connect-flash
5. a locals middleware (`user`, `currentPath`, flash messages), then one that loads the spotlighted listing for the banner
6. routes, the 404 page, and `middleware/errorHandler.js`

It starts listening only after MongoDB connects, then starts the auction closer.

- Forms delete and edit with `method="POST"` plus `?_method=DELETE` or `?_method=PUT` in the action URL; method-override reads the query string.
- The locals middleware calls `req.flash()` only when `req.session.flash` exists. Calling it every time would give every visitor a session cookie and a database row.
- `user` is `null` for visitors, so views check it before reading its fields.
- Any outside resource (script, stylesheet, font, image host, iframe) needs the matching CSP directive in server.js. `script-src` is `'self'` only: no inline scripts and no `onclick`-style attributes.

**Validation.** `middleware/validators.js` holds one express-validator chain per form.
- Every field starts with `.isString()`, because a form field can arrive as an object or a list.
- Controllers start with `const errors = formErrors(req)`. On failure they flash `errors.array()` and redirect back to the form. Otherwise they read input with `matchedData(req)`.
- `formErrors` keeps only `{ msg }`. The default error objects carry the typed value and would store passwords in the session.
- Express 5 sends thrown errors to errorHandler, so use try/catch only when the catch does something specific, like a `finally` that deletes multer's temp files.

**MongoDB guard.** `config/database.js` turns on Mongoose's `sanitizeFilter`, which neutralizes `$` operators in queries. Every operator the app writes itself must be wrapped, as in `endsAt: mongoose.trusted({ $gt: new Date() })`. A missing wrapper either silently matches nothing or throws a CastError, depending on the field type. Silent failures look like refused bids, auctions that never close, and links that always look expired. `test/unit/integration-database_test.js` runs the real queries against MongoDB to catch this.

**Auctions.** One `Auction` model holds both kinds of listing (`saleType: 'fixed' | 'auction'`). Money is a plain Number rounded through `utils/bidding.js` (`round2`, `parseMoney`, `formatMoney`, `minimumNextBid`, `isAuctionLive`). The money limits (`AMOUNT_LIMITS`, `INCREMENT_LIMITS`) live there too. The validators' `moneyField`, the schemas and the listing form's inputs all read them, so change a limit only there.
- `auctionController.postBid` accepts a bid with a single `findOneAndUpdate`. Its filter holds every rule (open, not ended, high enough), so two simultaneous bids can't both win. `returnDocument: 'before'` gives the outbid user for the email. `Bid` documents are only history.
- `services/auctionCloser.js` closes an auction by atomically flipping `status` from `'open'` to `'ended'`, so only one caller sends the end-of-auction emails. It runs every 60 s from server start. The detail page also closes an expired auction when someone views it.
- Spotlight uses `highlightedAt` on the listing. It lasts 12 hours (`utils/highlight.js`), one listing at a time, and only the `auctioneer` and `admin` roles can toggle it.

**Accounts.** Passport local strategy with the email as the username.
- Emails are cleaned with `normalizeEmail`: lowercased, with `+tags` removed for Gmail and similar providers, but Gmail dots kept. Changing it would stop existing accounts from matching.
- Verification and reset tokens are random hex. The email carries the token; the database stores its SHA-256 hash, valid for 1 hour.
- Guards in `middleware/auth.js`: `ensureAuth`, `ensureVerified` (required to create listings and to bid) and `ensureAuctioneer`.
- Roles are set directly in the database. Older accounts have `role: 'User'`, so don't add an enum to that field.
- Deleting an account deletes its listings, with their photos, comments and bids, through `services/listingCleanup.js`. Deleting a single listing uses the same helper. Account deletion is refused while the user has an open auction with bids, or is the top bidder on one.
- `middleware/rateLimiters.js` limits per IP: 10 failed logins and 20 account-form requests (the forms that send email) per 15 minutes.

**Uploads and email.**
- Multer writes JPG/PNG files (10 MB each, 10 at most) to the OS temp dir.
- `handleUploadErrors(redirectTo)` turns multer's errors into a flash message and a redirect.
- Controllers upload to Cloudinary and delete the temp files in `finally`. Listing validation runs before any upload, so a rejected listing leaves no orphaned images.
- `config/mailer.js` sends through Gmail. Every link is built from `APP_URL`, never from the request's Host header, and user text in email HTML goes through `escapeHtml`.

**Views and client JS.**
- Pages are built from `partials/head`, `navigation` (which pulls in the spotlight banner and the first-visit tutorial), `flash` and `footer`. The footer loads `/js/main.js` with `defer`.
- Use escaped `<%= %>` for data; `<%-` is only for `include`.
- Listing queries use `.lean()`, so results have `_id` but no `.id`.
- `public/js/main.js` serves every page: selectors at the top, then helpers, then handlers, then event listeners at the bottom. Each feature checks that its elements exist before running.

## Tests

`test/unit/` is flat, with files named `<layer>-<name>_test.js`. jest.config.js runs two projects: server suites in node, and `public-*_test.js` in jsdom (set up by `helpers-jsdom-setup.js`). `helpers-mocks.js` provides `mockRequest`, `mockResponse`, `mockQuery` and `runValidators`.

- The `integration-*` suites start a real MongoDB through mongodb-memory-server, which downloads a mongod binary on the first run.
- `jest.mock('../../model/Auction')` turns `Auction.CATEGORIES` and `SALE_TYPES` into empty arrays. Run listing validators only in suites that load the real model.
- `middleware-uploadErrors_test.js` leaves one multer temp file in the OS temp dir per run.

## Conventions

- The backend is CommonJS (`require` / `module.exports`).
- Client JS uses `querySelector` / `querySelectorAll` only, `const` / `let`, and async/await with try/catch.
- `styles.css` separates blocks with this heading, and keeps every media query, including the single `prefers-reduced-motion` block, at the bottom:

  ```css
  /**************************************************************
  Header
  ***************************************************************/
  ```

- Custom properties are camelCase. `:root` defines `--headerHeight` and a spacing scale (`--space1` to `--space10`); there are no color variables yet. Class names stay kebab-case.
- `.env` lives in `config/`.
- Commit messages are plain English and imperative, under 72 characters, and say what changed and why.
- Bobby's broader code standards are in the `boobeh123-code-standards` skill, when it's available.
