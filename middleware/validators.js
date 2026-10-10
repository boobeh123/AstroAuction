/**************************************************************
 * validators.js
 * One express-validator chain per form. A route runs the chain before
 * its controller, and the controller checks the result with formErrors()
 * before reading the cleaned-up input with matchedData().
 *
 * Every field starts with .isString(), so an object or a list can't
 * arrive where text belongs. The messages are the ones the forms
 * already showed.
 **************************************************************/
const { body, validationResult } = require('express-validator')

// Only the message goes into the flash. express-validator's default error
// objects also carry what was typed, which would store passwords in the
// session database until the next page showed the message.
const formErrors = validationResult.withDefaults({
  formatter: (error) => ({ msg: error.msg }),
})

// The same email clean-up the app has always used, so existing accounts
// still match: lowercase, with +tags removed for Gmail and similar
// providers, but the dots in Gmail addresses kept.
const emailField = () =>
  body('email')
    .isString().withMessage('Please enter a valid email address.').bail()
    .trim()
    .isEmail().withMessage('Please enter a valid email address.').bail()
    .normalizeEmail({ gmail_remove_dots: false })

// Matches the confirmation box against the password box
const matchesPassword = (value, { req }) => value === req.body.password

const TERMS_MESSAGE = 'Please agree to the Terms of Use and Privacy Policy.'

module.exports = {
  formErrors,

  validateSignup: [
    emailField(),
    body('password')
      .isString().withMessage('Password must be at least 8 characters long').bail()
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('confirmPassword')
      .isString().withMessage('Passwords do not match').bail()
      .custom(matchesPassword).withMessage('Passwords do not match'),
    // The checkbox sends "yes" when ticked and nothing when it isn't
    body('agreeToTerms')
      .isString().withMessage(TERMS_MESSAGE).bail()
      .equals('yes').withMessage(TERMS_MESSAGE),
  ],

  validateLogin: [
    emailField(),
    body('password')
      .isString().withMessage('Password cannot be blank.').bail()
      .notEmpty().withMessage('Password cannot be blank.'),
  ],

  validateForgotPassword: [
    emailField(),
  ],

  validateResetPassword: [
    body('password')
      .isString().withMessage('Invalid request.').bail()
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.'),
    body('confirmPassword')
      .isString().withMessage('Invalid request.').bail()
      .custom(matchesPassword).withMessage('Passwords do not match.'),
  ],
}
