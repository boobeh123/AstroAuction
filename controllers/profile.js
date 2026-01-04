const User = require('../models/User')
const cloudinary = require("../middleware/cloudinary");

module.exports = {

    getProfile: async (req, res) => {
        try {
            res.render('profile.ejs', {
                user: req.user,
            });
        } catch(err) {
            console.error(err)
            // redirect 404 todo
            res.render('404.ejs');
        }

    },

    uploadProfilePicture: async (req, res) => {

        try {
                const result = await cloudinary.uploader.upload(req.file.path, {
                    use_filename: true,
                    unique_filename: false,
                    overwrite: true,
                });
                await User.findByIdAndUpdate(req.user.id, {
                    image: result.secure_url,
                    cloudinaryId: result.public_id
                })
            console.log('Profile picture added')
            res.redirect('/profile')
        } catch(err) {
            console.error(err);
        }
    },

    getEditProfile: async (req, res) => {
        try {
            res.render('editProfile.ejs', {
                user: req.user,
            });
            console.log(req.user);
        } catch(err) {
            console.error(err)
            // redirect 404 todo
            res.render('404.ejs');
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
                    firstName: req.body.userName,
                    email: req.body.userEmail,
            })  
           console.log('Edited Profile Information')
           res.redirect('/profile')
            }
        } catch(err) {
            console.error(err)
            // redirect 404 todo
            res.render('404.ejs');
        }
        
    },
}