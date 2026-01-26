module.exports = {

    getTerms: async (req, res) => {

        try {
            res.render('terms.ejs');
        } catch(err) {
            console.error(err)
            res.status(500).render('500.ejs');
        }

    }
        
}