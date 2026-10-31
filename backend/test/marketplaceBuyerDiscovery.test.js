const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Listing = require("../models/Listing");
const ListingPhoto = require("../models/ListingPhoto");
const User = require("../models/User");
const CropFarm = require("../models/CropFarm");
const Farm = require("../models/Farm");
const Store = require("../models/Store");
const CropRecord = require("../models/CropRecord");
const Animal = require("../models/Animal");

const {
  evaluatePhotoFreshness,
  normalizeUnit,
} = require("../controllers/marketplacePublicController");
const marketplaceRoutes = require("../routes/marketplaceRoutes");

const JWT_SECRET = process.env.JWT_SECRET || "fms_super_secret_jwt_key_2025";
process.env.JWT_SECRET = JWT_SECRET;

async function runStage5Tests() {
  console.log("==================================================");
  console.log("🧪 RUNNING STAGE 5 BUYER DISCOVERY & VIRTUAL FARM TESTS");
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

  // Test Entities
  const farmer1Id = new mongoose.Types.ObjectId();
  const cropFarmId = new mongoose.Types.ObjectId();
  const farmId = new mongoose.Types.ObjectId();
  const storeId = new mongoose.Types.ObjectId();

  const now = Date.now();
  const oneHourAgo = new Date(now - 1 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000);

  // Seed sample listings
  const listing1_wheat = {
    _id: new mongoose.Types.ObjectId(),
    farmerId: farmer1Id,
    locationModel: "CropFarm",
    locationId: cropFarmId,
    category: "crop",
    title: "Organic Sharbati Wheat Lot",
    description: "Grade A harvested wheat grains stored in dry silo",
    quantityUnit: "quintal",
    quantityAvailable: 150,
    quantityReserved: 0,
    quantitySold: 0,
    fixedPricePerUnit: 2800,
    minimumOrderQuantity: 5,
    minimumBidPerUnit: 2600,
    harvestDate: new Date("2026-10-01"),
    conditionNotes: "Moisture level < 11%",
    status: "available",
    lastStockUpdatedAt: oneHourAgo,
    createdAt: new Date(now - 100000),
  };

  const listing2_tomatoes = {
    _id: new mongoose.Types.ObjectId(),
    farmerId: farmer1Id,
    locationModel: "CropFarm",
    locationId: cropFarmId,
    category: "produce",
    title: "Farm Fresh Hybrid Tomatoes",
    description: "Vine-ripened tomatoes crated for delivery",
    quantityUnit: "kg",
    quantityAvailable: 500,
    quantityReserved: 0,
    quantitySold: 0,
    fixedPricePerUnit: 35,
    minimumOrderQuantity: 20,
    minimumBidPerUnit: null,
    harvestDate: new Date("2026-10-20"),
    conditionNotes: "Pesticide free",
    status: "available",
    lastStockUpdatedAt: twoDaysAgo,
    createdAt: new Date(now - 200000),
  };

  const listing3_cows = {
    _id: new mongoose.Types.ObjectId(),
    farmerId: farmer1Id,
    locationModel: "Farm",
    locationId: farmId,
    category: "livestock",
    title: "Jersey Dairy Cow",
    description: "Healthy 3-year-old milk producing heifer",
    quantityUnit: "head",
    quantityAvailable: 2,
    quantityReserved: 0,
    quantitySold: 0,
    fixedPricePerUnit: 48000,
    minimumOrderQuantity: 1,
    minimumBidPerUnit: 45000,
    conditionNotes: "Fully vaccinated",
    status: "available",
    lastStockUpdatedAt: oneHourAgo,
    createdAt: new Date(now - 300000),
  };

  const listing4_inactive = {
    _id: new mongoose.Types.ObjectId(),
    farmerId: farmer1Id,
    locationModel: "CropFarm",
    locationId: cropFarmId,
    category: "crop",
    title: "Paused Basmati Lot",
    description: "Temporarily paused by farmer",
    quantityUnit: "quintal",
    quantityAvailable: 50,
    quantityReserved: 0,
    quantitySold: 0,
    fixedPricePerUnit: 4000,
    status: "inactive",
    lastStockUpdatedAt: oneHourAgo,
    createdAt: new Date(now - 400000),
  };

  const listing5_zeroQty = {
    _id: new mongoose.Types.ObjectId(),
    farmerId: farmer1Id,
    locationModel: "CropFarm",
    locationId: cropFarmId,
    category: "produce",
    title: "Sold Out Mangoes",
    description: "All stock sold",
    quantityUnit: "kg",
    quantityAvailable: 0,
    quantityReserved: 0,
    quantitySold: 100,
    fixedPricePerUnit: 120,
    status: "sold",
    lastStockUpdatedAt: oneHourAgo,
    createdAt: new Date(now - 500000),
  };

  const allListings = [listing1_wheat, listing2_tomatoes, listing3_cows, listing4_inactive, listing5_zeroQty];

  // Seed sample photos
  const photo1_fresh = {
    _id: new mongoose.Types.ObjectId(),
    listingId: listing1_wheat._id,
    imageUrl: "https://storage.smartagri.org/wheat1.webp",
    watermarkedUrl: "https://storage.smartagri.org/wm_wheat1.webp",
    serverReceivedAt: oneHourAgo,
    captureMethod: "live_camera",
    conditionNotes: "Silo batch A photo",
    isPrimary: true,
  };

  const photo2_recent = {
    _id: new mongoose.Types.ObjectId(),
    listingId: listing2_tomatoes._id,
    imageUrl: "https://storage.smartagri.org/tomato1.webp",
    watermarkedUrl: "https://storage.smartagri.org/wm_tomato1.webp",
    serverReceivedAt: twoDaysAgo,
    captureMethod: "file_upload",
    conditionNotes: "Harvest crates photo",
    isPrimary: true,
  };

  const photo3_stale = {
    _id: new mongoose.Types.ObjectId(),
    listingId: listing3_cows._id,
    imageUrl: "https://storage.smartagri.org/cow1.webp",
    watermarkedUrl: "https://storage.smartagri.org/wm_cow1.webp",
    serverReceivedAt: tenDaysAgo,
    captureMethod: "file_upload",
    isPrimary: true,
  };

  const allPhotos = [photo1_fresh, photo2_recent, photo3_stale];

  // In-memory model mocks
  const originalListingCount = Listing.countDocuments;
  const originalListingFind = Listing.find;
  const originalListingFindById = Listing.findById;
  const originalPhotoFind = ListingPhoto.find;
  const originalUserFindById = User.findById;
  const originalCropFarmFind = CropFarm.find;
  const originalCropFarmFindById = CropFarm.findById;
  const originalFarmFind = Farm.find;
  const originalFarmFindById = Farm.findById;
  const originalStoreFind = Store.find;
  const originalStoreFindById = Store.findById;
  const originalCropRecordFind = CropRecord.find;
  const originalAnimalFind = Animal.find;

  // Helper query matcher
  function matchListing(listing, query) {
    if (query.status && listing.status !== query.status) return false;
    if (query.quantityAvailable && query.quantityAvailable.$gt !== undefined) {
      if (listing.quantityAvailable <= query.quantityAvailable.$gt) return false;
    }
    if (query.category && listing.category !== query.category) return false;
    if (query.quantityUnit && listing.quantityUnit !== query.quantityUnit) return false;
    if (query.quantityAvailable && query.quantityAvailable.$gte !== undefined) {
      if (listing.quantityAvailable < query.quantityAvailable.$gte) return false;
    }
    if (query.fixedPricePerUnit) {
      if (query.fixedPricePerUnit.$gte !== undefined && listing.fixedPricePerUnit < query.fixedPricePerUnit.$gte) return false;
      if (query.fixedPricePerUnit.$lte !== undefined && listing.fixedPricePerUnit > query.fixedPricePerUnit.$lte) return false;
    }
    if (query.$or) {
      const orMatched = query.$or.some((clause) => {
        if (clause.title && clause.title.test(listing.title)) return true;
        if (clause.description && clause.description.test(listing.description)) return true;
        if (clause.conditionNotes && clause.conditionNotes.test(listing.conditionNotes || "")) return true;
        return false;
      });
      if (!orMatched) return false;
    }
    if (query.locationId && query.locationId.$in) {
      const idStrs = query.locationId.$in.map((id) => id.toString());
      if (!idStrs.includes(listing.locationId.toString())) return false;
    }
    return true;
  }

  Listing.countDocuments = async function (query) {
    return allListings.filter((l) => matchListing(l, query)).length;
  };

  Listing.find = function (query) {
    let results = allListings.filter((l) => matchListing(l, query));

    const cursor = {
      _sortObj: null,
      _skip: 0,
      _limit: 100,
      sort: function (s) {
        this._sortObj = s;
        if (s.fixedPricePerUnit === 1) {
          results.sort((a, b) => a.fixedPricePerUnit - b.fixedPricePerUnit);
        } else if (s.fixedPricePerUnit === -1) {
          results.sort((a, b) => b.fixedPricePerUnit - a.fixedPricePerUnit);
        } else if (s.lastStockUpdatedAt === -1) {
          results.sort((a, b) => new Date(b.lastStockUpdatedAt).getTime() - new Date(a.lastStockUpdatedAt).getTime());
        } else if (s.createdAt === -1) {
          results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        return this;
      },
      skip: function (sk) {
        this._skip = sk;
        return this;
      },
      limit: function (lim) {
        this._limit = lim;
        return this;
      },
      select: function () {
        return this;
      },
      populate: function () {
        return this;
      },
      lean: async function () {
        return results.slice(this._skip, this._skip + this._limit).map((l) => ({
          ...l,
          farmerId: { _id: l.farmerId, name: "Farmer Ramesh", role: "farmer", createdAt: new Date() },
        }));
      },
    };
    return cursor;
  };

  Listing.findById = function (id) {
    const found = allListings.find((l) => l._id.toString() === id.toString());
    return {
      populate: function () {
        return this;
      },
      lean: async function () {
        if (!found) return null;
        return {
          ...found,
          farmerId: { _id: found.farmerId, name: "Farmer Ramesh", role: "farmer", createdAt: new Date() },
        };
      },
    };
  };

  ListingPhoto.find = function (query) {
    let results = allPhotos;
    if (query.listingId) {
      if (query.listingId.$in) {
        const ids = query.listingId.$in.map((i) => i.toString());
        results = results.filter((p) => ids.includes(p.listingId.toString()));
      } else {
        results = results.filter((p) => p.listingId.toString() === query.listingId.toString());
      }
    }
    return {
      sort: function () {
        return this;
      },
      limit: function (lim) {
        return {
          lean: async function () {
            return results.slice(0, lim);
          },
        };
      },
      select: function () {
        return this;
      },
      lean: async function () {
        return results;
      },
    };
  };

  User.findById = function () {
    return {
      select: function () {
        return {
          lean: async function () {
            return { _id: farmer1Id, name: "Farmer Ramesh", role: "farmer", createdAt: new Date("2025-01-01") };
          },
        };
      },
    };
  };

  CropFarm.find = function () {
    return {
      select: function () {
        return [{ _id: cropFarmId }];
      },
      lean: async function () {
        return [{ _id: cropFarmId, name: "Green Valley Farm", location: "Nashik, Maharashtra" }];
      },
    };
  };

  CropFarm.findById = function (id) {
    return {
      lean: async function () {
        if (id.toString() === cropFarmId.toString()) {
          return { _id: cropFarmId, name: "Green Valley Farm", location: "Nashik, Maharashtra", userId: farmer1Id };
        }
        return null;
      },
    };
  };

  Farm.find = function () {
    return {
      select: function () {
        return [{ _id: farmId }];
      },
      lean: async function () {
        return [{ _id: farmId, name: "Sunrise Dairy Farm", location: "Pune, Maharashtra" }];
      },
    };
  };

  Farm.findById = function (id) {
    return {
      lean: async function () {
        if (id.toString() === farmId.toString()) {
          return { _id: farmId, name: "Sunrise Dairy Farm", location: "Pune, Maharashtra", userId: farmer1Id };
        }
        return null;
      },
    };
  };

  Store.find = function () {
    return {
      select: function () {
        return [{ _id: storeId }];
      },
      lean: async function () {
        return [{ _id: storeId, name: "Central Silo Hub" }];
      },
    };
  };

  Store.findById = function (id) {
    return {
      lean: async function () {
        if (id.toString() === storeId.toString()) {
          return { _id: storeId, name: "Central Silo Hub", userId: farmer1Id };
        }
        return null;
      },
    };
  };

  CropRecord.find = function () {
    return {
      select: function () {
        return {
          lean: async function () {
            return [
              { cropName: "Sharbati Wheat", cropType: "Grain", season: "Rabi 2026" },
              { cropName: "Organic Chickpeas", cropType: "Pulses", season: "Rabi 2026" },
            ];
          },
        };
      },
    };
  };

  Animal.find = function () {
    return {
      select: function () {
        return {
          lean: async function () {
            return [{ category: "Cow", breed: "Jersey" }];
          },
        };
      },
    };
  };

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Public unauthenticated discovery
    // ------------------------------------------------------------------------
    const res1 = await fetch(`${baseUrl}/listings`);
    const data1 = await res1.json();
    assert(res1.status === 200, "Test 1: Public users can retrieve eligible listings without authentication (HTTP 200)");
    assert(data1.success === true, "Test 1: Public listings response has success flag");
    assert(Array.isArray(data1.listings), "Test 1: Listings is returned as an array");

    // ------------------------------------------------------------------------
    // TEST 2: Inactive & sold listings excluded
    // ------------------------------------------------------------------------
    const titles1 = data1.listings.map((l) => l.title);
    assert(!titles1.includes("Paused Basmati Lot"), "Test 2: Inactive listing is excluded from public discovery");
    assert(!titles1.includes("Sold Out Mangoes"), "Test 2: Sold listing is excluded from public discovery");

    // ------------------------------------------------------------------------
    // TEST 3: Zero available quantity excluded
    // ------------------------------------------------------------------------
    const hasZeroQty = data1.listings.some((l) => l.quantityAvailable <= 0);
    assert(!hasZeroQty, "Test 3: Listings with zero available quantity are strictly excluded");

    // ------------------------------------------------------------------------
    // TEST 4: Text search filter
    // ------------------------------------------------------------------------
    const resSearch = await fetch(`${baseUrl}/listings?search=Wheat`);
    const dataSearch = await resSearch.json();
    assert(resSearch.status === 200, "Test 4: Search query returns HTTP 200");
    assert(dataSearch.listings.length === 1, "Test 4: Search for 'Wheat' matched exactly 1 listing");
    assert(dataSearch.listings[0].title === "Organic Sharbati Wheat Lot", "Test 4: Search returned the correct wheat listing");

    // ------------------------------------------------------------------------
    // TEST 5: Category filter & validation
    // ------------------------------------------------------------------------
    const resCatCrop = await fetch(`${baseUrl}/listings?category=crop`);
    const dataCatCrop = await resCatCrop.json();
    assert(resCatCrop.status === 200, "Test 5: Valid category 'crop' returns HTTP 200");
    const allCrops = dataCatCrop.listings.every((l) => l.category === "crop");
    assert(allCrops, "Test 5: Category filter returned only crop listings");

    const resInvalidCat = await fetch(`${baseUrl}/listings?category=aerospace`);
    assert(resInvalidCat.status === 400, "Test 5: Unsupported category is rejected with HTTP 400 Bad Request");

    // ------------------------------------------------------------------------
    // TEST 6: Unit-aware price range filter & validation (Fix 1)
    // ------------------------------------------------------------------------
    const resPriceNoUnit = await fetch(`${baseUrl}/listings?minPrice=10&maxPrice=100`);
    assert(resPriceNoUnit.status === 400, "Fix 1: Filtering by price without canonical unit rejected with HTTP 400");

    const resPriceMinOnlyNoUnit = await fetch(`${baseUrl}/listings?minPrice=10`);
    assert(resPriceMinOnlyNoUnit.status === 400, "Fix 1: minPrice without unit rejected with HTTP 400");

    const resPriceMaxOnlyNoUnit = await fetch(`${baseUrl}/listings?maxPrice=100`);
    assert(resPriceMaxOnlyNoUnit.status === 400, "Fix 1: maxPrice without unit rejected with HTTP 400");

    const resPriceWithUnit = await fetch(`${baseUrl}/listings?unit=kg&minPrice=10&maxPrice=100`);
    const dataPriceWithUnit = await resPriceWithUnit.json();
    assert(resPriceWithUnit.status === 200, "Fix 1: Valid price filter with unit=kg returns HTTP 200");
    assert(dataPriceWithUnit.listings.length === 1 && dataPriceWithUnit.listings[0].fixedPricePerUnit === 35, "Fix 1: Price filter matched tomatoes (₹35/kg)");

    const resInvalidPrice = await fetch(`${baseUrl}/listings?unit=kg&minPrice=500&maxPrice=100`);
    assert(resInvalidPrice.status === 400, "Fix 1: Inverted price range (minPrice > maxPrice) rejected with HTTP 400");

    const resNegativePrice = await fetch(`${baseUrl}/listings?unit=kg&minPrice=-10`);
    assert(resNegativePrice.status === 400, "Fix 1: Negative minPrice rejected with HTTP 400");

    // ------------------------------------------------------------------------
    // TEST 7: Canonical inventory unit support & normalization
    // ------------------------------------------------------------------------
    const resUnitHead = await fetch(`${baseUrl}/listings?unit=head`);
    const dataUnitHead = await resUnitHead.json();
    assert(resUnitHead.status === 200, "Test 7: Canonical unit 'head' accepted (HTTP 200)");
    assert(dataUnitHead.listings.length === 1 && dataUnitHead.listings[0].quantityUnit === "head", "Test 7: Head unit returns livestock cows");

    assert(normalizeUnit("ton") === "tonne", "Test 7: normalizeUnit maps 'ton' -> 'tonne'");
    assert(normalizeUnit("liter") === "litre", "Test 7: normalizeUnit maps 'liter' -> 'litre'");
    assert(normalizeUnit("pc") === "piece", "Test 7: normalizeUnit maps 'pc' -> 'piece'");

    const resInvalidUnit = await fetch(`${baseUrl}/listings?unit=bushel_custom`);
    assert(resInvalidUnit.status === 400, "Test 7: Unsupported unit rejected with HTTP 400");

    // ------------------------------------------------------------------------
    // TEST 8: Photo freshness calculation & trust labels
    // ------------------------------------------------------------------------
    const freshStatus = evaluatePhotoFreshness(oneHourAgo);
    assert(freshStatus.status === "fresh", "Test 8: Freshness within 24h evaluates to 'fresh'");
    assert(freshStatus.label === "Fresh Today", "Test 8: Label is 'Fresh Today'");

    const recentStatus = evaluatePhotoFreshness(twoDaysAgo);
    assert(recentStatus.status === "recent", "Test 8: Freshness between 1-7d evaluates to 'recent'");
    assert(recentStatus.label === "Recent Photo", "Test 8: Label is 'Recent Photo'");

    const staleStatus = evaluatePhotoFreshness(tenDaysAgo);
    assert(staleStatus.status === "stale", "Test 8: Freshness > 7d evaluates to 'stale'");
    assert(staleStatus.label.includes("Photo Outdated"), "Test 8: Label includes 'Photo Outdated'");

    const noPhotoStatus = evaluatePhotoFreshness(null);
    assert(noPhotoStatus.status === "no_photo" && noPhotoStatus.label === "No Photo", "Test 8: Missing photo evaluates to 'No Photo'");

    // ------------------------------------------------------------------------
    // TEST 9: Server-side pagination & input validation
    // ------------------------------------------------------------------------
    const resPage1 = await fetch(`${baseUrl}/listings?page=1&limit=2`);
    const dataPage1 = await resPage1.json();
    assert(resPage1.status === 200, "Test 9: Pagination page 1 returns HTTP 200");
    assert(dataPage1.listings.length <= 2, "Test 9: Respects limit=2");
    assert(dataPage1.pagination.page === 1, "Test 9: Pagination metadata reflects page 1");
    assert(dataPage1.pagination.total === 3, "Test 9: Total active listings count is 3");

    const resInvalidPage = await fetch(`${baseUrl}/listings?page=0`);
    assert(resInvalidPage.status === 400, "Test 9: Invalid page 0 rejected with HTTP 400");

    const resNegativePage = await fetch(`${baseUrl}/listings?page=-5`);
    assert(resNegativePage.status === 400, "Test 9: Negative page rejected with HTTP 400");

    // ------------------------------------------------------------------------
    // TEST 10: Unit-aware price sorting (Fix 1)
    // ------------------------------------------------------------------------
    const resSortPriceAscNoUnit = await fetch(`${baseUrl}/listings?sort=price_asc`);
    assert(resSortPriceAscNoUnit.status === 400, "Fix 1: Sorting price_asc without unit rejected with HTTP 400");

    const resSortPriceDescNoUnit = await fetch(`${baseUrl}/listings?sort=price_desc`);
    assert(resSortPriceDescNoUnit.status === 400, "Fix 1: Sorting price_desc without unit rejected with HTTP 400");

    const resSortPriceAsc = await fetch(`${baseUrl}/listings?unit=kg&sort=price_asc`);
    const dataSortPriceAsc = await resSortPriceAsc.json();
    assert(resSortPriceAsc.status === 200, "Fix 1: Sort price_asc with unit=kg returns HTTP 200");
    assert(dataSortPriceAsc.listings.length > 0 && dataSortPriceAsc.listings[0].quantityUnit === "kg", "Fix 1: Returned listings all belong to unit=kg");

    const resSortPriceDesc = await fetch(`${baseUrl}/listings?unit=head&sort=price_desc`);
    const dataSortPriceDesc = await resSortPriceDesc.json();
    assert(resSortPriceDesc.status === 200, "Fix 1: Sort price_desc with unit=head returns HTTP 200");
    assert(dataSortPriceDesc.listings[0].fixedPricePerUnit === 48000, "Fix 1: Highest price per head (Cow ₹48000) is first in price_desc");

    const resSortNewestNoUnit = await fetch(`${baseUrl}/listings?sort=newest`);
    assert(resSortNewestNoUnit.status === 200, "Test 10: Sort by newest without unit remains valid (HTTP 200)");

    // ------------------------------------------------------------------------
    // TEST 11: Public Listing Detail Endpoint
    // ------------------------------------------------------------------------
    const resDetail = await fetch(`${baseUrl}/listings/${listing1_wheat._id}`);
    const dataDetail = await resDetail.json();
    assert(resDetail.status === 200, "Test 11: Public detail endpoint returns HTTP 200");
    assert(dataDetail.listing.title === "Organic Sharbati Wheat Lot", "Test 11: Detail returns correct product title");
    assert(dataDetail.listing.isAvailable === true, "Test 11: Available status is true");
    assert(dataDetail.listing.primaryPhoto !== null, "Test 11: Primary photo is populated");
    assert(dataDetail.listing.primaryPhoto.freshness.label === "Fresh Today", "Test 11: Primary photo has 'Fresh Today' freshness");

    // ------------------------------------------------------------------------
    // TEST 12: Invalid & Not Found Listing IDs
    // ------------------------------------------------------------------------
    const resBadId = await fetch(`${baseUrl}/listings/not_a_valid_object_id`);
    assert(resBadId.status === 400, "Test 12: Malformed listing ID returns HTTP 400");

    const fakeId = new mongoose.Types.ObjectId();
    const resNotFound = await fetch(`${baseUrl}/listings/${fakeId}`);
    assert(resNotFound.status === 404, "Test 13: Non-existent listing ID returns HTTP 404");

    // ------------------------------------------------------------------------
    // TEST 13: Privacy Guard on Listing Detail
    // ------------------------------------------------------------------------
    assert(dataDetail.listing.farmer.password === undefined, "Test 14: Farmer password is NOT exposed in public response");
    assert(dataDetail.listing.farmer.email === undefined, "Test 14: Farmer email is NOT exposed in public response");
    assert(dataDetail.listing.farmer.tokens === undefined, "Test 14: Auth tokens are NOT exposed in public response");
    assert(dataDetail.listing.coordinates === undefined, "Test 14: Exact farmstead coordinates are NOT exposed");

    // ------------------------------------------------------------------------
    // TEST 14: Public Virtual Farm Profile & Privacy (Fix 3)
    // ------------------------------------------------------------------------
    const resFarm = await fetch(`${baseUrl}/farms/CropFarm/${cropFarmId}`);
    const dataFarm = await resFarm.json();
    assert(resFarm.status === 200, "Test 15: Public Virtual Farm Profile returns HTTP 200");
    assert(dataFarm.farm.name === "Green Valley Farm", "Test 15: Farm profile displays farm name");
    assert(dataFarm.farm.generalLocation === "Nashik, Maharashtra", "Test 15: Displays general region");
    assert(dataFarm.farm.cropSummary.length > 0, "Test 15: Displays active crop types");
    assert(dataFarm.farm.activeListingCount >= 1, "Test 15: Displays active listings count");

    // Fix 3: Virtual Farm Privacy Guarantees
    assert(dataFarm.farm.cropSummary.includes("Organic Sharbati Wheat Lot"), "Fix 3: Farm profile displays approved marketplace produce lot");
    assert(!dataFarm.farm.cropSummary.includes("Organic Chickpeas"), "Fix 3: Unlisted internal CropRecord is NOT disclosed in public profile");
    assert(dataFarm.farm.landRecords === undefined, "Test 16: Private LandRecord documents are NOT exposed");
    assert(dataFarm.farm.exactCoordinates === undefined, "Test 16: Boundary coordinates are NOT exposed");
    assert(dataFarm.farm.financials === undefined, "Test 16: Financial or cost-tracking records are NOT exposed");
    assert(dataFarm.farm.notes === undefined, "Fix 3: Internal farm notes are NOT exposed");
    assert(dataFarm.farm.email === undefined, "Fix 3: Farmer personal email is NOT exposed");

    // ------------------------------------------------------------------------
    // TEST 15: Public Map Locations & Approximate Labels (Fix 2)
    // ------------------------------------------------------------------------
    const resMap = await fetch(`${baseUrl}/map-locations`);
    const dataMap = await resMap.json();
    assert(resMap.status === 200, "Test 17: Map locations endpoint returns HTTP 200");
    assert(Array.isArray(dataMap.markers), "Test 17: Markers returned as array");
    assert(dataMap.markers.length > 0, "Test 17: Has markers for active farms");
    const m1 = dataMap.markers[0];
    assert(Array.isArray(m1.coordinates) && m1.coordinates.length === 2, "Test 17: Marker contains [lat, lng] coordinates");
    assert(typeof m1.farmName === "string", "Test 17: Marker includes farm name");
    assert(typeof m1.generalLocation === "string", "Test 17: Marker includes general location");
    assert(m1.isApproximateCentroid === true, "Fix 2: Marker includes isApproximateCentroid flag");
    assert(m1.regionalCentroidLabel === "Approximate Agricultural Region", "Fix 2: Marker explicitly labeled as approximate agricultural region");
    assert(typeof m1.coordinateNotice === "string", "Fix 2: Marker contains coordinate privacy disclaimer notice");

    // ------------------------------------------------------------------------
    // TEST 16: Timestamps distinction (Photo vs Stock Update)
    // ------------------------------------------------------------------------
    assert(listing1_wheat.lastStockUpdatedAt instanceof Date, "Test 18: Listing has dedicated lastStockUpdatedAt Date");
    assert(photo1_fresh.serverReceivedAt instanceof Date, "Test 18: Photo uses authoritative serverReceivedAt Date");
    assert(dataDetail.listing.lastStockUpdatedAt !== undefined, "Test 18: Detail view exposes lastStockUpdatedAt");
  } catch (err) {
    console.error("Test execution threw exception:", err);
    failed++;
  } finally {
    // Restore original Mongoose model methods
    Listing.countDocuments = originalListingCount;
    Listing.find = originalListingFind;
    Listing.findById = originalListingFindById;
    ListingPhoto.find = originalPhotoFind;
    User.findById = originalUserFindById;
    CropFarm.find = originalCropFarmFind;
    CropFarm.findById = originalCropFarmFindById;
    Farm.find = originalFarmFind;
    Farm.findById = originalFarmFindById;
    Store.find = originalStoreFind;
    Store.findById = originalStoreFindById;
    CropRecord.find = originalCropRecordFind;
    Animal.find = originalAnimalFind;

    await new Promise((resolve) => server.close(resolve));
  }

  console.log("==================================================");
  console.log(`🏁 STAGE 5 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runStage5Tests();
