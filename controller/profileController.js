const mongoose = require('mongoose')
const { matchedData } = require('express-validator')
const User = require('../model/User')
const Auction = require('../model/Auction')
const Message = require('../model/Message')
const cloudinary = require("../config/cloudinary");
const fs = require('fs/promises');
const { formErrors } = require('../middleware/validators')
const { deleteListings } = require('../services/listingCleanup')

// Unexpected errors aren't caught here: Express 5 passes anything thrown in
// these handlers to middleware/errorHandler.js, which logs it and shows the
// 500 page.
module.exports = {

    getProfile: async (req, res) => {
        res.render('profile.ejs');
    },

    uploadProfilePicture: async (req, res) => {
        // The form requires a file, but a request doesn't have to come from the form
        if (!req.file) {
            req.flash('errors', { msg: 'Choose a photo to upload first.' })
            return res.redirect('/profile')
        }

        try {
            const currentUser = await User.findById(req.user.id).lean()

            // Replacing a photo deletes the old one, but only after the new one
            // is uploaded and saved. A failed upload leaves the current photo in
            // place instead of a broken image.
            const result = await cloudinary.uploader.upload(req.file.path, {
                use_filename: true,
                unique_filename: false,
                overwrite: true,
                width: 100,
                height: 100,
                gravity: "faces",
                crop: "thumb"
            });

            await User.findByIdAndUpdate(req.user.id, {
                image: result.secure_url,
                cloudinaryId: result.public_id
            })

            // The new photo is saved by now, so a failure here is only logged
            if (currentUser.cloudinaryId && currentUser.cloudinaryId !== result.public_id) {
                await cloudinary.uploader.destroy(currentUser.cloudinaryId).catch((destroyErr) => {
                    console.error('Failed to remove old profile picture:', destroyErr.message);
                });
            }

            console.log('Profile picture added')
            res.redirect('/profile')
        } finally {
            await fs.unlink(req.file.path).catch((unlinkErr) => {
                console.error('Failed to remove temp upload:', unlinkErr.message);
            });
        }
    },

    getEditProfile: async (req, res) => {
        res.render('editProfile.ejs');
    },

    updateProfile: async (req, res) => {
        const errors = formErrors(req)
        if (!errors.isEmpty()) {
            req.flash('errors', errors.array())
            return res.redirect('/profile/edit')
        }

        // The edit form names its display name field "userName"
        const { userName: displayName } = matchedData(req)

        await User.findByIdAndUpdate(req.user._id, {
            displayName,
        })

        console.log('Profile updated')
        res.redirect('/profile')
    },

    deleteProfile: async (req, res) => {
        if (req.params.id !== req.user._id.toString()) {
            return res.status(403).render('errors/403.ejs');
        }

        const currentUser = await User.findById(req.user._id).lean();

        if (!currentUser) {
            req.flash('error', 'User not found');
            return res.redirect('/');
        }

        // People are still waiting on an account that's in the middle of an
        // auction: bidders on its listing, or the seller whose auction it's
        // winning. trusted(): see the note in auctionController.postBid
        const midAuction = await Auction.exists({
            saleType: 'auction',
            status: 'open',
            $or: [
                { user: req.user._id, bidCount: mongoose.trusted({ $gt: 0 }) },
                { currentBidder: req.user._id },
            ],
        });

        if (midAuction) {
            req.flash('errors', { msg: "You can't delete your account while you have an auction with bids, or while you're the highest bidder on one. You can delete it once those auctions end." });
            return res.redirect('/profile');
        }

        // The account's listings go with it, along with their photos, comments
        // and bids. Its comments and bids on other people's listings stay,
        // shown as "Removed user".
        const listings = await Auction.find({ user: req.user._id }).select('cloudinaryIds').lean();
        await deleteListings(listings);

        // Messages are private between two people, and the conversation can't
        // go on without this account, so every message it sent or received
        // goes too, including those on other people's listings
        await Message.deleteMany({ $or: [{ sender: req.user._id }, { recipient: req.user._id }] });

        if (currentUser.cloudinaryId) {
            await cloudinary.uploader.destroy(currentUser.cloudinaryId)
        }

        await User.deleteOne({_id: req.user._id});

        req.logout((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.redirect('/');
            }

            console.log('Profile deleted')
            res.redirect('/');
        });
    },
}
