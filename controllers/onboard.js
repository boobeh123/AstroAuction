const User = require('../models/User')

module.exports = {

    getOnboard: async (req, res) => {

        try {
            if (req.user.onboardingComplete) {
                return res.redirect('/');
            }

            res.render('onboard.ejs');
        } catch(err) {
            console.error(err)
            res.status(500).render('errors/500.ejs');
        }

    },


    postOnboard: async (req, res) => {
        try {
            if (req.user.onboardingComplete) {
              return res.redirect('/');
            }

            const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : ''

            if (!displayName) {
                req.flash('errors', { msg: 'Please enter a display name.', field: 'displayName' })
                return res.redirect('/onboard')
            }

            if (displayName.length > 25) {
                req.flash('errors', { msg: 'Display name cannot be longer than 25 characters.', field: 'displayName' })
                return res.redirect('/onboard')
            }

            await User.findByIdAndUpdate(req.user.id, {
                displayName,
                onboardingComplete: true
              });

              res.redirect('/auction');
        } catch(err) {
            console.error(err);
            res.status(500).render('errors/500.ejs');
        }
    },
    
}