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
    }
    
}