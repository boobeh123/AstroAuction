const User = require('../models/User')

module.exports = {

    getProfile: async (req, res) => {
        try {
            res.render('profile.ejs');
        } catch(err) {
            console.error(err)
            // redirect 404 todo
        }
    }
    
}