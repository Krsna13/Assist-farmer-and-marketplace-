const express = require("express");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middlewares/authMiddleware");
const { requireRole } = require("../middlewares/authMiddleware");
const { uploadSinglePhoto } = require("../middlewares/uploadMiddleware");
const {
  uploadListingPhoto,
  getListingPhotos,
} = require("../controllers/marketplacePhotoController");
const {
  getFarmerDashboard,
  getFarmerListings,
  getFarmerListingById,
  createListing,
  updateListing,
  updateListingStock,
  updateListingStatus,
  getFarmerSourceInventory,
  getFarmerBids,
  getFarmerOrders,
} = require("../controllers/marketplaceFarmerController");
const {
  getPublicListings,
  getPublicListingById,
  getPublicFarmProfile,
  getPublicMapLocations,
} = require("../controllers/marketplacePublicController");
const {
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
  getFarmerOrders: getFarmerOrdersTx,
  getBuyerBids,
  getFarmerBids: getFarmerBidsTx,
  getOrderById,
  getBidById,
} = require("../controllers/marketplaceTransactionController");

const router = express.Router();

/**
 * Optional authentication middleware for public endpoints:
 * If an Authorization header is present, decodes token to attach req.user,
 * but allows unauthenticated requests to proceed.
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();

  try {
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.role) decoded.role = "farmer";
      req.user = decoded;
    }
  } catch (err) {
    // Ignore expired/invalid token on optional auth; proceed as guest
  }
  next();
};

// ============================================================================
// STAGE 3 PHOTO CAPTURE & HISTORY ROUTES
// ============================================================================

/**
 * @route   POST /api/marketplace/listings/:listingId/photos
 * @desc    Secure upload of live camera or file inventory photo
 * @access  Private (Farmer role only, verified listing owner)
 */
router.post(
  "/listings/:listingId/photos",
  authMiddleware,
  requireRole("farmer"),
  uploadSinglePhoto("photo"),
  uploadListingPhoto
);

/**
 * @route   GET /api/marketplace/listings/:listingId/photos
 * @desc    Get photo history in stable chronological order
 * @access  Public for eligible listings; Private for inactive/draft listings
 */
router.get(
  "/listings/:listingId/photos",
  optionalAuth,
  getListingPhotos
);

// ============================================================================
// STAGE 4 FARMER MARKETPLACE DASHBOARD & INVENTORY MANAGEMENT ROUTES
// ============================================================================

/**
 * @route   GET /api/marketplace/farmer/dashboard
 * @desc    Get dashboard metrics, inventory summaries, and photo health
 * @access  Private (Farmer role only)
 */
router.get(
  "/farmer/dashboard",
  authMiddleware,
  requireRole("farmer"),
  getFarmerDashboard
);

/**
 * @route   GET /api/marketplace/farmer/source-inventory
 * @desc    Get farmer's eligible crop, livestock, and resource inventory for publishing
 * @access  Private (Farmer role only)
 */
router.get(
  "/farmer/source-inventory",
  authMiddleware,
  requireRole("farmer"),
  getFarmerSourceInventory
);

/**
 * @route   GET /api/marketplace/farmer/listings
 * @desc    Get all listings owned by the authenticated farmer
 * @access  Private (Farmer role only)
 */
router.get(
  "/farmer/listings",
  authMiddleware,
  requireRole("farmer"),
  getFarmerListings
);

/**
 * @route   GET /api/marketplace/farmer/listings/:listingId
 * @desc    Get a specific owned listing by ID
 * @access  Private (Farmer role only)
 */
router.get(
  "/farmer/listings/:listingId",
  authMiddleware,
  requireRole("farmer"),
  getFarmerListingById
);

/**
 * @route   POST /api/marketplace/farmer/listings
 * @desc    Publish a new listing to marketplace (source-linked or independent)
 * @access  Private (Farmer role only)
 */
router.post(
  "/farmer/listings",
  authMiddleware,
  requireRole("farmer"),
  createListing
);

/**
 * @route   PUT /api/marketplace/farmer/listings/:listingId
 * @desc    Update an owned listing's metadata, title, price, or description
 * @access  Private (Farmer role only)
 */
router.put(
  "/farmer/listings/:listingId",
  authMiddleware,
  requireRole("farmer"),
  updateListing
);

/**
 * @route   PATCH /api/marketplace/farmer/listings/:listingId/stock
 * @desc    Safely update marketplace available quantity (preserves reserved & sold stock)
 * @access  Private (Farmer role only)
 */
router.patch(
  "/farmer/listings/:listingId/stock",
  authMiddleware,
  requireRole("farmer"),
  updateListingStock
);

/**
 * @route   PATCH /api/marketplace/farmer/listings/:listingId/status
 * @desc    Pause/reactivate listing availability status ('available' or 'inactive')
 * @access  Private (Farmer role only)
 */
router.patch(
  "/farmer/listings/:listingId/status",
  authMiddleware,
  requireRole("farmer"),
  updateListingStatus
);

/**
 * @route   GET /api/marketplace/farmer/bids
 * @desc    Get incoming bids on listings owned by this farmer
 * @access  Private (Farmer role only)
 */
router.get(
  "/farmer/bids",
  authMiddleware,
  requireRole("farmer"),
  getFarmerBids
);

/**
 * @route   GET /api/marketplace/farmer/orders
 * @desc    Get orders received by this farmer
 * @access  Private (Farmer role only)
 */
router.get(
  "/farmer/orders",
  authMiddleware,
  requireRole("farmer"),
  getFarmerOrders
);

