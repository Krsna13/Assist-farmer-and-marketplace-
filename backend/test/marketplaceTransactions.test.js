const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Listing = require("../models/Listing");
const Bid = require("../models/Bid");
const Order = require("../models/Order");
const Notification = require("../models/Notification");
const marketplaceRoutes = require("../routes/marketplaceRoutes");
const {
  TransactionsUnsupportedError,
  executeInTransaction,
} = require("../services/transactionService");
const { expirePendingOrders } = require("../services/orderExpiryService");

const JWT_SECRET = process.env.JWT_SECRET || "fms_super_secret_jwt_key_2025";
process.env.JWT_SECRET = JWT_SECRET;

async function runStage6TransactionTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING STAGE 6 MARKETPLACE TRANSACTIONS & NEGOTIATION TESTS");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // Spin up test server
  const app = express();
  app.use(express.json());
  app.use("/api/marketplace", marketplaceRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/marketplace`;

  // Identities
  const farmer1Id = new mongoose.Types.ObjectId();
  const farmer2Id = new mongoose.Types.ObjectId();
  const buyer1Id = new mongoose.Types.ObjectId();
  const buyer2Id = new mongoose.Types.ObjectId();
  const outsiderId = new mongoose.Types.ObjectId();

  const farmer1Token = jwt.sign({ id: farmer1Id.toString(), role: "farmer" }, JWT_SECRET);
  const farmer2Token = jwt.sign({ id: farmer2Id.toString(), role: "farmer" }, JWT_SECRET);
  const buyer1Token = jwt.sign({ id: buyer1Id.toString(), role: "buyer" }, JWT_SECRET);
  const buyer2Token = jwt.sign({ id: buyer2Id.toString(), role: "buyer" }, JWT_SECRET);
  const outsiderToken = jwt.sign({ id: outsiderId.toString(), role: "buyer" }, JWT_SECRET);

  // In-memory data stores
  const listingsMap = new Map();
  const bidsMap = new Map();
  const ordersMap = new Map();
  const notificationsList = [];

  // Helper query builder supporting mongoose chained methods
  function makeQuery(result) {
    const q = {
      session: () => q,
      populate: () => q,
      sort: () => q,
      limit: () => q,
      select: () => q,
      lean: () => q,
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      catch: (reject) => Promise.resolve(result).catch(reject),
    };
    return q;
  }

  // Mock Mongoose Transaction Session
  let shouldFailTransactions = false;
  let transactionFailReason = "";

  const mockSession = {
    withTransaction: async (workFn) => {
      if (shouldFailTransactions) {
        throw new Error(transactionFailReason || "Transaction numbers are only allowed on a replica set member or mongos");
      }
      return await workFn(mockSession);
    },
    endSession: async () => {},
    startTransaction: () => {},
    abortTransaction: async () => {},
  };

  // Mock mongoose connection & sessions
  const origReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, "readyState");
  let mockReadyState = 1;
  Object.defineProperty(mongoose.connection, "readyState", {
    get: () => mockReadyState,
    configurable: true,
  });

  const origStartSession = mongoose.startSession;
  mongoose.startSession = async () => {
    if (shouldFailTransactions) {
      throw new Error(transactionFailReason || "Transaction numbers are only allowed on a replica set member or mongos");
    }
    return mockSession;
  };

  // Mock Listing methods
  Listing.findById = (id) => {
    const doc = listingsMap.get(id.toString()) || null;
    return makeQuery(doc);
  };
  Listing.find = (filter = {}) => {
    let items = Array.from(listingsMap.values());
    if (filter.farmerId) {
      items = items.filter((l) => l.farmerId.toString() === filter.farmerId.toString());
    }
    return makeQuery(items);
  };

  // Mock Order methods
  Order.findById = (id) => {
    const doc = ordersMap.get(id.toString()) || null;
    return makeQuery(doc);
  };
  Order.findOne = (filter = {}) => {
    let items = Array.from(ordersMap.values());
    if (filter.buyerId) {
      items = items.filter((o) => o.buyerId.toString() === filter.buyerId.toString());
    }
    if (filter.idempotencyKey) {
      items = items.filter((o) => o.idempotencyKey === filter.idempotencyKey);
    }
    return makeQuery(items[0] || null);
  };
  Order.find = (filter = {}) => {
    let items = Array.from(ordersMap.values());
    if (filter.buyerId) {
      items = items.filter((o) => o.buyerId.toString() === filter.buyerId.toString());
    }
    if (filter.farmerId) {
      items = items.filter((o) => o.farmerId.toString() === filter.farmerId.toString());
    }
    if (filter.status === "placed" && filter.reservationExpiresAt) {
      const now = new Date();
      items = items.filter((o) => o.status === "placed" && o.reservationExpiresAt && o.reservationExpiresAt <= now);
    }
    return makeQuery(items);
  };

  // Hook Order.prototype.save to persist into ordersMap
  const origOrderSave = Order.prototype.save;
  Order.prototype.save = async function () {
    if (!this._id) {
      this._id = new mongoose.Types.ObjectId();
    }
    if (!this.orderNumber) {
      this.orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    if (!this.createdAt) {
      this.createdAt = new Date();
    }
    ordersMap.set(this._id.toString(), this);
    return this;
  };

  // Mock Bid methods
  Bid.findById = (id) => {
    const doc = bidsMap.get(id.toString()) || null;
    return makeQuery(doc);
  };
  Bid.find = (filter = {}) => {
    let items = Array.from(bidsMap.values());
    if (filter.buyerId) {
      items = items.filter((b) => b.buyerId.toString() === filter.buyerId.toString());
    }
    if (filter.farmerId) {
      items = items.filter((b) => b.farmerId.toString() === filter.farmerId.toString());
    }
    if (filter.listingId) {
      items = items.filter((b) => b.listingId.toString() === filter.listingId.toString());
    }
    return makeQuery(items);
  };

  // Hook Bid.prototype.save to persist into bidsMap
  const origBidSave = Bid.prototype.save;
  Bid.prototype.save = async function () {
    if (!this._id) {
      this._id = new mongoose.Types.ObjectId();
    }
    if (!this.createdAt) {
      this.createdAt = new Date();
    }
    bidsMap.set(this._id.toString(), this);
    return this;
  };

  // Hook Notification.prototype.save to capture in notificationsList
  const origNotifSave = Notification.prototype.save;
  Notification.prototype.save = async function () {
    if (!this._id) {
      this._id = new mongoose.Types.ObjectId();
    }
    if (!this.createdAt) {
      this.createdAt = new Date();
    }
    notificationsList.push(this);
    return this;
  };

  try {
    // =========================================================================
    // SETUP: Seed test listing
    // =========================================================================
    const listing1 = new Listing({
      farmerId: farmer1Id,
      locationModel: "CropFarm",
      locationId: new mongoose.Types.ObjectId(),
      category: "crop",
      title: "Premium Grade Basmati Rice",
      quantityUnit: "quintal",
      quantityAvailable: 50,
      quantityReserved: 0,
      quantitySold: 0,
      fixedPricePerUnit: 4000,
      minimumOrderQuantity: 5,
      minimumBidPerUnit: 3500,
      status: "available",
    });
    listing1._id = new mongoose.Types.ObjectId();
    listing1.save = async function () {
      listingsMap.set(this._id.toString(), this);
      return this;
    };
    listingsMap.set(listing1._id.toString(), listing1);

    // =========================================================================
    // 1. Buy-Now Order Creation & Stock Reservation (ACID Atomic)
    // =========================================================================
    const buyRes1 = await fetch(`${baseUrl}/listings/${listing1._id}/buy-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
      body: JSON.stringify({
        quantity: 10,
        idempotencyKey: "test-key-buyer1-order1",
        deliveryInfo: { deliveryAddress: "123 Market St, Delhi", contactPhone: "+91-9876543210" },
      }),
    });
    const buyJson1 = await buyRes1.json();
    assert(buyRes1.status === 201, "Criterion 1.1: Buy Now succeeds with HTTP 201");
    assert(buyJson1.order && buyJson1.order.status === "placed", "Criterion 1.2: Order created with status 'placed'");
    assert(buyJson1.order.totalAmount === 40000, "Criterion 1.3: Server authoritatively computed totalAmount = ₹40,000");

    const updatedListing1 = listingsMap.get(listing1._id.toString());
    assert(updatedListing1.quantityAvailable === 40, "Criterion 1.4: quantityAvailable reduced from 50 to 40");
    assert(updatedListing1.quantityReserved === 10, "Criterion 1.5: quantityReserved increased from 0 to 10");
    assert(updatedListing1.status === "available", "Criterion 1.6: Listing status remains 'available' while stock > 0");

    // =========================================================================
    // 2. Out-of-Stock and Partial-Stock Validation
    // =========================================================================
    // 2a. Below minimumOrderQuantity (min is 5)
    const minQtyRes = await fetch(`${baseUrl}/listings/${listing1._id}/buy-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
      body: JSON.stringify({
        quantity: 2,
        idempotencyKey: "test-key-min-qty",
      }),
    });
    assert(minQtyRes.status === 400, "Criterion 2.1: Quantity below minimumOrderQuantity is rejected with HTTP 400");

    // 2b. Above available stock (available is 40)
    const overQtyRes = await fetch(`${baseUrl}/listings/${listing1._id}/buy-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
      body: JSON.stringify({
        quantity: 45,
        idempotencyKey: "test-key-over-qty",
      }),
    });
    assert(overQtyRes.status === 409, "Criterion 2.2: Quantity exceeding available stock rejected with HTTP 409");

    // 2c. Non-positive or invalid quantity
    const zeroQtyRes = await fetch(`${baseUrl}/listings/${listing1._id}/buy-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
      body: JSON.stringify({
        quantity: 0,
        idempotencyKey: "test-key-zero-qty",
      }),
    });
    assert(zeroQtyRes.status === 400, "Criterion 2.3: Zero or negative quantity rejected with HTTP 400");

    // =========================================================================
    // 3. Client Idempotency
    // =========================================================================
    // 3a. Replay with identical key by Buyer 1 returns identical order without double-reserving
    const replayRes = await fetch(`${baseUrl}/listings/${listing1._id}/buy-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
      body: JSON.stringify({
        quantity: 10,
        idempotencyKey: "test-key-buyer1-order1",
      }),
    });
    const replayJson = await replayRes.json();
    assert(replayRes.status === 200, "Criterion 3.1: Duplicate idempotency key request returns HTTP 200");
    assert(replayJson.idempotentReplay === true, "Criterion 3.2: Flagged as idempotentReplay = true");
    assert(replayJson.order._id.toString() === buyJson1.order._id.toString(), "Criterion 3.3: Returns the exact original order ID");
    assert(listingsMap.get(listing1._id.toString()).quantityAvailable === 40, "Criterion 3.4: Stock was not decremented a second time (still 40)");

    // 3b. Independent buyer using same idempotency key string does NOT collide
    const buyer2SameKeyRes = await fetch(`${baseUrl}/listings/${listing1._id}/buy-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer2Token}` },
      body: JSON.stringify({
        quantity: 5,
        idempotencyKey: "test-key-buyer1-order1", // same key string used by Buyer 2
      }),
    });
    const buyer2SameKeyJson = await buyer2SameKeyRes.json();
    assert(buyer2SameKeyRes.status === 201, "Criterion 3.5: Independent buyer using same key string succeeds with HTTP 201");
    assert(buyer2SameKeyJson.order._id.toString() !== buyJson1.order._id.toString(), "Criterion 3.6: Produces a separate, unique order document");
    assert(listingsMap.get(listing1._id.toString()).quantityAvailable === 35, "Criterion 3.7: Stock correctly decremented to 35");

    // =========================================================================
    // 4. Exhaust Stock Transitions Listing Status to 'reserved'
    // =========================================================================
    const exhaustRes = await fetch(`${baseUrl}/listings/${listing1._id}/buy-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
      body: JSON.stringify({
        quantity: 35,
        idempotencyKey: "test-key-exhaust-all",
      }),
    });
    assert(exhaustRes.status === 201, "Criterion 4.1: Purchasing all remaining stock succeeds");
    assert(listingsMap.get(listing1._id.toString()).quantityAvailable === 0, "Criterion 4.2: quantityAvailable is now 0");
    assert(listingsMap.get(listing1._id.toString()).status === "reserved", "Criterion 4.3: Listing status transitioned to 'reserved'");

    // =========================================================================
    // 5. Order Cancellation Releases Reserved Stock
    // =========================================================================
    const orderToCancel = (await exhaustRes.json()).order;
    const cancelRes = await fetch(`${baseUrl}/orders/${orderToCancel._id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
    });
    const cancelJson = await cancelRes.json();
    assert(cancelRes.status === 200, "Criterion 5.1: Cancelling placed order succeeds with HTTP 200");
    assert(cancelJson.order.status === "cancelled", "Criterion 5.2: Order status transitioned to 'cancelled'");

    const restoredListing = listingsMap.get(listing1._id.toString());
    assert(restoredListing.quantityAvailable === 35, "Criterion 5.3: Cancelled 35 units returned to quantityAvailable (now 35)");
    assert(restoredListing.quantityReserved === 15, "Criterion 5.4: quantityReserved decreased from 50 to 15");
    assert(restoredListing.status === "available", "Criterion 5.5: Listing status restored from 'reserved' to 'available'");

    // Cancelling already cancelled order rejected
    const cancelAgainRes = await fetch(`${baseUrl}/orders/${orderToCancel._id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
    });
    assert(cancelAgainRes.status === 400, "Criterion 5.6: Cancelling already cancelled order rejected with HTTP 400");

    // =========================================================================
    // 6. Farmer Confirmation Locks Order
    // =========================================================================
    const orderToConfirm = buyJson1.order;
    const confirmRes = await fetch(`${baseUrl}/orders/${orderToConfirm._id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${farmer1Token}` },
    });
    const confirmJson = await confirmRes.json();
    assert(confirmRes.status === 200, "Criterion 6.1: Farmer confirmation succeeds with HTTP 200");
    assert(confirmJson.order.status === "confirmed", "Criterion 6.2: Order status is now 'confirmed'");
    assert(confirmJson.order.reservationExpiresAt === null, "Criterion 6.3: reservationExpiresAt set to null to lock against expiry");

    // Confirmed order cannot be cancelled
    const cancelConfirmedRes = await fetch(`${baseUrl}/orders/${orderToConfirm._id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
    });
    assert(cancelConfirmedRes.status === 400, "Criterion 6.4: Attempting to cancel confirmed order is rejected with HTTP 400");

    // Stock for confirmed order remains reserved (NOT released)
    assert(listingsMap.get(listing1._id.toString()).quantityReserved === 15, "Criterion 6.5: Reserved stock remains reserved after confirmation");

    // =========================================================================
    // 7. Order Expiry Sweep
    // =========================================================================
    // Create an unconfirmed placed order with expired reservation window
    const expiredOrderId = new mongoose.Types.ObjectId();
    const expiredOrder = new Order({
      _id: expiredOrderId,
      orderNumber: "ORD-EXP-001",
      buyerId: buyer2Id,
      farmerId: farmer1Id,
      idempotencyKey: "test-expired-order",
      items: [
        {
          listingId: listing1._id,
          title: listing1.title,
          quantity: 5,
          unit: "quintal",
          agreedPricePerUnit: 4000,
          subtotal: 20000,
        },
      ],
      totalAmount: 20000,
      status: "placed",
      reservationExpiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
    });
    ordersMap.set(expiredOrderId.toString(), expiredOrder);

    // Run expiry sweep
    const expiryResult = await expirePendingOrders();
    assert(expiryResult.processedCount >= 1, "Criterion 7.1: Expiry sweep processed lapsed order");
    assert(ordersMap.get(expiredOrderId.toString()).status === "expired", "Criterion 7.2: Order status transitioned to 'expired'");
    assert(listingsMap.get(listing1._id.toString()).quantityAvailable === 40, "Criterion 7.3: Reserved stock returned to available (now 40)");

    // Confirmed order ORD was NOT touched by expiry sweep
    assert(ordersMap.get(orderToConfirm._id.toString()).status === "confirmed", "Criterion 7.4: Confirmed order was untouched by expiry sweep");

    // =========================================================================
    // 8. Bidding Lifecycle & Counter-Offer State Machine
    // =========================================================================
    // 8a. Bid Submission does NOT reserve stock
    const createBidRes = await fetch(`${baseUrl}/listings/${listing1._id}/bids`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
      body: JSON.stringify({
        bidPricePerUnit: 3700,
        quantity: 10,
        message: "Can pick up directly from your farm storage.",
        expiresInHours: 48,
      }),
    });
    const createBidJson = await createBidRes.json();
    assert(createBidRes.status === 201, "Criterion 8.1: Initial bid submission succeeds with HTTP 201");
    const activeBidId = createBidJson.bid._id;
    assert(createBidJson.bid.status === "pending", "Criterion 8.2: Bid status is 'pending'");
    assert(createBidJson.bid.currentOffer.pendingResponderRole === "farmer", "Criterion 8.3: Pending responder is 'farmer'");
    assert(listingsMap.get(listing1._id.toString()).quantityAvailable === 40, "Criterion 8.4: Bid submission did NOT reserve any stock (remains 40)");

    // 8b. Buyer cannot accept or counter their own initial bid (only farmer can)
    const buyerPrematureAccept = await fetch(`${baseUrl}/bids/${activeBidId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
    });
    assert(buyerPrematureAccept.status === 403, "Criterion 8.5: Proposer cannot accept their own pending offer (HTTP 403)");

    const buyerPrematureCounter = await fetch(`${baseUrl}/bids/${activeBidId}/counter`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
      body: JSON.stringify({ pricePerUnit: 3800, quantity: 10 }),
    });
    assert(buyerPrematureCounter.status === 403, "Criterion 8.6: Proposer cannot counter when it is not their turn (HTTP 403)");

    // 8c. Farmer counters with 3900 for 10 units
    const farmerCounterRes = await fetch(`${baseUrl}/bids/${activeBidId}/counter`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${farmer1Token}` },
      body: JSON.stringify({
        pricePerUnit: 3900,
        quantity: 10,
        message: "Can do 3900 including bagging.",
        expiresInHours: 48,
      }),
    });
    const farmerCounterJson = await farmerCounterRes.json();
    assert(farmerCounterRes.status === 200, "Criterion 8.7: Farmer counter-offer succeeds with HTTP 200");
    assert(farmerCounterJson.bid.status === "countered", "Criterion 8.8: Bid status is now 'countered'");
    assert(farmerCounterJson.bid.currentOffer.pendingResponderRole === "buyer", "Criterion 8.9: Pending responder flipped to 'buyer'");
    assert(farmerCounterJson.bid.offerHistory.length === 2, "Criterion 8.10: Offer history appended (2 items in audit trail)");

    // 8d. Farmer cannot accept their own counter-offer
    const farmerSelfAccept = await fetch(`${baseUrl}/bids/${activeBidId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${farmer1Token}` },
    });
    assert(farmerSelfAccept.status === 403, "Criterion 8.11: Farmer cannot accept own counter-offer (HTTP 403)");

    // 8e. Buyer accepts Farmer's counter-offer -> Reserves stock and generates Order
    const buyerAcceptRes = await fetch(`${baseUrl}/bids/${activeBidId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
    });
    const buyerAcceptJson = await buyerAcceptRes.json();
    assert(buyerAcceptRes.status === 200, "Criterion 8.12: Buyer acceptance of counter-offer succeeds with HTTP 200");
    assert(buyerAcceptJson.bid.status === "accepted", "Criterion 8.13: Bid status transitioned to 'accepted'");
    assert(buyerAcceptJson.order && buyerAcceptJson.order.status === "placed", "Criterion 8.14: Order created atomically from accepted bid");
    assert(buyerAcceptJson.order.totalAmount === 39000, "Criterion 8.15: Order total matches negotiated price (10 * 3900 = ₹39,000)");

    const listingAfterBidAccept = listingsMap.get(listing1._id.toString());
    assert(listingAfterBidAccept.quantityAvailable === 30, "Criterion 8.16: Available stock atomically reduced to 30");
    assert(listingAfterBidAccept.quantityReserved === 20, "Criterion 8.17: Reserved stock atomically increased to 20");

    // 8f. Terminal bids reject further actions
    const postAcceptCounter = await fetch(`${baseUrl}/bids/${activeBidId}/counter`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${farmer1Token}` },
      body: JSON.stringify({ pricePerUnit: 4000, quantity: 10 }),
    });
    assert(postAcceptCounter.status === 400, "Criterion 8.18: Terminal accepted bid rejects new counter-offers (HTTP 400)");

    // =========================================================================
    // 9. Bid Rejection & Withdrawal Lifecycles
    // =========================================================================
    // 9a. Rejection
    const bidToReject = new Bid({
      _id: new mongoose.Types.ObjectId(),
      listingId: listing1._id,
      buyerId: buyer2Id,
      farmerId: farmer1Id,
      bidPricePerUnit: 3600,
      quantity: 5,
      status: "pending",
      currentOffer: {
        pricePerUnit: 3600,
        quantity: 5,
        offeredBy: buyer2Id,
        offeredByRole: "buyer",
        pendingResponderRole: "farmer",
        pendingResponderId: farmer1Id,
      },
      offerHistory: [
        {
          offerNumber: 1,
          offeredBy: buyer2Id,
          role: "buyer",
          pricePerUnit: 3600,
          quantity: 5,
        },
      ],
    });
    bidsMap.set(bidToReject._id.toString(), bidToReject);

    const rejectRes = await fetch(`${baseUrl}/bids/${bidToReject._id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${farmer1Token}` },
      body: JSON.stringify({ reason: "Price is too low for this batch quality." }),
    });
    assert(rejectRes.status === 200, "Criterion 9.1: Farmer rejecting pending bid succeeds with HTTP 200");
    assert(bidsMap.get(bidToReject._id.toString()).status === "rejected", "Criterion 9.2: Bid status is now 'rejected'");
    assert(listingsMap.get(listing1._id.toString()).quantityAvailable === 30, "Criterion 9.3: Rejection caused zero stock movement");

    // 9b. Withdrawal by buyer
    const bidToWithdraw = new Bid({
      _id: new mongoose.Types.ObjectId(),
      listingId: listing1._id,
      buyerId: buyer2Id,
      farmerId: farmer1Id,
      bidPricePerUnit: 3650,
      quantity: 5,
      status: "pending",
      currentOffer: {
        pricePerUnit: 3650,
        quantity: 5,
        offeredBy: buyer2Id,
        offeredByRole: "buyer",
        pendingResponderRole: "farmer",
      },
    });
    bidsMap.set(bidToWithdraw._id.toString(), bidToWithdraw);

    const withdrawRes = await fetch(`${baseUrl}/bids/${bidToWithdraw._id}/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer2Token}` },
    });
    assert(withdrawRes.status === 200, "Criterion 9.4: Buyer withdrawing active offer succeeds with HTTP 200");
    assert(bidsMap.get(bidToWithdraw._id.toString()).status === "withdrawn", "Criterion 9.5: Bid status is now 'withdrawn'");

    // =========================================================================
    // 10. Role and Authorization Guards
    // =========================================================================
    // 10a. Buyer cannot access farmer order views
    const buyerAccessFarmerOrders = await fetch(`${baseUrl}/farmer/orders`, {
      headers: { Authorization: `Bearer ${buyer1Token}` },
    });
    assert(buyerAccessFarmerOrders.status === 403, "Criterion 10.1: Buyer accessing farmer order view receives HTTP 403");

    // 10b. Farmer cannot access buyer order views
    const farmerAccessBuyerOrders = await fetch(`${baseUrl}/buyer/orders`, {
      headers: { Authorization: `Bearer ${farmer1Token}` },
    });
    assert(farmerAccessBuyerOrders.status === 403, "Criterion 10.2: Farmer accessing buyer order view receives HTTP 403");

    // 10c. Outsider cannot view an order they are not party to
    const outsiderViewOrder = await fetch(`${baseUrl}/orders/${orderToConfirm._id}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    assert(outsiderViewOrder.status === 403, "Criterion 10.3: Non-party user viewing order receives HTTP 403");

    // =========================================================================
    // 11. Concurrency Simulation (Stock contention)
    // =========================================================================
    // Available stock is currently 30. Buyer 1 attempts 25, Buyer 2 attempts 15.
    // Simulating two near-instantaneous requests: First succeeds, second aborts cleanly.
    const concurrent1 = await fetch(`${baseUrl}/listings/${listing1._id}/buy-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
      body: JSON.stringify({ quantity: 25, idempotencyKey: "concurrent-order-1" }),
    });
    assert(concurrent1.status === 201, "Criterion 11.1: Concurrent purchase 1 (25 units) succeeds with HTTP 201");

    const concurrent2 = await fetch(`${baseUrl}/listings/${listing1._id}/buy-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer2Token}` },
      body: JSON.stringify({ quantity: 15, idempotencyKey: "concurrent-order-2" }),
    });
    assert(concurrent2.status === 409, "Criterion 11.2: Concurrent purchase 2 (15 units) cleanly aborted with HTTP 409 due to insufficient remaining stock (5 left)");

    // =========================================================================
    // 12. Failure Handling & Transactions Unsupported Fail-Safe (HTTP 503)
    // =========================================================================
    // 12a. When transactions fail (e.g. standalone MongoDB without replica set)
    shouldFailTransactions = true;
    transactionFailReason = "Transaction numbers are only allowed on a replica set member or mongos";

    const stockBeforeFailedTx = listingsMap.get(listing1._id.toString()).quantityAvailable;
    const failTxRes = await fetch(`${baseUrl}/listings/${listing1._id}/buy-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyer1Token}` },
      body: JSON.stringify({ quantity: 5, idempotencyKey: "fail-safe-key-1" }),
    });
    const failTxJson = await failTxRes.json();
    assert(failTxRes.status === 503, "Criterion 12.1: Standalone MongoDB without replica set aborts with HTTP 503 (TransactionsUnsupportedError)");
    assert(failTxJson.code === "TRANSACTIONS_UNSUPPORTED", "Criterion 12.2: Error code is 'TRANSACTIONS_UNSUPPORTED'");
    assert(listingsMap.get(listing1._id.toString()).quantityAvailable === stockBeforeFailedTx, "Criterion 12.3: Zero partial writes occurred upon transaction failure (stock unchanged)");

    // Restore transactions
    shouldFailTransactions = false;

    // =========================================================================
    // 13. In-App Database Notifications Verification
    // =========================================================================
    const typesRecorded = new Set(notificationsList.map((n) => n.type));
    assert(typesRecorded.has("order_placed"), "Criterion 13.1: 'order_placed' database notification recorded");
    assert(typesRecorded.has("order_confirmed"), "Criterion 13.2: 'order_confirmed' database notification recorded");
    assert(typesRecorded.has("order_cancelled"), "Criterion 13.3: 'order_cancelled' database notification recorded");
    assert(typesRecorded.has("order_expired"), "Criterion 13.4: 'order_expired' database notification recorded");
    assert(typesRecorded.has("new_bid"), "Criterion 13.5: 'new_bid' database notification recorded");
    assert(typesRecorded.has("counter_offer"), "Criterion 13.6: 'counter_offer' database notification recorded");

    console.log("==================================================");
    console.log(`📊 STAGE 6 TRANSACTION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");
  } finally {
    // Restore originals
    if (origReadyState) {
      Object.defineProperty(mongoose.connection, "readyState", origReadyState);
    } else {
      delete mongoose.connection.readyState;
    }
    mongoose.startSession = origStartSession;
    Order.prototype.save = origOrderSave;
    Bid.prototype.save = origBidSave;
    Notification.prototype.save = origNotifSave;
    server.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runStage6TransactionTests().catch((err) => {
  console.error("Unhandled error in Stage 6 Transaction test runner:", err);
  process.exit(1);
});
