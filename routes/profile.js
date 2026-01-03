const express = require('express')
const router = express.Router()
const profileController = require('../controllers/profile') 
const upload = require("../middleware/multer");

router.get('/', profileController.getProfile);
router.post('/', upload.single('file'), profileController.uploadProfilePicture);

module.exports = router;