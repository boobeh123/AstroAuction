const User = require('../models/User')

module.exports = {

    getIndex: async (req, res) => {
        try {
            res.render('index.ejs', {
                user: req.user
            });
        } catch(err) {
            console.error(err)
            res.status(500).render('500.ejs');
        }
    }
    
}