module.exports = {
  ensureAuth: function (req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    } else {
      res.redirect('/login')
    }
  },
  // Chained after ensureAuth, not standalone — this only checks the role,
  // trusting req.user already exists by the time it runs. A missing role
  // (e.g. an account created before this field existed) fails closed rather
  // than throwing on a null comparison.
  ensureAuctioneer: function (req, res, next) {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'auctioneer')) {
      return next()
    }
    res.status(403).render('errors/403.ejs')
  },
  // Also chained after ensureAuth. Listings are only for accounts that have
  // proved they own their email address, which is what the verification email
  // is for. Like ensureAuctioneer it fails closed: a missing user or a missing
  // flag is treated as unverified. The profile page is where the Resend
  // verification email button lives, so that's where the user is sent.
  ensureVerified: function (req, res, next) {
    if (req.user && req.user.emailVerified === true) {
      return next()
    }
    req.flash('errors', { msg: 'Please verify your email before creating a listing. You can resend the verification email from your profile.' })
    res.redirect('/profile')
  }
}
