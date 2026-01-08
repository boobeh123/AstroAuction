const express = require('express')
const router = express.Router()
const auctionController = require('../controllers/auction') 

router.get('/', auctionController.getAuction);
router.post('/', auctionController.postAuction);
router.delete('/deleteListing/:id', auctionController.deleteListing)

module.exports = router;