const passport = require('passport')
const validator = require('validator')
const mongoose = require('mongoose')
const User = require('../models/User')
const { sendVerificationEmail, sendPasswordResetEmail } = require('../config/mailer');
const crypto = require('crypto');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

// Matches an expiry time that hasn't passed yet. mongoose.trusted() tells the
// sanitizeFilter guard in config/database.js that this $gt is the app's own,
// not something sent in a request. Without it, every link would look expired.
const notExpired = () => mongoose.trusted({ $gt: Date.now() })

// Unexpected errors aren't caught here: Express 5 passes anything thrown in
// these handlers to middleware/errorHandler.js, which logs it and shows the
// 500 page. The try/catch blocks left are for failures with their own
// handling, like an email that couldn't be sent.
module.exports = {

    getLogin: async (req, res) => {
      if (req.user) {
        return res.redirect('/')
      } else {
        res.render('login.ejs');
      }
    },

    getSignup: async (req, res) => {
      if (req.user) {
        return res.redirect('/')
      } else {
        res.render('signup.ejs');
      }
    },

    postSignup: async (req, res, next) => {
      const validationErrors = []
      if (!validator.isEmail(req.body.email)) validationErrors.push({ msg: 'Please enter a valid email address.' })
      if (!validator.isLength(req.body.password, { min: 8 })) validationErrors.push({ msg: 'Password must be at least 8 characters long' })
      if (req.body.password !== req.body.confirmPassword) validationErrors.push({ msg: 'Passwords do not match' })

      if (validationErrors.length) {
        req.flash('errors', validationErrors)
        return res.redirect('../signup')
      }
      req.body.email = validator.normalizeEmail(req.body.email, { gmail_remove_dots: false })

      const existingUser = await User.findOne({ email: req.body.email })
      if (existingUser) {
        req.flash('errors', {msg: "Account with that email address or username already exists."})
        return res.redirect('/signup')
      }

      const token = crypto.randomBytes(20).toString('hex');

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
        verificationToken: hashToken(token),
        verificationTokenExpires: Date.now() + 3600000,
      })

      await user.save()

      req.login(user, async function(err) {
        if (err) { return next(err); }

        try {
          await sendVerificationEmail(user, token);
          console.log('Welcome email sent to:', user.email);
        } catch (err) {
          console.error('Failed to send welcome email:', err.message);
        }

        res.redirect('/onboard');
      });
    },

    postLogin: async (req, res, next) => {
      const validationErrors = []
      if (!validator.isEmail(req.body.email)) validationErrors.push({ msg: 'Please enter a valid email address.' })
      if (validator.isEmpty(req.body.password)) validationErrors.push({ msg: 'Password cannot be blank.' })

      if (validationErrors.length) {
        req.flash('errors', validationErrors)
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
          res.redirect(req.session.returnTo || '/')
      })
    })(req, res, next)
  },

    getLogout: async (req, res) => {
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
    },

    getVerified: async (req, res) => {
      const user = await User.findOne({
        verificationToken: hashToken(req.params.token),
        verificationTokenExpires: notExpired()
      });

      if (!user) {
        req.flash('errors', { msg: 'Verification link is invalid or has expired.' });
        return res.redirect('/signup');
      }

      user.emailVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;

      await user.save();

      req.flash('success', 'Your email has been verified! You may now create listings.')
      res.redirect('/');
    },

    postResendVerification: async (req, res) => {
      if (req.user.emailVerified) {
        req.flash('success', 'Your email is already verified.');
        return res.redirect('/profile');
      }

      const COOLDOWN_MS = 2 * 60 * 1000;
      const TOKEN_LIFETIME_MS = 60 * 60 * 1000;

      if (req.user.verificationTokenExpires) {
        const timeSinceIssued = TOKEN_LIFETIME_MS - (req.user.verificationTokenExpires - Date.now());
        if (timeSinceIssued < COOLDOWN_MS) {
          req.flash('errors', { msg: 'A verification email was already sent recently. Please wait a few minutes and try again.' });
          return res.redirect('/profile');
        }
      }

      const token = crypto.randomBytes(20).toString('hex');

      await User.findByIdAndUpdate(req.user._id, {
        verificationToken: hashToken(token),
        verificationTokenExpires: Date.now() + TOKEN_LIFETIME_MS,
      });

      try {
        await sendVerificationEmail(req.user, token);
        console.log('Welcome email sent to:', req.user.email);
      } catch (err) {
        console.error('Failed to send welcome email:', err.message);
      }

      req.flash('success', 'Verification email sent! Please check your inbox.');
      res.redirect('/profile');
    },

    getForgetPassword: async (req, res) => {
      if (req.user) {
        return res.redirect('/');
      }
      res.render('forgotPassword.ejs');
    },

    postForgetPassword: async (req, res) => {
      if (!validator.isEmail(req.body.email)) {
        req.flash('errors', { msg: 'Please enter a valid email address.' });
        return res.redirect('/recover');
      }

      const email = validator.normalizeEmail(req.body.email, { gmail_remove_dots: false });
      const user  = await User.findOne({ email });

      if (!user) {
        req.flash('success', 'If an account with that email exists, a reset link has been sent.');
        return res.redirect('/recover');
      }

      const token   = crypto.randomBytes(20).toString('hex');
      const expires = Date.now() + 3600000;

      user.passwordResetToken   = hashToken(token);
      user.passwordResetExpires = expires;
      await user.save();

      sendPasswordResetEmail(user, token)
        .then(() => console.log('Password reset email sent to:', user.email))
        .catch((mailErr) => console.error('Failed to send password reset email:', mailErr.message));

      req.flash('success', 'If an account with that email exists, a reset link has been sent.');
      res.redirect('/recover');
    },

    getResetPassword: async (req, res) => {
      const user = await User.findOne({
        passwordResetToken:   hashToken(req.params.token),
        passwordResetExpires: notExpired(),
      });

      if (!user) {
        req.flash('errors', { msg: 'Password reset link is invalid or has expired.' });
        return res.redirect('/recover');
      }

      res.render('resetPassword.ejs', { token: req.params.token });
    },

    postResetPassword: async (req, res, next) => {
      const validationErrors = [];

      if (typeof req.body.password !== 'string' || typeof req.body.confirmPassword !== 'string') {
        validationErrors.push({ msg: 'Invalid request.' });
      } else {
        if (!validator.isLength(req.body.password, { min: 8 })) {
          validationErrors.push({ msg: 'Password must be at least 8 characters long.' });
        }
        if (req.body.password !== req.body.confirmPassword) {
          validationErrors.push({ msg: 'Passwords do not match.' });
        }
      }

      if (validationErrors.length) {
        req.flash('errors', validationErrors);
        return res.redirect(`/recover/${req.params.token}`);
      }

      const user = await User.findOne({
        passwordResetToken:   hashToken(req.params.token),
        passwordResetExpires: notExpired(),
      });

      if (!user) {
        req.flash('errors', { msg: 'Password reset link is invalid or has expired.' });
        return res.redirect('/recover');
      }

      user.password             = req.body.password;
      user.passwordResetToken   = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      req.login(user, (err) => {
        if (err) return next(err);
        req.flash('success', 'Your password has been reset. Welcome back!');
        res.redirect('/');
      });
    },
}
