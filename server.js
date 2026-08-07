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
// const auctionRoutes = require('./routes/auction');
// const profileRoutes = require('./routes/profile');

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
            fontSrc:        ["'self'", "https://fonts.gstatic.com", "https://kit.fontawesome.com", "https://ka-f.fontawesome.com"],
            imgSrc:         ["'self'", "data:", "https://res.cloudinary.com", "https://www.google-analytics.com", "https://placeholder.pics"],
            connectSrc:     ["'self'", "https://www.google-analytics.com", "https://analytics.google.com", "https://ka-f.fontawesome.com"],
            frameSrc:       ["'none'"],
            objectSrc:      ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    // X-Frame-Options: SAMEORIGIN — already covered by CSP frameSrc 'none'
    // but kept for older browsers that don't support CSP
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

app.use('/', mainRoutes);
// app.use('/auction', auctionRoutes);
// app.use('/profile', profileRoutes);

// 404 handler — catches any request that didn't match a route above
app.use((req, res) => {
  res.status(404).render('errors/404.ejs')
})

// Central error handler — must be last -> routes -> 404 handler - > error handler
app.use(errorHandler)

app.listen(process.env.PORT, ()=>{
    console.log('Server is running, you better catch it!')
})    