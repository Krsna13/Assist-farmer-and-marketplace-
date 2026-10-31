const Order = require("../models/Order");
const Listing = require("../models/Listing");
const Notification = require("../models/Notification");
const { executeInTransaction } = require("./transactionService");

/**
 * Sweeps the database for unconfirmed orders awaiting farmer confirmation
 * whose reservation confirmation window has lapsed.
 *
 * Requirements:
 * 1. Only expires orders that are still strictly in 'placed' state.
 * 2. Idempotent: once confirmed, cancelled, or expired, stock is never re-released.
 * 3. Uses a MongoDB ACID transaction for each order expiry to ensure consistent stock release.
 * 4. Restores listing availability invariants (quantityReserved -> quantityAvailable).
 *
 * @returns {Promise<{ processedCount: number, expiredOrders: Array<{ orderId: string, orderNumber: string }> }>}
 */
async function expirePendingOrders() {
  const now = new Date();

  // Find candidate expired orders (status: 'placed' with reservationExpiresAt in the past)
  const candidateOrders = await Order.find({
    status: "placed",
    reservationExpiresAt: { $ne: null, $lte: now },
  }).select("_id orderNumber");

  if (!candidateOrders || candidateOrders.length === 0) {
    return { processedCount: 0, expiredOrders: [] };
  }

  const expiredOrders = [];

  for (const candidate of candidateOrders) {
    try {
      await executeInTransaction(async (session) => {
        // Re-fetch order within transaction lock
        const order = await Order.findById(candidate._id).session(session);
        if (!order || order.status !== "placed") {
          return; // Concurrently confirmed or cancelled; skip safely
        }
        if (!order.reservationExpiresAt || order.reservationExpiresAt > new Date()) {
          return; // Window extended or not yet expired
        }

        // Release stock for each item in the order
        for (const item of order.items) {
          const listing = await Listing.findById(item.listingId).session(session);
          if (listing) {
            const qtyToRelease = Number(item.quantity) || 0;
            listing.quantityReserved = Math.max(0, (listing.quantityReserved || 0) - qtyToRelease);
            listing.quantityAvailable = (listing.quantityAvailable || 0) + qtyToRelease;

            // Enforce status invariants: if available quantity > 0 and was reserved/sold, reset to available
            if (listing.quantityAvailable > 0 && listing.status !== "inactive") {
              listing.status = "available";
            }
            await listing.save({ session });
          }
        }

        // Mark order expired
        order.status = "expired";
        await order.save({ session });

        // Generate database notifications
        const notifBuyer = new Notification({
          recipientId: order.buyerId,
          type: "order_expired",
          title: "Order Reservation Expired",
          message: `Your order #${order.orderNumber} expired because farmer confirmation was not completed within the reservation window. Reserved stock has been released.`,
          relatedOrderId: order._id,
        });
        await notifBuyer.save({ session });

        const notifFarmer = new Notification({
          recipientId: order.farmerId,
          type: "order_expired",
          title: "Incoming Order Expired",
          message: `Order #${order.orderNumber} expired without confirmation. Reserved inventory has been restored to your available stock.`,
          relatedOrderId: order._id,
        });
        await notifFarmer.save({ session });

        expiredOrders.push({ orderId: order._id.toString(), orderNumber: order.orderNumber });
      });
    } catch (err) {
      console.error(`Failed to expire order ${candidate._id}:`, err.message);
    }
  }

  return {
    processedCount: expiredOrders.length,
    expiredOrders,
  };
}

module.exports = {
  expirePendingOrders,
};
