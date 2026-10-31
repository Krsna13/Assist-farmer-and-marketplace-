const mongoose = require("mongoose");
const Listing = require("../models/Listing");
const ListingPhoto = require("../models/ListingPhoto");
const Bid = require("../models/Bid");
const Order = require("../models/Order");
const CropFarm = require("../models/CropFarm");
const Farm = require("../models/Farm");
const Store = require("../models/Store");
const CropRecord = require("../models/CropRecord");
const Animal = require("../models/Animal");
const Production = require("../models/Production");
const UnitResource = require("../models/UnitResource");
const ItemResource = require("../models/ItemResource");

const ALLOWED_UNITS = ["kg", "quintal", "tonne", "litre", "piece", "head"];
const ALLOWED_CATEGORIES = ["crop", "livestock", "produce", "other"];

function normalizeUnit(unit) {
  if (!unit || typeof unit !== "string") return unit;
  const lower = unit.toLowerCase().trim();
  if (lower === "ton" || lower === "tons" || lower === "metric ton" || lower === "metric tons") return "tonne";
  if (lower === "liter" || lower === "liters" || lower === "l") return "litre";
  if (lower === "pc" || lower === "pcs") return "piece";
  if (lower === "quintals" || lower === "qtl") return "quintal";
  return lower;
}

/**
 * Verifies that a referenced source record and location model are valid,
 * exist, and belong to the authenticated farmer.
 */
async function verifySourceRecordAndLocation({
  farmerId,
  sourceRecordType,
  sourceRecordId,
  locationModel,
  locationId,
}) {
  if (!locationModel || !locationId) {
    throw new Error("Both locationModel and locationId are required.");
  }

  // 1. Independent Listing (sourceRecordType is null/empty)
  if (!sourceRecordType) {
    let locDoc = null;
    if (locationModel === "CropFarm") {
      locDoc = await CropFarm.findById(locationId);
    } else if (locationModel === "Farm") {
      locDoc = await Farm.findById(locationId);
    } else if (locationModel === "Store") {
      locDoc = await Store.findById(locationId);
    } else {
      throw new Error(`Invalid locationModel: '${locationModel}'`);
    }

    if (!locDoc) {
      throw new Error(`Referenced ${locationModel} location does not exist.`);
    }

    const ownerId = locDoc.userId ? locDoc.userId.toString() : null;
    if (ownerId !== farmerId.toString()) {
      throw new Error(`Forbidden: You do not own the referenced ${locationModel} location.`);
    }

    return {
      sourceRecord: null,
      locationDoc: locDoc,
      locationName: locDoc.name,
    };
  }

  // 2. Source-Linked Listing
  if (!sourceRecordId) {
    throw new Error(`sourceRecordId is required when sourceRecordType is '${sourceRecordType}'.`);
  }

  if (sourceRecordType === "CropRecord") {
    if (locationModel !== "CropFarm") {
      throw new Error("CropRecord source must be linked to locationModel 'CropFarm'.");
    }

    const cropRecord = await CropRecord.findById(sourceRecordId);
    if (!cropRecord) {
      throw new Error("Source CropRecord does not exist.");
    }

    if (cropRecord.user && cropRecord.user.toString() !== farmerId.toString()) {
      throw new Error("Forbidden: You do not own this CropRecord.");
    }

    if (cropRecord.cropFarmId.toString() !== locationId.toString()) {
      throw new Error("CropRecord does not belong to the specified CropFarm location.");
    }

    const cropFarm = await CropFarm.findById(locationId);
    if (!cropFarm || (cropFarm.userId && cropFarm.userId.toString() !== farmerId.toString())) {
      throw new Error("Forbidden: You do not own the referenced CropFarm location.");
    }

    return {
      sourceRecord: cropRecord,
      locationDoc: cropFarm,
      locationName: cropFarm.name,
    };
  }

  if (sourceRecordType === "Animal") {
    if (locationModel !== "Farm") {
      throw new Error("Animal source must be linked to locationModel 'Farm'.");
    }

    const animal = await Animal.findById(sourceRecordId);
    if (!animal) {
      throw new Error("Source Animal record does not exist.");
    }

    if (animal.farmId.toString() !== locationId.toString()) {
      throw new Error("Animal record does not belong to the specified Farm location.");
    }

    const farm = await Farm.findById(locationId);
    if (!farm || (farm.userId && farm.userId.toString() !== farmerId.toString())) {
      throw new Error("Forbidden: You do not own the referenced Farm location.");
    }

    return {
      sourceRecord: animal,
      locationDoc: farm,
      locationName: farm.name,
    };
  }

  if (sourceRecordType === "Production") {
    if (locationModel !== "Farm") {
      throw new Error("Production source must be linked to locationModel 'Farm'.");
    }

    const production = await Production.findById(sourceRecordId);
    if (!production) {
      throw new Error("Source Production record does not exist.");
    }

    if (production.farmId.toString() !== locationId.toString()) {
      throw new Error("Production record does not belong to the specified Farm location.");
    }

    const farm = await Farm.findById(locationId);
    if (!farm || (farm.userId && farm.userId.toString() !== farmerId.toString())) {
      throw new Error("Forbidden: You do not own the referenced Farm location.");
    }

    return {
      sourceRecord: production,
      locationDoc: farm,
      locationName: farm.name,
    };
  }

  if (sourceRecordType === "UnitResource") {
    if (locationModel !== "Store") {
      throw new Error("UnitResource source must be linked to locationModel 'Store'.");
    }

    const unitResource = await UnitResource.findById(sourceRecordId);
    if (!unitResource) {
      throw new Error("Source UnitResource record does not exist.");
    }

    if (unitResource.userId && unitResource.userId.toString() !== farmerId.toString()) {
      throw new Error("Forbidden: You do not own this UnitResource.");
    }

    if (unitResource.storeId.toString() !== locationId.toString()) {
      throw new Error("UnitResource does not belong to the specified Store location.");
    }

    const store = await Store.findById(locationId);
    if (!store || (store.userId && store.userId.toString() !== farmerId.toString())) {
      throw new Error("Forbidden: You do not own the referenced Store location.");
    }

    return {
      sourceRecord: unitResource,
      locationDoc: store,
      locationName: store.name,
    };
  }

  if (sourceRecordType === "ItemResource") {
    if (locationModel !== "Store") {
      throw new Error("ItemResource source must be linked to locationModel 'Store'.");
    }

    const itemResource = await ItemResource.findById(sourceRecordId);
    if (!itemResource) {
      throw new Error("Source ItemResource record does not exist.");
    }

    if (itemResource.userId && itemResource.userId.toString() !== farmerId.toString()) {
      throw new Error("Forbidden: You do not own this ItemResource.");
    }

    if (itemResource.storeId.toString() !== locationId.toString()) {
      throw new Error("ItemResource does not belong to the specified Store location.");
    }

    const store = await Store.findById(locationId);
    if (!store || (store.userId && store.userId.toString() !== farmerId.toString())) {
      throw new Error("Forbidden: You do not own the referenced Store location.");
    }

    return {
      sourceRecord: itemResource,
      locationDoc: store,
      locationName: store.name,
    };
  }

  throw new Error(`Unsupported sourceRecordType '${sourceRecordType}'.`);
}

