const express = require('express')
const router = express.Router()
const auctionController = require('../controllers/auction') 
const upload = require("../middleware/multer");

router.get('/', auctionController.getAuction);
router.post('/', upload.single('file'), auctionController.postAuction);
router.delete('/deleteListing/:id', auctionController.deleteListing)

module.exports = router;