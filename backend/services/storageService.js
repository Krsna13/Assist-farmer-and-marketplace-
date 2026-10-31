const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

// Check if Cloudinary credentials are fully provided
const hasCloudinaryCredentials = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

// Configure Cloudinary if credentials are present
if (hasCloudinaryCredentials()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Ensure local uploads directory for marketplace exists as fallback / local storage
const localMarketplaceDir = path.join(__dirname, "../uploads/marketplace");
if (!fs.existsSync(localMarketplaceDir)) {
  try {
    fs.mkdirSync(localMarketplaceDir, { recursive: true });
  } catch (err) {
    console.error("Failed to create local marketplace uploads dir:", err.message);
  }
}

// Failure simulation flag for automated unit/integration tests
let mockFailureEnabled = false;

/**
 * Uploads an image buffer to the configured storage provider (Cloudinary or local/mock).
 *
 * @param {Buffer} buffer - Compressed/processed image buffer
 * @param {Object} options
 * @param {string} [options.folder='marketplace_listings']
 * @param {string} [options.filename]
 * @param {string} [options.format='webp']
 * @returns {Promise<{ url: string, publicId: string, storageProvider: string }>}
 */
async function uploadImage(buffer, options = {}) {
  if (mockFailureEnabled) {
    throw new Error("Storage service unavailable: simulated failure for automated testing");
  }

  const folder = options.folder || "marketplace_listings";
  const format = options.format || "webp";
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 10000);
  const baseFilename = options.filename
    ? options.filename.replace(/[^a-zA-Z0-9_-]/g, "_")
    : `photo_${timestamp}_${randomSuffix}`;

  const provider = process.env.STORAGE_PROVIDER || (hasCloudinaryCredentials() ? "cloudinary" : "local");

  if (provider === "cloudinary" && hasCloudinaryCredentials()) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          public_id: baseFilename,
          format: format,
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            return reject(new Error(`Cloudinary upload failed: ${error.message}`));
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            storageProvider: "cloudinary",
          });
        }
      );
      uploadStream.end(buffer);
    });
  }

  // Local / Mock file storage adapter
  const targetFilename = `${baseFilename}.${format}`;
  const targetFilePath = path.join(localMarketplaceDir, targetFilename);

  await fs.promises.writeFile(targetFilePath, buffer);

  const relativeUrl = `/uploads/marketplace/${targetFilename}`;
  return {
    url: relativeUrl,
    publicId: targetFilename,
    storageProvider: "local",
  };
}

/**
 * Deletes an uploaded image from storage (used for cleanup when DB persistence fails).
 *
 * @param {string} publicIdOrUrl
 * @param {string} [storageProvider]
 * @returns {Promise<boolean>}
 */
async function deleteImage(publicIdOrUrl, storageProvider) {
  if (!publicIdOrUrl) return false;

  try {
    const provider = storageProvider || (hasCloudinaryCredentials() ? "cloudinary" : "local");

    if (provider === "cloudinary" && hasCloudinaryCredentials()) {
      await cloudinary.uploader.destroy(publicIdOrUrl);
      return true;
    }

    // Local / Mock storage cleanup
    const filename = path.basename(publicIdOrUrl);
    const targetFilePath = path.join(localMarketplaceDir, filename);
    if (fs.existsSync(targetFilePath)) {
      await fs.promises.unlink(targetFilePath);
      return true;
    }
    return false;
  } catch (err) {
    // Log cleanup failure safely without crashing process
    console.error(`[STORAGE_CLEANUP_FAILURE] Could not delete orphaned file '${publicIdOrUrl}':`, err.message);
    return false;
  }
}

/**
 * Test helper to toggle simulated storage failure mode.
 * @param {boolean} shouldFail
 */
function __setMockFailure(shouldFail) {
  mockFailureEnabled = !!shouldFail;
}

module.exports = {
  uploadImage,
  deleteImage,
  hasCloudinaryCredentials,
  __setMockFailure,
};