/**
 * GET /api/marketplace/farmer/dashboard
 * Aggregates statistics and health metrics for the authenticated farmer.
 */
async function getFarmerDashboard(req, res) {
  try {
    const farmerId = req.user.id || req.user._id;

    // Fetch all listings owned by this farmer
    const listings = await Listing.find({ farmerId }).sort({ createdAt: -1 });
    const listingIds = listings.map((l) => l._id);

    // Compute inventory totals
    let activeListingsCount = 0;
    let totalAvailableStock = 0;
    let totalStockValue = 0;
    let reservedListingsCount = 0;
    let totalReservedStock = 0;
    let soldListingsCount = 0;
    let totalSoldStock = 0;
    let inactiveListingsCount = 0;

    for (const l of listings) {
      if (l.status === "available") {
        activeListingsCount++;
        totalAvailableStock += Number(l.quantityAvailable) || 0;
        totalStockValue += (Number(l.quantityAvailable) || 0) * (Number(l.fixedPricePerUnit) || 0);
      } else if (l.status === "reserved") {
        reservedListingsCount++;
      } else if (l.status === "sold") {
        soldListingsCount++;
      } else if (l.status === "inactive") {
        inactiveListingsCount++;
      }

      totalReservedStock += Number(l.quantityReserved) || 0;
      totalSoldStock += Number(l.quantitySold) || 0;
    }

    // Photo Health Audit
    const allPhotos = await ListingPhoto.find({ listingId: { $in: listingIds } }).sort({
      serverReceivedAt: -1,
    });

    const photosByListing = new Map();
    for (const p of allPhotos) {
      const lid = p.listingId.toString();
      if (!photosByListing.has(lid)) {
        photosByListing.set(lid, []);
      }
      photosByListing.get(lid).push(p);
    }

    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    let listingsWithPhotosCount = 0;
    let listingsWithStalePhotosCount = 0;
    let listingsNoPhotosCount = 0;
    let latestPhotoReceivedAt = null;

    for (const l of listings) {
      const pList = photosByListing.get(l._id.toString());
      if (pList && pList.length > 0) {
        listingsWithPhotosCount++;
        const latestP = pList[0];
        if (!latestPhotoReceivedAt || latestP.serverReceivedAt > latestPhotoReceivedAt) {
          latestPhotoReceivedAt = latestP.serverReceivedAt;
        }
        const ageMs = now - new Date(latestP.serverReceivedAt).getTime();
        if (ageMs > SEVEN_DAYS_MS) {
          listingsWithStalePhotosCount++;
        }
      } else {
        listingsNoPhotosCount++;
      }
    }

    // Recent Incoming Bids (actual data from Bid model)
    let recentBids = [];
    try {
      recentBids = await Bid.find({ listingId: { $in: listingIds } })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate("buyerId", "firstName lastName email role")
        .populate("listingId", "title fixedPricePerUnit quantityUnit status");
    } catch (e) {
      console.warn("Could not load recent bids:", e.message);
    }

    // Recent Incoming Orders (actual data from Order model)
    let recentOrders = [];
    try {
      recentOrders = await Order.find({ farmerId })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate("buyerId", "firstName lastName email");
    } catch (e) {
      console.warn("Could not load recent orders:", e.message);
    }

    return res.json({
      metrics: {
        totalListings: listings.length,
        activeListingsCount,
        totalAvailableStock: Math.round(totalAvailableStock * 100) / 100,
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        reservedListingsCount,
        totalReservedStock: Math.round(totalReservedStock * 100) / 100,
        soldListingsCount,
        totalSoldStock: Math.round(totalSoldStock * 100) / 100,
        inactiveListingsCount,
      },
      photoHealth: {
        withPhotos: listingsWithPhotosCount,
        withStalePhotos: listingsWithStalePhotosCount,
        withoutPhotos: listingsNoPhotosCount,
        latestPhotoReceivedAt,
      },
      recentBids: recentBids.map((b) => ({
        id: b._id,
        listingId: b.listingId ? b.listingId._id : null,
        listingTitle: b.listingId ? b.listingId.title : "Listing",
        listingUnit: b.listingId ? b.listingId.quantityUnit : "",
        buyerName: b.buyerId ? `${b.buyerId.firstName} ${b.buyerId.lastName}` : "Verified Buyer",
        buyerRole: b.buyerId ? b.buyerId.role : "buyer",
        bidPricePerUnit: b.bidPricePerUnit,
        quantity: b.quantity,
        totalOffer: Math.round(b.bidPricePerUnit * b.quantity * 100) / 100,
        status: b.status,
        expiresAt: b.expiresAt,
        createdAt: b.createdAt,
      })),
      recentOrders: recentOrders.map((o) => ({
        id: o._id,
        orderNumber: o.orderNumber,
        buyerName: o.buyerId ? `${o.buyerId.firstName} ${o.buyerId.lastName}` : "Buyer",
        itemsCount: o.items ? o.items.length : 0,
        totalAmount: o.totalAmount,
        status: o.status,
        createdAt: o.createdAt,
      })),
    });
  } catch (err) {
    console.error("Error in getFarmerDashboard:", err);
    return res.status(500).json({
      message: "Failed to load farmer marketplace dashboard.",
      error: err.message,
    });
  }
}

