const { body } = require('express-validator');

const ensureAccountValidation = [
    body('email').trim().isEmail().withMessage('Please enter a valid email address.').bail().normalizeEmail({ gmail_remove_dots: false }),
    body('password').isLength({ min: 3, max: 128 }).withMessage('Password must be at least 3-128 characters'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.password) throw new Error('Passwords do not match');
        return true;
    }),
    body('agreeToTerms').equals('yes').withMessage('You must agree to the Terms of Use')
];

const ensureLoginValidation = [
    body('email').trim().isEmail().withMessage('Enter a valid email').bail().normalizeEmail({ gmail_remove_dots: false }),
    body('password').notEmpty().withMessage('Password cannot be blank').isLength({ min: 3 }).withMessage('Password must be at least 3 characters').isLength({ max: 128 }).withMessage('Password cannot be longer than 128 characters')
];

module.exports = { ensureLoginValidation, ensureAccountValidation };