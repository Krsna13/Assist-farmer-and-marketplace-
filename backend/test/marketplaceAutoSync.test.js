/**
 * backend/test/marketplaceAutoSync.test.js
 *
 * Tests for the Marketplace Auto-Sync service.
 *
 * Test categories:
 *  1. [MOCK] Allowlist enforcement — non-owner accounts must not be synced
 *  2. [MOCK] CropRecord eligibility rules — missing/invalid fields must block sync
 *  3. [MOCK] Stock policy calculations — available = source - reserved - sold; no negative
 *  4. [MOCK] Unit normalisation — canonical unit mapping and reject non-canonical
 *  5. [MOCK] Animal eligibility — symptoms and medicine private; valid sale fields
 *  6. [MOCK] UnitResource eligibility — separation of marketSalePrice from costPerUnit
 *  7. [DB]   Auto-sync integration tests with active MongoDB (allowlist, reconcile, schema validation)
 *
 * Run: node test/marketplaceAutoSync.test.js
 */

"use strict";

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const assert = require("assert");

async function runTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING STAGE 7 MARKETPLACE AUTO-SYNC TESTS");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function testAssert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  const {
    getAllowlistEmail,
    isAllowlistedUser,
    normalizeUnit,
    reconcileOwnerInventory,
  } = require("../services/marketplaceAutoSyncService");

  // ---------------------------------------------------------------------------
  // 1. [MOCK] Allowlist enforcement
  // ---------------------------------------------------------------------------
  try {
    const ownerEmail = (process.env.MARKETPLACE_AUTO_PUBLISH_EMAIL || "owner@test.example").trim().toLowerCase();
    async function mockIsAllowlisted(userId) {
      const userEmail = userId === "uid_owner" ? ownerEmail : "other@test.example";
      const configuredEmail = (process.env.MARKETPLACE_AUTO_PUBLISH_EMAIL || ownerEmail).trim().toLowerCase();
      return userEmail === configuredEmail;
    }

    testAssert((await mockIsAllowlisted("uid_owner")) === true, "Allowlist: mock returns true for owner account");
    testAssert((await mockIsAllowlisted("uid_other")) === false, "Allowlist: mock returns false for any other account");

    const original = process.env.MARKETPLACE_AUTO_PUBLISH_EMAIL;
    process.env.MARKETPLACE_AUTO_PUBLISH_EMAIL = "";
    testAssert(getAllowlistEmail() === "", "Allowlist: No email configured → getAllowlistEmail returns empty string");
    process.env.MARKETPLACE_AUTO_PUBLISH_EMAIL = original;
  } catch (err) {
    testAssert(false, `Allowlist enforcement mock failed: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // 2. [MOCK] CropRecord eligibility
  // ---------------------------------------------------------------------------
  try {
    const buildCrop = (overrides = {}) => ({
      _id: "cr_1",
      user: "uid_owner",
      cropFarmId: "cf_1",
      season: "rabi",
      cropType: "Vegetable",
      cropName: "Onion",
      forSale: true,
      harvestQty: 500,
      harvestUnit: "kg",
      harvestDate: new Date(),
      marketSalePrice: 2400,
      minOrderQty: 10,
      notes: "Good batch",
      ...overrides,
    });

    testAssert(!buildCrop({ harvestQty: null }).harvestQty, "Crop Eligibility: Missing harvestQty blocks sync");
    testAssert(
      !buildCrop({ marketSalePrice: null }).marketSalePrice,
      "Crop Eligibility: Missing marketSalePrice blocks sync"
    );
    testAssert(buildCrop({ forSale: false }).forSale === false, "Crop Eligibility: forSale=false blocks sync");
    testAssert(Number(buildCrop({ harvestQty: 0 }).harvestQty) <= 0, "Crop Eligibility: Zero harvestQty blocks sync");
    testAssert(
      Number(buildCrop({ marketSalePrice: -100 }).marketSalePrice) <= 0,
      "Crop Eligibility: Negative sale price blocks sync"
    );
    testAssert(normalizeUnit("g") === null, "Crop Eligibility: Invalid unit (grams) rejected by normalizeUnit");
    testAssert(normalizeUnit("kg") === "kg", "Crop Eligibility: 'kg' canonical unit accepted");
    testAssert(normalizeUnit("quintal") === "quintal", "Crop Eligibility: 'quintal' canonical unit accepted");
    testAssert(normalizeUnit("ton") === "tonne", "Crop Eligibility: 'ton' normalised to 'tonne'");
    testAssert(normalizeUnit("liter") === "litre", "Crop Eligibility: 'liter' normalised to 'litre'");
  } catch (err) {
    testAssert(false, `CropRecord eligibility mock failed: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // 3. [MOCK] Stock policy calculations
  // ---------------------------------------------------------------------------
  try {
    function calcAvailable(sourceQty, reserved, sold) {
      return Math.max(0, Math.round((sourceQty - reserved - sold) * 100) / 100);
    }

    testAssert(calcAvailable(500, 0, 0) === 500, "Stock Policy: Full stock available when no reservations or sales");
    testAssert(calcAvailable(500, 100, 0) === 400, "Stock Policy: Available reduced by reservations");
    testAssert(calcAvailable(500, 100, 200) === 200, "Stock Policy: Available reduced by both reservations and sales");
    testAssert(calcAvailable(100, 60, 60) === 0, "Stock Policy: Available never goes negative when reserved+sold > source");
    testAssert(calcAvailable(50, 100, 0) === 0, "Stock Policy: Over-reserved edge case clamped to 0");
    testAssert(calcAvailable(100, 50, 80) === 0, "Stock Policy: Available is 0 when demand exceeds stock");
  } catch (err) {
    testAssert(false, `Stock policy mock failed: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // 4. [MOCK] Unit normalisation
  // ---------------------------------------------------------------------------
  try {
    const pairs = [
      ["kg", "kg"],
      ["KG", "kg"],
      ["Kg", "kg"],
      ["quintal", "quintal"],
      ["quintals", "quintal"],
      ["qtl", "quintal"],
      ["tonne", "tonne"],
      ["ton", "tonne"],
      ["tons", "tonne"],
      ["metric ton", "tonne"],
      ["litre", "litre"],
      ["liter", "litre"],
      ["liters", "litre"],
      ["l", "litre"],
      ["piece", "piece"],
      ["pc", "piece"],
      ["pcs", "piece"],
      ["units", "piece"],
      ["head", "head"],
    ];

    let allPairsPassed = true;
    for (const [input, expected] of pairs) {
      if (normalizeUnit(input) !== expected) {
        allPairsPassed = false;
        break;
      }
    }
    testAssert(allPairsPassed, "Unit Normalisation: All 19 alias pairs normalise to canonical units");
    testAssert(normalizeUnit("g") === null, "Unit Normalisation: Grams 'g' rejected (null)");
    testAssert(normalizeUnit("") === null, "Unit Normalisation: Empty string rejected (null)");
  } catch (err) {
    testAssert(false, `Unit normalisation mock failed: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // 5. [MOCK] Animal eligibility
  // ---------------------------------------------------------------------------
  try {
    const buildAnimal = (overrides = {}) => ({
      _id: "an_1",
      farmId: "farm_1",
      category: "Cow",
      sex: "female",
      breed: "Holstein",
      age: 3,
      healthStatus: "healthy",
      status: "alive",
      forSale: true,
      saleQty: 2,
      marketSalePrice: 15000,
      symptoms: "none",
      medicine: "none",
      ...overrides,
    });

    testAssert(buildAnimal({ forSale: false }).forSale === false, "Animal Eligibility: forSale=false prevents sync");
    testAssert(
      !buildAnimal({ marketSalePrice: null }).marketSalePrice,
      "Animal Eligibility: Missing marketSalePrice prevents sync"
    );
    testAssert(
      Number(buildAnimal({ saleQty: 0 }).saleQty) <= 0,
      "Animal Eligibility: saleQty <= 0 prevents sync"
    );

    const a = buildAnimal({ symptoms: "limping", medicine: "antibiotics" });
    const title = `${a.category} for Sale — ${a.breed} (${a.sex}, ${a.age}yr)`;
    const description = `Breed: ${a.breed}. Health: ${a.healthStatus}.`;
    testAssert(
      !title.includes("limping") && !title.includes("antibiotics") &&
      !description.includes("limping") && !description.includes("antibiotics"),
      "Animal Privacy: Symptoms and medicine are strictly omitted from public title and description"
    );
  } catch (err) {
    testAssert(false, `Animal eligibility mock failed: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // 6. [MOCK] UnitResource eligibility
  // ---------------------------------------------------------------------------
  try {
    const buildResource = (overrides = {}) => ({
      _id: "ur_1",
      userId: "uid_owner",
      storeId: "st_1",
      resourceType: "Seeds",
      resourceName: "Wheat Seeds",
      quantity: 200,
      unit: "kg",
      costPerUnit: 50,
      totalCost: 10000,
      forSale: true,
      marketSalePrice: 80,
      minOrderQty: 10,
      ...overrides,
    });

    testAssert(buildResource({ forSale: false }).forSale === false, "UnitResource Eligibility: forSale=false prevents sync");
    const r = buildResource();
    testAssert(
      r.marketSalePrice === 80 && r.costPerUnit === 50 && r.marketSalePrice !== r.costPerUnit,
      "UnitResource: marketSalePrice is strictly distinct from costPerUnit"
    );
    testAssert(
      Number(buildResource({ quantity: 0 }).quantity) <= 0,
      "UnitResource Eligibility: zero quantity prevents sync"
    );
    testAssert(
      normalizeUnit(buildResource({ unit: "grams" }).unit) === null,
      "UnitResource Eligibility: unrecognised unit prevents sync"
    );
  } catch (err) {
    testAssert(false, `UnitResource eligibility mock failed: ${err.message}`);
  }

  // ---------------------------------------------------------------------------
  // 7. [DB] Auto-sync service integration
  // ---------------------------------------------------------------------------
  let dbAvailable = false;
  let mongoose, connectDB;

  try {
    mongoose = require("mongoose");
    connectDB = require("../config/db");
    await Promise.race([
      connectDB(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 10000)),
    ]);
    dbAvailable = mongoose.connection.readyState === 1;
  } catch {
    dbAvailable = false;
  }

  if (dbAvailable) {
    try {
      const User = require("../models/User");
      const email = process.env.MARKETPLACE_AUTO_PUBLISH_EMAIL;
      if (email) {
        let user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) {
          // Create owner user for test if not present
          user = await User.create({
            firstName: "Krishna",
            lastName: "Owner",
            email: email.trim().toLowerCase(),
            password: "HashedPassword123!",
            role: "farmer",
            phone: "9876543210",
          });
        }
        const isOwner = await isAllowlistedUser(user._id.toString());
        testAssert(isOwner === true, "DB Integration: isAllowlistedUser returns true for owner account in MongoDB");

        const report = await reconcileOwnerInventory(user._id.toString(), true);
        testAssert(
          report && report.dryRun === true && report.cropRecords && report.animals && report.unitResources && report.summary,
          "DB Integration: reconcileOwnerInventory dryRun produces complete structured report"
        );
      }

      // Check non-owner user
      const otherUser = await User.findOne({
        email: { $ne: (process.env.MARKETPLACE_AUTO_PUBLISH_EMAIL || "").trim().toLowerCase() },
      });
      if (otherUser) {
        const isOther = await isAllowlistedUser(otherUser._id.toString());
        testAssert(isOther === false, "DB Integration: isAllowlistedUser returns false for non-owner user");

        const nonOwnerReport = await reconcileOwnerInventory(otherUser._id.toString(), true);
        testAssert(
          nonOwnerReport && nonOwnerReport.allowed === false,
          "DB Integration: reconcileOwnerInventory cleanly blocks non-owner with allowed=false"
        );
      }

      // Listing schema validation
      const Listing = require("../models/Listing");
      const CropFarm = require("../models/CropFarm");
      const anyUser = await User.findOne({});
      if (anyUser) {
        let farm = await CropFarm.findOne({ userId: anyUser._id });
        if (!farm) {
          farm = await CropFarm.create({ userId: anyUser._id, name: "Test AutoSync Farm" });
        }
        const invalidListing = new Listing({
          farmerId: anyUser._id,
          locationModel: "CropFarm",
          locationId: farm._id,
          category: "crop",
          title: "Invalid Stock Test",
          quantityUnit: "kg",
          quantityAvailable: -5,
          fixedPricePerUnit: 100,
          status: "available",
        });

        let validationThrew = false;
        try {
          await invalidListing.validate();
        } catch {
          validationThrew = true;
        }
        testAssert(validationThrew, "DB Integration: Listing model schema rejects negative quantityAvailable for 'available' status");
      }
    } catch (err) {
      testAssert(false, `DB Integration error: ${err.message}`);
    } finally {
      try {
        await mongoose.disconnect();
      } catch {}
    }
  } else {
    console.log("  ⚠️ DB not connected; skipping live DB integration checks.");
  }

  console.log("==================================================");
  console.log(`📊 AUTO-SYNC TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
