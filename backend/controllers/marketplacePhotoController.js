const mongoose = require("mongoose");
const Listing = require("../models/Listing");
const ListingPhoto = require("../models/ListingPhoto");
const CropFarm = require("../models/CropFarm");
const Farm = require("../models/Farm");
const Store = require("../models/Store");
const imageService = require("../services/imageService");
const storageService = require("../services/storageService");

/**
 * Helper to dynamically load the location document based on locationModel.
 * @param {string} locationModel - "CropFarm" | "Farm" | "Store"
 * @param {string|mongoose.Types.ObjectId} locationId
 * @returns {Promise<Document|null>}
 */
async function findLocationDocument(locationModel, locationId) {
  if (locationModel === "CropFarm") {
    return await CropFarm.findById(locationId);
  } else if (locationModel === "Farm") {
    return await Farm.findById(locationId);
  } else if (locationModel === "Store") {
    return await Store.findById(locationId);
  }
  return null;
}

/**
 * POST /api/marketplace/listings/:listingId/photos
 * Secure farm inventory photo upload endpoint.
 */
async function uploadListingPhoto(req, res) {
  let cleanUploadResult = null;
  let watermarkedUploadResult = null;

  try {
    const { listingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ message: "Invalid listing ID format." });
    }

    // 1. Authenticate user & extract user ID
    const currentUserId = req.user ? (req.user.id || req.user._id) : null;
    if (!currentUserId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    // 2. Load the target listing
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found." });
    }

    // 3. Confirm listing.farmerId matches authenticated user
    if (listing.farmerId.toString() !== currentUserId.toString()) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to upload photos for another farmer's listing.",
      });
    }

    // 4. Verify associated location exists and belongs to that farmer
    const locationDoc = await findLocationDocument(listing.locationModel, listing.locationId);
    if (!locationDoc) {
      return res.status(400).json({
        message: `Referenced ${listing.locationModel} location does not exist.`,
      });
    }

    if (!locationDoc.userId || locationDoc.userId.toString() !== currentUserId.toString()) {
      return res.status(403).json({
        message: `Forbidden: The referenced ${listing.locationModel} location does not belong to your account.`,
      });
    }

    // 5. Verify image file was provided
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        message: "No image file provided. Please attach a photo via camera capture or file upload.",
      });
    }

    // 6. Generate authoritative server timestamp AFTER request is validated and accepted
    const serverReceivedAt = new Date();

    // 7. Validate and process image (strips EXIF GPS, normalizes orientation, compresses, generates watermark)
    let processed;
    try {
      processed = await imageService.processImage(req.file.buffer, {
        listingTitle: listing.title,
        locationName: locationDoc.name || "Farm Inventory",
        serverReceivedAt,
        generateWatermark: true,
      });
    } catch (procErr) {
      return res.status(400).json({
        message: procErr.message || "Image validation or processing failed.",
      });
    }

    // 8. Upload processed images through configured storage provider
    const baseFilename = `listing_${listing._id}_${Date.now()}`;

    try {
      cleanUploadResult = await storageService.uploadImage(processed.cleanBuffer, {
        folder: "marketplace/clean",
        filename: `${baseFilename}_clean`,
        format: processed.format,
      });

      if (processed.watermarkedBuffer) {
        watermarkedUploadResult = await storageService.uploadImage(processed.watermarkedBuffer, {
          folder: "marketplace/watermarked",
          filename: `${baseFilename}_wm`,
          format: processed.format,
        });
      }
    } catch (storageErr) {
      // Storage unavailable: return clear error and do NOT save photo record
      return res.status(502).json({
        message: "Storage service unavailable. Photo was not saved.",
        error: storageErr.message,
      });
    }

    // 9. Construct database record from strict allowlist of validated/server-generated values
    // Client-supplied serverReceivedAt, capturedAt, uploaderId, and arbitrary URLs are strictly ignored
    const photoData = {
      listingId: listing._id,
      uploaderId: currentUserId,
      imageUrl: cleanUploadResult.url,
      watermarkedUrl: watermarkedUploadResult ? watermarkedUploadResult.url : cleanUploadResult.url,
      serverReceivedAt: serverReceivedAt, // Authoritative server timestamp
      captureMethod: req.body && req.body.captureMethod === "live_camera" ? "live_camera" : "file_upload",
      conditionNotes: req.body && typeof req.body.conditionNotes === "string" ? req.body.conditionNotes.trim().slice(0, 500) : "",
      isPrimary: req.body && (req.body.isPrimary === true || req.body.isPrimary === "true"),
    };

    // Client-reported capture time is treated as optional, explicitly untrusted metadata
    if (req.body && req.body.clientCapturedAt) {
      const parsedClientTime = new Date(req.body.clientCapturedAt);
      if (!isNaN(parsedClientTime.getTime())) {
        photoData.clientCapturedAt = parsedClientTime;
      }
    }

    // Optional GPS: stored as consented metadata if valid coordinates are supplied
    if (req.body && req.body.latitude !== undefined && req.body.longitude !== undefined) {
      const lat = parseFloat(req.body.latitude);
      const lon = parseFloat(req.body.longitude);
      if (
        Number.isFinite(lat) &&
        lat >= -90 &&
        lat <= 90 &&
        Number.isFinite(lon) &&
        lon >= -180 &&
        lon <= 180
      ) {
        photoData.location = { latitude: lat, longitude: lon };
      }
    }

    // 10. Persist ListingPhoto record only after successful storage upload
    let savedPhoto;
    try {
      const photoDoc = new ListingPhoto(photoData);
      savedPhoto = await photoDoc.save();

      // If marked as primary, unmark other photos for this listing
      if (savedPhoto.isPrimary) {
        await ListingPhoto.updateMany(
          { listingId: listing._id, _id: { $ne: savedPhoto._id } },
          { isPrimary: false }
        );
      }
    } catch (dbErr) {
      // Database persistence failed: attempt to remove orphaned cloud storage objects
      console.error("Database persistence failed. Initiating storage cleanup...");
      if (cleanUploadResult) {
        await storageService.deleteImage(
          cleanUploadResult.publicId || cleanUploadResult.url,
          cleanUploadResult.storageProvider
        );
      }
      if (watermarkedUploadResult) {
        await storageService.deleteImage(
          watermarkedUploadResult.publicId || watermarkedUploadResult.url,
          watermarkedUploadResult.storageProvider
        );
      }
      return res.status(500).json({
        message: "Failed to persist photo record to database. Uploaded assets were cleaned up.",
        error: dbErr.message,
      });
    }

    // 11. Return resulting metadata and authoritative timestamp
    return res.status(201).json({
      message: "Photo uploaded and verified by server successfully.",
      photo: {
        id: savedPhoto._id,
        listingId: savedPhoto.listingId,
        imageUrl: savedPhoto.imageUrl,
        watermarkedUrl: savedPhoto.watermarkedUrl,
        serverReceivedAt: savedPhoto.serverReceivedAt,
        clientCapturedAt: savedPhoto.clientCapturedAt,
        captureMethod: savedPhoto.captureMethod,
        conditionNotes: savedPhoto.conditionNotes,
        isPrimary: savedPhoto.isPrimary,
      },
    });
  } catch (err) {
    console.error("Unexpected error in uploadListingPhoto:", err);
    return res.status(500).json({
      message: "Internal server error during photo upload.",
      error: err.message,
    });
  }
}

