const Auction = require('../models/Auction')

module.exports = {

    getAuction: async (req, res) => {
        try {
            const listings = await Auction.find({}).sort({ createdAt: -1 }).populate('user', 'image firstName').lean();
            res.render('auction.ejs', {
                listings: listings,
                user: req.user || null,

            });
        } catch(err) {
            console.error(err)
            // redirect 404 todo or could be status 500?
            res.render('404.ejs');
        }
    },

    postAuction: async (req, res) => {

        try {
            await Auction.create({
                    title: req.body.title,
                    description: req.body.description,
                    image: req.body.image,
                    video: req.body.video,
                    user: req.user.id
                })
                console.log('Listing has been added!')
                res.redirect('/auction')
            } catch(err) {
                console.log(err)
                // redirect 404 todo or could be status 500?
                res.render('404.ejs');
            }
        },

        deleteListing: async (req, res) => {

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
                res.render('404.ejs');
            }

        },
    
}