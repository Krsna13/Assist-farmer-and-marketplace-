const mongoose = require("mongoose");
const Listing = require("../models/Listing");
const ListingPhoto = require("../models/ListingPhoto");
const User = require("../models/User");
const CropFarm = require("../models/CropFarm");
const Farm = require("../models/Farm");
const Store = require("../models/Store");
const CropRecord = require("../models/CropRecord");
const Animal = require("../models/Animal");

const ALLOWED_UNITS = ["kg", "quintal", "tonne", "litre", "piece", "head"];
const ALLOWED_CATEGORIES = ["crop", "livestock", "produce", "other"];

const FRESHNESS_THRESHOLDS = {
  FRESH_MAX_MS: 24 * 60 * 60 * 1000, // 24 hours
  RECENT_MAX_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Computes authoritative photo freshness based on serverReceivedAt.
 */
function evaluatePhotoFreshness(serverReceivedAt, now = Date.now()) {
  if (!serverReceivedAt) {
    return {
      status: "no_photo",
      label: "No Photo",
      badgeColor: "bg-gray-100 text-gray-700 border-gray-300",
      description: "No inventory photograph has been uploaded for this listing.",
    };
  }

  const timestamp = new Date(serverReceivedAt).getTime();
  if (isNaN(timestamp)) {
    return {
      status: "no_photo",
      label: "No Photo",
      badgeColor: "bg-gray-100 text-gray-700 border-gray-300",
      description: "Recorded timestamp cannot be parsed.",
    };
  }

  const currentTime = typeof now === "number" ? now : new Date(now).getTime();
  const elapsedMs = Math.max(0, currentTime - timestamp);

  if (elapsedMs <= FRESHNESS_THRESHOLDS.FRESH_MAX_MS) {
    return {
      status: "fresh",
      label: "Fresh Today",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
      description: "Server received this photo within the last 24 hours.",
    };
  } else if (elapsedMs <= FRESHNESS_THRESHOLDS.RECENT_MAX_MS) {
    return {
      status: "recent",
      label: "Recent Photo",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
      description: "Server received this photo between 1 and 7 days ago.",
    };
  } else {
    return {
      status: "stale",
      label: "Photo Outdated (Stale)",
      badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
      description: "Server received this photo more than 7 days ago. Newer photo recommended.",
    };
  }
}

/**
 * Normalizes input unit strings to canonical database units.
 */
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
 * Approximate regional centroids for agricultural centers in India.
 * Used for generalized map discovery without exposing private farm homestead coordinates.
 */
const REGIONAL_COORDINATES = {
  // Nashik district agricultural localities & regional demo clusters
  panchavati: [20.015, 73.795],
  dindori: [20.2014, 73.8378],
  niphad: [20.0838, 74.1085],
  lasalgaon: [20.1472, 74.2281],
  pimpalgaon: [20.1714, 73.9877],
  sinnar_midc: [19.87, 73.95],
  sinnar: [19.8475, 73.9961],
  yeola: [20.0435, 74.4842],
  chandwad: [20.3292, 74.2417],
  kalwan: [20.4853, 73.9678],
  malegaon: [20.5539, 74.5298],
  satana: [20.5925, 74.2052],
  baglan: [20.5925, 74.2052],
  deola: [20.4674, 74.1913],
  igatpuri_agro: [19.72, 73.6],
  igatpuri: [19.6967, 73.5594],
  trimbakeshwar: [19.9388, 73.5358],
  trimbak: [19.9388, 73.5358],
  ozar: [20.0964, 73.9189],
  vani: [20.3167, 73.8833],
  saikheda: [20.0667, 74.05],
  sukene: [20.1167, 74.0167],
  chandshi: [20.0417, 73.7583],
  girnare: [20.0333, 73.6667],
  makhmalabad: [20.05, 73.7833],
  bhagur: [19.9167, 73.8167],
  nandgaon: [20.3125, 74.6583],
  nashik: [19.9975, 73.7898],

  // Other Maharashtra & National agro-centers
  pune: [18.5204, 73.8567],
  nagpur: [21.1458, 79.0882],
  mumbai: [19.076, 72.8777],
  aurangabad: [19.8762, 75.3433],
  kolhapur: [16.705, 74.2433],
  solapur: [17.6599, 75.9064],
  ahmednagar: [19.0948, 74.748],
  punjab: [31.1471, 75.3412],
  ludhiana: [30.901, 75.8573],
  haryana: [29.0588, 76.0856],
  karnal: [29.6857, 76.9905],
  gujarat: [22.2587, 71.1924],
  surat: [21.1702, 72.8311],
  bengaluru: [12.9716, 77.5946],
  mysore: [12.2958, 76.6394],
  default: [19.9975, 73.7898], // Nashik agro-zone centroid
};

function getApproximateCoordinates(locationStr = "", id = "") {
  const locLower = (locationStr || "").toLowerCase();
  for (const [key, coords] of Object.entries(REGIONAL_COORDINATES)) {
    if (key !== "default" && locLower.includes(key)) {
      // Small deterministic pseudo-offset from ID hash so points don't stack on exact same pixel
      const hash = String(id).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const latOffset = ((hash % 100) - 50) * 0.002;
      const lngOffset = (((hash * 7) % 100) - 50) * 0.002;
      return [coords[0] + latOffset, coords[1] + lngOffset];
    }
  }
  const hash = String(id).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const latOffset = ((hash % 100) - 50) * 0.004;
  const lngOffset = (((hash * 7) % 100) - 50) * 0.004;
  return [REGIONAL_COORDINATES.default[0] + latOffset, REGIONAL_COORDINATES.default[1] + lngOffset];
}

/**
 * GET /api/marketplace/listings
 * Public Discovery Endpoint with search, filtering, sorting, and server-side pagination.
 *
 * Rules:
 * - Publicly accessible without authentication.
 * - Only returns status="available" with quantityAvailable > 0.
 * - Excludes inactive, reserved, and sold listings.
 * - Excludes sensitive internal/auth fields.
 */
async function getPublicListings(req, res) {
  try {
    const {
      search,
      category,
      unit,
      minPrice,
      maxPrice,
      minQuantity,
      freshness,
      location,
      sort = "newest",
      page = 1,
      limit = 12,
    } = req.query;

    // Validate pagination parameters
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    if (isNaN(parsedPage) || parsedPage < 1) {
      return res.status(400).json({ message: "Page parameter must be a positive integer >= 1." });
    }
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ message: "Limit parameter must be an integer between 1 and 100." });
    }

    // Validate category
    if (category && category !== "all") {
      const lowerCat = String(category).toLowerCase().trim();
      if (!ALLOWED_CATEGORIES.includes(lowerCat)) {
        return res.status(400).json({
          message: `Invalid category '${category}'. Allowed categories: ${ALLOWED_CATEGORIES.join(", ")}, or 'all'.`,
        });
      }
    }

    // Validate unit
    let canonicalUnit = null;
    if (unit && unit !== "all") {
      canonicalUnit = normalizeUnit(unit);
      if (!ALLOWED_UNITS.includes(canonicalUnit)) {
        return res.status(400).json({
          message: `Invalid unit '${unit}'. Supported units: ${ALLOWED_UNITS.join(", ")}.`,
        });
      }
    }

    // Fix 1: Validate price filters and price sorts require a valid canonical unit
    const hasMinPrice = minPrice !== undefined && minPrice !== "" && minPrice !== null;
    const hasMaxPrice = maxPrice !== undefined && maxPrice !== "" && maxPrice !== null;
    const isPriceSort = sort === "price_asc" || sort === "price_desc";

    if ((hasMinPrice || hasMaxPrice) && !canonicalUnit) {
      return res.status(400).json({
        message: "Filtering by price requires specifying a valid 'unit' parameter (e.g. kg, quintal, tonne, litre, piece, head). Prices per unit cannot be compared directly across different units.",
      });
    }

    if (isPriceSort && !canonicalUnit) {
      return res.status(400).json({
        message: "Sorting listings by price requires specifying a valid 'unit' parameter because price-per-unit cannot be meaningfully sorted across mixed units without unit context.",
      });
    }

    // Validate price range
    let parsedMinPrice = null;
    let parsedMaxPrice = null;
    if (hasMinPrice) {
      parsedMinPrice = Number(minPrice);
      if (!Number.isFinite(parsedMinPrice) || parsedMinPrice < 0) {
        return res.status(400).json({ message: "minPrice must be a non-negative finite number." });
      }
    }
    if (hasMaxPrice) {
      parsedMaxPrice = Number(maxPrice);
      if (!Number.isFinite(parsedMaxPrice) || parsedMaxPrice < 0) {
        return res.status(400).json({ message: "maxPrice must be a non-negative finite number." });
      }
    }
    if (parsedMinPrice !== null && parsedMaxPrice !== null && parsedMinPrice > parsedMaxPrice) {
      return res.status(400).json({ message: "minPrice cannot be greater than maxPrice." });
    }

    // Validate minQuantity
    let parsedMinQty = null;
    if (minQuantity !== undefined && minQuantity !== "") {
      parsedMinQty = Number(minQuantity);
      if (!Number.isFinite(parsedMinQty) || parsedMinQty < 0) {
        return res.status(400).json({ message: "minQuantity must be a non-negative number." });
      }
    }

    // Validate freshness filter
    const allowedFreshness = ["fresh", "recent", "stale", "no_photo", "all"];
    if (freshness && !allowedFreshness.includes(String(freshness).toLowerCase())) {
      return res.status(400).json({
        message: `Invalid freshness filter '${freshness}'. Allowed values: ${allowedFreshness.join(", ")}.`,
      });
    }

    // Build base MongoDB query: STRICTLY available listings with positive inventory
    const query = {
      status: "available",
      quantityAvailable: { $gt: 0 },
    };

    if (category && category !== "all") {
      query.category = String(category).toLowerCase().trim();
    }

    if (canonicalUnit) {
      query.quantityUnit = canonicalUnit;
    }

    if (parsedMinPrice !== null || parsedMaxPrice !== null) {
      query.fixedPricePerUnit = {};
      if (parsedMinPrice !== null) query.fixedPricePerUnit.$gte = parsedMinPrice;
      if (parsedMaxPrice !== null) query.fixedPricePerUnit.$lte = parsedMaxPrice;
    }

    if (parsedMinQty !== null && parsedMinQty > 0) {
      query.quantityAvailable.$gte = parsedMinQty;
    }

    // Text search on title, description, and condition notes
    if (search && String(search).trim()) {
      const sanitizedSearch = String(search).trim();
      const searchRegex = new RegExp(sanitizedSearch, "i");
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { conditionNotes: searchRegex },
      ];
    }

    // Location filter: search matched location IDs across CropFarm, Farm, Store
    if (location && String(location).trim()) {
      const locRegex = new RegExp(String(location).trim(), "i");
      const [cropFarms, farms, stores] = await Promise.all([
        CropFarm.find({ name: locRegex }).select("_id"),
        Farm.find({ $or: [{ name: locRegex }, { location: locRegex }] }).select("_id"),
        Store.find({ name: locRegex }).select("_id"),
      ]);
      const matchedIds = [
        ...cropFarms.map((cf) => cf._id),
        ...farms.map((f) => f._id),
        ...stores.map((s) => s._id),
      ];

      if (matchedIds.length > 0) {
        query.locationId = { $in: matchedIds };
      } else {
        // Return zero results safely if location filter matched no farms
        return res.json({
          success: true,
          listings: [],
          pagination: {
            total: 0,
            page: parsedPage,
            limit: parsedLimit,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
          filtersApplied: { search, category, unit, minPrice, maxPrice, freshness, location, sort },
        });
      }
    }

    // Build sorting condition
    let sortObj = { createdAt: -1 }; // default newest
    if (sort === "price_asc") {
      sortObj = { fixedPricePerUnit: 1, createdAt: -1 };
    } else if (sort === "price_desc") {
      sortObj = { fixedPricePerUnit: -1, createdAt: -1 };
    } else if (sort === "latest_stock") {
      sortObj = { lastStockUpdatedAt: -1, createdAt: -1 };
    } else if (sort === "newest") {
      sortObj = { createdAt: -1 };
    }

    // Count total matching documents
    const totalMatching = await Listing.countDocuments(query);

    // Fetch listings with projection (safe public fields only)
    const rawListings = await Listing.find(query)
      .sort(sortObj)
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .populate("farmerId", "firstName lastName name role createdAt")
      .lean();

    if (rawListings.length === 0) {
      return res.json({
        success: true,
        listings: [],
        pagination: {
          total: totalMatching,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.ceil(totalMatching / parsedLimit) || 0,
          hasNext: false,
          hasPrev: parsedPage > 1,
        },
        filtersApplied: { search, category, unit, minPrice, maxPrice, freshness, location, sort },
      });
    }

    // Batch-fetch primary photos and location details
    const listingIds = rawListings.map((l) => l._id);
    const photos = await ListingPhoto.find({ listingId: { $in: listingIds } })
      .sort({ isPrimary: -1, serverReceivedAt: -1 })
      .lean();

    // Map latest photo per listing
    const photoByListingId = {};
    for (const ph of photos) {
      const lid = ph.listingId.toString();
      if (!photoByListingId[lid]) {
        photoByListingId[lid] = ph;
      }
    }

    // Collect location IDs per model
    const cropFarmIds = rawListings.filter((l) => l.locationModel === "CropFarm").map((l) => l.locationId);
    const farmIds = rawListings.filter((l) => l.locationModel === "Farm").map((l) => l.locationId);
    const storeIds = rawListings.filter((l) => l.locationModel === "Store").map((l) => l.locationId);

    const [cropFarms, farms, stores] = await Promise.all([
      cropFarmIds.length > 0 ? CropFarm.find({ _id: { $in: cropFarmIds } }).lean() : [],
      farmIds.length > 0 ? Farm.find({ _id: { $in: farmIds } }).lean() : [],
      storeIds.length > 0 ? Store.find({ _id: { $in: storeIds } }).lean() : [],
    ]);

    const locationMap = {};
    for (const cf of cropFarms) locationMap[`CropFarm_${cf._id}`] = cf;
    for (const f of farms) locationMap[`Farm_${f._id}`] = f;
    for (const s of stores) locationMap[`Store_${s._id}`] = s;

    // Construct public-safe presentation documents
    let publicListings = rawListings.map((listing) => {
      const photo = photoByListingId[listing._id.toString()] || null;
      const freshnessData = evaluatePhotoFreshness(photo ? photo.serverReceivedAt : null);
      const locDoc = locationMap[`${listing.locationModel}_${listing.locationId}`] || null;

      // Safe general location disclosure without revealing exact farmstead boundaries
      const generalLocation = locDoc
        ? locDoc.location || "Regional Agricultural Zone"
        : "Regional Agricultural Zone";

      const farmerDisplayName =
        listing.farmerId && listing.farmerId.firstName
          ? `${listing.farmerId.firstName} ${listing.farmerId.lastName || ""}`.trim()
          : listing.farmerId && listing.farmerId.name
          ? listing.farmerId.name
          : "Verified Farmer";

      return {
        id: listing._id,
        title: listing.title,
        description: listing.description || "",
        category: listing.category,
        fixedPricePerUnit: listing.fixedPricePerUnit,
        quantityUnit: listing.quantityUnit,
        quantityAvailable: listing.quantityAvailable,
        minimumOrderQuantity: listing.minimumOrderQuantity || 1,
        minimumBidPerUnit: listing.minimumBidPerUnit || null,
        harvestDate: listing.harvestDate || null,
        availableFrom: listing.availableFrom || null,
        conditionNotes: listing.conditionNotes || "",
        status: listing.status,
        lastStockUpdatedAt: listing.lastStockUpdatedAt || null,
        createdAt: listing.createdAt,
        locationSummary: {
          id: listing.locationId,
          model: listing.locationModel,
          name: locDoc ? locDoc.name : "Registered Farm",
          generalLocation,
        },
        farmer: {
          id: listing.farmerId ? listing.farmerId._id : null,
          name: farmerDisplayName,
        },
        primaryPhoto: photo
          ? {
              id: photo._id,
              imageUrl: photo.imageUrl,
              watermarkedUrl: photo.watermarkedUrl || photo.imageUrl,
              serverReceivedAt: photo.serverReceivedAt,
              freshness: freshnessData,
            }
          : null,
        photoFreshness: freshnessData,
      };
    });

    // Apply post-aggregation freshness filter if specified
    if (freshness && freshness !== "all") {
      const targetFreshness = String(freshness).toLowerCase();
      publicListings = publicListings.filter(
        (l) => l.photoFreshness.status === targetFreshness
      );
    }

    // Handle sort by latest_photo in-memory if requested
    if (sort === "latest_photo") {
      publicListings.sort((a, b) => {
        const timeA = a.primaryPhoto ? new Date(a.primaryPhoto.serverReceivedAt).getTime() : 0;
        const timeB = b.primaryPhoto ? new Date(b.primaryPhoto.serverReceivedAt).getTime() : 0;
        return timeB - timeA;
      });
    }

    const totalPages = Math.ceil(totalMatching / parsedLimit) || 1;

    return res.json({
      success: true,
      listings: publicListings,
      pagination: {
        total: totalMatching,
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
        hasNext: parsedPage < totalPages,
        hasPrev: parsedPage > 1,
      },
      filtersApplied: {
        search: search || "",
        category: category || "all",
        unit: unit || "all",
        minPrice: parsedMinPrice,
        maxPrice: parsedMaxPrice,
        minQuantity: parsedMinQty,
        freshness: freshness || "all",
        location: location || "",
        sort,
      },
    });
  } catch (err) {
    console.error("Error in getPublicListings:", err);
    return res.status(500).json({
      message: "Failed to retrieve marketplace listings.",
      error: err.message,
    });
  }
}

