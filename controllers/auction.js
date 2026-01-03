const Auction = require('../models/Auction')
const User = require('../models/User')

module.exports = {

    getAuction: async (req, res) => {
        try {
            const listings = await Auction.find({}).sort({ createdAt: -1 }).lean();
            res.render('auction.ejs', {
                listings: listings,
                user: req.user
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
                    video: req.body.video
                })
                console.log('Listing has been added!')
                res.redirect('/auction')
            } catch(err) {
                console.log(err)
                // redirect 404 todo or could be status 500?
                res.render('404.ejs');
            }
        },
    
}