const express = require('express')
const router = express.Router()
const auctionController = require('../controllers/auction') 

router.get('/', auctionController.getAuction);
router.post('/', auctionController.postAuction);

module.exports = router;