/**
 * GET /api/marketplace/listings/:listingId
 * Detailed public listing view.
 *
 * Exposes:
 * - Product identity, category, price, available quantity, unit, min order
 * - Condition notes, harvest date
 * - Location summary (general location only; NO private land deeds or private coordinates)
 * - Chronological photo gallery and freshness timeline
 * - Current real-time availability message
 */
async function getPublicListingById(req, res) {
  try {
    const { listingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ message: "Invalid listing ID format." });
    }

    const listing = await Listing.findById(listingId)
      .populate("farmerId", "firstName lastName name role createdAt")
      .lean();

    if (!listing) {
      return res.status(404).json({ message: "Marketplace listing not found." });
    }

    // Determine location details safely
    let locationDoc = null;
    if (listing.locationModel === "CropFarm") {
      locationDoc = await CropFarm.findById(listing.locationId).lean();
    } else if (listing.locationModel === "Farm") {
      locationDoc = await Farm.findById(listing.locationId).lean();
    } else if (listing.locationModel === "Store") {
      locationDoc = await Store.findById(listing.locationId).lean();
    }

    // Retrieve all public photos for this listing in stable chronological order
    const rawPhotos = await ListingPhoto.find({ listingId })
      .sort({ serverReceivedAt: -1 })
      .lean();

    const photos = rawPhotos.map((p) => ({
      id: p._id,
      imageUrl: p.imageUrl,
      watermarkedUrl: p.watermarkedUrl || p.imageUrl,
      serverReceivedAt: p.serverReceivedAt,
      captureMethod: p.captureMethod || "file_upload",
      conditionNotes: p.conditionNotes || "",
      isPrimary: Boolean(p.isPrimary),
      freshness: evaluatePhotoFreshness(p.serverReceivedAt),
    }));

    const primaryPhoto = photos.find((p) => p.isPrimary) || photos[0] || null;
    const overallFreshness = evaluatePhotoFreshness(primaryPhoto ? primaryPhoto.serverReceivedAt : null);

    // Live availability messaging
    const isAvailable = listing.status === "available" && listing.quantityAvailable > 0;
    let availabilityMessage = "In Stock & Ready for Inquiry";
    if (listing.status === "reserved") {
      availabilityMessage = "Currently Reserved for Pending Trade";
    } else if (listing.status === "sold" || listing.quantityAvailable === 0) {
      availabilityMessage = "Sold Out";
    } else if (listing.status === "inactive") {
      availabilityMessage = "Temporarily Inactive (Paused by Farmer)";
    }

    const farmerDisplayName =
      listing.farmerId && listing.farmerId.firstName
        ? `${listing.farmerId.firstName} ${listing.farmerId.lastName || ""}`.trim()
        : listing.farmerId && listing.farmerId.name
        ? listing.farmerId.name
        : "Verified Farmer";

    const responseData = {
      success: true,
      listing: {
        id: listing._id,
        title: listing.title,
        description: listing.description || "",
        category: listing.category,
        fixedPricePerUnit: listing.fixedPricePerUnit,
        quantityUnit: listing.quantityUnit,
        quantityAvailable: listing.quantityAvailable,
        quantityReserved: listing.quantityReserved || 0,
        minimumOrderQuantity: listing.minimumOrderQuantity || 1,
        minimumBidPerUnit: listing.minimumBidPerUnit || null,
        harvestDate: listing.harvestDate || null,
        availableFrom: listing.availableFrom || null,
        conditionNotes: listing.conditionNotes || "",
        status: listing.status,
        isAvailable,
        availabilityMessage,
        lastStockUpdatedAt: listing.lastStockUpdatedAt || null,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        locationSummary: {
          id: listing.locationId,
          model: listing.locationModel,
          name: locationDoc ? locationDoc.name : "Registered Farm",
          generalLocation: locationDoc && locationDoc.location ? locationDoc.location : "Regional Agricultural Zone",
        },
        farmer: {
          id: listing.farmerId ? listing.farmerId._id : null,
          name: farmerDisplayName,
        },
        photos,
        primaryPhoto,
        photoFreshness: overallFreshness,
      },
    };

    return res.json(responseData);
  } catch (err) {
    console.error("Error in getPublicListingById:", err);
    return res.status(500).json({
      message: "Failed to retrieve listing details.",
      error: err.message,
    });
  }
}

