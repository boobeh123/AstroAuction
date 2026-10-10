const express = require('express');
const router = express.Router();
const homeController = require('../controllers/home');
const authController = require('../controllers/auth');
const onboardController = require('../controllers/onboard');
const termController = require('../controllers/term');
const { ensureAuth } = require('../middleware/auth');
const { loginLimiter, authLimiter } = require('../middleware/rateLimiters');
const {
  validateSignup,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateOnboard,
} = require('../middleware/validators');


router.get('/', homeController.getIndex);

router.get('/login', authController.getLogin);
router.get('/signup', authController.getSignup);
router.post('/signup', authLimiter, validateSignup, authController.postSignup);
router.post('/login', loginLimiter, validateLogin, authController.postLogin);
router.get('/logout', authController.getLogout);
router.get('/verify/:token', authController.getVerified);
router.get('/recover', authController.getForgetPassword);
router.post('/recover', authLimiter, validateForgotPassword, authController.postForgetPassword);
router.get('/recover/:token', authController.getResetPassword);
router.post('/recover/:token', authLimiter, validateResetPassword, authController.postResetPassword);

router.get('/onboard', ensureAuth, onboardController.getOnboard);
router.post('/onboard', ensureAuth, validateOnboard, onboardController.postOnboard);

router.get('/terms', termController.getTerms);
router.get('/privacy', termController.getPrivacy);

module.exports = router;