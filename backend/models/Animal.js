const mongoose = require("mongoose");

const AnimalSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: "Farm", required: true },
  animalId: { type: String, required: true, unique: true }, // Ensure unique animal ID
  category: { type: String, required: true },
  sex: { type: String, required: true },
  weight: { type: Number, required: true },
  breed: { type: String, required: true },
  age: { type: Number, required: true },
  healthStatus: { type: String, required: true },
  symptoms: { type: String, default: "" },
  medicine: { type: String, default: "" },
  feedType: { type: String, required: true },
  milkingQuantity: { type: Number, default: null },
  status: { type: String, required: true }, // Animal status: alive, dead, sold, forSale

  // ── Marketplace Sale fields (owner-only auto-sync) ──────────────────────
  forSale: { type: Boolean, default: false },       // explicit sale flag
  saleQty: { type: Number, default: 1 },            // number of animals offered (head)
  marketSalePrice: { type: Number, default: null }, // ₹ per head — NOT feeding cost
  saleConditionNotes: { type: String, default: "" },// public notes (no medical details)
  // Sync metadata
  syncStatus: {
    type: String,
    enum: ["not_synced", "synced", "pending", "error", "deactivated"],
    default: "not_synced",
  },
  syncListingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", default: null },
  syncError: { type: String, default: null },
  lastSyncedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Animal", AnimalSchema);
