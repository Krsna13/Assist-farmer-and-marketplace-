const mongoose = require("mongoose");

const ALLOWED_UNITS = ["kg", "quintal", "tonne", "litre", "piece", "head"];
const ALLOWED_CATEGORIES = ["crop", "livestock", "produce", "other"];
const ALLOWED_STATUSES = ["available", "reserved", "sold", "inactive"];
const ALLOWED_LOCATION_MODELS = ["CropFarm", "Farm", "Store"];
const ALLOWED_SOURCE_TYPES = ["CropRecord", "Animal", "UnitResource", "ItemResource", "Production", null];

function normalizeUnit(unit) {
  if (!unit || typeof unit !== "string") return unit;
  const lower = unit.toLowerCase().trim();
  if (lower === "ton" || lower === "tons" || lower === "metric ton" || lower === "metric tons") return "tonne";
  if (lower === "liter" || lower === "liters" || lower === "l") return "litre";
  if (lower === "pc" || lower === "pcs") return "piece";
  if (lower === "quintals" || lower === "qtl") return "quintal";
  return lower;
}

const ListingSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Farmer ID (User reference) is required"],
    },
    locationModel: {
      type: String,
      required: [true, "Location model is required"],
      enum: {
        values: ALLOWED_LOCATION_MODELS,
        message: "locationModel must be one of: CropFarm, Farm, Store",
      },
      default: "CropFarm",
      validate: {
        validator: function (val) {
          if (!this.sourceRecordType) return true;
          const cropTypes = ["CropRecord"];
          const livestockTypes = ["Animal", "Production"];
          const resourceTypes = ["UnitResource", "ItemResource"];

          if (cropTypes.includes(this.sourceRecordType) && val !== "CropFarm") return false;
          if (livestockTypes.includes(this.sourceRecordType) && val !== "Farm") return false;
          if (resourceTypes.includes(this.sourceRecordType) && val !== "Store") return false;
          return true;
        },
        message: function () {
          return `Source record '${this.sourceRecordType}' must belong to matching locationModel`;
        },
      },
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Location ID is required"],
      refPath: "locationModel",
    },
    sourceRecordType: {
      type: String,
      enum: {
        values: ALLOWED_SOURCE_TYPES,
        message: "sourceRecordType must be one of: CropRecord, Animal, UnitResource, ItemResource, Production",
      },
      default: null,
    },
    sourceRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "sourceRecordType",
      default: null,
      validate: {
        validator: function (val) {
          // If sourceRecordType is set, sourceRecordId must be provided
          if (this.sourceRecordType && !val) return false;
          return true;
        },
        message: "sourceRecordId is required when sourceRecordType is specified",
      },
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: ALLOWED_CATEGORIES,
        message: "Category must be one of: crop, livestock, produce, other",
      },
      lowercase: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [2, "Title must be at least 2 characters"],
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    quantityUnit: {
      type: String,
      required: [true, "Quantity unit is required"],
      enum: {
        values: ALLOWED_UNITS,
        message: "Unit must be one of: kg, quintal, tonne, litre, piece, head",
      },
      lowercase: true,
      trim: true,
    },
    quantityAvailable: {
      type: Number,
      required: [true, "Available quantity is required"],
      min: [0, "Quantity available cannot be negative"],
      validate: [
        {
          validator: Number.isFinite,
          message: "Quantity available must be a finite number",
        },
        {
          validator: function (val) {
            if (this.status === "available" && val <= 0) return false;
            if ((this.status === "reserved" || this.status === "sold") && val !== 0) return false;
            return true;
          },
          message: "Quantity available conflicts with listing status requirements",
        },
      ],
    },
    quantityReserved: {
      type: Number,
      default: 0,
      min: [0, "Quantity reserved cannot be negative"],
      validate: [
        {
          validator: Number.isFinite,
          message: "Quantity reserved must be a finite number",
        },
        {
          validator: function (val) {
            if (this.status === "reserved" && val <= 0) return false;
            if (this.status === "sold" && val !== 0) return false;
            return true;
          },
          message: "Quantity reserved conflicts with listing status requirements",
        },
      ],
    },
    quantitySold: {
      type: Number,
      default: 0,
      min: [0, "Quantity sold cannot be negative"],
      validate: [
        {
          validator: Number.isFinite,
          message: "Quantity sold must be a finite number",
        },
        {
          validator: function (val) {
            if (this.status === "sold" && val <= 0) return false;
            return true;
          },
          message: "A sold listing must have quantitySold greater than 0",
        },
      ],
    },
    fixedPricePerUnit: {
      type: Number,
      required: [true, "Fixed price per unit is required"],
      min: [0.01, "Fixed price per unit must be greater than 0"],
      validate: {
        validator: Number.isFinite,
        message: "Fixed price per unit must be a finite number",
      },
    },
    minimumBidPerUnit: {
      type: Number,
      default: null,
      validate: {
        validator: function (val) {
          if (val === null || val === undefined) return true;
          return Number.isFinite(val) && val > 0;
        },
        message: "Minimum bid per unit must be a positive number if provided",
      },
    },
    minimumOrderQuantity: {
      type: Number,
      default: 1,
      min: [0.01, "Minimum order quantity must be greater than 0"],
      validate: {
        validator: Number.isFinite,
        message: "Minimum order quantity must be a finite number",
      },
    },
    harvestDate: {
      type: Date,
      default: null,
    },
    availableFrom: {
      type: Date,
      default: null,
    },
    conditionNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Condition notes cannot exceed 500 characters"],
    },
    status: {
      type: String,
      required: [true, "Listing status is required"],
      enum: {
        values: ALLOWED_STATUSES,
        message: "Status must be one of: available, reserved, sold, inactive",
      },
      default: "available",
      lowercase: true,
      trim: true,
      validate: {
        validator: function (val) {
          const avail = Number(this.quantityAvailable);
          const res = Number(this.quantityReserved);
          const sold = Number(this.quantitySold);

          if (val === "available") {
            return avail > 0;
          } else if (val === "reserved") {
            return avail === 0 && res > 0;
          } else if (val === "sold") {
            return avail === 0 && res === 0 && sold > 0;
          } else if (val === "inactive") {
            return avail >= 0 && res >= 0 && sold >= 0;
          }
          return true;
        },
        message: "Inventory quantities are inconsistent with listing status",
      },
    },
    lastStockUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Backward-compatibility virtual for farmId
