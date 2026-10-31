const mongoose = require("mongoose");

const CropRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cropFarmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CropFarm",
      required: true,
    },
    season: { type: String, enum: ["rabi", "kharif"], required: true },
    cropType: { type: String, required: true },
    cropName: { type: String, required: true },
    duration: { type: Number, required: true }, // in days
    seedQuantity: { type: Number, required: true },
    seedingDate: { type: String, required: true },
    notes: { type: String },

    // ── Harvest / Sale fields added for Marketplace Auto-Sync ──────────────
    harvestDate: { type: Date, default: null },
    harvestQty: { type: Number, default: null },   // available quantity post-harvest
    harvestUnit: {
      type: String,
      default: "kg",
      enum: ["kg", "quintal", "tonne", "litre", "piece"],
    },
    conditionNotes: { type: String, default: "" }, // public-facing quality notes
    // Marketplace sync fields (owner-only, backend-controlled)
    forSale: { type: Boolean, default: false },
    marketSalePrice: { type: Number, default: null },  // ₹ per harvestUnit — NOT purchase/cost
    minOrderQty: { type: Number, default: 1 },
    // Sync status — written by backend, never trusted from client
    syncStatus: {
      type: String,
      enum: ["not_synced", "synced", "pending", "error", "deactivated"],
      default: "not_synced",
    },
    syncListingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", default: null },
    syncError: { type: String, default: null },
    lastSyncedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CropRecord", CropRecordSchema);
