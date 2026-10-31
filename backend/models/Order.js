const mongoose = require("mongoose");
const crypto = require("crypto");

const ALLOWED_ORDER_STATUSES = [
  "placed",
  "confirmed",
  "packed",
  "dispatched",
  "delivered",
  "completed",
  "cancelled",
  "expired",
];

const ALLOWED_PAYMENT_METHODS = ["cod", "manual_bank_transfer", "online"];
const ALLOWED_PAYMENT_STATUSES = ["unpaid", "pending", "paid", "failed", "refunded"];

// Consistent monetary rounding helper (2 decimal places)
const roundCurrency = (val) => Math.round(Number(val) * 100) / 100;

const OrderItemSnapshotSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: [true, "Listing ID reference is required in item snapshot"],
    },
    title: {
      type: String,
      required: [true, "Product title snapshot is required"],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, "Item quantity is required"],
      min: [0.01, "Quantity must be greater than 0"],
      validate: {
        validator: Number.isFinite,
        message: "Quantity must be a finite number",
      },
    },
    unit: {
      type: String,
      required: [true, "Quantity unit is required"],
      trim: true,
    },
    agreedPricePerUnit: {
      type: Number,
      required: [true, "Agreed price per unit is required"],
      min: [0.01, "Agreed price per unit must be greater than 0"],
      validate: {
        validator: Number.isFinite,
        message: "Agreed price per unit must be a finite number",
      },
    },
    subtotal: {
      type: Number,
      required: [true, "Item subtotal is required"],
      min: [0.01, "Subtotal must be greater than 0"],
      validate: [
        {
          validator: Number.isFinite,
          message: "Subtotal must be a finite number",
        },
        {
          validator: function (val) {
            if (!Number.isFinite(this.quantity) || !Number.isFinite(this.agreedPricePerUnit)) return true;
            const expected = roundCurrency(this.quantity * this.agreedPricePerUnit);
            return Math.abs(roundCurrency(val) - expected) <= 0.01;
          },
          message: function (props) {
            const expected = roundCurrency(this.quantity * this.agreedPricePerUnit);
            return `Item subtotal (${props.value}) does not match quantity * agreedPricePerUnit (${expected})`;
          },
        },
      ],
    },
  },
  { _id: true }
);

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      default: () => `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Buyer ID (User reference) is required"],
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Farmer ID (User reference) is required"],
    },
    items: {
      type: [OrderItemSnapshotSchema],
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: "Order must contain at least one item snapshot",
      },
    },
    totalAmount: {
      type: Number,
      required: [true, "Order total amount is required"],
      min: [0.01, "Total amount must be greater than 0"],
      validate: [
        {
          validator: Number.isFinite,
          message: "Total amount must be a finite number",
        },
        {
          validator: function (val) {
            if (!Array.isArray(this.items) || this.items.length === 0) return true;
            const sum = roundCurrency(
              this.items.reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0)
            );
            return Math.abs(roundCurrency(val) - sum) <= 0.01;
          },
          message: function (props) {
            const sum = roundCurrency(
              (this.items || []).reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0)
            );
            return `Order totalAmount (${props.value}) does not match the sum of item subtotals (${sum})`;
          },
        },
      ],
    },
    status: {
      type: String,
      required: [true, "Order status is required"],
      enum: {
        values: ALLOWED_ORDER_STATUSES,
        message: "Invalid order status",
      },
      default: "placed",
      lowercase: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      required: [true, "Payment method is required"],
      enum: {
        values: ALLOWED_PAYMENT_METHODS,
        message: "Payment method must be one of: cod, manual_bank_transfer, online",
      },
      default: "cod",
      lowercase: true,
      trim: true,
    },
    paymentStatus: {
      type: String,
      required: [true, "Payment status is required"],
      enum: {
        values: ALLOWED_PAYMENT_STATUSES,
        message: "Payment status must be one of: unpaid, pending, paid, failed, refunded",
      },
      default: "unpaid",
      lowercase: true,
      trim: true,
    },
    deliveryInfo: {
      deliveryType: {
        type: String,
        enum: ["farm_pickup", "seller_delivery", "third_party_transport"],
        default: "farm_pickup",
      },
      shippingAddress: { type: String, default: "", trim: true },
      city: { type: String, default: "", trim: true },
      contactPhone: { type: String, default: "", trim: true },
      deliveryNotes: { type: String, default: "", trim: true },
    },
    // Stage 6 Safe Transaction & Expiry Support
    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    reservationExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validation hook for currency rounding
OrderSchema.pre("validate", function (next) {
  if (Array.isArray(this.items)) {
    this.items.forEach((item) => {
      if (typeof item.agreedPricePerUnit === "number" && Number.isFinite(item.agreedPricePerUnit)) {
        item.agreedPricePerUnit = roundCurrency(item.agreedPricePerUnit);
      }
      if (typeof item.quantity === "number" && Number.isFinite(item.quantity)) {
        item.quantity = roundCurrency(item.quantity);
      }
      if (typeof item.subtotal === "number" && Number.isFinite(item.subtotal)) {
        item.subtotal = roundCurrency(item.subtotal);
      }
    });
  }

  if (typeof this.totalAmount === "number" && Number.isFinite(this.totalAmount)) {
    this.totalAmount = roundCurrency(this.totalAmount);
  }

  next();
});

// Database Indexes
OrderSchema.index({ buyerId: 1, createdAt: -1 });
OrderSchema.index({ farmerId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ status: 1, reservationExpiresAt: 1 });
OrderSchema.index({ buyerId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Order", OrderSchema);
module.exports.ALLOWED_ORDER_STATUSES = ALLOWED_ORDER_STATUSES;
