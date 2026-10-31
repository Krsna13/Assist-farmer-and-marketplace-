const mongoose = require("mongoose");

const ALLOWED_NOTIFICATION_TYPES = [
  // Bidding lifecycle
  "new_bid",
  "counter_offer",
  "bid_accepted",
  "bid_rejected",
  "bid_withdrawn",
  "bid_expired",

  // Order fulfillment lifecycle
  "order_placed",
  "order_confirmed",
  "order_dispatched",
  "order_delivered",
  "order_cancelled",
  "order_expired",

  // Inventory quality / verification lifecycle
  "stale_photo_reminder",

  // System & platform alerts
  "system_alert",
];

const NotificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient ID (User reference) is required"],
    },
    type: {
      type: String,
      required: [true, "Notification type is required"],
      enum: {
        values: ALLOWED_NOTIFICATION_TYPES,
        message: "Invalid notification type",
      },
    },
    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },
    relatedListingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      default: null,
    },
    relatedBidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bid",
      default: null,
    },
    relatedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Database Indexes for efficient notification queries and badge counts
NotificationSchema.index({ recipientId: 1, readAt: 1 });
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
