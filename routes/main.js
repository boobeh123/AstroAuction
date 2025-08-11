const express = require('express');
const router = express.Router();
const homeController = require('../controllers/home');
const authController = require('../controllers/auth');
const { body } = require('express-validator');

router.get('/', homeController.getIndex);

router.get('/login', authController.getLogin);
router.get('/signup', authController.getSignup);

const ensureAccountValidation = [
    body('email')
    .isEmail().withMessage('Please enter a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false }),
    body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('confirmPassword')
    .custom((value, { req }) => {
        if (value !== req.body.password) throw new Error('Passwords do not match');
        return true;
    }),
    body('agreeToTerms')
    .equals('yes').withMessage('You must agree to the Terms of Use')
];
router.post('/signup', ensureAccountValidation, authController.postSignup);

module.exports = router;