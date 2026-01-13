const User = require('../models/User')

module.exports = {

    getOnboard: async (req, res) => {

        try {
            if (!req.user) {
                return res.redirect('/login');
            }

            if (req.user.onboardingComplete) {
                return res.redirect('/auction');
            }

            res.render('onboard.ejs', {
                user: req.user,
            });
        } catch(err) {
            console.error(err)
            res.status(500).render('500.ejs');
        }

    },


    postOnboard: async (req, res) => {
        try {
            await User.findByIdAndUpdate(req.user.id, {
                displayName: req.body.displayName,
                onboardingComplete: true
              });

              res.redirect('/auction');
        } catch(err) {
            console.error(err);
            res.status(500).redirect('500.ejs');
        }
    },
    
}