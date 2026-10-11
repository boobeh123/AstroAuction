/**************************************************************
 * validators.js
 * One express-validator chain per form. A route runs the chain before
 * its controller, and the controller checks the result with formErrors()
 * before reading the cleaned-up input with matchedData().
 *
 * Every field starts with .isString(), so an object or a list can't
 * arrive where text belongs. The messages are the ones the forms
 * already showed, except that the money fields now name their limits.
 **************************************************************/
const { body, validationResult } = require('express-validator')
const { CATEGORIES, SALE_TYPES } = require('../model/Auction')
const { DURATION_CHOICES, AMOUNT_LIMITS, INCREMENT_LIMITS } = require('../utils/bidding')

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

// "$100,000.00", for the messages below
const dollars = (value) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const AMOUNT_RANGE = `from ${dollars(AMOUNT_LIMITS.min)} to ${dollars(AMOUNT_LIMITS.max)}`
const INCREMENT_RANGE = `from ${dollars(INCREMENT_LIMITS.min)} to ${dollars(INCREMENT_LIMITS.max)}`

// An amount in dollars and cents ("25", "25.5" or "25.50") within the given
// limits. isDecimal rules out letters, exponents like 1e300 and fractions of
// a cent; isFloat checks the range. The chain passed in already has any
// .if() or .optional() the field needs.
const moneyField = (chain, { min, max }, message) =>
  chain
    .isString().withMessage(message).bail()
    .trim()
    .isDecimal({ decimal_digits: '0,2' }).withMessage(message).bail()
    .isFloat({ min, max }).withMessage(message)

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
    moneyField(body('price').if(forFixedPrice), AMOUNT_LIMITS, `Enter a valid price ${AMOUNT_RANGE}.`),
    moneyField(body('startingPrice').if(forAuction), AMOUNT_LIMITS, `Enter a valid starting price ${AMOUNT_RANGE}.`),
    // Optional: an empty increment means $1.00, as before
    moneyField(
      body('minIncrement').if(forAuction).optional({ values: 'falsy' }),
      INCREMENT_LIMITS,
      `Enter a valid minimum bid increment ${INCREMENT_RANGE}.`
    ),
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
    moneyField(body('amount'), AMOUNT_LIMITS, `Enter a valid bid ${AMOUNT_RANGE}.`),
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
