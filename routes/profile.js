const express = require('express')
const router = express.Router()
const profileController = require('../controllers/profile') 
const upload = require("../middleware/multer");
const handleUploadErrors = require("../middleware/handleUploadErrors");
const { ensureAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiters');
const authController = require('../controllers/auth');

router.get('/', ensureAuth, profileController.getProfile);
router.post('/', ensureAuth, upload.single('file'), handleUploadErrors('/profile'), profileController.uploadProfilePicture);
router.get('/edit', ensureAuth, profileController.getEditProfile);
router.put('/edit/:id', ensureAuth, profileController.updateProfile);
router.delete('/delete/:id', ensureAuth, profileController.deleteProfile);

router.post('/resend-verification', authLimiter, ensureAuth, authController.postResendVerification);

module.exports = router;
