const express = require('express')
const router = express.Router()
const profileController = require('../controllers/profile') 
const upload = require("../middleware/multer");
const { ensureAuth } = require('../middleware/auth');

router.get('/', profileController.getProfile);
router.post('/', ensureAuth, upload.single('file'), profileController.uploadProfilePicture);
router.get('/edit', ensureAuth, profileController.getEditProfile);
router.put('/edit/:id', ensureAuth, profileController.updateProfile);
router.delete('/delete/:id', ensureAuth, profileController.deleteProfile);

module.exports = router;