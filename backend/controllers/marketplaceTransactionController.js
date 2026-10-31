const mongoose = require("mongoose");
const Listing = require("../models/Listing");
const Bid = require("../models/Bid");
const Order = require("../models/Order");
const Notification = require("../models/Notification");
const { executeInTransaction } = require("../services/transactionService");
const { expirePendingOrders } = require("../services/orderExpiryService");

// Helpers
const roundCurrency = (val) => Math.round(Number(val) * 100) / 100;
const DEFAULT_CONFIRMATION_WINDOW_HOURS = 24;

/**
 * POST /api/marketplace/listings/:listingId/buy-now
 * Transactional Buy Now purchase with client idempotency key and atomic inventory reservation.
 */
async function buyNowListing(req, res) {
  try {
    const { listingId } = req.params;
    const { quantity, idempotencyKey, deliveryInfo } = req.body;
    const buyerId = req.user.id;

    // Validate parameters
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ message: "Invalid listing ID format." });
    }

    const parsedQty = Number(quantity);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({ message: "Purchase quantity must be a positive finite number." });
    }

    if (!idempotencyKey || typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
      return res.status(400).json({
        message: "An 'idempotencyKey' is required for purchase requests to prevent accidental duplicate orders.",
      });
    }

    const trimmedKey = idempotencyKey.trim();

    // Idempotency check: if this buyer already placed an order with this key, return original result
    const existingOrder = await Order.findOne({ buyerId, idempotencyKey: trimmedKey });
    if (existingOrder) {
      return res.status(200).json({
        success: true,
        idempotentReplay: true,
        message: "Returning previously confirmed order transaction for this idempotency key.",
        order: existingOrder,
      });
    }

    // Execute within MongoDB ACID Transaction
    const result = await executeInTransaction(async (session) => {
      // Re-check idempotency inside transaction
      const inTxExisting = await Order.findOne({ buyerId, idempotencyKey: trimmedKey }).session(session);
      if (inTxExisting) {
        return { idempotentReplay: true, order: inTxExisting };
      }

      // Read authoritative listing inside session
      const listing = await Listing.findById(listingId).session(session);
      if (!listing) {
        const err = new Error("Listing not found.");
        err.statusCode = 404;
        throw err;
      }

      // Invariants check
      if (listing.status !== "available") {
        const err = new Error(`Listing is not available for purchase (current status: '${listing.status}').`);
        err.statusCode = 400;
        throw err;
      }

      const minOrderQty = listing.minimumOrderQuantity || 1;
      if (parsedQty < minOrderQty) {
        const err = new Error(`Requested quantity (${parsedQty}) is below the minimum order quantity (${minOrderQty} ${listing.quantityUnit}).`);
        err.statusCode = 400;
        throw err;
      }

      if (parsedQty > listing.quantityAvailable) {
        const err = new Error(`Requested quantity (${parsedQty} ${listing.quantityUnit}) exceeds available stock (${listing.quantityAvailable} ${listing.quantityUnit}).`);
        err.statusCode = 409;
        throw err;
      }

      // Prevent buying from one's own listing
      if (listing.farmerId.toString() === buyerId.toString()) {
        const err = new Error("Growers cannot purchase from their own produce listings.");
        err.statusCode = 400;
        throw err;
      }

      // Step 2 & 3: Atomically move requested quantity from available to reserved
      listing.quantityAvailable = roundCurrency(listing.quantityAvailable - parsedQty);
      listing.quantityReserved = roundCurrency((listing.quantityReserved || 0) + parsedQty);

      // Recalculate listing status: if no available stock remains, transition to reserved
      if (listing.quantityAvailable === 0) {
        listing.status = "reserved";
      }

      await listing.save({ session });

      // Authoritative financial totals computed on server
      const agreedPricePerUnit = roundCurrency(listing.fixedPricePerUnit);
      const subtotal = roundCurrency(parsedQty * agreedPricePerUnit);
      const totalAmount = subtotal;

      const reservationExpiresAt = new Date(Date.now() + DEFAULT_CONFIRMATION_WINDOW_HOURS * 60 * 60 * 1000);

      // Create Order document
      const order = new Order({
        buyerId,
        farmerId: listing.farmerId,
        idempotencyKey: trimmedKey,
        items: [
          {
            listingId: listing._id,
            title: listing.title,
            quantity: parsedQty,
            unit: listing.quantityUnit,
            agreedPricePerUnit,
            subtotal,
          },
        ],
        totalAmount,
        status: "placed",
        paymentStatus: "unpaid",
        reservationExpiresAt,
        deliveryInfo: deliveryInfo || {},
      });

      await order.save({ session });

      // Generate in-app database notification for seller
      const notification = new Notification({
        recipientId: listing.farmerId,
        type: "order_placed",
        title: "New Purchase Placed",
        message: `Order #${order.orderNumber} for ${parsedQty} ${listing.quantityUnit} of '${listing.title}' was placed by buyer. Please review and confirm within ${DEFAULT_CONFIRMATION_WINDOW_HOURS} hours.`,
        relatedListingId: listing._id,
        relatedOrderId: order._id,
      });

      await notification.save({ session });

      return { idempotentReplay: false, order };
    });

    return res.status(201).json({
      success: true,
      idempotentReplay: result.idempotentReplay,
      message: "Order placed successfully. Inventory reserved pending farmer confirmation.",
      order: result.order,
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern && err.keyPattern.idempotencyKey) {
      // Duplicate idempotency race condition: retrieve and return the winning order safely
      const existing = await Order.findOne({ buyerId: req.user.id, idempotencyKey: req.body.idempotencyKey.trim() });
      if (existing) {
        return res.status(200).json({
          success: true,
          idempotentReplay: true,
          message: "Returning previously confirmed order transaction for this idempotency key.",
          order: existing,
        });
      }
    }

    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to process Buy Now purchase.",
      code: err.code || "ORDER_CREATION_FAILED",
    });
  }
}

