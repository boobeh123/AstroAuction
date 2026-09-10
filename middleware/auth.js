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
  }
}
