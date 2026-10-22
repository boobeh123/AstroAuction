require('dotenv').config({ path: './config/.env' })

const express = require('express');
const app = express();
const helmet = require('helmet');
const logger = require('morgan');
const connectDB = require('./config/database')
const methodOverride = require('method-override');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const flash = require('./middleware/flash');
const homeRoutes = require('./routes/homeRoutes');
const authRoutes = require('./routes/authRoutes');
const onboardRoutes = require('./routes/onboardRoutes');
const termRoutes = require('./routes/termRoutes');
const errorHandler = require('./middleware/errorHandler')
const { endStaleSessions } = require('./middleware/auth')
const auctionRoutes = require('./routes/auctionRoutes');
const profileRoutes = require('./routes/profileRoutes');
const tutorialRoutes = require('./routes/tutorialRoutes');
const { startAuctionCloser } = require('./services/auctionCloser');
const { getHighlightedListing } = require('./services/highlightCache');
const { formatMoney } = require('./utils/bidding');
const { formatDate } = require('./utils/dates');

// Passport config
require('./config/passport')(passport);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Verification, reset and auction emails build their links from APP_URL.
// Without it in production, every link in those emails points at localhost.
if (isProduction && !process.env.APP_URL) {
  console.warn('APP_URL is not set. Links in emails will point at http://localhost:3000.')
}

// Connect once. The server starts taking requests only after this succeeds
// (see the bottom of this file), and the session store shares the connection.
const clientPromise = connectDB();

// Railway sends every request through one proxy. Trusting that hop lets
// Express see the visitor's real IP and that the connection was HTTPS,
// which the secure session cookie below depends on.
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
// Error pages include the navigation, which reads currentPath. A request that
// fails before the locals middleware below sets it, such as a body that can't
// be parsed, would otherwise crash the error page itself.
app.locals.currentPath = ''
// Every view shows dates in Hawaii time through formatDate (utils/dates.js).
// The server runs in UTC, so toLocaleDateString() would show tomorrow's date
// for anything after 2 PM there.
app.locals.formatDate = formatDate
// X-Content-Type-Options: nosniff — prevents MIME sniffing attacks
// X-Frame-Options: SAMEORIGIN — prevents clickjacking via iframes
// Strict-Transport-Security — forces HTTPS on browsers that have visited before
// X-DNS-Prefetch-Control — controls DNS prefetching
// Referrer-Policy — controls what's sent in the Referer header
// Content-Security-Policy (CSP) lists the only places pages may load things
// from, and the browser blocks everything else. No page has inline scripts
// or onclick-style attributes, so scripts may only come from this site's own
// files: even if a <script> tag slipped into a listing, the browser wouldn't
// run it.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'"],
            // No inline styles: no page has a style="" or <style>. main.js
            // sets styles through JavaScript, which this doesn't block.
            styleSrc:       [
                "'self'",
                "https://fonts.googleapis.com",      // the Roboto stylesheet
                "https://cdnjs.cloudflare.com",      // Font Awesome 6.4 stylesheet
            ],
            fontSrc:        [
                "'self'",
                "https://fonts.gstatic.com",         // Google Fonts' font files
                "https://cdnjs.cloudflare.com",      // Font Awesome's icon font files
            ],
            imgSrc:         [
                "'self'",
                "data:",                             // small images built into styles.css
                "blob:",                             // previews of photos picked in the listing form
                "https://res.cloudinary.com",        // uploaded listing and profile photos
            ],
            connectSrc:     ["'self'"],
            frameSrc:       [
                "'self'",
                "https://www.youtube-nocookie.com",  // listing videos
            ],
            objectSrc:      ["'none'"],
            // Local development runs on plain HTTP, so only upgrade on the live site
            upgradeInsecureRequests: isProduction ? [] : null,
        },
    },
    // X-Frame-Options: SAMEORIGIN — controls whether other sites can embed
    // THIS page (clickjacking protection); separate concern from frameSrc,
    // which controls what THIS page is allowed to embed. Kept for older
    // browsers that don't support CSP's frame-ancestors.
    xFrameOptions: { action: 'sameorigin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}))
// Locally: short colored lines. On Railway: the standard "combined" format,
// which adds the visitor's IP, the date, the referring page and the browser.
app.use(logger(isProduction ? 'combined' : 'dev'));
// extended: false keeps every form field a plain string. With extended: true,
// a field named email[$ne] arrived as the object { $ne: ... }, which is how
// database operators get smuggled into queries.
// There's no JSON parser: every form posts urlencoded data, and the one
// fetch() in main.js sends no body.
// inflate: false refuses a compressed request body with a 415. Otherwise
// body-parser decompresses gzip and Brotli bodies through Node's zlib, where
// the Oct 21 2026 Node security release fixed a Brotli bug that let a crafted
// body run code. No browser compresses a form post.
app.use(express.urlencoded({ extended: false, inflate: false }));
app.use(express.static('public'));
//Use forms for put / delete
app.use(methodOverride("_method"));
// Sessions, stored in MongoDB over the app's own connection
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ clientPromise }),
    // httpOnly keeps the cookie away from page scripts. sameSite 'lax' stops
    // other sites from submitting forms (bids, deletes) as a logged-in user.
    // secure limits it to HTTPS, which only works because of 'trust proxy'.
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
    },
  })
)