/**
 * POST /api/marketplace/orders/:orderId/confirm
 * Farmer confirms placed order, locking in the transaction and preventing auto-expiry.
 */
async function confirmOrder(req, res) {
  try {
    const { orderId } = req.params;
    const farmerId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID format." });
    }

    const updatedOrder = await executeInTransaction(async (session) => {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        const err = new Error("Order not found.");
        err.statusCode = 404;
        throw err;
      }

      if (order.farmerId.toString() !== farmerId.toString()) {
        const err = new Error("Forbidden: You are not authorized to confirm orders for another farmer.");
        err.statusCode = 403;
        throw err;
      }

      if (order.status !== "placed") {
        const err = new Error(`Cannot confirm order in status '${order.status}'. Only newly placed orders can be confirmed.`);
        err.statusCode = 400;
        throw err;
      }

      if (order.reservationExpiresAt && order.reservationExpiresAt <= new Date()) {
        const err = new Error("Order reservation confirmation window has already expired.");
        err.statusCode = 400;
        throw err;
      }

      order.status = "confirmed";
      order.reservationExpiresAt = null; // Lock reservation so expiry workers never release confirmed stock
      await order.save({ session });

      // Notify buyer of confirmation
      const notif = new Notification({
        recipientId: order.buyerId,
        type: "order_confirmed",
        title: "Order Confirmed",
        message: `Your order #${order.orderNumber} has been officially confirmed by the farmer.`,
        relatedOrderId: order._id,
      });
      await notif.save({ session });

      return order;
    });

    return res.json({
      success: true,
      message: "Order confirmed successfully.",
      order: updatedOrder,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to confirm order.",
    });
  }
}

/**
 * POST /api/marketplace/orders/:orderId/cancel
 * Authoritatively cancel an unconfirmed placed order and restore reserved stock to available stock.
 */
