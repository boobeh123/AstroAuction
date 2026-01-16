const express = require('express')
const router = express.Router()
const auctionController = require('../controllers/auction') 
const upload = require("../middleware/multer");

router.get('/', auctionController.getAuction);
router.post('/', upload.single('file'), auctionController.postAuction);
router.delete('/deleteAuction/:id', auctionController.deleteAuction);

router.get('/viewAuction/:id', auctionController.getDetailedAuction)

module.exports = router;