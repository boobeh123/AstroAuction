const express = require('express')
const router = express.Router()
const profileController = require('../controller/profileController') 
const upload = require("../middleware/multer");
const handleUploadErrors = require("../middleware/handleUploadErrors");
const { ensureAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiters');
const { validateProfileEdit } = require('../middleware/validators');
const authController = require('../controller/authController');

router.get('/', ensureAuth, profileController.getProfile);
router.post('/', ensureAuth, upload.single('file'), handleUploadErrors('/profile'), profileController.uploadProfilePicture);
router.get('/edit', ensureAuth, profileController.getEditProfile);
router.put('/edit/:id', ensureAuth, validateProfileEdit, profileController.updateProfile);
router.delete('/delete/:id', ensureAuth, profileController.deleteProfile);

router.post('/resend-verification', authLimiter, ensureAuth, authController.postResendVerification);

module.exports = router;
