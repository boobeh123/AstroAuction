const passport = require('passport')
const { validationResult } = require('express-validator');
const User = require('../models/User')

module.exports = {

    getLogin: (req, res) => {
        // if Authenticated, redirect - ToDO
        res.render('login.ejs');
    },

    getSignup: (req, res) => {
        res.render('signup.ejs');
    },

    postSignup: async (req, res, next) => {

        try {
            const errors = validationResult(req);
            const { email, password, confirmPassword, agreeToTerms } = req.body;
            const existingUser = await User.findOne({ email: email }).lean();

            if (!errors.isEmpty()) {
                return res.status(400).redirect('/signup');
            }
            
            if (existingUser) {
                // req.flash('errors', { msg: 'Account with that email address or username already exists.' });
                return res.status(400).redirect('/signup');
            }

              const user = new User({
                email,
                password,
                agreeToTerms,
              })

              await user.save();
              return res.redirect('/login');

        } catch (err) {
            return next(err);
        }
    }
}