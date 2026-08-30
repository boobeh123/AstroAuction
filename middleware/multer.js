const multer = require("multer");
const path = require("path");

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png"];
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];

module.exports = multer({
  storage: multer.diskStorage({}),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error("File type is not supported"), false);
      return;
    }

    cb(null, true);
  },
});