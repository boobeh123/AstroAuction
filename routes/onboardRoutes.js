const express = require('express');
const router = express.Router();
const onboardController = require('../controller/onboardController');
const { ensureAuth } = require('../middleware/auth');
const { validateOnboard } = require('../middleware/validators');

// Mounted at /onboard in server.js
router.get('/', ensureAuth, onboardController.getOnboard);
router.post('/', ensureAuth, validateOnboard, onboardController.postOnboard);

module.exports = router;
