const { matchedData } = require('express-validator')
const User = require('../models/User')
const { formErrors } = require('../middleware/validators')

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

        const errors = formErrors(req)
        if (!errors.isEmpty()) {
            req.flash('errors', errors.array())
            return res.redirect('/onboard')
        }

        const { displayName } = matchedData(req)

        await User.findByIdAndUpdate(req.user.id, {
            displayName,
            onboardingComplete: true
        });

        res.redirect('/auction');
    },

}
