const User = require('../models/User')

// Unexpected errors aren't caught here: Express 5 passes anything thrown in
// these handlers to middleware/errorHandler.js, which logs it and shows the
// 500 page.
module.exports = {

    getOnboard: async (req, res) => {
        if (req.user.onboardingComplete) {
            return res.redirect('/');
        }

        res.render('onboard.ejs');
    },


    postOnboard: async (req, res) => {
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
    },

}
