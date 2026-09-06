const express = require('express')
const router = express.Router()
const auctionController = require('../controllers/auction') 
const upload = require("../middleware/multer");
const { ensureAuth } = require('../middleware/auth');

router.get('/', auctionController.getAuction);
router.post('/', ensureAuth, upload.array('file', 10), auctionController.postAuction);
router.delete('/deleteAuction/:id', ensureAuth, auctionController.deleteAuction);

router.get('/viewAuction/:id', auctionController.getDetailedAuction)

module.exports = router;
