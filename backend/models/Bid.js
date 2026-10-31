const mongoose = require("mongoose");

const ALLOWED_BID_STATUSES = ["pending", "countered", "accepted", "rejected", "withdrawn", "expired"];

const OfferHistoryItemSchema = new mongoose.Schema(
  {
    offerNumber: { type: Number, required: true },
    offeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["buyer", "farmer"], required: true },
    pricePerUnit: {
      type: Number,
      required: true,
      min: [0.01, "Offer price must be greater than 0"],
      validate: { validator: Number.isFinite, message: "Offer price must be finite" },
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.01, "Offer quantity must be greater than 0"],
      validate: { validator: Number.isFinite, message: "Offer quantity must be finite" },
    },
    message: { type: String, default: "", trim: true, maxlength: [500, "Message cannot exceed 500 characters"] },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/**
 * Bid Model (Extended for Stage 6 Counter-Offers & Auditable Negotiation History)
 */
const BidSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: [true, "Listing ID reference is required"],
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Buyer ID (User reference) is required"],
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    bidPricePerUnit: {
      type: Number,
      required: [true, "Bid price per unit is required"],
      min: [0.01, "Bid price per unit must be greater than 0"],
      validate: {
        validator: Number.isFinite,
        message: "Bid price per unit must be a finite number",
      },
    },
    quantity: {
      type: Number,
      required: [true, "Bid quantity is required"],
      min: [0.01, "Bid quantity must be greater than 0"],
      validate: {
        validator: Number.isFinite,
        message: "Bid quantity must be a finite number",
      },
    },
    status: {
      type: String,
      required: [true, "Bid status is required"],
      enum: {
        values: ALLOWED_BID_STATUSES,
        message: "Bid status must be one of: pending, countered, accepted, rejected, withdrawn, expired",
      },
      default: "pending",
      lowercase: true,
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Bid message cannot exceed 500 characters"],
    },
    farmerResponse: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Farmer response cannot exceed 500 characters"],
    },
    expiresAt: {
      type: Date,
      required: [true, "Bid expiration date/time is required"],
    },

    // Stage 6 Negotiation Architecture
    currentOffer: {
      pricePerUnit: { type: Number },
      quantity: { type: Number },
      offeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      offeredByRole: { type: String, enum: ["buyer", "farmer"] },
      pendingResponderRole: { type: String, enum: ["buyer", "farmer"] },
      pendingResponderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      message: { type: String, default: "", trim: true, maxlength: 500 },
      expiresAt: { type: Date },
      updatedAt: { type: Date, default: Date.now },
    },
    offerHistory: {
      type: [OfferHistoryItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Round monetary amounts and quantities before validation; maintain backward-compatibility
BidSchema.pre("validate", function (next) {
  if (typeof this.bidPricePerUnit === "number" && Number.isFinite(this.bidPricePerUnit)) {
    this.bidPricePerUnit = Math.round(this.bidPricePerUnit * 100) / 100;
  }
  if (typeof this.quantity === "number" && Number.isFinite(this.quantity)) {
    this.quantity = Math.round(this.quantity * 100) / 100;
  }

  // Populate currentOffer from top-level fields if not yet explicitly populated
  if (!this.currentOffer || !this.currentOffer.pricePerUnit) {
    this.currentOffer = {
      pricePerUnit: this.bidPricePerUnit,
      quantity: this.quantity,
      offeredBy: this.buyerId,
      offeredByRole: "buyer",
      pendingResponderRole: "farmer",
      pendingResponderId: this.farmerId,
      message: this.message || "",
      expiresAt: this.expiresAt,
      updatedAt: new Date(),
    };
  }

  // Ensure initial offer is preserved in offerHistory
  if (!this.offerHistory || this.offerHistory.length === 0) {
    if (this.currentOffer && this.currentOffer.pricePerUnit) {
      this.offerHistory = [
        {
          offerNumber: 1,
          offeredBy: this.currentOffer.offeredBy || this.buyerId,
          role: this.currentOffer.offeredByRole || "buyer",
          pricePerUnit: this.currentOffer.pricePerUnit,
          quantity: this.currentOffer.quantity,
          message: this.currentOffer.message || "",
          expiresAt: this.currentOffer.expiresAt || this.expiresAt,
          createdAt: this.createdAt || new Date(),
        },
      ];
    }
  }

  next();
});

// Database Indexes
BidSchema.index({ listingId: 1, status: 1 });
BidSchema.index({ buyerId: 1, createdAt: -1 });
BidSchema.index({ farmerId: 1, createdAt: -1 });
BidSchema.index({ expiresAt: 1, status: 1 });
BidSchema.index({ "currentOffer.pendingResponderId": 1, status: 1 });

module.exports = mongoose.model("Bid", BidSchema);
module.exports.ALLOWED_BID_STATUSES = ALLOWED_BID_STATUSES;