// ============================================================================
// STAGE 5 PUBLIC DISCOVERY, VIRTUAL FARM & BUYER MARKETPLACE ROUTES
// ============================================================================

/**
 * @route   GET /api/marketplace/listings
 * @desc    Public discovery of available marketplace listings with search & filters
 * @access  Public (Guest / Buyer / Farmer)
 */
router.get("/listings", optionalAuth, getPublicListings);

/**
 * @route   GET /api/marketplace/listings/:listingId
 * @desc    Public detail view of a specific listing with photo timeline & real-time stock
 * @access  Public (Guest / Buyer / Farmer)
 */
router.get("/listings/:listingId", optionalAuth, getPublicListingById);

/**
 * @route   GET /api/marketplace/farms/:locationModel/:locationId
 * @desc    Read-only public Virtual Farm Profile showing crops and active lots
 * @access  Public (Guest / Buyer / Farmer)
 */
router.get("/farms/:locationModel/:locationId", optionalAuth, getPublicFarmProfile);

/**
 * @route   GET /api/marketplace/map-locations
 * @desc    Public discovery map markers with approximate regional coordinates
 * @access  Public (Guest / Buyer / Farmer)
 */
router.get("/map-locations", optionalAuth, getPublicMapLocations);

// ============================================================================
// STAGE 6 BUY NOW, BIDDING, COUNTER-OFFERS & TRANSACTIONAL LIFECYCLE ROUTES
// ============================================================================

/**
 * @route   POST /api/marketplace/listings/:listingId/buy-now
 * @desc    Execute Buy Now purchase with client idempotency key and atomic stock reservation
 * @access  Private (Buyer / Bulk Buyer / Farmer)
 */
router.post(
  "/listings/:listingId/buy-now",
  authMiddleware,
  requireRole("buyer", "bulk_buyer", "farmer"),
  buyNowListing
);

/**
 * @route   POST /api/marketplace/listings/:listingId/bids
 * @desc    Submit initial bid on an active listing (no stock reserved at submission)
 * @access  Private (Buyer / Bulk Buyer / Farmer)
 */
router.post(
  "/listings/:listingId/bids",
  authMiddleware,
  requireRole("buyer", "bulk_buyer", "farmer"),
  createBid
);

/**
 * @route   POST /api/marketplace/bids/:bidId/counter
 * @desc    Submit alternating counter-offer with append-only offer history
 * @access  Private (Designated pending responder only)
 */
router.post(
  "/bids/:bidId/counter",
  authMiddleware,
  counterBid
);

/**
 * @route   POST /api/marketplace/bids/:bidId/accept
 * @desc    Accept active offer within an ACID transaction; atomically reserves stock and creates order
 * @access  Private (Designated pending responder only)
 */
router.post(
  "/bids/:bidId/accept",
  authMiddleware,
  acceptBid
);

/**
 * @route   POST /api/marketplace/bids/:bidId/reject
 * @desc    Reject active offer (terminal state)
 * @access  Private (Designated pending responder only)
 */
router.post(
  "/bids/:bidId/reject",
  authMiddleware,
  rejectBid
);

/**
 * @route   POST /api/marketplace/bids/:bidId/withdraw
 * @desc    Withdraw active offer by offer creator (terminal state)
 * @access  Private (Active offer creator only)
 */
router.post(
  "/bids/:bidId/withdraw",
  authMiddleware,
  withdrawBid
);

/**
 * @route   GET /api/marketplace/bids/:bidId
 * @desc    Get detailed negotiation offer history for a specific bid
 * @access  Private (Buyer or seller of that bid only)
 */
router.get(
  "/bids/:bidId",
  authMiddleware,
  getBidById
);

/**
 * @route   POST /api/marketplace/orders/:orderId/confirm
 * @desc    Farmer confirms placed order, locking in the reservation against expiry
 * @access  Private (Farmer role only, verified seller)
 */
router.post(
  "/orders/:orderId/confirm",
  authMiddleware,
  requireRole("farmer"),
  confirmOrder
);

/**
 * @route   POST /api/marketplace/orders/:orderId/cancel
 * @desc    Cancel an unconfirmed placed order and restore reserved stock within transaction
 * @access  Private (Buyer or Seller of the order)
 */
router.post(
  "/orders/:orderId/cancel",
  authMiddleware,
  cancelOrder
);

/**
 * @route   POST /api/marketplace/orders/expire
 * @desc    Background service / scheduled worker trigger to expire lapsed unconfirmed orders
 * @access  Private / Internal worker
 */
router.post(
  "/orders/expire",
  triggerOrderExpiry
);

/**
 * @route   GET /api/marketplace/orders/:orderId
 * @desc    Get order details
 * @access  Private (Buyer or Seller only)
 */
router.get(
  "/orders/:orderId",
  authMiddleware,
  getOrderById
);

/**
 * @route   GET /api/marketplace/buyer/orders
 * @desc    Get buyer's own placed orders
 * @access  Private (Buyer / Bulk Buyer / Farmer)
 */
router.get(
  "/buyer/orders",
  authMiddleware,
  requireRole("buyer", "bulk_buyer"),
  getBuyerOrders
);

/**
 * @route   GET /api/marketplace/buyer/bids
 * @desc    Get buyer's submitted bids and negotiation status
 * @access  Private (Buyer / Bulk Buyer)
 */
router.get(
  "/buyer/bids",
  authMiddleware,
  requireRole("buyer", "bulk_buyer"),
  getBuyerBids
);

module.exports = router;
