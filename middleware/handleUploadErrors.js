const upload = require('./multer');

/**************************************************************
 * handleUploadErrors.js
 *
 * Turns a rejected upload into a flash message and a redirect, instead of a
 * blank 500 page.
 *
 * Without this, every multer rejection — an oversized phone photo, a HEIC
 * file, an eleventh image — reaches errorHandler.js and renders errors/500.ejs.
 * The user gets a server-error page with no explanation and loses the listing
 * they were part-way through writing. Nothing tells them the photo was simply
 * too big.
 *
 * This is a factory rather than a single middleware because the right place
 * to send someone depends on where they were: a failed profile picture belongs
 * back on /profile, a failed listing on /auction. A central error handler has
 * no reliable way to know which, but the route does.
 *
 * Express identifies error-handling middleware by its four-argument
 * signature, so the returned function is skipped entirely on a successful
 * upload and only runs when `upload` calls next(err).
 *
 * Usage:
 *   router.post('/', ensureAuth, upload.array('file', 10),
 *               handleUploadErrors('/auction'), controller.postAuction);
 **************************************************************/

// Read from multer's own config so the message can never contradict the rule
// actually being enforced. Hardcoding "10MB" here would quietly start lying
// the first time the limit is tuned.
const maxFileMb = Math.round(upload.MAX_FILE_BYTES / (1024 * 1024));

function messageFor(err) {
    switch (err.code) {
        case 'LIMIT_FILE_SIZE':
            return `Each photo must be under ${maxFileMb}MB. Photos taken on newer phones are often larger than this — try resizing before uploading.`;

        case 'LIMIT_FILE_COUNT':
            return `You can upload up to ${upload.MAX_FILES} photos at a time.`;

        case upload.INVALID_FILE_TYPE:
            return 'Only JPG and PNG images are supported.';

        // Raised when the form's file input name does not match what the
        // route expects. That is a wiring bug rather than anything the user
        // did, so the message stays vague while the console line below
        // carries the detail needed to actually fix it.
        case 'LIMIT_UNEXPECTED_FILE':
            return 'Something went wrong with that upload. Please try again.';

        default:
            return 'Your upload could not be processed. Please try again.';
    }
}

function handleUploadErrors(redirectTo) {
    return (err, req, res, next) => {
        // Anything that is not an upload problem belongs to the central error
        // handler. Without this check, an unrelated error reaching this point
        // would be swallowed and reported to the user as an upload failure.
        const isUploadError = err
            && (err.name === 'MulterError' || err.code === upload.INVALID_FILE_TYPE);

        if (!isUploadError) {
            return next(err);
        }

        console.error(`Upload rejected (${err.code}):`, err.message);

        req.flash('errors', { msg: messageFor(err) });
        return res.redirect(redirectTo);
    };
}

module.exports = handleUploadErrors;
module.exports.messageFor = messageFor;
