const express = require('express')
const router = express.Router()
const auctionController = require('../controllers/auction') 
const upload = require("../middleware/multer");
const handleUploadErrors = require("../middleware/handleUploadErrors");
const { ensureAuth } = require('../middleware/auth');

router.get('/', auctionController.getAuction);
router.post('/', ensureAuth, upload.array('file', 10), handleUploadErrors('/auction'), auctionController.postAuction);
router.delete('/deleteAuction/:id', ensureAuth, auctionController.deleteAuction);

router.get('/viewAuction/:id', auctionController.getDetailedAuction)
router.post('/viewAuction/:id/comments', ensureAuth, auctionController.postComment);
router.post('/viewAuction/:id/bids', ensureAuth, auctionController.postBid);

module.exports = router;