// Passport middleware
app.use(passport.initialize())
app.use(passport.session())
// Signs out any session that logged in before the account's last password reset
app.use(endStaleSessions)

app.use(flash);

// Flash Available to all Views
app.use((req, res, next) => {
  // Reading messages never writes to the session (middleware/flash.js), so
  // a visitor with nothing queued still gets no session cookie and no
  // database row, and a request without a session reads empty lists
  res.locals.success = req.flash('success')
  res.locals.errors  = req.flash('errors')
  res.locals.error   = req.flash('error')
  res.locals.info    = req.flash('info')
  // The path without the query string, so /auction?page=2 still counts as
  // the auction page in the navigation, the banner and the tutorial
  res.locals.currentPath = req.path
  res.locals.user = req.user || null
  next()
})

// The spotlight banner at the top of most pages. Only pages show it, and
// pages are GET requests: form posts redirect, and the error pages they
// sometimes render manage without it. The listing is cached for 10 seconds
// in services/highlightCache.js instead of being looked up every request.
app.use(async (req, res, next) => {
  res.locals.formatMoney = formatMoney
  if (req.method !== 'GET') return next()

  try {
    res.locals.highlightedListing = await getHighlightedListing()
  } catch (err) {
    console.error('Failed to load highlighted listing for banner:', err.message)
    res.locals.highlightedListing = null
  }
  next()
})

app.use('/', homeRoutes);
app.use('/', authRoutes);
app.use('/onboard', onboardRoutes);
app.use('/', termRoutes);
app.use('/auction', auctionRoutes);
app.use('/profile', profileRoutes);
app.use('/tutorial', tutorialRoutes);

// 404 handler — catches any request that didn't match a route above
app.use((req, res) => {
  res.status(404).render('errors/404.ejs')
})

// Central error handler — must be last -> routes -> 404 handler - > error handler
app.use(errorHandler)

// Take requests only once the database is connected. Before, the server
// started straight away, and requests that arrived during a slow or failed
// connection hung until they timed out. If the connection fails, the process
// exits so Railway can restart it.
clientPromise
  .then(() => {
    app.listen(PORT, () => {
      // The Node version shows in Railway's deploy log, to confirm the pin in
      // package.json's engines took effect
      console.log(`Server is running on Node ${process.version}, you better catch it!`)

      // Sweeps for auctions whose time is up and closes them. Runs once
      // immediately to catch anything that expired while the app was down,
      // then every 60s.
      startAuctionCloser()
    })
  })
  .catch((err) => {
    console.error('Database connection failed:', err)
    process.exit(1)
  })