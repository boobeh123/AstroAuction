const express = require('express')
const router = express.Router()
const auctionController = require('../controllers/auction') 
const upload = require("../middleware/multer");
const handleUploadErrors = require("../middleware/handleUploadErrors");
const { ensureAuth, ensureAuctioneer } = require('../middleware/auth');

router.get('/', auctionController.getAuction);
router.post('/', ensureAuth, upload.array('file', 10), handleUploadErrors('/auction'), auctionController.postAuction);
router.delete('/deleteAuction/:id', ensureAuth, auctionController.deleteAuction);

router.get('/viewAuction/:id', auctionController.getDetailedAuction)
router.post('/postComment/:id', ensureAuth, auctionController.postComment);
router.post('/postBid/:id', ensureAuth, auctionController.postBid);
router.post('/toggleSpotlight/:id', ensureAuth, ensureAuctioneer, auctionController.postToggleHighlight);

module.exports = router;