/**
 * GET /api/marketplace/farms/:locationModel/:locationId
 * Read-only Public Virtual Farm Profile.
 *
 * Privacy Guarantees:
 * - NO private land record deeds or boundaries
 * - NO bank/financial/cost documents
 * - NO private phone numbers, emails, or internal notes
 * - ONLY public crop records, livestock categories, and active marketplace lots
 */
async function getPublicFarmProfile(req, res) {
  try {
    const { locationModel, locationId } = req.params;

    if (!["CropFarm", "Farm", "Store"].includes(locationModel)) {
      return res.status(400).json({
        message: "Invalid locationModel. Allowed: CropFarm, Farm, Store.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(locationId)) {
      return res.status(400).json({ message: "Invalid location ID format." });
    }

    let locationDoc = null;
    if (locationModel === "CropFarm") {
      locationDoc = await CropFarm.findById(locationId).lean();
    } else if (locationModel === "Farm") {
      locationDoc = await Farm.findById(locationId).lean();
    } else if (locationModel === "Store") {
      locationDoc = await Store.findById(locationId).lean();
    }

    if (!locationDoc) {
      return res.status(404).json({ message: "Farm or storage location not found." });
    }

    // Owner display details
    const owner = await User.findById(locationDoc.userId)
      .select("firstName lastName name role createdAt")
      .lean();

    const producerDisplayName = owner
      ? owner.firstName
        ? `${owner.firstName} ${owner.lastName || ""}`.trim()
        : owner.name || "Verified Agricultural Grower"
      : "Verified Agricultural Grower";

    // Active marketplace listings published from this farm (publicly approved lots only)
    const activeListings = await Listing.find({
      locationModel,
      locationId,
      status: "available",
      quantityAvailable: { $gt: 0 },
    })
      .select("title category fixedPricePerUnit quantityUnit quantityAvailable lastStockUpdatedAt createdAt")
      .sort({ createdAt: -1 })
      .lean();

    // Fix 3: Restrict crop and livestock activity shown publicly strictly to eligible public marketplace listings.
    // Exclude unlisted internal CropRecord or Animal source records, private land boundaries, and financials.
    const cropSummary = Array.from(
      new Set(
        activeListings
          .filter((l) => l.category === "crop" || l.category === "produce")
          .map((l) => l.title)
      )
    );

    const livestockSummary = Array.from(
      new Set(
        activeListings
          .filter((l) => l.category === "livestock")
          .map((l) => l.title)
      )
    );

    // Recent photo timeline for this farm's listings
    const activeListingIds = activeListings.map((l) => l._id);
    const recentPhotos = await ListingPhoto.find({ listingId: { $in: activeListingIds } })
      .select("imageUrl watermarkedUrl serverReceivedAt captureMethod isPrimary")
      .sort({ serverReceivedAt: -1 })
      .limit(8)
      .lean();

    const formattedPhotos = recentPhotos.map((p) => ({
      id: p._id,
      imageUrl: p.imageUrl,
      watermarkedUrl: p.watermarkedUrl || p.imageUrl,
      serverReceivedAt: p.serverReceivedAt,
      freshness: evaluatePhotoFreshness(p.serverReceivedAt),
    }));

    return res.json({
      success: true,
      farm: {
        id: locationDoc._id,
        name: locationDoc.name,
        model: locationModel,
        generalLocation: locationDoc.location || "Regional Agricultural Zone",
        producerName: producerDisplayName,
        memberSince: owner ? owner.createdAt : null,
        cropSummary,
        livestockSummary,
        activeListingCount: activeListings.length,
        activeListings: activeListings.map((l) => ({
          id: l._id,
          title: l.title,
          category: l.category,
          pricePerUnit: l.fixedPricePerUnit,
          unit: l.quantityUnit,
          quantityAvailable: l.quantityAvailable,
          lastStockUpdatedAt: l.lastStockUpdatedAt,
        })),
        recentPhotos: formattedPhotos,
      },
    });
  } catch (err) {
    console.error("Error in getPublicFarmProfile:", err);
    return res.status(500).json({
      message: "Failed to retrieve virtual farm profile.",
      error: err.message,
    });
  }
}

/**
 * GET /api/marketplace/map-locations
 * Retrieves approximate geographic markers for active marketplace inventory.
 *
 * Privacy Guarantees:
 * - Does NOT expose exact GPS boundaries of farmsteads.
 * - Uses regional centroid coordinates with deterministic micro-offsets.
 * - Does NOT require buyer browser location permission.
 */
async function getPublicMapLocations(req, res) {
  try {
    // Only query active, available listings with inventory
    const activeListings = await Listing.find({
      status: "available",
      quantityAvailable: { $gt: 0 },
    })
      .select("title category fixedPricePerUnit quantityUnit quantityAvailable locationModel locationId farmerId")
      .populate("farmerId", "firstName lastName role")
      .lean();

    if (activeListings.length === 0) {
      return res.json({ success: true, count: 0, markers: [] });
    }

    // Group listings by location
    const locationGroups = {};
    for (const l of activeListings) {
      const key = `${l.locationModel}_${l.locationId}`;
      if (!locationGroups[key]) {
        locationGroups[key] = {
          locationModel: l.locationModel,
          locationId: l.locationId,
          listings: [],
        };
      }
      locationGroups[key].listings.push(l);
    }

    // Fetch location details
    const cropFarmIds = [];
    const farmIds = [];
    const storeIds = [];

    for (const g of Object.values(locationGroups)) {
      if (g.locationModel === "CropFarm") cropFarmIds.push(g.locationId);
      if (g.locationModel === "Farm") farmIds.push(g.locationId);
      if (g.locationModel === "Store") storeIds.push(g.locationId);
    }

    const [cropFarms, farms, stores] = await Promise.all([
      cropFarmIds.length > 0 ? CropFarm.find({ _id: { $in: cropFarmIds } }).lean() : [],
      farmIds.length > 0 ? Farm.find({ _id: { $in: farmIds } }).lean() : [],
      storeIds.length > 0 ? Store.find({ _id: { $in: storeIds } }).lean() : [],
    ]);

    const locationDocMap = {};
    for (const cf of cropFarms) locationDocMap[`CropFarm_${cf._id}`] = cf;
    for (const f of farms) locationDocMap[`Farm_${f._id}`] = f;
    for (const s of stores) locationDocMap[`Store_${s._id}`] = s;

    // Fetch photos for sample listings (prefer primary photos, latest first)
    const sampleListingIds = activeListings.map((l) => l._id);
    const photos = await ListingPhoto.find({ listingId: { $in: sampleListingIds } })
      .sort({ isPrimary: -1, serverReceivedAt: -1 })
      .lean();

    const photoMap = {};
    for (const p of photos) {
      const lid = p.listingId.toString();
      if (!photoMap[lid]) {
        photoMap[lid] = p;
      }
    }

    const markers = Object.values(locationGroups).map((group) => {
      const locDoc = locationDocMap[`${group.locationModel}_${group.locationId}`];
      const farmName = locDoc ? locDoc.name : "Agricultural Farm";
      const generalLocation = locDoc && locDoc.location ? locDoc.location : "Regional Farm Zone";
      const coordinates = getApproximateCoordinates(generalLocation, group.locationId);

      // Select representative listing: prefer listing with an inventory photo for rich marker display
      const repListing = group.listings.find((l) => photoMap[l._id.toString()]) || group.listings[0];
      const farmerUser = repListing?.farmerId;
      const farmerName = farmerUser
        ? `${farmerUser.firstName || ""} ${farmerUser.lastName || ""}`.trim()
        : "Demo Farmer";
      const repPhoto = repListing ? photoMap[repListing._id.toString()] : null;
      const freshness = evaluatePhotoFreshness(repPhoto ? repPhoto.serverReceivedAt : null);

      return {
        markerId: `${group.locationModel}_${group.locationId}`,
        locationId: group.locationId,
        locationModel: group.locationModel,
        farmName,
        farmerName,
        farmerDisplayName: farmerName,
        generalLocation,
        generalRegion: generalLocation,
        coordinates,
        isApproximateCentroid: true,
        regionalCentroidLabel: "Approximate Agricultural Region",
        coordinateNotice:
          "Marker represents an approximate regional centroid, not precise farmstead boundaries or homestead coordinates.",
        totalListings: group.listings.length,
        representativeListingId: repListing ? repListing._id : null,
        representativeItemTitle: repListing ? repListing.title : "",
        category: repListing ? repListing.category : "crop",
        availableQuantity: repListing ? repListing.quantityAvailable : 0,
        quantityUnit: repListing ? repListing.quantityUnit : "kg",
        fixedPricePerUnit: repListing ? repListing.fixedPricePerUnit : 0,
        photoUrl: repPhoto ? repPhoto.watermarkedUrl || repPhoto.imageUrl : null,
        freshnessStatus: freshness.status,
        freshnessLabel: freshness.label,
        freshnessBadgeColor: freshness.badgeColor,
        serverReceivedAt: repPhoto ? repPhoto.serverReceivedAt : null,
        sampleListings: group.listings.slice(0, 3).map((l) => {
          const lPhoto = photoMap[l._id.toString()];
          return {
            id: l._id,
            title: l.title,
            category: l.category,
            price: l.fixedPricePerUnit,
            quantityAvailable: l.quantityAvailable,
            unit: l.quantityUnit,
            photoUrl: lPhoto ? lPhoto.watermarkedUrl || lPhoto.imageUrl : null,
          };
        }),
      };
    });

    return res.json({
      success: true,
      count: markers.length,
      markers,
    });
  } catch (err) {
    console.error("Error in getPublicMapLocations:", err);
    return res.status(500).json({
      message: "Failed to retrieve map markers.",
      error: err.message,
    });
  }
}

module.exports = {
  getPublicListings,
  getPublicListingById,
  getPublicFarmProfile,
  getPublicMapLocations,
  evaluatePhotoFreshness,
  normalizeUnit,
};
