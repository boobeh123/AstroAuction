const passport = require('passport')
const validator = require('validator')
const User = require('../models/User')

module.exports = {

    getLogin: async (req, res) => {

      try {
        if (req.user) {
          return res.redirect('/auction')
        } else {
          res.render('login.ejs');
        }
    } catch(err) {
        console.error(err)
        res.status(500).render('500.ejs');
      }
    },

    getSignup: async (req, res) => {

      try {
        if (req.user) {
          return res.redirect('/auction')
        } else {
          res.render('signup.ejs');
        }
    } catch(err) {
        console.error(err)
        res.status(500).render('500.ejs');
      }

    },

    postSignup: async (req, res, next) => {

      const validationErrors = []
      if (!validator.isEmail(req.body.email)) validationErrors.push({ msg: 'Please enter a valid email address.' })
      if (!validator.isLength(req.body.password, { min: 3 })) validationErrors.push({ msg: 'Password must be at least 8 characters long' })
      if (req.body.password !== req.body.confirmPassword) validationErrors.push({ msg: 'Passwords do not match' })
    
      if (validationErrors.length) {
        req.flash('errors', validationErrors)
        return res.redirect('../signup')
      }
      req.body.email = validator.normalizeEmail(req.body.email, { gmail_remove_dots: false })

      try {
        const existingUser = await User.findOne({ email: req.body.email })
        if (existingUser) {
          req.flash('errors', {msg: "Account with that email address or username already exists."})
          return res.redirect('/signup')
        }

        const user = new User({
          role: 'User',
          email: req.body.email,
          password: req.body.password,
          agreeToTerms: req.body.agreeToTerms,
          displayName: '',
          image: '',
          cloudinaryId: '',
          onboardingComplete: false,
          emailVerified: false,
        })

        await user.save()
        req.login(user, function(err) {
          if (err) { return next(err); }
          res.redirect('/onboard');

        });
      } catch(err) {
        return next(err)
      }
    },

    postLogin: async (req, res, next) => {
      const validationErrors = []
      if (!validator.isEmail(req.body.email)) validationErrors.push({ msg: 'Please enter a valid email address.' })
      if (validator.isEmpty(req.body.password)) validationErrors.push({ msg: 'Password cannot be blank.' })
  
      if (validationErrors.length) {
        req.flash('errors', info.message)
        return res.redirect('/login')
      }
      
      req.body.email = validator.normalizeEmail(req.body.email, { gmail_remove_dots: false })
  
      passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err) }
        if (!user) {
          req.flash('errors', info.message)
          return res.redirect('/login')
        }
        req.logIn(user, (err) => {
          if (err) { return next(err) }
          req.flash('success', 'Success! You are logged in.')
          res.redirect(req.session.returnTo || '/auction')
      })
    })(req, res, next)
  },

      getLogout: async (req, res) => {

        try {
          req.logout((err) => {
              if (err) {
                  console.error('Logout error:', err);
                  req.flash('errors', 'Error during logout');
                  return res.redirect('/');
              }
              
              req.session.destroy((err) => {
                  if (err) {
                      console.error('Session destruction error:', err);
                      return res.redirect('/');
                  }
  
                  req.user = null;
                  res.clearCookie('connect.sid');
                  res.redirect('/');
              });
          });

        } catch(err) {
            console.error(err)
            res.status(500).render('500.ejs');
          }
        
    }

}