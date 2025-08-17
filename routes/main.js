const express = require('express');
const router = express.Router();
const homeController = require('../controllers/home');
const authController = require('../controllers/auth');
const passport = require('passport')
const { ensureLoginValidation, ensureAccountValidation } = require('../middleware/auth');

router.get('/', homeController.getIndex);
router.get('/login', authController.getLogin);
router.get('/signup', authController.getSignup);
router.post('/signup', ensureAccountValidation, authController.postSignup);
router.post('/login', ensureLoginValidation, authController.postLogin);
router.get('/logout', authController.getLogout);

module.exports = router;