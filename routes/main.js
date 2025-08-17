const express = require('express');
const router = express.Router();
const homeController = require('../controllers/home');
const authController = require('../controllers/auth');
const { body } = require('express-validator');
const passport = require('passport')


router.get('/', homeController.getIndex);

router.get('/login', authController.getLogin);
router.get('/signup', authController.getSignup);

const ensureAccountValidation = [
    body('email')
    .isEmail().withMessage('Please enter a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false }),
    body('password')
    .isLength({ min: 3 }).withMessage('Password must be at least 3 characters long'),
    body('confirmPassword')
    .custom((value, { req }) => {
        if (value !== req.body.password) throw new Error('Passwords do not match');
        return true;
    }),
    body('agreeToTerms')
    .equals('yes').withMessage('You must agree to the Terms of Use')
];
router.post('/signup', ensureAccountValidation, authController.postSignup);

const ensureLoginValidation = [
    body('email').isEmail().withMessage('Enter a valid email').normalizeEmail({ gmail_remove_dots: false }),
    body('password').notEmpty().withMessage('Password cannot be blank')
];
router.post('/login', ensureLoginValidation, authController.postLogin);

router.get('/logout', authController.getLogout);

module.exports = { router, ensureLoginValidation };