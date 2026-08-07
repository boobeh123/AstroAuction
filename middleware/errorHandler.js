/**************************************************************
 * errorHandler.js
 * Central error handling middleware for Express.
 * Registered last in server.js so it catches any error passed in to next(err) from routes or middleware.
 * The four-parameter signature (err, req, res, next) is required
 * for Express to recognise this as an error handler.
 **************************************************************/
module.exports = (err, req, res, next) => {
    console.error(err.stack)
    res.status(500).render('errors/500.ejs')
}