async function cancelOrder(req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role || "farmer";

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID format." });
    }

    const cancelledOrder = await executeInTransaction(async (session) => {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        const err = new Error("Order not found.");
        err.statusCode = 404;
        throw err;
      }

      const isBuyer = order.buyerId.toString() === userId.toString();
      const isFarmer = order.farmerId.toString() === userId.toString();

      if (!isBuyer && !isFarmer) {
        const err = new Error("Forbidden: You are not a party to this order.");
        err.statusCode = 403;
        throw err;
      }

      if (order.status !== "placed") {
        const err = new Error(`Cannot cancel order in status '${order.status}'. Only unconfirmed placed orders can be cancelled.`);
        err.statusCode = 400;
        throw err;
      }

      // Release reserved stock back into quantityAvailable
      for (const item of order.items) {
        const listing = await Listing.findById(item.listingId).session(session);
        if (listing) {
          const qty = Number(item.quantity) || 0;
          listing.quantityReserved = Math.max(0, (listing.quantityReserved || 0) - qty);
          listing.quantityAvailable = (listing.quantityAvailable || 0) + qty;

          if (listing.quantityAvailable > 0 && listing.status !== "inactive") {
            listing.status = "available";
          }
          await listing.save({ session });
        }
      }

      order.status = "cancelled";
      await order.save({ session });

      // Notify counterparty
      const recipientId = isBuyer ? order.farmerId : order.buyerId;
      const cancelledByText = isBuyer ? "Buyer" : "Farmer";
      const notif = new Notification({
        recipientId,
        type: "order_cancelled",
        title: "Order Cancelled",
        message: `Order #${order.orderNumber} was cancelled by the ${cancelledByText}. Reserved stock has been returned to inventory.`,
        relatedOrderId: order._id,
      });
      await notif.save({ session });

      return order;
    });

    return res.json({
      success: true,
      message: "Order cancelled and reserved stock restored.",
      order: cancelledOrder,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to cancel order.",
    });
  }
}

/**
 * POST /api/marketplace/orders/expire
 * Scheduled worker / maintenance route to sweep and expire lapsed orders.
 */
async function triggerOrderExpiry(req, res) {
  try {
    const result = await expirePendingOrders();
    return res.json({
      success: true,
      message: `Processed order reservation expiry. Expired ${result.processedCount} orders.`,
      result,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Order expiry sweep failed.",
    });
  }
}

/**
 * POST /api/marketplace/listings/:listingId/bids
 * Submits an initial buyer bid. DOES NOT RESERVE STOCK at submission time.
 */
async function createBid(req, res) {
  try {
    const { listingId } = req.params;
    const { bidPricePerUnit, quantity, message, expiresInHours = 48 } = req.body;
    const buyerId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ message: "Invalid listing ID format." });
    }

    const parsedPrice = Number(bidPricePerUnit);
    const parsedQty = Number(quantity);

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ message: "Bid price per unit must be a positive finite number." });
    }
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({ message: "Bid quantity must be a positive finite number." });
    }

    const parsedHours = Number(expiresInHours);
    if (!Number.isFinite(parsedHours) || parsedHours < 1 || parsedHours > 168) {
      return res.status(400).json({ message: "expiresInHours must be between 1 and 168 hours (7 days)." });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found." });
    }

    if (listing.status !== "available") {
      return res.status(400).json({ message: `Cannot submit a bid on a '${listing.status}' listing.` });
    }

    if (listing.farmerId.toString() === buyerId.toString()) {
      return res.status(400).json({ message: "Farmers cannot submit bids on their own produce listings." });
    }

    if (parsedQty > listing.quantityAvailable) {
      return res.status(400).json({
        message: `Bid quantity (${parsedQty}) cannot exceed currently available stock (${listing.quantityAvailable} ${listing.quantityUnit}).`,
      });
    }

    if (listing.minimumBidPerUnit && parsedPrice < listing.minimumBidPerUnit) {
      return res.status(400).json({
        message: `Bid price (₹${parsedPrice}) is below the minimum required bid (₹${listing.minimumBidPerUnit}/${listing.quantityUnit}).`,
      });
    }

    const minOrderQty = listing.minimumOrderQuantity || 1;
    if (parsedQty < minOrderQty) {
      return res.status(400).json({
        message: `Bid quantity (${parsedQty}) is below the minimum order quantity (${minOrderQty} ${listing.quantityUnit}).`,
      });
    }

    const expiresAt = new Date(Date.now() + parsedHours * 60 * 60 * 1000);
    const trimmedMessage = message && typeof message === "string" ? message.trim().slice(0, 500) : "";

    // Stage 6 Negotiation Model
    const initialOffer = {
      offerNumber: 1,
      offeredBy: buyerId,
      role: "buyer",
      pricePerUnit: parsedPrice,
      quantity: parsedQty,
      message: trimmedMessage,
      expiresAt,
      createdAt: new Date(),
    };

    const bid = new Bid({
      listingId: listing._id,
      buyerId,
      farmerId: listing.farmerId,
      bidPricePerUnit: parsedPrice,
      quantity: parsedQty,
      status: "pending",
      message: trimmedMessage,
      expiresAt,
      currentOffer: {
        pricePerUnit: parsedPrice,
        quantity: parsedQty,
        offeredBy: buyerId,
        offeredByRole: "buyer",
        pendingResponderRole: "farmer",
        pendingResponderId: listing.farmerId,
        message: trimmedMessage,
        expiresAt,
        updatedAt: new Date(),
      },
      offerHistory: [initialOffer],
    });

    await bid.save();

    // Send notification to farmer
    const notification = new Notification({
      recipientId: listing.farmerId,
      type: "new_bid",
      title: "New Bid Received",
      message: `A new bid of ₹${parsedPrice}/${listing.quantityUnit} for ${parsedQty} units of '${listing.title}' was submitted.`,
      relatedListingId: listing._id,
      relatedBidId: bid._id,
    });
    await notification.save();

    return res.status(201).json({
      success: true,
      message: "Bid submitted successfully. No inventory reserved until acceptance.",
      bid,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to submit bid.",
    });
  }
}