/**
 * GET /api/marketplace/farmer/listings
 * Retrieves all listings owned by the authenticated farmer with their photo health.
 */
async function getFarmerListings(req, res) {
  try {
    const farmerId = req.user.id || req.user._id;
    const listings = await Listing.find({ farmerId }).sort({ createdAt: -1 });

    const listingIds = listings.map((l) => l._id);
    const photos = await ListingPhoto.find({ listingId: { $in: listingIds } }).sort({
      isPrimary: -1,
      serverReceivedAt: -1,
    });

    const photoMap = new Map();
    for (const p of photos) {
      const lid = p.listingId.toString();
      if (!photoMap.has(lid)) {
        photoMap.set(lid, []);
      }
      photoMap.get(lid).push(p);
    }

    const results = listings.map((l) => {
      const lPhotos = photoMap.get(l._id.toString()) || [];
      const primaryPhoto = lPhotos.find((p) => p.isPrimary) || lPhotos[0] || null;

      return {
        id: l._id,
        farmerId: l.farmerId,
        locationModel: l.locationModel,
        locationId: l.locationId,
        sourceRecordType: l.sourceRecordType,
        sourceRecordId: l.sourceRecordId,
        category: l.category,
        title: l.title,
        description: l.description,
        quantityUnit: l.quantityUnit,
        quantityAvailable: l.quantityAvailable,
        quantityReserved: l.quantityReserved,
        quantitySold: l.quantitySold,
        fixedPricePerUnit: l.fixedPricePerUnit,
        minimumBidPerUnit: l.minimumBidPerUnit,
        minimumOrderQuantity: l.minimumOrderQuantity,
        harvestDate: l.harvestDate,
        availableFrom: l.availableFrom,
        conditionNotes: l.conditionNotes,
        status: l.status,
        photoCount: lPhotos.length,
        primaryPhotoUrl: primaryPhoto ? primaryPhoto.imageUrl : null,
        primaryPhotoWatermarkedUrl: primaryPhoto ? (primaryPhoto.watermarkedUrl || primaryPhoto.imageUrl) : null,
        latestPhotoServerReceivedAt: primaryPhoto ? primaryPhoto.serverReceivedAt : null,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      };
    });

    return res.json({
      count: results.length,
      listings: results,
    });
  } catch (err) {
    console.error("Error in getFarmerListings:", err);
    return res.status(500).json({
      message: "Failed to retrieve farmer listings.",
      error: err.message,
    });
  }
}

