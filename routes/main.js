const express = require('express');
const router = express.Router();
const homeController = require('../controllers/home');
const authController = require('../controllers/auth');
const onboardController = require('../controllers/onboard');
const termController = require('../controllers/term');
const { ensureAuth } = require('../middleware/auth');


router.get('/', homeController.getIndex);

router.get('/login', authController.getLogin);
router.get('/signup', authController.getSignup);
router.post('/signup', authController.postSignup);
router.post('/login', authController.postLogin);
router.get('/logout', authController.getLogout);
// router.get('/verify/:token', authController.getVerified);
router.get('/recover', authController.getForgetPassword);
// router.post('/recover', authController.postForgetPassword);
// router.get('/recover/:token', authController.getResetPassword);
// router.post('/recover/:token', authController.postResetPassword);

router.get('/onboard', ensureAuth, onboardController.getOnboard);
router.post('/onboard', ensureAuth, onboardController.postOnboard);

router.get('/terms', termController.getTerms);
router.get('/privacy', termController.getPrivacy);

module.exports = router;