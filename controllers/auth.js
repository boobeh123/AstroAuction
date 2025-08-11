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
                req.flash('errors', errors.array().map(e => e.msg));
                return res.status(400).redirect('/signup');
            }
            
            if (existingUser) {
                req.flash('errors', 'Account with that email already exists.');
                return res.status(400).redirect('/signup');
            }

              const user = new User({
                email,
                password,
                agreeToTerms,
              })
              req.flash('success', 'Account created. Please log in.');
              await user.save();
              return res.redirect('/login');

        } catch (err) {
            req.flash('errors', 'Unexpected error. Please try again.');
            return res.status(500).redirect('/signup');
        }
    }
}