/**
 * POST /api/marketplace/bids/:bidId/counter
 * Alternating counter-offer submission with immutable offer history append.
 */
async function counterBid(req, res) {
  try {
    const { bidId } = req.params;
    const { pricePerUnit, quantity, message, expiresInHours = 48 } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(bidId)) {
      return res.status(400).json({ message: "Invalid bid ID format." });
    }

    const parsedPrice = Number(pricePerUnit);
    const parsedQty = Number(quantity);

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ message: "Counter-offer price must be a positive finite number." });
    }
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({ message: "Counter-offer quantity must be a positive finite number." });
    }

    const bid = await Bid.findById(bidId);
    if (!bid) {
      return res.status(404).json({ message: "Bid not found." });
    }

    const listing = await Listing.findById(bid.listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found." });
    }

    // Terminal states check
    if (["accepted", "rejected", "withdrawn", "expired"].includes(bid.status)) {
      return res.status(400).json({
        message: `Cannot counter a bid in terminal state '${bid.status}'.`,
      });
    }

    // Expiry check
    if (bid.currentOffer && bid.currentOffer.expiresAt && bid.currentOffer.expiresAt <= new Date()) {
      return res.status(400).json({ message: "The active offer has expired and can no longer be countered." });
    }

    // Authorization & Responder Alternation Check
    const isFarmer = listing.farmerId.toString() === userId.toString();
    const isBuyer = bid.buyerId.toString() === userId.toString();

    if (!isFarmer && !isBuyer) {
      return res.status(403).json({ message: "Forbidden: You are not a participant in this negotiation." });
    }

    const pendingRole = bid.currentOffer ? bid.currentOffer.pendingResponderRole : "farmer";

    if (pendingRole === "farmer" && !isFarmer) {
      return res.status(403).json({
        message: "Action restricted: It is currently the farmer's turn to respond to the active offer.",
      });
    }

    if (pendingRole === "buyer" && !isBuyer) {
      return res.status(403).json({
        message: "Action restricted: It is currently the buyer's turn to respond to the active offer.",
      });
    }

    if (parsedQty > listing.quantityAvailable) {
      return res.status(400).json({
        message: `Counter-offer quantity (${parsedQty}) cannot exceed current available stock (${listing.quantityAvailable} ${listing.quantityUnit}).`,
      });
    }

    // Determine new roles
    const offeredByRole = isFarmer ? "farmer" : "buyer";
    const nextResponderRole = isFarmer ? "buyer" : "farmer";
    const nextResponderId = isFarmer ? bid.buyerId : listing.farmerId;
    const expiresAt = new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000);
    const trimmedMessage = message && typeof message === "string" ? message.trim().slice(0, 500) : "";

    const nextOfferNumber = (bid.offerHistory ? bid.offerHistory.length : 0) + 1;
    const newOffer = {
      offerNumber: nextOfferNumber,
      offeredBy: userId,
      role: offeredByRole,
      pricePerUnit: parsedPrice,
      quantity: parsedQty,
      message: trimmedMessage,
      expiresAt,
      createdAt: new Date(),
    };

    bid.offerHistory.push(newOffer);

    bid.currentOffer = {
      pricePerUnit: parsedPrice,
      quantity: parsedQty,
      offeredBy: userId,
      offeredByRole,
      pendingResponderRole: nextResponderRole,
      pendingResponderId: nextResponderId,
      message: trimmedMessage,
      expiresAt,
      updatedAt: new Date(),
    };

    bid.status = "countered";
    await bid.save();

    // Create notification for the newly intended responder
    const notification = new Notification({
      recipientId: nextResponderId,
      type: "counter_offer",
      title: "New Counter-Offer Received",
      message: `A counter-offer of ₹${parsedPrice}/${listing.quantityUnit} for ${parsedQty} units was submitted on '${listing.title}'.`,
      relatedListingId: listing._id,
      relatedBidId: bid._id,
    });
    await notification.save();

    return res.json({
      success: true,
      message: "Counter-offer submitted. Awaiting counterparty response.",
      bid,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to submit counter-offer.",
    });
  }
}

