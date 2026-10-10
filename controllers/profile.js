const User = require('../models/User')
const cloudinary = require("../middleware/cloudinary");
const fs = require('fs/promises');

// Unexpected errors aren't caught here: Express 5 passes anything thrown in
// these handlers to middleware/errorHandler.js, which logs it and shows the
// 500 page.
module.exports = {

    getProfile: async (req, res) => {
        res.render('profile.ejs');
    },

    uploadProfilePicture: async (req, res) => {

        try {
            const currentUser = await User.findById(req.user.id).lean()

            if (currentUser.cloudinaryId) {
                await cloudinary.uploader.destroy(currentUser.cloudinaryId)
            }

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

            console.log('Profile picture added')
            res.redirect('/profile')
        } finally {
            if (req.file) {
                await fs.unlink(req.file.path).catch((unlinkErr) => {
                    console.error('Failed to remove temp upload:', unlinkErr.message);
                });
            }
        }
    },

    getEditProfile: async (req, res) => {
        res.render('editProfile.ejs');
    },

    updateProfile: async (req, res) => {
        const displayName = typeof req.body.userName === 'string' ? req.body.userName.trim() : ''

        if (!displayName) {
            req.flash('errors', { msg: 'Please enter a display name.', field: 'displayName' })
            return res.redirect('/profile/edit')
        }

        if (displayName.length > 25) {
            req.flash('errors', { msg: 'Display name cannot be longer than 25 characters.', field: 'displayName' })
            return res.redirect('/profile/edit')
        }

        await User.findByIdAndUpdate(req.user._id, {
            displayName,
        })

        console.log('Profile updated')
        res.redirect('/profile')
    },

    deleteProfile: async (req, res) => {
        if (req.params.id !== req.user._id.toString()) {
            req.flash('error', 'You can only delete your own account');
            return res.status(403).render('errors/403.ejs');
        }

        const currentUser = await User.findById(req.user._id).lean();

        if (!currentUser) {
            req.flash('error', 'User not found');
            return res.redirect('/');
        }

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
