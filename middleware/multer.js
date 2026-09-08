const multer = require("multer");
const path = require("path");

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png"];
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];

// Cloudinary's free plan caps image uploads at 10MB. Setting multer above
// that would let a file clear this check, spend the whole upload, and then
// fail at the Cloudinary API instead — a worse failure, later, after the
// user has already waited.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;

// Multer tags its own limit errors with a `code`. Giving the filter's
// rejection one too means handleUploadErrors can identify it the same way,
// instead of matching on the message text — which would silently stop
// working the moment someone rewords the string.
const INVALID_FILE_TYPE = "INVALID_FILE_TYPE";

module.exports = multer({
  storage: multer.diskStorage({}),
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: MAX_FILES,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      const err = new Error("File type is not supported");
      err.code = INVALID_FILE_TYPE;
      cb(err, false);
      return;
    }

    cb(null, true);
  },
});

module.exports.INVALID_FILE_TYPE = INVALID_FILE_TYPE;
module.exports.MAX_FILE_BYTES = MAX_FILE_BYTES;
module.exports.MAX_FILES = MAX_FILES;