/**
 * GET /api/marketplace/farmer/listings/:listingId
 * Retrieves an owned listing by ID.
 */
async function getFarmerListingById(req, res) {
  try {
    const farmerId = req.user.id || req.user._id;
    const { listingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ message: "Invalid listing ID format." });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found." });
    }

    if (listing.farmerId.toString() !== farmerId.toString()) {
      return res.status(403).json({
        message: "Forbidden: You do not have permission to access another farmer's listing.",
      });
    }

    const photos = await ListingPhoto.find({ listingId: listing._id }).sort({
      serverReceivedAt: -1,
    });

    return res.json({
      listing: {
        id: listing._id,
        farmerId: listing.farmerId,
        locationModel: listing.locationModel,
        locationId: listing.locationId,
        sourceRecordType: listing.sourceRecordType,
        sourceRecordId: listing.sourceRecordId,
        category: listing.category,
        title: listing.title,
        description: listing.description,
        quantityUnit: listing.quantityUnit,
        quantityAvailable: listing.quantityAvailable,
        quantityReserved: listing.quantityReserved,
        quantitySold: listing.quantitySold,
        fixedPricePerUnit: listing.fixedPricePerUnit,
        minimumBidPerUnit: listing.minimumBidPerUnit,
        minimumOrderQuantity: listing.minimumOrderQuantity,
        harvestDate: listing.harvestDate,
        availableFrom: listing.availableFrom,
        conditionNotes: listing.conditionNotes,
        status: listing.status,
        photos: photos.map((p) => ({
          id: p._id,
          imageUrl: p.imageUrl,
          watermarkedUrl: p.watermarkedUrl || p.imageUrl,
          serverReceivedAt: p.serverReceivedAt,
          captureMethod: p.captureMethod,
          conditionNotes: p.conditionNotes,
          isPrimary: p.isPrimary,
        })),
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
      },
    });
  } catch (err) {
    console.error("Error in getFarmerListingById:", err);
    return res.status(500).json({
      message: "Failed to retrieve listing details.",
      error: err.message,
    });
  }
}

/**
 * POST /api/marketplace/farmer/listings
 * Publishes a new marketplace listing (from a source inventory record or independent).
 */
