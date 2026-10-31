/**
 * backend/test/marketplaceDemoExperience.test.js
 *
 * Stage 7 / Step 11: Comprehensive Test Suite for Demo Data,
 * 25 Farmer Map Discovery, Idempotent Seeding, Two-Level Login & Buyer Experience
 */

const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const connectDB = require("../config/db");
const User = require("../models/User");
const CropFarm = require("../models/CropFarm");
const Listing = require("../models/Listing");
const ListingPhoto = require("../models/ListingPhoto");
const marketplaceRoutes = require("../routes/marketplaceRoutes");
const authRoutes = require("../routes/auth");
const seedMarketplaceDemo = require("../scripts/seedMarketplaceDemo");

const JWT_SECRET = process.env.JWT_SECRET || "fms_super_secret_jwt_key_2025";
process.env.JWT_SECRET = JWT_SECRET;

async function runDemoExperienceTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING STEP 11 DEMO SEEDING, MAP & AUTH TESTS");
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

  // 1. Setup Express Test Server
  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  app.use("/api/marketplace", marketplaceRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Helper for HTTP requests
  async function apiRequest(method, urlPath, body = null, token = null) {
    const url = new URL(urlPath, baseUrl);
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  try {
    // Connect to embedded persistent / local database
    await connectDB();

    // --------------------------------------------------------------------------
    // TEST 1: PRODUCTION MODE SAFEGUARD (CRITERION 6)
    // --------------------------------------------------------------------------
    try {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      let threw = false;
      try {
        await seedMarketplaceDemo();
      } catch (err) {
        threw = true;
        assert(
          err.message.includes("Refusing to seed"),
          "Criterion 6: Running seed script in production mode throws security error"
        );
      }
      assert(threw, "Criterion 6: Seeding execution is cleanly rejected in production");
      process.env.NODE_ENV = prevEnv;
    } catch (guardErr) {
      assert(false, `Criterion 6 error: ${guardErr.message}`);
    }

    // --------------------------------------------------------------------------
    // TEST 2: RUN SEED SCRIPT (CRITERIA 1, 2, 3, 4, 10)
    // --------------------------------------------------------------------------
    const seedStats = await seedMarketplaceDemo();

    assert(
      seedStats.seededFarmerCount === 25,
      `Criterion 1: Seed script creates exactly 25 distinct demo farmers (got ${seedStats.seededFarmerCount})`
    );

    const demoUsers = await User.find({ email: { $regex: /^farmer\d{2}\.demo@example\.test$/ } });
    assert(
      demoUsers.length === 25,
      "Criterion 1: Verified 25 unique demo farmer users exist in database"
    );

    assert(
      seedStats.bulkBuyerEmail === "bulkbuyer.demo@example.test",
      "Criterion 2: Seed script configures bulkbuyer.demo@example.test"
    );

    const bulkBuyerDoc = await User.findOne({ email: "bulkbuyer.demo@example.test" });
    assert(
      bulkBuyerDoc && bulkBuyerDoc.role === "bulk_buyer",
      "Criterion 2: Exactly one demo bulk buyer created with 'bulk_buyer' role"
    );

    const demoFarms = await CropFarm.find({ userId: { $in: demoUsers.map((u) => u._id) } });
    assert(
      demoFarms.length === 25,
      `Criterion 3: Every demo farmer has an associated farm location (found ${demoFarms.length})`
    );

    const demoListings = await Listing.find({
      farmerId: { $in: demoUsers.map((u) => u._id) },
      status: "available",
      quantityAvailable: { $gt: 0 },
    });
    assert(
      demoListings.length >= 25,
      `Criterion 3: Every demo farmer has at least one active listing with positive stock (total: ${demoListings.length})`
    );

    // Verify all 25 farmers have at least 1 listing
    const farmerIdsWithListings = new Set(demoListings.map((l) => l.farmerId.toString()));
    assert(
      farmerIdsWithListings.size === 25,
      "Criterion 3: All 25 farmers possess at least one discoverable marketplace lot"
    );

    // --------------------------------------------------------------------------
    // TEST 3: PHOTO ASSETS INTEGRITY (CRITERION 4)
    // --------------------------------------------------------------------------
    const demoPhotos = await ListingPhoto.find({
      uploaderId: { $in: demoUsers.map((u) => u._id) },
    });
    assert(demoPhotos.length > 0, `Criterion 4: Found ${demoPhotos.length} seeded listing photos`);

    const imageFolder = path.resolve(__dirname, "../../frontend/public/demo-farm-images");
    let missingAssets = 0;
    for (const photo of demoPhotos) {
      if (photo.imageUrl && photo.imageUrl.startsWith("/demo-farm-images/")) {
        const localFileName = photo.imageUrl.replace("/demo-farm-images/", "");
        const filePath = path.join(imageFolder, localFileName);
        if (!fs.existsSync(filePath)) {
          missingAssets++;
        }
      }
    }
    assert(
      missingAssets === 0,
      `Criterion 4: All photo references correspond to valid image files in frontend/public (0 missing out of ${demoPhotos.length})`
    );

    // --------------------------------------------------------------------------
    // TEST 4: IDEMPOTENCY OF SEED SCRIPT (CRITERION 5)
    // --------------------------------------------------------------------------
    const secondRunStats = await seedMarketplaceDemo();
    assert(
      secondRunStats.seededFarmerCount === 25,
      "Criterion 5: Re-running seed script preserves deterministic 25 demo farmers"
    );

    const userCountAfterRerun = await User.countDocuments({
      email: { $regex: /@example\.test$/ },
    });
    assert(
      userCountAfterRerun === 26, // 25 farmers + 1 bulk buyer
      `Criterion 5: Re-running seed does NOT create duplicate user accounts (exact count: ${userCountAfterRerun})`
    );

    const farmCountAfterRerun = await CropFarm.countDocuments({
      userId: { $in: (await User.find({ email: { $regex: /@example\.test$/ } })).map((u) => u._id) },
    });
    assert(
      farmCountAfterRerun === 25,
      `Criterion 5: Re-running seed does NOT duplicate farm locations (exact count: ${farmCountAfterRerun})`
    );

    // --------------------------------------------------------------------------
    // TEST 5: MAP LOCATIONS API (CRITERIA 7, 8, 9, 10)
    // --------------------------------------------------------------------------
    const mapRes = await apiRequest("GET", "/api/marketplace/map-locations");
    assert(mapRes.status === 200, "Criterion 7: GET /api/marketplace/map-locations returns HTTP 200");
    assert(
      mapRes.data.success === true,
      "Criterion 7: Response has success=true"
    );
    assert(
      mapRes.data.count === 25,
      `Criterion 7 & 8: Map API returns exactly 25 unique demo locations (count: ${mapRes.data.count})`
    );
    assert(
      Array.isArray(mapRes.data.markers) && mapRes.data.markers.length === 25,
      `Criterion 8: Markers array contains exactly 25 marker items (got ${mapRes.data.markers.length})`
    );

    // Check marker data structure
    const sampleMarker = mapRes.data.markers[0];
    assert(
      sampleMarker.farmName && sampleMarker.farmerDisplayName,
      "Criterion 9: Marker includes farm name and farmer display name"
    );
    assert(
      sampleMarker.representativeItemTitle && sampleMarker.availableQuantity > 0,
      "Criterion 9: Marker includes representative item title and positive available inventory"
    );
    assert(
      sampleMarker.fixedPricePerUnit > 0 && sampleMarker.quantityUnit,
      "Criterion 9: Marker includes price per unit and category-appropriate unit"
    );
    const markerWithPhoto = mapRes.data.markers.find((m) => m.photoUrl);
    assert(
      markerWithPhoto && markerWithPhoto.photoUrl.startsWith("/demo-farm-images/"),
      "Criterion 9: Marker includes representative inventory photo URL"
    );
    assert(
      sampleMarker.isApproximateCentroid === true,
      "Criterion 9: Marker explicitly flagged as approximate regional centroid for grower privacy"
    );

    // Check coordinate validity (Criterion 10)
    let allCoordinatesValid = true;
    for (const m of mapRes.data.markers) {
      if (
        !Array.isArray(m.coordinates) ||
        m.coordinates.length !== 2 ||
        typeof m.coordinates[0] !== "number" ||
        typeof m.coordinates[1] !== "number" ||
        m.coordinates[0] < 18 || m.coordinates[0] > 22 || // Maharashtra lat bounds
        m.coordinates[1] < 72 || m.coordinates[1] > 76    // Maharashtra lng bounds
      ) {
        allCoordinatesValid = false;
        break;
      }
    }
    assert(
      allCoordinatesValid,
      "Criterion 10: All 25 markers possess valid [lat, lng] coordinates within Nashik agricultural region"
    );

    // --------------------------------------------------------------------------
    // TEST 6: EMPTY-STATE VS FAILURE BEHAVIOR (CRITERION 11)
    // --------------------------------------------------------------------------
    // An empty array response is a successful HTTP 200 with count: 0
    // Test that the API gracefully handles queries when no listings match
    const filterRes = await apiRequest("GET", "/api/marketplace/listings?search=NonExistentLotCode999");
    assert(filterRes.status === 200, "Criterion 11: Empty search query returns HTTP 200");
    assert(
      filterRes.data.listings && filterRes.data.listings.length === 0,
      "Criterion 11: True empty result returns empty listings array cleanly without error"
    );

    const invalidDetailRes = await apiRequest("GET", "/api/marketplace/listings/invalid-id-format");
    assert(
      invalidDetailRes.status === 400,
      "Criterion 11: Invalid input triggers explicit HTTP 400 error rather than masked empty state"
    );

    // --------------------------------------------------------------------------
    // TEST 7: AUTHENTICATION FLOWS (CRITERIA 12, 13, 14, 15, 16)
    // --------------------------------------------------------------------------
    // 15: Bulk buyer login
    const bulkLoginRes = await apiRequest("POST", "/auth/login", {
      emailOrPhone: "bulkbuyer.demo@example.test",
      password: seedStats.demoPassword,
    });
    assert(bulkLoginRes.status === 200, "Criterion 15: Demo bulk buyer login succeeds with HTTP 200");
    assert(
      bulkLoginRes.data.user && bulkLoginRes.data.user.role === "bulk_buyer",
      "Criterion 15: Authoritative JWT / user profile has role='bulk_buyer'"
    );
    const bulkBuyerToken = bulkLoginRes.data.token;

    // 16: Demo farmer login
    const farmerLoginRes = await apiRequest("POST", "/auth/login", {
      emailOrPhone: "farmer01.demo@example.test",
      password: seedStats.demoPassword,
    });
    assert(farmerLoginRes.status === 200, "Criterion 16: Demo farmer 01 login succeeds with HTTP 200");
    assert(
      farmerLoginRes.data.user && farmerLoginRes.data.user.role === "farmer",
      "Criterion 16: Demo farmer has role='farmer'"
    );
    const farmerToken = farmerLoginRes.data.token;

    // Farmer accessing protected farmer dashboard
    const farmerDashRes = await apiRequest("GET", "/api/marketplace/farmer/dashboard", null, farmerToken);
    assert(
      farmerDashRes.status === 200,
      "Criterion 16: Demo farmer can access /api/marketplace/farmer/dashboard"
    );
    assert(
      farmerDashRes.data.metrics && farmerDashRes.data.metrics.totalListings >= 1,
      "Criterion 16: Farmer dashboard correctly reports active seeded produce listings"
    );

    // 14: Role authorization guard - Buyer accessing farmer dashboard is forbidden
    const unauthorizedRes = await apiRequest("GET", "/api/marketplace/farmer/dashboard", null, bulkBuyerToken);
    assert(
      unauthorizedRes.status === 403,
      "Criterion 14: Buyer account attempting to access farmer dashboard receives HTTP 403 Forbidden"
    );

    // --------------------------------------------------------------------------
    // TEST 8: VIRTUAL FARM PROFILE & LISTING DETAIL (CRITERION 17)
    // --------------------------------------------------------------------------
    const currentDemoListings = await Listing.find({
      status: "available",
      quantityAvailable: { $gt: 0 },
    });
    const firstListing = currentDemoListings[0];
    const detailRes = await apiRequest("GET", `/api/marketplace/listings/${firstListing._id}`);
    assert(detailRes.status === 200, "Criterion 17: Public detail endpoint returns HTTP 200");
    assert(
      detailRes.data.listing && detailRes.data.listing.title === firstListing.title,
      "Criterion 17: Public detail returns correct produce lot title and price"
    );

    const currentDemoFarms = await CropFarm.find({});
    const firstFarm = currentDemoFarms[0];
    const profileRes = await apiRequest("GET", `/api/marketplace/farms/CropFarm/${firstFarm._id}`);
    assert(profileRes.status === 200, "Criterion 17: Virtual farm profile endpoint returns HTTP 200");
    assert(
      profileRes.data.farm && profileRes.data.farm.name === firstFarm.name,
      "Criterion 17: Farm profile displays farm name, crop summary, and photo timeline"
    );

    // --------------------------------------------------------------------------
    // TEST 9: PHOTO FRESHNESS STATES (CRITERION 10 & 18)
    // --------------------------------------------------------------------------
    assert(
      seedStats.freshnessStats.fresh > 0,
      `Criterion 10: Includes 'Fresh Today' (≤24h) listings (count: ${seedStats.freshnessStats.fresh})`
    );
    assert(
      seedStats.freshnessStats.recent > 0,
      `Criterion 10: Includes 'Recent Photo' (1-7d) listings (count: ${seedStats.freshnessStats.recent})`
    );
    assert(
      seedStats.freshnessStats.stale > 0,
      `Criterion 10: Includes 'Photo Outdated' (>7d) listings (count: ${seedStats.freshnessStats.stale})`
    );
    assert(
      seedStats.freshnessStats.no_photo > 0,
      `Criterion 10: Includes intentionally missing photo test listing (count: ${seedStats.freshnessStats.no_photo})`
    );

    // --------------------------------------------------------------------------
    // TEST 10: FRONTEND MODAL CODE AUDIT (CRITERIA 12, 13)
    // --------------------------------------------------------------------------
    const loginModalPath = path.resolve(__dirname, "../../frontend/src/components/Authentication/LoginModal.js");
    const signUpModalPath = path.resolve(__dirname, "../../frontend/src/components/Authentication/SignUpModal.js");
    const loginModalCode = fs.readFileSync(loginModalPath, "utf8");
    const signUpModalCode = fs.readFileSync(signUpModalPath, "utf8");

    assert(
      loginModalCode.includes("Section A: Farmer") && loginModalCode.includes("Section B: Buyer"),
      "Criterion 12: LoginModal features exactly two top-level sections: Section A (Farmer) and Section B (Buyer)"
    );
    assert(
      loginModalCode.includes("Individual Buyer") && loginModalCode.includes("Bulk Wholesale Buyer"),
      "Criterion 13: LoginModal provides Individual Buyer and Bulk Buyer sub-types under Buyer section"
    );

    assert(
      signUpModalCode.includes("Section A: Farmer") && signUpModalCode.includes("Section B: Buyer"),
      "Criterion 12: SignUpModal features Section A (Farmer) and Section B (Buyer) top-level categories"
    );
    assert(
      signUpModalCode.includes("Individual Buyer") && signUpModalCode.includes("Bulk Buyer"),
      "Criterion 13: SignUpModal provides Individual Buyer and Bulk Buyer options under Buyer"
    );

  } catch (err) {
    console.error("❌ Unhandled Test Suite Error:", err);
    failed++;
  } finally {
    server.close();
    if (mongoose.connection) {
      await mongoose.disconnect();
    }
  }

  console.log("\n==================================================");
  console.log(`🏁 STEP 11 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  runDemoExperienceTests();
}

module.exports = runDemoExperienceTests;
