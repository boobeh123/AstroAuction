const User = require('../models/User')
const cloudinary = require("../middleware/cloudinary");

module.exports = {

    getProfile: async (req, res) => {
        try {
            res.render('profile.ejs');
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
    }
}