async function createListing(req, res) {
  try {
    const farmerId = req.user.id || req.user._id;
    const {
      locationModel = "CropFarm",
      locationId,
      sourceRecordType = null,
      sourceRecordId = null,
      category,
      title,
      description = "",
      quantityUnit,
      quantityAvailable,
      fixedPricePerUnit,
      minimumBidPerUnit = null,
      minimumOrderQuantity = 1,
      harvestDate = null,
      availableFrom = null,
      conditionNotes = "",
    } = req.body;

    // Validate required fields
    if (!title || !category || !quantityUnit || quantityAvailable === undefined || fixedPricePerUnit === undefined || !locationId) {
      return res.status(400).json({
        message: "Missing required fields: title, category, quantityUnit, quantityAvailable, fixedPricePerUnit, locationId.",
      });
    }

    if (!ALLOWED_CATEGORIES.includes(String(category).toLowerCase())) {
      return res.status(400).json({
        message: `Invalid category '${category}'. Allowed: ${ALLOWED_CATEGORIES.join(", ")}.`,
      });
    }

    const normalizedUnit = normalizeUnit(quantityUnit);
    if (!ALLOWED_UNITS.includes(normalizedUnit)) {
      return res.status(400).json({
        message: `Invalid quantityUnit '${quantityUnit}'. Allowed: ${ALLOWED_UNITS.join(", ")}.`,
      });
    }

    const parsedQty = Number(quantityAvailable);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({
        message: "Available quantity must be a positive finite number to publish a new listing.",
      });
    }

    const parsedPrice = Number(fixedPricePerUnit);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({
        message: "Fixed price per unit must be greater than 0.",
      });
    }

    // Verify source record and location ownership
    let verification;
    try {
      verification = await verifySourceRecordAndLocation({
        farmerId,
        sourceRecordType,
        sourceRecordId,
        locationModel,
        locationId,
      });
    } catch (vErr) {
      const isForbidden = vErr.message.includes("Forbidden") || vErr.message.includes("own");
      return res.status(isForbidden ? 403 : 400).json({
        message: vErr.message,
      });
    }

    // Duplicate listing check for active source records
    if (sourceRecordType && sourceRecordId) {
      const existingActive = await Listing.findOne({
        sourceRecordType,
        sourceRecordId,
        status: { $in: ["available", "reserved"] },
      });

      if (existingActive) {
        return res.status(409).json({
          message: `An active marketplace listing (${existingActive.title}) already exists for this source record. Please manage or update the existing listing instead of creating a duplicate.`,
          existingListingId: existingActive._id,
        });
      }
    }

    // Construct listing document using authoritative server values
    const newListing = new Listing({
      farmerId, // Authoritative authenticated farmer
      locationModel,
      locationId,
      sourceRecordType: sourceRecordType || null,
      sourceRecordId: sourceRecordId || null,
      category: String(category).toLowerCase().trim(),
      title: String(title).trim(),
      description: String(description || "").trim(),
      quantityUnit: normalizedUnit,
      quantityAvailable: parsedQty,
      quantityReserved: 0,
      quantitySold: 0,
      fixedPricePerUnit: parsedPrice,
      minimumBidPerUnit: minimumBidPerUnit ? Number(minimumBidPerUnit) : null,
      minimumOrderQuantity: minimumOrderQuantity ? Number(minimumOrderQuantity) : 1,
      harvestDate: harvestDate ? new Date(harvestDate) : null,
      availableFrom: availableFrom ? new Date(availableFrom) : null,
      conditionNotes: String(conditionNotes || "").trim(),
      status: "available",
      lastStockUpdatedAt: new Date(),
    });

    await newListing.save();

    return res.status(201).json({
      message: "Listing published to marketplace successfully.",
      listing: {
        id: newListing._id,
        farmerId: newListing.farmerId,
        title: newListing.title,
        category: newListing.category,
        quantityAvailable: newListing.quantityAvailable,
        quantityUnit: newListing.quantityUnit,
        fixedPricePerUnit: newListing.fixedPricePerUnit,
        locationModel: newListing.locationModel,
        locationId: newListing.locationId,
        status: newListing.status,
        lastStockUpdatedAt: newListing.lastStockUpdatedAt,
        createdAt: newListing.createdAt,
      },
    });
  } catch (err) {
    console.error("Error in createListing:", err);
    return res.status(500).json({
      message: "Failed to publish listing.",
      error: err.message,
    });
  }
}

/**
 * PUT /api/marketplace/farmer/listings/:listingId
 * Updates general details of an owned listing (title, description, price, min bid, dates, notes).
 * Does not overwrite available, reserved, or sold stock casually (use PATCH /stock).
 */
async function updateListing(req, res) {
  try {
    const farmerId = req.user.id || req.user._id;
    const { listingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ message: "Invalid listing ID format." });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found." });
    }

    if (listing.farmerId.toString() !== farmerId.toString()) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to edit another farmer's listing.",
      });
    }

    const {
      title,
      description,
      fixedPricePerUnit,
      minimumBidPerUnit,
      minimumOrderQuantity,
      harvestDate,
      availableFrom,
      conditionNotes,
      category,
    } = req.body;

    if (title) listing.title = String(title).trim();
    if (description !== undefined) listing.description = String(description).trim();
    if (conditionNotes !== undefined) listing.conditionNotes = String(conditionNotes).trim();
    if (category) {
      if (!ALLOWED_CATEGORIES.includes(String(category).toLowerCase())) {
        return res.status(400).json({ message: `Invalid category '${category}'.` });
      }
      listing.category = String(category).toLowerCase().trim();
    }

    if (fixedPricePerUnit !== undefined) {
      const price = Number(fixedPricePerUnit);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ message: "Price must be a positive number." });
      }
      listing.fixedPricePerUnit = price;
    }

    if (minimumBidPerUnit !== undefined) {
      listing.minimumBidPerUnit = minimumBidPerUnit ? Number(minimumBidPerUnit) : null;
    }

    if (minimumOrderQuantity !== undefined) {
      const minQty = Number(minimumOrderQuantity);
      if (Number.isFinite(minQty) && minQty > 0) {
        listing.minimumOrderQuantity = minQty;
      }
    }

    if (harvestDate !== undefined) listing.harvestDate = harvestDate ? new Date(harvestDate) : null;
    if (availableFrom !== undefined) listing.availableFrom = availableFrom ? new Date(availableFrom) : null;

    await listing.save();

    return res.json({
      message: "Listing updated successfully.",
      listing: {
        id: listing._id,
        title: listing.title,
        category: listing.category,
        fixedPricePerUnit: listing.fixedPricePerUnit,
        quantityAvailable: listing.quantityAvailable,
        quantityUnit: listing.quantityUnit,
        status: listing.status,
        updatedAt: listing.updatedAt,
      },
    });
  } catch (err) {
    console.error("Error in updateListing:", err);
    return res.status(500).json({
      message: "Failed to update listing.",
      error: err.message,
    });
  }
}

