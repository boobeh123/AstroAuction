const passport = require('passport')
const validator = require('express-validator')
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
//      TODO - validation, success msg, redirect
        try {
            const { email, password, confirmPassword, agreeToTerms } = req.body;
            const existingUser = await User.findOne({
                $or: [{ email: email }, { userName: req.body.userName }]
              }).lean();

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

        // const validationErrors = []
        // if (!validator.isEmail(req.body.email)) validationErrors.push({ msg: 'Please enter a valid email address.' })
        // if (!validator.isLength(req.body.password, { min: 8 })) validationErrors.push({ msg: 'Password must be at least 8 characters long' })
        // if (req.body.password !== req.body.confirmPassword) validationErrors.push({ msg: 'Passwords do not match' })
      
        // if (validationErrors.length) {
        //   req.flash('errors', validationErrors)
        //   return res.redirect('../signup')
        // }
        // req.body.email = validator.normalizeEmail(req.body.email, { gmail_remove_dots: false })
      
    //     const user = new User({
    //       email: req.body.email,
    //       password: req.body.password,
    //       agreeToTerms: req.body.agreeToTerms
    //     })
      
    //     User.findOne({$or: [
    //       {email: req.body.email},
    //       {userName: req.body.userName}
    //     ]}, (err, existingUser) => {
    //       if (err) { return next(err) }
    //       if (existingUser) {
    //         req.flash('errors', { msg: 'Account with that email address or username already exists.' })
    //         return res.redirect('../signup')
    //       }
    //       user.save((err) => {
    //         if (err) { return next(err) }
    //         req.logIn(user, (err) => {
    //           if (err) {
    //             return next(err)
    //           }
    //           res.redirect('/')
    //         })
    //       })
    //     })
    }
    
}