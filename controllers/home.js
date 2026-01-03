const User = require('../models/User')

module.exports = {

    getIndex: async (req, res) => {
        try {
            res.render('index.ejs', {
                user: req.user
            });
        } catch(err) {
            console.error(err)
            // redirect 404 todo
            res.render('404.ejs');
        }
    }
    
}