const express = require('express');
const router = express.Router();
const homeController = require('../controllers/home');
const authController = require('../controllers/auth');
const onboardController = require('../controllers/onboard');
const termController = require('../controllers/term');

router.get('/', homeController.getIndex);

router.get('/login', authController.getLogin);
router.get('/signup', authController.getSignup);
router.post('/signup', authController.postSignup);
router.post('/login', authController.postLogin);
router.get('/logout', authController.getLogout);
router.get('/verify/:token', authController.getVerified);

router.get('/onboard', onboardController.getOnboard);
router.post('/onboard', onboardController.postOnboard);

router.get('/terms', termController.getTerms);
router.get('/privacy', termController.getPrivacy);

module.exports = router;