ListingSchema.virtual("farmId")
  .get(function () {
    return this.locationId;
  })
  .set(function (val) {
    this.locationId = val;
    if (!this.locationModel) {
      this.locationModel = "CropFarm";
    }
  });

// Pre-validation hook for monetary precision, unit normalization, and farmId mapping
ListingSchema.pre("validate", function (next) {
  // Unit normalization
  if (this.quantityUnit) {
    this.quantityUnit = normalizeUnit(this.quantityUnit);
  }

  // Backward compatibility: map farmId to locationId/locationModel if supplied
  if (this.farmId && !this.locationId) {
    this.locationId = this.farmId;
    if (!this.locationModel) {
      this.locationModel = "CropFarm";
    }
  }

  // Precision rounding
  if (typeof this.fixedPricePerUnit === "number" && Number.isFinite(this.fixedPricePerUnit)) {
    this.fixedPricePerUnit = Math.round(this.fixedPricePerUnit * 100) / 100;
  }
  if (typeof this.minimumBidPerUnit === "number" && Number.isFinite(this.minimumBidPerUnit)) {
    this.minimumBidPerUnit = Math.round(this.minimumBidPerUnit * 100) / 100;
  }
  if (typeof this.quantityAvailable === "number" && Number.isFinite(this.quantityAvailable)) {
    this.quantityAvailable = Math.round(this.quantityAvailable * 100) / 100;
  }
  if (typeof this.quantityReserved === "number" && Number.isFinite(this.quantityReserved)) {
    this.quantityReserved = Math.round(this.quantityReserved * 100) / 100;
  }
  if (typeof this.quantitySold === "number" && Number.isFinite(this.quantitySold)) {
    this.quantitySold = Math.round(this.quantitySold * 100) / 100;
  }

  // Cross-field validation: minimumBidPerUnit should not exceed fixedPricePerUnit
  if (
    typeof this.minimumBidPerUnit === "number" &&
    typeof this.fixedPricePerUnit === "number" &&
    this.minimumBidPerUnit > this.fixedPricePerUnit
  ) {
    this.invalidate("minimumBidPerUnit", "Minimum bid price cannot exceed the fixed buy price");
  }

  // Validate minimumOrderQuantity cannot exceed total available inventory if both are positive
  if (
    typeof this.minimumOrderQuantity === "number" &&
    typeof this.quantityAvailable === "number" &&
    this.status === "available" &&
    this.quantityAvailable > 0 &&
    this.minimumOrderQuantity > this.quantityAvailable
  ) {
    this.invalidate("minimumOrderQuantity", "Minimum order quantity cannot exceed quantity available");
  }

  next();
});

// Database Indexes for optimized marketplace querying
ListingSchema.index({ farmerId: 1, status: 1 });
ListingSchema.index({ locationModel: 1, locationId: 1, status: 1 });
ListingSchema.index({ category: 1, status: 1 });
ListingSchema.index({ createdAt: -1 });
ListingSchema.index({ status: 1, createdAt: -1 });
ListingSchema.index({ status: 1, lastStockUpdatedAt: -1 });

const Listing = mongoose.model("Listing", ListingSchema);
Listing.ALLOWED_UNITS = ALLOWED_UNITS;
Listing.normalizeUnit = normalizeUnit;

module.exports = Listing;
