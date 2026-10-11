const rateLimit = require('express-rate-limit')

// The account-form limits, counted per IP address. Everyone on the same Wi-Fi
// shares one address, so these leave room for several people signing up at
// the store at the same time. Raise them here if a busy event ever runs into
// them.
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const FAILED_LOGINS_PER_WINDOW = 10
const ACCOUNT_REQUESTS_PER_WINDOW = 20

// Comments and bids are counted per account instead, so one person flooding
// a listing doesn't block everyone else on the store's Wi-Fi. A bidding war
// near the end of an auction needs room, hence the higher bid limit.
const COMMENTS_PER_WINDOW = 10
const BIDS_PER_WINDOW = 30

// These limiters run after ensureAuth, so there's always a req.user
const byAccount = (req) => req.user.id

// Shown instead of the form once someone goes over a limit
const tooManyAttempts = (req, res) => {
  res.status(429).render('errors/429.ejs')
}

module.exports = {
  // Counts only failed logins, so people who sign in normally are never
  // slowed down. A failed login redirects just like a successful one, so
  // "successful" means the visitor ended up logged in.
  loginLimiter: rateLimit({
    windowMs: WINDOW_MS,
    limit: FAILED_LOGINS_PER_WINDOW,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req) => req.isAuthenticated(),
    handler: tooManyAttempts,
  }),

  // Signup, forgot password, the reset form, and resending the verification
  // email. Each of these can send an email, so they share one count.
  authLimiter: rateLimit({
    windowMs: WINDOW_MS,
    limit: ACCOUNT_REQUESTS_PER_WINDOW,
    handler: tooManyAttempts,
  }),

  commentLimiter: rateLimit({
    windowMs: WINDOW_MS,
    limit: COMMENTS_PER_WINDOW,
    keyGenerator: byAccount,
    handler: tooManyAttempts,
  }),

  bidLimiter: rateLimit({
    windowMs: WINDOW_MS,
    limit: BIDS_PER_WINDOW,
    keyGenerator: byAccount,
    handler: tooManyAttempts,
  }),
}
