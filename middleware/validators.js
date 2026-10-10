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
const { CATEGORIES, SALE_TYPES } = require('../models/Auction')
const { parseMoney, DURATION_CHOICES } = require('../utils/bidding')

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

// A positive amount of money, read the same way the bidding code reads it
const isMoney = (value) => parseMoney(value) !== null

// Price fields only apply to one kind of listing, so each is checked only
// when the form chose that kind
const forFixedPrice = body('saleType').equals('fixed')
const forAuction = body('saleType').equals('auction')

// The name other people see, set during onboarding and on the edit page.
// The onboarding page already tells people it's 2 to 25 characters.
const displayNameField = (field) =>
  body(field)
    .isString().withMessage('Please enter a display name.').bail()
    .trim()
    .notEmpty().withMessage('Please enter a display name.').bail()
    .isLength({ min: 2 }).withMessage('Display name must be at least 2 characters.').bail()
    .isLength({ max: 25 }).withMessage('Display name cannot be longer than 25 characters.')

// A text field that has to be filled in, with a maximum length
const requiredText = (field, missingMessage, maxLength, tooLongMessage) =>
  body(field)
    .isString().withMessage(missingMessage).bail()
    .trim()
    .notEmpty().withMessage(missingMessage).bail()
    .isLength({ max: maxLength }).withMessage(tooLongMessage)

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

  // The create-listing form. Its route runs this after multer has read the
  // multipart form, and the controller checks the result before uploading
  // any photos, so a rejected listing never leaves photos in Cloudinary.
  validateListing: [
    requiredText('title', 'Enter a title for your listing.', 100, 'Titles can be up to 100 characters.'),
    requiredText('description', 'Enter a description for your listing.', 2000, 'Descriptions can be up to 2000 characters.'),
    body('category')
      .isString().withMessage('Choose a category.').bail()
      .isIn(CATEGORIES).withMessage('Choose a category.'),
    body('saleType')
      .isString().withMessage('Choose fixed price or auction.').bail()
      .isIn(SALE_TYPES).withMessage('Choose fixed price or auction.'),
    body('price')
      .if(forFixedPrice)
      .isString().withMessage('Enter a valid price for your listing.').bail()
      .custom(isMoney).withMessage('Enter a valid price for your listing.'),
    body('startingPrice')
      .if(forAuction)
      .isString().withMessage('Enter a valid starting price for your auction.').bail()
      .custom(isMoney).withMessage('Enter a valid starting price for your auction.'),
    // Optional: an empty increment means $1.00, as before
    body('minIncrement')
      .if(forAuction)
      .optional({ values: 'falsy' })
      .isString().withMessage('Enter a valid minimum bid increment.').bail()
      .custom(isMoney).withMessage('Enter a valid minimum bid increment.'),
    body('durationDays')
      .if(forAuction)
      .isString().withMessage('Choose a valid auction duration.').bail()
      .isInt().withMessage('Choose a valid auction duration.').bail()
      .custom((value) => DURATION_CHOICES.includes(Number(value))).withMessage('Choose a valid auction duration.'),
    body('video')
      .optional({ values: 'falsy' })
      .isString().withMessage('Enter a valid video link.').bail()
      .trim()
      .isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('Enter a valid video link.'),
  ],

  validateBid: [
    body('amount')
      .isString().withMessage('Enter a valid bid amount.').bail()
      .custom(isMoney).withMessage('Enter a valid bid amount.'),
  ],

  validateComment: [
    requiredText('body', 'Please enter a comment.', 1000, 'Comments cannot be longer than 1000 characters.'),
  ],

  validateOnboard: [
    displayNameField('displayName'),
  ],

  // The edit form names its display name field "userName"
  validateProfileEdit: [
    displayNameField('userName'),
  ],
}
