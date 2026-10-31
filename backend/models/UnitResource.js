const mongoose = require("mongoose");

const UnitResourceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
  resourceType: { type: String, required: true },
  resourceName: { type: String, required: true },
  uniqueId: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  costPerUnit: { type: Number, required: true },
  totalCost: { type: Number, required: true },
  notes: { type: String, default: "" },
  dateAdded: { type: Date, required: true },

  // ── Marketplace Sale fields (owner-only auto-sync) ──────────────────────
  forSale: { type: Boolean, default: false },         // opt-in for marketplace listing
  marketSalePrice: { type: Number, default: null },   // ₹ per unit — NOT costPerUnit
  minOrderQty: { type: Number, default: 1 },
  // Sync metadata
  syncStatus: {
    type: String,
    enum: ["not_synced", "synced", "pending", "error", "deactivated"],
    default: "not_synced",
  },
  syncListingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", default: null },
  syncError: { type: String, default: null },
  lastSyncedAt: { type: Date, default: null },
});

module.exports = mongoose.model("UnitResource", UnitResourceSchema);
