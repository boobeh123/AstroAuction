const mongoose = require('mongoose')
const Auction = require('../models/Auction')
const cloudinary = require("../middleware/cloudinary");
const fs = require('fs/promises');

// Handles youtube.com/watch?v=, youtu.be/, and youtube.com/embed/ links,
// with or without extra query params (timestamps, playlists, etc).
// Returns null if the URL doesn't contain a recognizable video ID, so the
// template can cleanly skip rendering an embed for anything malformed.
function extractYouTubeId(url) {
    if (typeof url !== 'string') return null;
    const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
    return match ? match[1] : null;
}

module.exports = {

    getAuction: async (req, res) => {
        try {
            const listings = await Auction.find({}).sort({ createdAt: -1 }).populate('user', 'image displayName').lean();
            res.render('auction.ejs', {
                listings: listings
            });
        } catch(err) {
            console.error(err)
            res.status(500).render('errors/500.ejs');
        }
    },

    postAuction: async (req, res) => {

        try {
            let images = [];
            let cloudinaryIds = [];

            if (req.files && req.files.length > 0) {
                const uploadResults = await Promise.all(
                    req.files.map((file) =>
                        cloudinary.uploader.upload(file.path, {
                            use_filename: true,
                            unique_filename: false,
                            overwrite: true
                        })
                    )
                );

                images = uploadResults.map((result) => result.secure_url);
                cloudinaryIds = uploadResults.map((result) => result.public_id);
            }

            await Auction.create({
                    title: req.body.title,
                    description: req.body.description,
                    images: images,
                    video: req.body.video,
                    user: req.user.id,
                    cloudinaryIds: cloudinaryIds,
                    category: req.body.category
                })

                console.log('Listing has been added!')
                res.redirect('/auction')
            } catch(err) {
                console.error(err)
                res.status(500).render('errors/500.ejs');
            } finally {
                if (req.files && req.files.length > 0) {
                    await Promise.all(
                        req.files.map((file) =>
                            fs.unlink(file.path).catch((unlinkErr) => {
                                console.error('Failed to remove temp upload:', unlinkErr.message);
                            })
                        )
                    );
                }
            }
        },

        deleteAuction: async (req, res) => {

            try {
                if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                    return res.status(404).render('errors/404.ejs');
                }

                const listing = await Auction.findById(req.params.id);

                if (!listing) {
                    return res.status(404).render('errors/404.ejs');
                }
                
                if (listing.user.toString() !== req.user.id) {
                    req.flash('error', 'You can only delete your own listings');
                    return res.status(403).render('errors/403.ejs');
                }

                if (listing.cloudinaryIds && listing.cloudinaryIds.length > 0) {
                    await Promise.all(
                        listing.cloudinaryIds.map((id) =>
                            cloudinary.uploader.destroy(id).catch((destroyErr) => {
                                console.error('Failed to remove Cloudinary asset:', destroyErr.message);
                            })
                        )
                    );
                }

                await Auction.findByIdAndDelete(req.params.id)
                console.log('Deleted listing')
                res.redirect('/auction')
                
            } catch(err) {
                console.error(err)
                res.status(500).render('errors/500.ejs');
            }

        },

        getDetailedAuction: async (req, res) => {
            try {
                if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                    return res.status(404).render('errors/404.ejs');
                }

                const listing = await Auction.findById(req.params.id).populate('user', 'image displayName createdAt').lean();

                if (!listing) {
                    return res.status(404).render('errors/404.ejs');
                }

                const youtubeId = extractYouTubeId(listing.video);
                const videoEmbedUrl = youtubeId ? `https://www.youtube-nocookie.com/embed/${youtubeId}` : null;

                res.render('detailedAuction.ejs', {
                    listing: listing,
                    videoEmbedUrl: videoEmbedUrl
                });

            } catch(err) {
                console.error(err)
                res.status(500).render('errors/500.ejs');
            }
        },
    
}