/**
 * PATCH /api/marketplace/farmer/listings/:listingId/stock
 * Safe stock update endpoint:
 * Allows farmers to update marketplace quantity available without modifying underlying physical farm records.
 * Strictly preserves quantityReserved and quantitySold.
 * Enforces status consistency invariants.
 */
async function updateListingStock(req, res) {
  try {
    const farmerId = req.user.id || req.user._id;
    const { listingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ message: "Invalid listing ID format." });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found." });
    }

    if (listing.farmerId.toString() !== farmerId.toString()) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to update another farmer's stock.",
      });
    }

    const { quantityAvailable } = req.body;

    if (quantityAvailable === undefined || quantityAvailable === null) {
      return res.status(400).json({ message: "quantityAvailable is required." });
    }

    const newAvailable = Number(quantityAvailable);
    if (!Number.isFinite(newAvailable) || newAvailable < 0) {
      return res.status(400).json({
        message: "Available quantity cannot be negative and must be a finite number.",
      });
    }

    // Safe stock logic preserving reserved and sold inventory
    listing.quantityAvailable = newAvailable;
    listing.lastStockUpdatedAt = new Date();

    // Handle status transitions conservatively based on Stage 2 invariants:
    if (newAvailable === 0) {
      if (listing.quantityReserved > 0) {
        listing.status = "reserved";
      } else if (listing.quantitySold > 0) {
        listing.status = "sold";
      } else {
        // No reserved, no sold, and 0 available -> pause to inactive
        listing.status = "inactive";
      }
    } else {
      // newAvailable > 0
      // If currently available or was reserved/sold, reactivate to available
      if (listing.status !== "inactive") {
        listing.status = "available";
      }
      // If was inactive, it remains inactive unless explicitly changed via status endpoint
    }

    await listing.save();

    return res.json({
      message: "Marketplace stock updated safely.",
      stock: {
        id: listing._id,
        quantityAvailable: listing.quantityAvailable,
        quantityReserved: listing.quantityReserved, // Strictly preserved
        quantitySold: listing.quantitySold, // Strictly preserved
        quantityUnit: listing.quantityUnit,
        status: listing.status,
        lastStockUpdatedAt: listing.lastStockUpdatedAt,
        updatedAt: listing.updatedAt,
      },
    });
  } catch (err) {
    console.error("Error in updateListingStock:", err);
    return res.status(500).json({
      message: "Failed to update stock quantity.",
      error: err.message,
    });
  }
}

/**
 * PATCH /api/marketplace/farmer/listings/:listingId/status
 * Changes listing status (e.g. pause to 'inactive' or resume to 'available').
 */
async function updateListingStatus(req, res) {
  try {
    const farmerId = req.user.id || req.user._id;
    const { listingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ message: "Invalid listing ID format." });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found." });
    }

    if (listing.farmerId.toString() !== farmerId.toString()) {
      return res.status(403).json({
        message: "Forbidden: You are not authorized to change another farmer's listing status.",
      });
    }

    const { status } = req.body;
    if (!status || !["available", "inactive"].includes(status)) {
      return res.status(400).json({
        message: "Status must be either 'available' or 'inactive'. (Reserved and Sold are system-managed).",
      });
    }

    if (status === "available" && listing.quantityAvailable <= 0) {
      return res.status(400).json({
        message: "Cannot mark listing as 'available' when quantityAvailable is 0. Please add available stock first.",
      });
    }

    listing.status = status;
    await listing.save();

    return res.json({
      message: `Listing status updated to '${status}'.`,
      status: listing.status,
      id: listing._id,
    });
  } catch (err) {
    console.error("Error in updateListingStatus:", err);
    return res.status(500).json({
      message: "Failed to update listing status.",
      error: err.message,
    });
  }
}

