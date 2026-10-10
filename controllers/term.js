module.exports = {

    getTerms: async (req, res) => {
        res.render('terms.ejs');
    },

    getPrivacy: async (req, res) => {
        res.render('privacy.ejs');
    }

}
