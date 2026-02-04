const Auction = require('../models/Auction')
const cloudinary = require("../middleware/cloudinary");

module.exports = {

    getAuction: async (req, res) => {
        try {
            const listings = await Auction.find({}).sort({ createdAt: -1 }).populate('user', 'image displayName').lean();
            res.render('auction.ejs', {
                listings: listings
            });
        } catch(err) {
            console.error(err)
            res.status(500).render('500.ejs');
        }
    },

    postAuction: async (req, res) => {

        try {
            let imageUrl = null;
            let cloudinaryId = null;

            if (req.file) {
                const result = await cloudinary.uploader.upload(req.file.path, {
                    use_filename: true,
                    unique_filename: false,
                    overwrite: true
                });
                imageUrl = result.secure_url;
                cloudinaryId = result.public_id

            }

            await Auction.create({
                    title: req.body.title,
                    description: req.body.description,
                    image: imageUrl,
                    video: req.body.video,
                    user: req.user.id,
                    cloudinaryId: cloudinaryId,
                    category: req.body.category
                })

                console.log('Listing has been added!')
                res.redirect('/auction')
            } catch(err) {
                console.log(err)
                res.status(500).render('500.ejs');
            }
        },

        deleteAuction: async (req, res) => {

            try {
                const listing = await Auction.findById(req.params.id);

                if (!listing) {
                    return res.status(404).render('404.ejs');
                }
                
                if (listing.user.toString() !== req.user.id) {
                    return res.status(403).send('You can only delete your own listings');
                }

                await Auction.findByIdAndDelete(req.params.id)
                console.log('Deleted listing')
                res.redirect('/auction')
                
            } catch(err) {
                console.log(err)
                res.status(500).render('500.ejs');
            }

        },

        getDetailedAuction: async (req, res) => {
            try {
                res.render('detailedAuction.ejs');
            } catch(err) {
                console.error(err)
                res.status(500).render('500.ejs');
            }
        },
    
}