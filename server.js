require('dotenv').config({ path: './config/.env' })

const express = require('express');
const app = express();
const helmet = require('helmet');
const logger = require('morgan');
const connectDB = require('./config/db')
const methodOverride = require('method-override');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const passport = require('passport');
const flash = require('connect-flash');
const mainRoutes = require('./routes/main');
const errorHandler = require('./middleware/errorHandler')
const auctionRoutes = require('./routes/auction');
const profileRoutes = require('./routes/profile');
const { startAuctionCloser } = require('./services/auctionCloser');
const Auction = require('./models/Auction');
const { isHighlighted } = require('./utils/highlight');
const { formatMoney } = require('./utils/bidding');

// Passport config
require('./config/passport')(passport);

connectDB();
app.set('view engine', 'ejs');
// X-Content-Type-Options: nosniff — prevents MIME sniffing attacks
// X-Frame-Options: SAMEORIGIN — prevents clickjacking via iframes
// Strict-Transport-Security — forces HTTPS on browsers that have visited before
// X-DNS-Prefetch-Control — controls DNS prefetching
// Referrer-Policy — controls what's sent in the Referer header
// CSP is configured explicitly to allow Google Analytics, Google Fonts, Cloudinary images, and our own assets while blocking everything else.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://cdnjs.cloudflare.com", "https://kit.fontawesome.com"],
            scriptSrcAttr:  ["'unsafe-inline'"],
            styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc:        ["'self'", "https://fonts.gstatic.com", "https://kit.fontawesome.com", "https://ka-f.fontawesome.com", "https://cdnjs.cloudflare.com"],
            imgSrc:         ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://www.google-analytics.com", "https://placeholder.pics"],
            connectSrc:     ["'self'", "https://www.google-analytics.com", "https://analytics.google.com", "https://ka-f.fontawesome.com"],
            frameSrc:       ["'self'", "https://www.youtube-nocookie.com"],
            objectSrc:      ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    // X-Frame-Options: SAMEORIGIN — controls whether other sites can embed
    // THIS page (clickjacking protection); separate concern from frameSrc,
    // which controls what THIS page is allowed to embed. Kept for older
    // browsers that don't support CSP's frame-ancestors.
    xFrameOptions: { action: 'sameorigin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}))
app.use(logger('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
//Use forms for put / delete
app.use(methodOverride("_method"));
// Sessions (mongoOptions avoids indefinite hangs if DB is unreachable)
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.DB_STRING,
      mongoOptions: {
        serverSelectionTimeoutMS: 10_000,
        connectTimeoutMS: 10_000,
      },
    }),
  })
)

// Passport middleware
app.use(passport.initialize())
app.use(passport.session())

app.use(flash());

// Flash Available to all Views
app.use((req, res, next) => {
  try {
    res.locals.success = req.flash('success') || []
    res.locals.errors  = req.flash('errors')  || []
    res.locals.error   = req.flash('error')   || []
    res.locals.info    = req.flash('info')    || []
    res.locals.currentPath = req.originalUrl
    res.locals.user = req.user || null
    next()
  } catch (err) {
    res.locals.success = []
    res.locals.errors  = []
    res.locals.error   = []
    res.locals.info    = []
    next(err)
  }
})

app.use(async (req, res, next) => {
  try {
    const candidate = await Auction.findOne({ highlightedAt: { $ne: null } })
      .select('title saleType price startingPrice currentBid status endsAt highlightedAt')
      .lean()
    res.locals.highlightedListing = candidate && isHighlighted(candidate) ? candidate : null
    res.locals.formatMoney = formatMoney
  } catch (err) {
    console.error('Failed to load highlighted listing for banner:', err.message)
    res.locals.highlightedListing = null
    res.locals.formatMoney = formatMoney
  }
  next()
})

app.use('/', mainRoutes);
app.use('/auction', auctionRoutes);
app.use('/profile', profileRoutes);

// 404 handler — catches any request that didn't match a route above
app.use((req, res) => {
  res.status(404).render('errors/404.ejs')
})

// Central error handler — must be last -> routes -> 404 handler - > error handler
app.use(errorHandler)

app.listen(process.env.PORT, ()=>{
    console.log('Server is running, you better catch it!')

    // Sweeps for auctions whose time is up and closes them. Runs once
    // immediately to catch anything that expired while the app was down, then
    // every 60s. Mongoose buffers commands until the connection is ready, so
    // this is safe to kick off here even though connectDB() isn't awaited.
    startAuctionCloser()
})    