const express = require('express');
const router = express.Router();
const termController = require('../controller/termController');

router.get('/terms', termController.getTerms);
router.get('/privacy', termController.getPrivacy);

module.exports = router;