/**
 * POST /api/marketplace/bids/:bidId/accept
 * Transactionally accepts the active offer, atomically reserves stock, and creates an order.
 */
async function acceptBid(req, res) {
  try {
    const { bidId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(bidId)) {
      return res.status(400).json({ message: "Invalid bid ID format." });
    }

    const { order, bid } = await executeInTransaction(async (session) => {
      const bidDoc = await Bid.findById(bidId).session(session);
      if (!bidDoc) {
        const err = new Error("Bid not found.");
        err.statusCode = 404;
        throw err;
      }

      const listing = await Listing.findById(bidDoc.listingId).session(session);
      if (!listing) {
        const err = new Error("Listing not found.");
        err.statusCode = 404;
        throw err;
      }

      // Check terminal state
      if (["accepted", "rejected", "withdrawn", "expired"].includes(bidDoc.status)) {
        const err = new Error(`Cannot accept bid in terminal status '${bidDoc.status}'.`);
        err.statusCode = 400;
        throw err;
      }

      const activeOffer = bidDoc.currentOffer;
      if (!activeOffer || !activeOffer.pricePerUnit) {
        const err = new Error("Active offer structure is missing.");
        err.statusCode = 400;
        throw err;
      }

      // Check expiry
      if (activeOffer.expiresAt && activeOffer.expiresAt <= new Date()) {
        const err = new Error("Active offer has expired and cannot be accepted.");
        err.statusCode = 400;
        throw err;
      }

      // Verify responder authorization
      const isFarmer = listing.farmerId.toString() === userId.toString();
      const isBuyer = bidDoc.buyerId.toString() === userId.toString();

      if (activeOffer.pendingResponderRole === "farmer" && !isFarmer) {
        const err = new Error("Only the seller (farmer) can accept this active offer.");
        err.statusCode = 403;
        throw err;
      }

      if (activeOffer.pendingResponderRole === "buyer" && !isBuyer) {
        const err = new Error("Only the buyer can accept this counter-offer.");
        err.statusCode = 403;
        throw err;
      }

      // Check listing availability and stock
      if (listing.status !== "available") {
        const err = new Error(`Listing is no longer available (current status: '${listing.status}').`);
        err.statusCode = 400;
        throw err;
      }

      const requiredQty = Number(activeOffer.quantity);
      if (listing.quantityAvailable < requiredQty) {
        const err = new Error(`Insufficient available stock (${listing.quantityAvailable} ${listing.quantityUnit}) to accept bid for ${requiredQty} units.`);
        err.statusCode = 409;
        throw err;
      }

      // Atomically move stock: quantityAvailable -> quantityReserved
      listing.quantityAvailable = roundCurrency(listing.quantityAvailable - requiredQty);
      listing.quantityReserved = roundCurrency((listing.quantityReserved || 0) + requiredQty);

      if (listing.quantityAvailable === 0) {
        listing.status = "reserved";
      }
      await listing.save({ session });

      // Financial arithmetic
      const agreedPricePerUnit = roundCurrency(activeOffer.pricePerUnit);
      const subtotal = roundCurrency(requiredQty * agreedPricePerUnit);
      const totalAmount = subtotal;

      const order = new Order({
        buyerId: bidDoc.buyerId,
        farmerId: listing.farmerId,
        idempotencyKey: `BID_ACCEPT_${bidDoc._id}`,
        items: [
          {
            listingId: listing._id,
            title: listing.title,
            quantity: requiredQty,
            unit: listing.quantityUnit,
            agreedPricePerUnit,
            subtotal,
          },
        ],
        totalAmount,
        status: "placed",
        paymentStatus: "unpaid",
        reservationExpiresAt: new Date(Date.now() + DEFAULT_CONFIRMATION_WINDOW_HOURS * 60 * 60 * 1000),
      });

      await order.save({ session });

      // Mark bid accepted
      bidDoc.status = "accepted";
      await bidDoc.save({ session });

      // Notify buyer and farmer
      const notifBuyer = new Notification({
        recipientId: bidDoc.buyerId,
        type: "bid_accepted",
        title: "Bid Accepted! Order Created",
        message: `The agreed offer on '${listing.title}' was accepted. Order #${order.orderNumber} has been generated with reserved stock.`,
        relatedListingId: listing._id,
        relatedBidId: bidDoc._id,
        relatedOrderId: order._id,
      });
      await notifBuyer.save({ session });

      const notifFarmer = new Notification({
        recipientId: listing.farmerId,
        type: "bid_accepted",
        title: "Bid Trade Finalized",
        message: `Offer on '${listing.title}' accepted. Order #${order.orderNumber} generated.`,
        relatedListingId: listing._id,
        relatedBidId: bidDoc._id,
        relatedOrderId: order._id,
      });
      await notifFarmer.save({ session });

      return { order, bid: bidDoc };
    });

    return res.json({
      success: true,
      message: "Bid accepted successfully. Stock reserved and order created.",
      order,
      bid,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to accept bid.",
    });
  }
}