/**
 * GET /api/marketplace/farmer/source-inventory
 * Retrieves eligible crop, livestock, and resource inventory owned by the farmer,
 * pre-populating the "Publish to Marketplace" interface and showing existing listing status.
 */
async function getFarmerSourceInventory(req, res) {
  try {
    const farmerId = req.user.id || req.user._id;

    // 1. Locations
    const cropFarms = await CropFarm.find({ userId: farmerId });
    const livestockFarms = await Farm.find({ userId: farmerId });
    const stores = await Store.find({ userId: farmerId });

    const cropFarmIds = cropFarms.map((cf) => cf._id);
    const livestockFarmIds = livestockFarms.map((lf) => lf._id);
    const storeIds = stores.map((s) => s._id);

    // 2. Crop Records
    const cropRecords = await CropRecord.find({
      user: farmerId,
      cropFarmId: { $in: cropFarmIds },
    });

    // 3. Animals & Production
    const animals = await Animal.find({ farmId: { $in: livestockFarmIds } });
    const productions = await Production.find({ farmId: { $in: livestockFarmIds } });

    // 4. Resources
    const unitResources = await UnitResource.find({
      userId: farmerId,
      storeId: { $in: storeIds },
    });
    const itemResources = await ItemResource.find({
      userId: farmerId,
      storeId: { $in: storeIds },
    });

    // 5. Existing active listings for duplicate tagging
    const activeListings = await Listing.find({
      farmerId,
      status: { $in: ["available", "reserved"] },
      sourceRecordType: { $ne: null },
    });

    const activeListingKeys = new Set(
      activeListings.map((l) => `${l.sourceRecordType}_${l.sourceRecordId}`)
    );

    const formatLocation = (locDoc, type) => ({
      id: locDoc._id,
      name: locDoc.name,
      type,
    });

    const formattedCropFarms = cropFarms.map((cf) => formatLocation(cf, "CropFarm"));
    const formattedFarms = livestockFarms.map((f) => formatLocation(f, "Farm"));
    const formattedStores = stores.map((s) => formatLocation(s, "Store"));

    const items = [
      ...cropRecords.map((cr) => {
        const farm = cropFarms.find((cf) => cf._id.toString() === cr.cropFarmId.toString());
        const key = `CropRecord_${cr._id}`;
        return {
          sourceRecordType: "CropRecord",
          sourceRecordId: cr._id,
          locationModel: "CropFarm",
          locationId: cr.cropFarmId,
          locationName: farm ? farm.name : "Crop Farm",
          title: `${cr.cropName} (${cr.season})`,
          cropType: cr.cropType,
          suggestedCategory: "crop",
          suggestedUnit: "kg",
          availablePhysicalStock: cr.seedQuantity || 0,
          isAlreadyListed: activeListingKeys.has(key),
          dateAdded: cr.createdAt || cr.seedingDate,
        };
      }),

      ...animals.map((an) => {
        const farm = livestockFarms.find((f) => f._id.toString() === an.farmId.toString());
        const key = `Animal_${an._id}`;
        return {
          sourceRecordType: "Animal",
          sourceRecordId: an._id,
          locationModel: "Farm",
          locationId: an.farmId,
          locationName: farm ? farm.name : "Livestock Farm",
          title: `${an.category} - ${an.breed} (${an.animalId})`,
          suggestedCategory: "livestock",
          suggestedUnit: "head",
          availablePhysicalStock: 1,
          isAlreadyListed: activeListingKeys.has(key),
          dateAdded: an.createdAt,
        };
      }),

      ...productions.map((pr) => {
        const farm = livestockFarms.find((f) => f._id.toString() === pr.farmId.toString());
        const key = `Production_${pr._id}`;
        const isMilk = pr.productionType === "milkSelling" || pr.productionType === "milkProduction";
        return {
          sourceRecordType: "Production",
          sourceRecordId: pr._id,
          locationModel: "Farm",
          locationId: pr.farmId,
          locationName: farm ? farm.name : "Livestock Farm",
          title: `${pr.productionType}`,
          suggestedCategory: isMilk ? "produce" : "livestock",
          suggestedUnit: isMilk ? "litre" : "head",
          availablePhysicalStock: isMilk ? (pr.milkQuantity || 0) : (pr.soldAnimals || 1),
          isAlreadyListed: activeListingKeys.has(key),
          dateAdded: pr.date || pr.createdAt,
        };
      }),

      ...unitResources.map((ur) => {
        const store = stores.find((s) => s._id.toString() === ur.storeId.toString());
        const key = `UnitResource_${ur._id}`;
        let mappedUnit = "kg";
        const normalizedResourceUnit = normalizeUnit(ur.unit);
        if (ALLOWED_UNITS.includes(normalizedResourceUnit)) {
          mappedUnit = normalizedResourceUnit;
        }
        return {
          sourceRecordType: "UnitResource",
          sourceRecordId: ur._id,
          locationModel: "Store",
          locationId: ur.storeId,
          locationName: store ? store.name : "Warehouse Store",
          title: ur.resourceName,
          suggestedCategory: "other",
          suggestedUnit: mappedUnit,
          availablePhysicalStock: ur.quantity || 0,
          suggestedPrice: ur.costPerUnit || null,
          isAlreadyListed: activeListingKeys.has(key),
          dateAdded: ur.dateAdded,
        };
      }),

      ...itemResources.map((ir) => {
        const store = stores.find((s) => s._id.toString() === ir.storeId.toString());
        const key = `ItemResource_${ir._id}`;
        return {
          sourceRecordType: "ItemResource",
          sourceRecordId: ir._id,
          locationModel: "Store",
          locationId: ir.storeId,
          locationName: store ? store.name : "Warehouse Store",
          title: ir.resourceName,
          suggestedCategory: "other",
          suggestedUnit: "piece",
          availablePhysicalStock: ir.quantity || 0,
          suggestedPrice: ir.costPerItem || null,
          isAlreadyListed: activeListingKeys.has(key),
          dateAdded: ir.dateAdded,
        };
      }),
    ];

    return res.json({
      locations: {
        cropFarms: formattedCropFarms,
        farms: formattedFarms,
        stores: formattedStores,
      },
      inventoryItems: items,
    });
  } catch (err) {
    console.error("Error in getFarmerSourceInventory:", err);
    return res.status(500).json({
      message: "Failed to retrieve farmer source inventory.",
      error: err.message,
    });
  }
}

