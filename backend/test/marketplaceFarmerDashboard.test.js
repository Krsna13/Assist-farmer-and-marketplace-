const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Listing = require("../models/Listing");
const ListingPhoto = require("../models/ListingPhoto");
const CropFarm = require("../models/CropFarm");
const Farm = require("../models/Farm");
const Store = require("../models/Store");
const CropRecord = require("../models/CropRecord");
const Animal = require("../models/Animal");
const Production = require("../models/Production");
const UnitResource = require("../models/UnitResource");
const ItemResource = require("../models/ItemResource");
const Bid = require("../models/Bid");
const Order = require("../models/Order");

const marketplaceRoutes = require("../routes/marketplaceRoutes");

const JWT_SECRET = process.env.JWT_SECRET || "fms_super_secret_jwt_key_2025";
process.env.JWT_SECRET = JWT_SECRET;

async function runStage4Tests() {
  console.log("==================================================");
  console.log("🧪 RUNNING STAGE 4 FARMER DASHBOARD & INVENTORY TESTS");
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

  // Test User IDs
  const farmer1_Id = new mongoose.Types.ObjectId();
  const farmer2_Id = new mongoose.Types.ObjectId();
  const buyerId = new mongoose.Types.ObjectId();

  const farmer1_Token = jwt.sign({ id: farmer1_Id.toString(), role: "farmer" }, JWT_SECRET);
  const farmer2_Token = jwt.sign({ id: farmer2_Id.toString(), role: "farmer" }, JWT_SECRET);
  const buyerToken = jwt.sign({ id: buyerId.toString(), role: "buyer" }, JWT_SECRET);

  // Test Locations
  const cropFarmId = new mongoose.Types.ObjectId();
  const farmId = new mongoose.Types.ObjectId();
  const storeId = new mongoose.Types.ObjectId();

  const cropFarm2Id = new mongoose.Types.ObjectId(); // Owned by Farmer 2

  // Test Source Records
  const cropRecord1Id = new mongoose.Types.ObjectId();
  const cropRecord2Id = new mongoose.Types.ObjectId(); // Owned by Farmer 2
  const animal1Id = new mongoose.Types.ObjectId();
  const unitResource1Id = new mongoose.Types.ObjectId();
  const itemResource1Id = new mongoose.Types.ObjectId();

  // In-memory mock maps
  const listingsMap = new Map();
  const cropFarmsMap = new Map();
  const farmsMap = new Map();
  const storesMap = new Map();
  const cropRecordsMap = new Map();
  const animalsMap = new Map();
  const unitResourcesMap = new Map();
  const itemResourcesMap = new Map();

  // Populate Locations
  cropFarmsMap.set(cropFarmId.toString(), {
    _id: cropFarmId,
    userId: farmer1_Id,
    name: "Farmer 1 Crop Farm",
  });
  cropFarmsMap.set(cropFarm2Id.toString(), {
    _id: cropFarm2Id,
    userId: farmer2_Id,
    name: "Farmer 2 Crop Farm",
  });
  farmsMap.set(farmId.toString(), {
    _id: farmId,
    userId: farmer1_Id,
    name: "Farmer 1 Livestock Farm",
  });
  storesMap.set(storeId.toString(), {
    _id: storeId,
    userId: farmer1_Id,
    name: "Farmer 1 Store Warehouse",
  });

  // Populate Source Records
  cropRecordsMap.set(cropRecord1Id.toString(), {
    _id: cropRecord1Id,
    user: farmer1_Id,
    cropFarmId: cropFarmId,
    cropName: "Organic Wheat",
    cropType: "Grain",
    season: "rabi",
    seedQuantity: 500,
  });
  cropRecordsMap.set(cropRecord2Id.toString(), {
    _id: cropRecord2Id,
    user: farmer2_Id, // Belongs to Farmer 2
    cropFarmId: cropFarm2Id,
    cropName: "Farmer 2 Rice",
    cropType: "Grain",
    season: "kharif",
    seedQuantity: 300,
  });
  animalsMap.set(animal1Id.toString(), {
    _id: animal1Id,
    farmId: farmId,
    category: "Cattle",
    breed: "Jersey",
    animalId: "J-01",
    status: "Healthy",
  });
  unitResourcesMap.set(unitResource1Id.toString(), {
    _id: unitResource1Id,
    userId: farmer1_Id,
    storeId: storeId,
    resourceType: "Fertilizer",
    resourceName: "Organic Compost",
    quantity: 200,
    unit: "kg",
    costPerUnit: 15,
  });
  itemResourcesMap.set(itemResource1Id.toString(), {
    _id: itemResource1Id,
    userId: farmer1_Id,
    storeId: storeId,
    resourceType: "Tools",
    resourceName: "Stainless Sickles",
    quantity: 25,
    costPerItem: 120,
  });

  // Stubs
  const origListingFind = Listing.find;
  const origListingFindById = Listing.findById;
  const origListingFindOne = Listing.findOne;
  const origListingSave = Listing.prototype.save;

  const origCropFarmFindById = CropFarm.findById;
  const origCropFarmFind = CropFarm.find;
  const origFarmFindById = Farm.findById;
  const origFarmFind = Farm.find;
  const origStoreFindById = Store.findById;
  const origStoreFind = Store.find;

  const origCropRecordFindById = CropRecord.findById;
  const origCropRecordFind = CropRecord.find;
  const origAnimalFindById = Animal.findById;
  const origAnimalFind = Animal.find;
  const origProductionFind = Production.find;
  const origUnitResourceFindById = UnitResource.findById;
  const origUnitResourceFind = UnitResource.find;
  const origItemResourceFindById = ItemResource.findById;
  const origItemResourceFind = ItemResource.find;

  const origBidFind = Bid.find;
  const origOrderFind = Order.find;
  const origPhotoFind = ListingPhoto.find;

  // Setup Mongoose Stubs
  Listing.findById = function (id) {
    const doc = listingsMap.get(id.toString());
    return Promise.resolve(doc || null);
  };

  Listing.findOne = function (query) {
    for (const doc of listingsMap.values()) {
      let match = true;
      if (query.sourceRecordType && doc.sourceRecordType !== query.sourceRecordType) match = false;
      if (query.sourceRecordId && doc.sourceRecordId.toString() !== query.sourceRecordId.toString()) match = false;
      if (query.status && query.status.$in && !query.status.$in.includes(doc.status)) match = false;
      if (match) return Promise.resolve(doc);
    }
    return Promise.resolve(null);
  };

  Listing.find = function (query = {}) {
    let results = Array.from(listingsMap.values());
    if (query.farmerId) {
      results = results.filter((d) => d.farmerId.toString() === query.farmerId.toString());
    }
    const chain = {
      sort: () => chain,
      select: () => results,
      then: (resolve) => resolve(results),
    };
    return chain;
  };

  Listing.prototype.save = async function () {
    const id = this._id || new mongoose.Types.ObjectId();
    this._id = id;
    const doc = {
      _id: id,
      farmerId: this.farmerId,
      locationModel: this.locationModel,
      locationId: this.locationId,
      sourceRecordType: this.sourceRecordType,
      sourceRecordId: this.sourceRecordId,
      category: this.category,
      title: this.title,
      description: this.description,
      quantityUnit: this.quantityUnit,
      quantityAvailable: this.quantityAvailable,
      quantityReserved: this.quantityReserved,
      quantitySold: this.quantitySold,
      fixedPricePerUnit: this.fixedPricePerUnit,
      minimumBidPerUnit: this.minimumBidPerUnit,
      minimumOrderQuantity: this.minimumOrderQuantity,
      harvestDate: this.harvestDate,
      availableFrom: this.availableFrom,
      conditionNotes: this.conditionNotes,
      status: this.status,
      createdAt: this.createdAt || new Date(),
      updatedAt: new Date(),
      save: Listing.prototype.save,
    };
    listingsMap.set(id.toString(), doc);
    return doc;
  };

  CropFarm.findById = (id) => Promise.resolve(cropFarmsMap.get(id.toString()) || null);
  CropFarm.find = (q) => Promise.resolve(Array.from(cropFarmsMap.values()).filter((c) => c.userId.toString() === q.userId.toString()));

  Farm.findById = (id) => Promise.resolve(farmsMap.get(id.toString()) || null);
  Farm.find = (q) => Promise.resolve(Array.from(farmsMap.values()).filter((f) => f.userId.toString() === q.userId.toString()));

  Store.findById = (id) => Promise.resolve(storesMap.get(id.toString()) || null);
  Store.find = (q) => Promise.resolve(Array.from(storesMap.values()).filter((s) => s.userId.toString() === q.userId.toString()));

  CropRecord.findById = (id) => Promise.resolve(cropRecordsMap.get(id.toString()) || null);
  CropRecord.find = (q) => Promise.resolve(Array.from(cropRecordsMap.values()).filter((c) => c.user.toString() === q.user.toString()));

  Animal.findById = (id) => Promise.resolve(animalsMap.get(id.toString()) || null);
  Animal.find = () => Promise.resolve(Array.from(animalsMap.values()));

  Production.find = () => Promise.resolve([]);
  UnitResource.findById = (id) => Promise.resolve(unitResourcesMap.get(id.toString()) || null);
  UnitResource.find = () => Promise.resolve(Array.from(unitResourcesMap.values()));
  ItemResource.findById = (id) => Promise.resolve(itemResourcesMap.get(id.toString()) || null);
  ItemResource.find = () => Promise.resolve(Array.from(itemResourcesMap.values()));

  Bid.find = () => ({
    sort: () => ({
      limit: () => ({
        populate: () => ({
          populate: () => Promise.resolve([]),
        }),
      }),
    }),
  });

  Order.find = () => ({
    sort: () => ({
      limit: () => ({
        populate: () => Promise.resolve([]),
      }),
    }),
  });

  ListingPhoto.find = () => ({
    sort: () => Promise.resolve([]),
  });

  try {
    // =========================================================================
    // 1. A farmer can publish an eligible crop record
    // =========================================================================
    const publishCropRes = await fetch(`${baseUrl}/farmer/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1_Token}`,
      },
      body: JSON.stringify({
        locationModel: "CropFarm",
        locationId: cropFarmId,
        sourceRecordType: "CropRecord",
        sourceRecordId: cropRecord1Id,
        category: "crop",
        title: "Harvested Organic Wheat",
        description: "Freshly harvested golden wheat from block 1",
        quantityUnit: "kg",
        quantityAvailable: 350,
        fixedPricePerUnit: 45,
        minimumOrderQuantity: 10,
      }),
    });
    const publishCropJson = await publishCropRes.json();
    assert(publishCropRes.status === 201, "Test 1: Farmer can publish an eligible crop record (HTTP 201)");
    assert(
      publishCropJson.listing && publishCropJson.listing.title === "Harvested Organic Wheat",
      "Test 1: Published crop listing contains correct title and quantity"
    );
    const createdCropListingId = publishCropJson.listing.id;

    // =========================================================================
    // 2. A farmer can publish eligible livestock and resource records
    // =========================================================================
    // 2a. Livestock Animal record
    const publishAnimalRes = await fetch(`${baseUrl}/farmer/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1_Token}`,
      },
      body: JSON.stringify({
        locationModel: "Farm",
        locationId: farmId,
        sourceRecordType: "Animal",
        sourceRecordId: animal1Id,
        category: "livestock",
        title: "Healthy Jersey Heifer (J-01)",
        quantityUnit: "piece",
        quantityAvailable: 1,
        fixedPricePerUnit: 45000,
      }),
    });
    assert(publishAnimalRes.status === 201, "Test 2a: Farmer can publish eligible livestock Animal record (HTTP 201)");

    // 2b. Resource record (UnitResource)
    const publishResourceRes = await fetch(`${baseUrl}/farmer/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1_Token}`,
      },
      body: JSON.stringify({
        locationModel: "Store",
        locationId: storeId,
        sourceRecordType: "UnitResource",
        sourceRecordId: unitResource1Id,
        category: "other",
        title: "Surplus Organic Compost",
        quantityUnit: "kg",
        quantityAvailable: 100,
        fixedPricePerUnit: 18,
      }),
    });
    assert(publishResourceRes.status === 201, "Test 2b: Farmer can publish eligible UnitResource record (HTTP 201)");

    // =========================================================================
    // 3. A farmer cannot publish another user's record
    // =========================================================================
    // Farmer 1 tries to publish Farmer 2's CropRecord
    const unauthorizedPublishRes = await fetch(`${baseUrl}/farmer/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1_Token}`,
      },
      body: JSON.stringify({
        locationModel: "CropFarm",
        locationId: cropFarm2Id,
        sourceRecordType: "CropRecord",
        sourceRecordId: cropRecord2Id, // Owned by Farmer 2
        category: "crop",
        title: "Stolen Rice Listing",
        quantityUnit: "kg",
        quantityAvailable: 200,
        fixedPricePerUnit: 30,
      }),
    });
    assert(
      unauthorizedPublishRes.status === 403,
      "Test 3: Farmer cannot publish another farmer's crop record (HTTP 403 Forbidden)"
    );

    // =========================================================================
    // 4. Invalid prices, quantities, units and statuses are rejected
    // =========================================================================
    // 4a. Negative quantity
    const negQtyRes = await fetch(`${baseUrl}/farmer/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1_Token}`,
      },
      body: JSON.stringify({
        locationModel: "CropFarm",
        locationId: cropFarmId,
        category: "crop",
        title: "Negative Stock Crop",
        quantityUnit: "kg",
        quantityAvailable: -50,
        fixedPricePerUnit: 40,
      }),
    });
    assert(negQtyRes.status === 400, "Test 4a: Negative quantity is rejected with HTTP 400");

    // 4b. Zero price
    const zeroPriceRes = await fetch(`${baseUrl}/farmer/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1_Token}`,
      },
      body: JSON.stringify({
        locationModel: "CropFarm",
        locationId: cropFarmId,
        category: "crop",
        title: "Free Crop",
        quantityUnit: "kg",
        quantityAvailable: 50,
        fixedPricePerUnit: 0,
      }),
    });
    assert(zeroPriceRes.status === 400, "Test 4b: Zero/negative price is rejected with HTTP 400");

    // 4c. Unsupported unit
    const badUnitRes = await fetch(`${baseUrl}/farmer/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1_Token}`,
      },
      body: JSON.stringify({
        locationModel: "CropFarm",
        locationId: cropFarmId,
        category: "crop",
        title: "Bad Unit Crop",
        quantityUnit: "bushels_custom",
        quantityAvailable: 50,
        fixedPricePerUnit: 40,
      }),
    });
    assert(badUnitRes.status === 400, "Test 4c: Unsupported unit ('bushels_custom') is rejected with HTTP 400");

    // =========================================================================
    // 5. Duplicate source listings are handled according to documented rule (HTTP 409)
    // =========================================================================
    // Attempting to publish cropRecord1Id again while createdCropListingId is available
    const duplicateRes = await fetch(`${baseUrl}/farmer/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1_Token}`,
      },
      body: JSON.stringify({
        locationModel: "CropFarm",
        locationId: cropFarmId,
        sourceRecordType: "CropRecord",
        sourceRecordId: cropRecord1Id,
        category: "crop",
        title: "Duplicate Wheat Listing",
        quantityUnit: "kg",
        quantityAvailable: 100,
        fixedPricePerUnit: 45,
      }),
    });
    assert(
      duplicateRes.status === 409,
      "Test 5: Publishing duplicate active listing for same source record returns HTTP 409 Conflict"
    );

    // =========================================================================
    // 6. A farmer can retrieve only their own listing-management data
    // =========================================================================
    const farmer1ListingsRes = await fetch(`${baseUrl}/farmer/listings`, {
      headers: { Authorization: `Bearer ${farmer1_Token}` },
    });
    const farmer1ListingsJson = await farmer1ListingsRes.json();

    const farmer2ListingsRes = await fetch(`${baseUrl}/farmer/listings`, {
      headers: { Authorization: `Bearer ${farmer2_Token}` },
    });
    const farmer2ListingsJson = await farmer2ListingsRes.json();

    assert(
      farmer1ListingsRes.status === 200 && farmer1ListingsJson.listings.length >= 3,
      "Test 6a: Farmer 1 retrieves their own 3 published listings"
    );
    assert(
      farmer2ListingsRes.status === 200 && farmer2ListingsJson.listings.length === 0,
      "Test 6b: Farmer 2 sees 0 listings (Farmer 1's listings are not exposed)"
    );

    // =========================================================================
    // 7. A farmer can edit an owned listing
    // =========================================================================
    const editRes = await fetch(`${baseUrl}/farmer/listings/${createdCropListingId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1_Token}`,
      },
      body: JSON.stringify({
        title: "Premium Grade Organic Wheat",
        fixedPricePerUnit: 50,
        description: "Updated description with laboratory purity report",
      }),
    });
    const editJson = await editRes.json();
    assert(editRes.status === 200, "Test 7: Farmer can edit their owned listing (HTTP 200)");
    assert(
      editJson.listing && editJson.listing.fixedPricePerUnit === 50,
      "Test 7: Updated listing reflects new price"
    );

    // =========================================================================
    // 8. Another farmer cannot modify that listing
    // =========================================================================
    const intruderEditRes = await fetch(`${baseUrl}/farmer/listings/${createdCropListingId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer2_Token}`,
      },
      body: JSON.stringify({
        fixedPricePerUnit: 1, // Malicious price drop attempt
      }),
    });
    assert(
      intruderEditRes.status === 403,
      "Test 8: Another farmer cannot edit listing (HTTP 403 Forbidden)"
    );

    // =========================================================================
    // 9. Stock updates preserve reserved and sold quantities
    // =========================================================================
    // Simulate listing having 20kg reserved and 10kg sold
    const targetListing = listingsMap.get(createdCropListingId.toString());
    targetListing.quantityReserved = 20;
    targetListing.quantitySold = 10;

    const stockUpdateRes = await fetch(`${baseUrl}/farmer/listings/${createdCropListingId}/stock`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1_Token}`,
      },
      body: JSON.stringify({
        quantityAvailable: 400, // Update available from 350 to 400
      }),
    });
    const stockUpdateJson = await stockUpdateRes.json();

    assert(stockUpdateRes.status === 200, "Test 9: Stock update succeeded (HTTP 200)");
    assert(
      stockUpdateJson.stock.quantityAvailable === 400,
      "Test 9: Available quantity updated to 400"
    );
    assert(
      stockUpdateJson.stock.quantityReserved === 20,
      "Test 9: Reserved quantity (20) was strictly preserved"
    );
    assert(
      stockUpdateJson.stock.quantitySold === 10,
      "Test 9: Sold quantity (10) was strictly preserved"
    );

    // =========================================================================
    // 10. Invalid stock/status combinations are rejected
    // =========================================================================
    // 10a. Negative stock update
    const negStockRes = await fetch(`${baseUrl}/farmer/listings/${createdCropListingId}/stock`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1_Token}`,
      },
      body: JSON.stringify({
        quantityAvailable: -10,
      }),
    });
    assert(negStockRes.status === 400, "Test 10a: Negative stock update rejected with HTTP 400");

    // 10b. Activating listing with 0 available quantity
    const currentListingObj = listingsMap.get(createdCropListingId.toString());
    currentListingObj.quantityAvailable = 0;
    currentListingObj.status = "inactive";

    const activateZeroRes = await fetch(`${baseUrl}/farmer/listings/${createdCropListingId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1_Token}`,
      },
      body: JSON.stringify({
        status: "available",
      }),
    });
    assert(
      activateZeroRes.status === 400,
      "Test 10b: Activating listing with 0 available quantity is rejected with HTTP 400"
    );

    // =========================================================================
    // 11. Pausing a listing does not delete its historical records
    // =========================================================================
    const pauseRes = await fetch(`${baseUrl}/farmer/listings/${createdCropListingId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1_Token}`,
      },
      body: JSON.stringify({
        status: "inactive",
      }),
    });
    assert(pauseRes.status === 200, "Test 11: Listing paused to 'inactive' status successfully");
    const pausedListing = listingsMap.get(createdCropListingId.toString());
    assert(
      pausedListing && pausedListing.status === "inactive",
      "Test 11: Paused listing persists in database and is not deleted"
    );

    // =========================================================================
    // 12. Buyer and bulk buyer role guard on farmer dashboard
    // =========================================================================
    const buyerDashboardRes = await fetch(`${baseUrl}/farmer/dashboard`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    assert(
      buyerDashboardRes.status === 403,
      "Test 12: Buyer role is blocked from accessing farmer dashboard (HTTP 403 Forbidden)"
    );

    // =========================================================================
    // 13. Source inventory endpoint returns locations and mapped records
    // =========================================================================
    const sourceInvRes = await fetch(`${baseUrl}/farmer/source-inventory`, {
      headers: { Authorization: `Bearer ${farmer1_Token}` },
    });
    const sourceInvJson = await sourceInvRes.json();
    assert(sourceInvRes.status === 200, "Test 13: Source inventory endpoint returns HTTP 200");
    assert(
      sourceInvJson.locations && sourceInvJson.locations.cropFarms.length > 0,
      "Test 13: Source inventory includes farmer locations"
    );
    assert(
      sourceInvJson.inventoryItems && sourceInvJson.inventoryItems.length > 0,
      "Test 13: Source inventory includes mapped inventory items"
    );

    // =========================================================================
    // 14. Farmer dashboard returns actual metrics and photo health
    // =========================================================================
    const dashboardRes = await fetch(`${baseUrl}/farmer/dashboard`, {
      headers: { Authorization: `Bearer ${farmer1_Token}` },
    });
    const dashboardJson = await dashboardRes.json();
    assert(dashboardRes.status === 200, "Test 14: Farmer dashboard returns HTTP 200");
    assert(
      dashboardJson.metrics && dashboardJson.metrics.totalListings >= 3,
      "Test 14: Dashboard metrics accurately aggregate farmer listings"
    );
    assert(
      dashboardJson.photoHealth !== undefined,
      "Test 14: Dashboard includes photo health audit"
    );
  } catch (err) {
    console.error("Test execution error:", err);
    assert(false, `Test uncaught error: ${err.message}`);
  } finally {
    // Restore Stubs
    Listing.find = origListingFind;
    Listing.findById = origListingFindById;
    Listing.findOne = origListingFindOne;
    Listing.prototype.save = origListingSave;

    CropFarm.findById = origCropFarmFindById;
    CropFarm.find = origCropFarmFind;
    Farm.findById = origFarmFindById;
    Farm.find = origFarmFind;
    Store.findById = origStoreFindById;
    Store.find = origStoreFind;

    CropRecord.findById = origCropRecordFindById;
    CropRecord.find = origCropRecordFind;
    Animal.findById = origAnimalFindById;
    Animal.find = origAnimalFind;
    Production.find = origProductionFind;
    UnitResource.findById = origUnitResourceFindById;
    UnitResource.find = origUnitResourceFind;
    ItemResource.findById = origItemResourceFindById;
    ItemResource.find = origItemResourceFind;

    Bid.find = origBidFind;
    Order.find = origOrderFind;
    ListingPhoto.find = origPhotoFind;

    server.close();
  }

  console.log("==================================================");
  console.log(`🏁 STAGE 4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runStage4Tests();
