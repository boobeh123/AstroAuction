const express = require('express')
const router = express.Router()
const auctionController = require('../controller/auctionController') 
const upload = require("../middleware/multer");
const handleUploadErrors = require("../middleware/handleUploadErrors");
const { ensureAuth, ensureAuctioneer, ensureVerified } = require('../middleware/auth');
const { validateListing, validateComment, validateMessage, validateBid, validateListingsPage } = require('../middleware/validators');
const { commentLimiter, messageLimiter, bidLimiter } = require('../middleware/rateLimiters');

router.get('/', validateListingsPage, auctionController.getAuction);
// validateListing comes after multer, which is what reads the form's fields
router.post('/', ensureAuth, ensureVerified, upload.array('file', 10), handleUploadErrors('/auction'), validateListing, auctionController.postAuction);
router.delete('/deleteAuction/:id', ensureAuth, auctionController.deleteAuction);

router.get('/viewAuction/:id', auctionController.getDetailedAuction)
router.post('/postComment/:id', ensureAuth, commentLimiter, validateComment, auctionController.postComment);
router.post('/postMessage/:id', ensureAuth, messageLimiter, validateMessage, auctionController.postMessage);
router.post('/postBid/:id', ensureAuth, ensureVerified, bidLimiter, validateBid, auctionController.postBid);
router.post('/toggleSpotlight/:id', ensureAuth, ensureAuctioneer, auctionController.postToggleHighlight);

module.exports = router;