/**
 * POST /api/marketplace/bids/:bidId/reject
 * Designated responder rejects the active offer (Terminal state).
 */
async function rejectBid(req, res) {
  try {
    const { bidId } = req.params;
    const userId = req.user.id;

    const bid = await Bid.findById(bidId);
    if (!bid) return res.status(404).json({ message: "Bid not found." });

    const listing = await Listing.findById(bid.listingId);
    if (!listing) return res.status(404).json({ message: "Listing not found." });

    if (["accepted", "rejected", "withdrawn", "expired"].includes(bid.status)) {
      return res.status(400).json({ message: `Cannot reject bid in terminal status '${bid.status}'.` });
    }

    const isFarmer = listing.farmerId.toString() === userId.toString();
    const isBuyer = bid.buyerId.toString() === userId.toString();

    const pendingRole = bid.currentOffer ? bid.currentOffer.pendingResponderRole : "farmer";
    if (pendingRole === "farmer" && !isFarmer) {
      return res.status(403).json({ message: "Only the seller can reject this active offer." });
    }
    if (pendingRole === "buyer" && !isBuyer) {
      return res.status(403).json({ message: "Only the buyer can reject this active counter-offer." });
    }

    bid.status = "rejected";
    await bid.save();

    const otherPartyId = isFarmer ? bid.buyerId : listing.farmerId;
    const notif = new Notification({
      recipientId: otherPartyId,
      type: "bid_rejected",
      title: "Offer Rejected",
      message: `The active offer on '${listing.title}' was rejected.`,
      relatedBidId: bid._id,
      relatedListingId: listing._id,
    });
    await notif.save();

    return res.json({ success: true, message: "Offer rejected.", bid });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/marketplace/bids/:bidId/withdraw
 * Offer creator withdraws their own active offer before counterparty accepts (Terminal state).
 */
async function withdrawBid(req, res) {
  try {
    const { bidId } = req.params;
    const userId = req.user.id;

    const bid = await Bid.findById(bidId);
    if (!bid) return res.status(404).json({ message: "Bid not found." });

    if (["accepted", "rejected", "withdrawn", "expired"].includes(bid.status)) {
      return res.status(400).json({ message: `Cannot withdraw bid in terminal status '${bid.status}'.` });
    }

    const activeOfferer = bid.currentOffer ? bid.currentOffer.offeredBy.toString() : bid.buyerId.toString();
    if (activeOfferer !== userId.toString()) {
      return res.status(403).json({ message: "You can only withdraw an offer that you created." });
    }

    bid.status = "withdrawn";
    await bid.save();

    return res.json({ success: true, message: "Offer withdrawn successfully.", bid });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/marketplace/buyer/orders
 */
async function getBuyerOrders(req, res) {
  try {
    const orders = await Order.find({ buyerId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("farmerId", "name email")
      .populate("items.listingId", "title category fixedPricePerUnit quantityUnit")
      .lean();

    return res.json({ success: true, orders });
  } catch (err) {
    return res.status(500).json({ message: "Failed to retrieve buyer orders.", error: err.message });
  }
}

/**
 * GET /api/marketplace/farmer/orders
 */
async function getFarmerOrders(req, res) {
  try {
    const orders = await Order.find({ farmerId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("buyerId", "name email phone")
      .populate("items.listingId", "title category fixedPricePerUnit quantityUnit")
      .lean();

    return res.json({ success: true, orders });
  } catch (err) {
    return res.status(500).json({ message: "Failed to retrieve farmer orders.", error: err.message });
  }
}

/**
 * GET /api/marketplace/buyer/bids
 */
async function getBuyerBids(req, res) {
  try {
    const bids = await Bid.find({ buyerId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("listingId", "title category fixedPricePerUnit quantityUnit quantityAvailable status")
      .populate("farmerId", "name")
      .lean();

    return res.json({ success: true, bids });
  } catch (err) {
    return res.status(500).json({ message: "Failed to retrieve buyer bids.", error: err.message });
  }
}

/**
 * GET /api/marketplace/farmer/bids
 */
async function getFarmerBids(req, res) {
  try {
    const bids = await Bid.find({ farmerId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("listingId", "title category fixedPricePerUnit quantityUnit quantityAvailable status")
      .populate("buyerId", "name email")
      .lean();

    return res.json({ success: true, bids });
  } catch (err) {
    return res.status(500).json({ message: "Failed to retrieve farmer bids.", error: err.message });
  }
}

/**
 * GET /api/marketplace/orders/:orderId
 */
async function getOrderById(req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID." });
    }

    const order = await Order.findById(orderId)
      .populate("buyerId", "name email phone")
      .populate("farmerId", "name email phone")
      .populate("items.listingId", "title category fixedPricePerUnit quantityUnit")
      .lean();

    if (!order) return res.status(404).json({ message: "Order not found." });

    if (order.buyerId._id.toString() !== userId.toString() && order.farmerId._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view this order." });
    }

    return res.json({ success: true, order });
  } catch (err) {
    return res.status(500).json({ message: "Failed to retrieve order.", error: err.message });
  }
}

/**
 * GET /api/marketplace/bids/:bidId
 */
async function getBidById(req, res) {
  try {
    const { bidId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(bidId)) {
      return res.status(400).json({ message: "Invalid bid ID." });
    }

    const bid = await Bid.findById(bidId)
      .populate("buyerId", "name")
      .populate("farmerId", "name")
      .populate("listingId", "title category fixedPricePerUnit quantityUnit quantityAvailable status")
      .lean();

    if (!bid) return res.status(404).json({ message: "Bid not found." });

    const isBuyer = bid.buyerId._id.toString() === userId.toString();
    const isFarmer = bid.farmerId && bid.farmerId._id.toString() === userId.toString();

    if (!isBuyer && !isFarmer) {
      return res.status(403).json({ message: "Forbidden: You are not authorized to view this bid." });
    }

    return res.json({ success: true, bid });
  } catch (err) {
    return res.status(500).json({ message: "Failed to retrieve bid.", error: err.message });
  }
}

module.exports = {
  buyNowListing,
  confirmOrder,
  cancelOrder,
  triggerOrderExpiry,
  createBid,
  counterBid,
  acceptBid,
  rejectBid,
  withdrawBid,
  getBuyerOrders,
  getFarmerOrders,
  getBuyerBids,
  getFarmerBids,
  getOrderById,
  getBidById,
};
