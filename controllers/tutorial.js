const User = require('../models/User')

module.exports = {

    postDismiss: async (req, res) => {
        try {
            await User.findByIdAndUpdate(req.user.id, { tutorialStep: null })
            res.status(204).end()
        } catch (err) {
            console.error('Failed to dismiss tutorial:', err.message)
            res.status(500).end()
        }
    },

}
