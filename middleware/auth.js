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
  // Also chained after ensureAuth. Creating a listing and bidding are only for
  // accounts that have proved they own their email address, which is what the
  // verification email is for. Like ensureAuctioneer it fails closed: a missing
  // user or a missing flag is treated as unverified. The profile page is where
  // the Resend verification email button lives, so that's where the user is sent.
  ensureVerified: function (req, res, next) {
    if (req.user && req.user.emailVerified === true) {
      return next()
    }
    req.flash('errors', { msg: 'Please verify your email first. You can resend the verification email from your profile.' })
    res.redirect('/profile')
  },
  // Runs on every request, right after Passport. A password reset records
  // passwordChangedAt on the account, and every login records loginAt on its
  // session. A session that logged in before the last reset is signed out
  // here, so whoever knew the old password loses access on every other
  // device. The request carries on as a visitor's.
  endStaleSessions: function (req, res, next) {
    const changedAt = req.user && req.user.passwordChangedAt
    if (!changedAt || (req.session.loginAt || 0) >= changedAt.getTime()) {
      return next()
    }
    req.logout((err) => next(err))
  }
}
