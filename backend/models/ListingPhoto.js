const mongoose = require("mongoose");

const ALLOWED_CAPTURE_METHODS = ["live_camera", "file_upload"];

/**
 * ListingPhoto Schema
 *
 * NOTE on serverReceivedAt vs clientCapturedAt (FIX 2):
 * - `serverReceivedAt`: Authoritative server-side timestamp recording when the photo metadata/upload was
 *   successfully validated and received by the backend server.
 *   IMPORTANT: This timestamp proves only the time the server accepted the record; it does NOT prove
 *   the physical time the photograph was snapped nor does it verify the physical GPS location of the farm.
 * - `clientCapturedAt`: Optional, client- or EXIF-reported capture timestamp from device, explicitly
 *   untrusted and unverified.
 *
 * NOTE on storage:
 * - Direct storage of large image buffers or base64 data URLs in MongoDB is strictly prohibited.
 * - `imageUrl` must store a URL, relative asset path, or cloud storage reference (S3 / Cloudinary).
 */
const ListingPhotoSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: [true, "Listing ID reference is required"],
    },
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Uploader ID (User reference) is required"],
    },
    imageUrl: {
      type: String,
      required: [true, "Image URL or storage key is required"],
      trim: true,
      validate: {
        validator: function (val) {
          if (!val) return false;
          // Reject raw base64 data URLs to prevent MongoDB document bloating
          if (val.startsWith("data:image/")) return false;
          return val.length <= 1024;
        },
        message: "Image URL must be a valid file/cloud storage reference under 1024 characters; base64 strings are forbidden.",
      },
    },
    watermarkedUrl: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator: function (val) {
          if (!val) return true;
          if (val.startsWith("data:image/")) return false;
          return val.length <= 1024;
        },
        message: "Watermarked image URL must be under 1024 characters; base64 strings are forbidden.",
      },
    },
    serverReceivedAt: {
      type: Date,
      default: () => new Date(),
      required: true,
      immutable: true, // Server-generated authoritative record time
      set: function (val) {
        // Enforce server-controlled generation on new documents; reject client-forged timestamps
        if (this && this.isNew) {
          return new Date();
        }
        return val;
      },
    },
    clientCapturedAt: {
      type: Date,
      default: null, // Untrusted client-reported capture time
    },
    captureMethod: {
      type: String,
      required: [true, "Capture method is required"],
      enum: {
        values: ALLOWED_CAPTURE_METHODS,
        message: "Capture method must be either 'live_camera' or 'file_upload'",
      },
      default: "file_upload",
    },
    location: {
      latitude: {
        type: Number,
        default: null,
        min: [-90, "Latitude must be between -90 and 90"],
        max: [90, "Latitude must be between -90 and 90"],
        validate: {
          validator: function (v) {
            return v === null || v === undefined || Number.isFinite(v);
          },
          message: "Latitude must be a finite number",
        },
      },
      longitude: {
        type: Number,
        default: null,
        min: [-180, "Longitude must be between -180 and 180"],
        max: [180, "Longitude must be between -180 and 180"],
        validate: {
          validator: function (v) {
            return v === null || v === undefined || Number.isFinite(v);
          },
          message: "Longitude must be a finite number",
        },
      },
    },
    conditionNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Condition notes cannot exceed 500 characters"],
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Backward-compatible read-only virtual for legacy consumers reading `capturedAt`
ListingPhotoSchema.virtual("capturedAt").get(function () {
  return this.serverReceivedAt;
});

// Indexes
ListingPhotoSchema.index({ listingId: 1, serverReceivedAt: -1 });
ListingPhotoSchema.index({ listingId: 1, isPrimary: -1 });

module.exports = mongoose.model("ListingPhoto", ListingPhotoSchema);