/**
 * GET /api/marketplace/farmer/bids
 * Retrieves incoming bids on listings owned by the authenticated farmer.
 */
async function getFarmerBids(req, res) {
  try {
    const farmerId = req.user.id || req.user._id;
    const listings = await Listing.find({ farmerId }).select("_id title quantityUnit fixedPricePerUnit");
    const listingIds = listings.map((l) => l._id);

    const bids = await Bid.find({ listingId: { $in: listingIds } })
      .sort({ createdAt: -1 })
      .populate("buyerId", "firstName lastName email role")
      .populate("listingId", "title fixedPricePerUnit quantityUnit status");

    const formatted = bids.map((b) => ({
      id: b._id,
      listingId: b.listingId ? b.listingId._id : null,
      listingTitle: b.listingId ? b.listingId.title : "Listing",
      listingUnit: b.listingId ? b.listingId.quantityUnit : "",
      buyerName: b.buyerId ? `${b.buyerId.firstName} ${b.buyerId.lastName}` : "Verified Buyer",
      buyerRole: b.buyerId ? b.buyerId.role : "buyer",
      bidPricePerUnit: b.bidPricePerUnit,
      quantity: b.quantity,
      totalOffer: Math.round(b.bidPricePerUnit * b.quantity * 100) / 100,
      status: b.status,
      message: b.message || "",
      farmerResponse: b.farmerResponse || "",
      expiresAt: b.expiresAt,
      createdAt: b.createdAt,
    }));

    return res.json({
      count: formatted.length,
      bids: formatted,
    });
  } catch (err) {
    console.error("Error in getFarmerBids:", err);
    return res.status(500).json({
      message: "Failed to retrieve incoming bids.",
      error: err.message,
    });
  }
}

/**
 * GET /api/marketplace/farmer/orders
 * Retrieves orders received by the authenticated farmer.
 */
async function getFarmerOrders(req, res) {
  try {
    const farmerId = req.user.id || req.user._id;

    const orders = await Order.find({ farmerId })
      .sort({ createdAt: -1 })
      .populate("buyerId", "firstName lastName email");

    const formatted = orders.map((o) => ({
      id: o._id,
      orderNumber: o.orderNumber,
      buyerName: o.buyerId ? `${o.buyerId.firstName} ${o.buyerId.lastName}` : "Buyer",
      items: o.items || [],
      totalAmount: o.totalAmount,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt,
    }));

    return res.json({
      count: formatted.length,
      orders: formatted,
    });
  } catch (err) {
    console.error("Error in getFarmerOrders:", err);
    return res.status(500).json({
      message: "Failed to retrieve orders.",
      error: err.message,
    });
  }
}

module.exports = {
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
  verifySourceRecordAndLocation,
};
