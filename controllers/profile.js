const User = require('../models/User')
const cloudinary = require("../middleware/cloudinary");

module.exports = {

    getProfile: async (req, res) => {
        try {
            res.render('profile.ejs');
        } catch(err) {
            console.error(err)
            res.status(500).render('500.ejs');
        }

    },

    uploadProfilePicture: async (req, res) => {

        try {
            const currentUser = await User.findById(req.user.id).lean()
            if (currentUser.image === '') {
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
            }
             else {
                await cloudinary.uploader.destroy(req.user.cloudinaryId)
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
        }
            console.log('Profile picture added')
            res.redirect('/profile')
        } catch(err) {
            console.error(err);
            res.status(500).render('500.ejs');
        }
    },

    getEditProfile: async (req, res) => {
        try {
            res.render('editProfile.ejs');
        } catch(err) {
            console.error(err)
            res.status(500).render('500.ejs');
        }
        
    },

    updateProfile: async (req, res) => {
        try {
            
            let loggedInUser = await User.findById(req.user._id).lean()

            if (!loggedInUser) {
                res.redirect('/')
            }
            if (loggedInUser.email !== req.user.email) {
                res.redirect('/')
            } else { 
                await User.findByIdAndUpdate(req.user._id, {
                    displayName: req.body.userName,
            })  
           console.log('Profile updated')
           res.redirect('/profile')
            }
        } catch(err) {
            console.error(err)
            res.status(500).render('500.ejs');
        }
        
    },
    deleteProfile: async (req, res) => {
        try {

            if (req.params.id !== req.user._id.toString()) {
                req.flash('error', 'You can only delete your own account');
                return res.status(403).render('403.ejs');
            }

            const currentUser = await User.findById(req.user._id).lean();
            
            if (!currentUser) {
                req.flash('error', 'User not found');
                return res.redirect('/');
            }

            if (currentUser.cloudinaryId) {
                await cloudinary.uploader.destroy(req.user.cloudinaryId)
            }
            
            await User.deleteOne({_id: req.user._id});
            req.logout((err) => {
                if (err) {
                    console.error('Logout error:', err);
                    return res.redirect('/');
                }
            });
            
            console.log('Profile deleted')
            res.redirect('/');
        } catch (err) {
            console.log(err);
            req.flash('error', 'Failed to delete profile. Please try again.');
            res.status(500).render('500.ejs');
        }
    },
}