/**
 * GET /api/marketplace/listings/:listingId/photos
 * Secure photo history endpoint.
 * Allows unauthenticated visitors for eligible public listings.
 * Hides photos for private (inactive) listings from non-owners.
 */
async function getListingPhotos(req, res) {
  try {
    const { listingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ message: "Invalid listing ID format." });
    }

    // 1. Load target listing
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found." });
    }

    // 2. Check public visibility:
    // If listing is inactive, only the owner farmer may view its photo history
    if (listing.status === "inactive") {
      const currentUserId = req.user ? (req.user.id || req.user._id) : null;
      if (!currentUserId || listing.farmerId.toString() !== currentUserId.toString()) {
        return res.status(403).json({
          message: "This listing is private or inactive. Photos cannot be viewed.",
        });
      }
    }

    // 3. Fetch photo history in stable chronological order (most recent authoritative receipt first)
    const photos = await ListingPhoto.find({ listingId: listing._id }).sort({
      serverReceivedAt: -1,
      createdAt: -1,
    });

    // 4. Return strictly public-safe allowlist of fields
    // Strips internal uploader references, credentials, storage keys, and precise GPS coordinates
    const safePhotos = photos.map((photo) => ({
      id: photo._id,
      listingId: photo.listingId,
      imageUrl: photo.imageUrl,
      watermarkedUrl: photo.watermarkedUrl || photo.imageUrl,
      serverReceivedAt: photo.serverReceivedAt,
      clientCapturedAt: photo.clientCapturedAt || null,
      captureMethod: photo.captureMethod,
      conditionNotes: photo.conditionNotes || "",
      isPrimary: !!photo.isPrimary,
    }));

    return res.json({
      listingId: listing._id,
      listingTitle: listing.title,
      listingStatus: listing.status,
      count: safePhotos.length,
      photos: safePhotos,
    });
  } catch (err) {
    console.error("Error in getListingPhotos:", err);
    return res.status(500).json({
      message: "Failed to retrieve listing photo history.",
      error: err.message,
    });
  }
}

module.exports = {
  uploadListingPhoto,
  getListingPhotos,
  findLocationDocument,
};
