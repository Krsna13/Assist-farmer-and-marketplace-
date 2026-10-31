const multer = require("multer");

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB strict limit
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

// Memory storage to process files before sending to Cloudinary / storage adapter
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type '${file.mimetype}'. Only JPEG, PNG, and WebP images are allowed.`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only 1 file per upload request
  },
  fileFilter,
});

/**
 * Express middleware wrapper to catch Multer errors (e.g. file size limit exceeded)
 * and return structured HTTP responses.
 */
const uploadSinglePhoto = (fieldName = "photo") => {
  return (req, res, next) => {
    // Also accept 'image' or 'file' if client used alternate field name
    const multerUpload = upload.fields([
      { name: "photo", maxCount: 1 },
      { name: "image", maxCount: 1 },
      { name: "file", maxCount: 1 },
    ]);

    multerUpload(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: "File is too large. Maximum allowed file size is 5 MB.",
            error: err.message,
          });
        }
        return res.status(400).json({
          message: err.message || "File upload validation failed.",
          error: err.message,
        });
      }

      // Normalize file to req.file
      if (req.files) {
        if (req.files.photo && req.files.photo[0]) {
          req.file = req.files.photo[0];
        } else if (req.files.image && req.files.image[0]) {
          req.file = req.files.image[0];
        } else if (req.files.file && req.files.file[0]) {
          req.file = req.files.file[0];
        }
      }

      next();
    });
  };
};

module.exports = {
  uploadSinglePhoto,
  MAX_FILE_SIZE,
};
