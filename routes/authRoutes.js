const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');
const { ensureAuth } = require('../middleware/auth');
const { loginLimiter, authLimiter } = require('../middleware/rateLimiters');
const {
  validateSignup,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} = require('../middleware/validators');


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

// The "resend verification email" button is on the profile page, so its URL
// stays under /profile. The route lives here with the rest of authController.
router.post('/profile/resend-verification', authLimiter, ensureAuth, authController.postResendVerification);

module.exports = router;
