/**************************************************************
 * errorHandler.js
 * Central error handling middleware for Express.
 * Registered last in server.js so it catches any error passed in to next(err) from routes or middleware.
 * The four-parameter signature (err, req, res, next) is required
 * for Express to recognise this as an error handler.
 **************************************************************/

// Statuses with a page of their own. Every other status shows the 500 page.
const ERROR_VIEWS = {
    403: 'errors/403.ejs',
    404: 'errors/404.ejs',
}

module.exports = (err, req, res, next) => {
    console.error(err.stack)
    if (res.headersSent) {
      return next(err)
    }
    // Some errors carry their own status, like 400 for a link with broken
    // characters or a request body that can't be read. Anything without a
    // valid error status is the server's fault, so it gets 500.
    const status = err.status >= 400 && err.status < 600 ? err.status : 500
    res.status(status).render(ERROR_VIEWS[status] || 'errors/500.ejs')
}
