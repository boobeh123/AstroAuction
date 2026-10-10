const express = require('express')
const router = express.Router()
const tutorialController = require('../controller/tutorialController')
const { ensureAuth } = require('../middleware/auth')

router.post('/dismiss', ensureAuth, tutorialController.postDismiss)

module.exports = router
