const { body } = require('express-validator');

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

const ensureLoginValidation = [
    body('email').isEmail().withMessage('Enter a valid email').normalizeEmail({ gmail_remove_dots: false }),
    body('password').notEmpty().withMessage('Password cannot be blank')
];

module.exports = { ensureLoginValidation, ensureAccountValidation };