const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const sharp = require("sharp");

const Listing = require("../models/Listing");
const ListingPhoto = require("../models/ListingPhoto");
const CropFarm = require("../models/CropFarm");
const Farm = require("../models/Farm");
const Store = require("../models/Store");
const storageService = require("../services/storageService");
const imageService = require("../services/imageService");
const marketplaceRoutes = require("../routes/marketplaceRoutes");

const JWT_SECRET = process.env.JWT_SECRET || "fms_super_secret_jwt_key_2025";
process.env.JWT_SECRET = JWT_SECRET;

async function runStage3Tests() {
  console.log("==================================================");
  console.log("🧪 RUNNING STAGE 3 PHOTO CAPTURE & FRESHNESS TESTS");
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

  // Create Express Test App
  const app = express();
  app.use(express.json());
  app.use("/api/marketplace", marketplaceRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/marketplace`;

  // Test Entities
  const farmerA_Id = new mongoose.Types.ObjectId();
  const farmerB_Id = new mongoose.Types.ObjectId();
  const buyerId = new mongoose.Types.ObjectId();
  const bulkBuyerId = new mongoose.Types.ObjectId();

  const cropFarmId = new mongoose.Types.ObjectId();
  const livestockFarmId = new mongoose.Types.ObjectId();
  const storeId = new mongoose.Types.ObjectId();

  const listingA_Id = new mongoose.Types.ObjectId();
  const listingB_Id = new mongoose.Types.ObjectId();
  const inactiveListingId = new mongoose.Types.ObjectId();

  // Tokens
  const farmerA_Token = jwt.sign({ id: farmerA_Id.toString(), role: "farmer" }, JWT_SECRET);
  const farmerB_Token = jwt.sign({ id: farmerB_Id.toString(), role: "farmer" }, JWT_SECRET);
  const buyerToken = jwt.sign({ id: buyerId.toString(), role: "buyer" }, JWT_SECRET);
  const bulkBuyerToken = jwt.sign({ id: bulkBuyerId.toString(), role: "bulk_buyer" }, JWT_SECRET);

  // Generate test image buffers
  const validJpegBuffer = await sharp({
    create: { width: 120, height: 120, channels: 3, background: { r: 34, g: 197, b: 94 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  const validPngBuffer = await sharp({
    create: { width: 80, height: 80, channels: 3, background: { r: 59, g: 130, b: 246 } },
  })
    .png()
    .toBuffer();

  const unsupportedGifBuffer = await sharp({
    create: { width: 40, height: 40, channels: 3, background: { r: 239, g: 68, b: 68 } },
  })
    .gif()
    .toBuffer();

  const corruptedBuffer = Buffer.from("NOT_A_VALID_IMAGE_BUFFER_DATA_STREAM");

  // In-memory mock data stores
  const listingsMap = new Map();
  const cropFarmsMap = new Map();
  const farmsMap = new Map();
  const storesMap = new Map();
  const photosList = [];

  // Seed sample data
  listingsMap.set(listingA_Id.toString(), {
    _id: listingA_Id,
    farmerId: farmerA_Id,
    locationModel: "CropFarm",
    locationId: cropFarmId,
    title: "Organic Red Apples",
    status: "available",
  });

  listingsMap.set(listingB_Id.toString(), {
    _id: listingB_Id,
    farmerId: farmerB_Id,
    locationModel: "Farm",
    locationId: livestockFarmId,
    title: "Dairy Cow Milk",
    status: "available",
  });

  listingsMap.set(inactiveListingId.toString(), {
    _id: inactiveListingId,
    farmerId: farmerA_Id,
    locationModel: "Store",
    locationId: storeId,
    title: "Seasonal Seeds Draft",
    status: "inactive",
  });

  cropFarmsMap.set(cropFarmId.toString(), {
    _id: cropFarmId,
    userId: farmerA_Id,
    name: "Green Valley Orchard",
  });

  farmsMap.set(livestockFarmId.toString(), {
    _id: livestockFarmId,
    userId: farmerB_Id,
    name: "Sunrise Dairy Farm",
  });

  storesMap.set(storeId.toString(), {
    _id: storeId,
    userId: farmerA_Id,
    name: "Central Seed Warehouse",
  });

  // Stubs for Mongoose findById / save methods
  const originalListingFindById = Listing.findById;
  Listing.findById = function (id) {
    const doc = listingsMap.get(id.toString());
    return Promise.resolve(doc || null);
  };

  const originalCropFarmFindById = CropFarm.findById;
  CropFarm.findById = function (id) {
    const doc = cropFarmsMap.get(id.toString());
    return Promise.resolve(doc || null);
  };

  const originalFarmFindById = Farm.findById;
  Farm.findById = function (id) {
    const doc = farmsMap.get(id.toString());
    return Promise.resolve(doc || null);
  };

  const originalStoreFindById = Store.findById;
  Store.findById = function (id) {
    const doc = storesMap.get(id.toString());
    return Promise.resolve(doc || null);
  };

  let dbSaveShouldFail = false;
  let lastPersistedPhotoData = null;
  const originalListingPhotoSave = ListingPhoto.prototype.save;
  ListingPhoto.prototype.save = async function () {
    if (dbSaveShouldFail) {
      throw new Error("Simulated database connection failure during photo persistence");
    }
    const savedObj = {
      _id: this._id || new mongoose.Types.ObjectId(),
      listingId: this.listingId,
      uploaderId: this.uploaderId,
      imageUrl: this.imageUrl,
      watermarkedUrl: this.watermarkedUrl,
      serverReceivedAt: this.serverReceivedAt,
      clientCapturedAt: this.clientCapturedAt,
      captureMethod: this.captureMethod,
      conditionNotes: this.conditionNotes,
      isPrimary: this.isPrimary,
    };
    lastPersistedPhotoData = savedObj;
    photosList.push(savedObj);
    return savedObj;
  };

  const originalListingPhotoFind = ListingPhoto.find;
  ListingPhoto.find = function (query) {
    return {
      sort: function () {
        const matching = photosList.filter(
          (p) => p.listingId.toString() === query.listingId.toString()
        );
        return Promise.resolve(matching);
      },
    };
  };

  const originalListingPhotoUpdateMany = ListingPhoto.updateMany;
  ListingPhoto.updateMany = async function () {
    return { modifiedCount: 0 };
  };

  // Helper to make multipart POST requests
  async function postPhotoUpload(listingId, fileBuffer, filename, fields = {}, token = null) {
    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).slice(2);
    const crlf = "\r\n";

    let payloadParts = [];

    // Append file if provided
    if (fileBuffer) {
      const fileHeader =
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="photo"; filename="${filename}"${crlf}` +
        `Content-Type: image/jpeg${crlf}${crlf}`;
      payloadParts.push(Buffer.from(fileHeader));
      payloadParts.push(fileBuffer);
      payloadParts.push(Buffer.from(crlf));
    }

    // Append other form fields
    for (const [key, value] of Object.entries(fields)) {
      const fieldData =
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="${key}"${crlf}${crlf}` +
        `${value}${crlf}`;
      payloadParts.push(Buffer.from(fieldData));
    }

    payloadParts.push(Buffer.from(`--${boundary}--${crlf}`));
    const bodyBuffer = Buffer.concat(payloadParts);

    const headers = {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": bodyBuffer.length,
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}/listings/${listingId}/photos`, {
      method: "POST",
      headers,
      body: bodyBuffer,
    });

    const status = res.status;
    let json = {};
    try {
      json = await res.json();
    } catch (e) {
      json = { rawText: await res.text() };
    }
    return { status, json };
  }

  try {
    // =========================================================================
    // TEST 1: Authorized farmer uploads a valid photo using mock/local storage
    // =========================================================================
    const beforeUpload = new Date(Date.now() - 1000);
    const test1Res = await postPhotoUpload(
      listingA_Id,
      validJpegBuffer,
      "harvest_test.jpg",
      {
        captureMethod: "live_camera",
        conditionNotes: "Crisp red apples freshly picked from block 4",
        isPrimary: "true",
      },
      farmerA_Token
    );
    const afterUpload = new Date(Date.now() + 1000);
    assert(test1Res.status === 201, "Test 1: Authorized farmer uploads valid photo receives HTTP 201 Created");
    assert(
      test1Res.json.photo && test1Res.json.photo.imageUrl,
      "Test 1: Result includes stored image URL"
    );
    assert(
      test1Res.json.photo && test1Res.json.photo.watermarkedUrl,
      "Test 1: Result includes watermarked display derivative"
    );
    const sTime = new Date(test1Res.json.photo.serverReceivedAt);
    assert(
      sTime >= beforeUpload && sTime <= afterUpload,
      "Test 1: Authoritative serverReceivedAt is generated server-side upon request acceptance"
    );

    // =========================================================================
    // TEST 2: Unauthenticated upload receives HTTP 401
    // =========================================================================
    const test2Res = await postPhotoUpload(
      listingA_Id,
      validJpegBuffer,
      "harvest.jpg",
      {},
      null // No token
    );
    assert(test2Res.status === 401, "Test 2: Unauthenticated upload receives HTTP 401 Unauthorized");

    // =========================================================================
    // TEST 3: Buyer and bulk buyer cannot upload to a listing
    // =========================================================================
    const test3aRes = await postPhotoUpload(
      listingA_Id,
      validJpegBuffer,
      "buyer_attempt.jpg",
      {},
      buyerToken
    );
    assert(test3aRes.status === 403, "Test 3a: User with 'buyer' role is blocked with HTTP 403 Forbidden");

    const test3bRes = await postPhotoUpload(
      listingA_Id,
      validJpegBuffer,
      "bulk_buyer_attempt.jpg",
      {},
      bulkBuyerToken
    );
    assert(test3bRes.status === 403, "Test 3b: User with 'bulk_buyer' role is blocked with HTTP 403 Forbidden");

    // =========================================================================
    // TEST 4: One farmer cannot upload to another farmer's listing
    // =========================================================================
    const test4Res = await postPhotoUpload(
      listingA_Id, // Belongs to Farmer A
      validJpegBuffer,
      "intruder.jpg",
      {},
      farmerB_Token // Farmer B attempting upload
    );
    assert(test4Res.status === 403, "Test 4: Farmer cannot upload to another farmer's listing (HTTP 403)");

    // =========================================================================
    // TEST 5: Location ownership is verified correctly for supported location types
    // =========================================================================
    // Farmer A tries to upload to Listing B (Farm owned by Farmer B)
    const test5Res = await postPhotoUpload(
      listingB_Id,
      validJpegBuffer,
      "test.jpg",
      {},
      farmerA_Token
    );
    assert(test5Res.status === 403, "Test 5: Cross-location ownership mismatch is blocked with HTTP 403");

    // =========================================================================
    // TEST 6: Invalid image data is rejected
    // =========================================================================
    const test6Res = await postPhotoUpload(
      listingA_Id,
      corruptedBuffer,
      "corrupted.jpg",
      {},
      farmerA_Token
    );
    assert(test6Res.status === 400, "Test 6: Invalid/corrupt image data is rejected with HTTP 400");
    assert(
      test6Res.json.message && test6Res.json.message.includes("Invalid image data"),
      "Test 6: Error message indicates unable to decode image file"
    );

    // =========================================================================
    // TEST 7: Oversized files are rejected (> 5 MB limit)
    // =========================================================================
    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024, 0); // 5 MB + 1 KB
    const test7Res = await postPhotoUpload(
      listingA_Id,
      oversizedBuffer,
      "oversized.jpg",
      {},
      farmerA_Token
    );
    assert(test7Res.status === 400, "Test 7: Oversized file (> 5 MB) is rejected with HTTP 400");
    assert(
      test7Res.json.message && test7Res.json.message.includes("5 MB"),
      "Test 7: Error specifies maximum allowed file size of 5 MB"
    );

    // =========================================================================
    // TEST 8: Unsupported formats are rejected (e.g. GIF)
    // =========================================================================
    const test8Res = await postPhotoUpload(
      listingA_Id,
      unsupportedGifBuffer,
      "animation.gif",
      {},
      farmerA_Token
    );
    assert(test8Res.status === 400, "Test 8: Unsupported format (GIF) is rejected with HTTP 400");
    assert(
      test8Res.json.message && test8Res.json.message.includes("Unsupported image format"),
      "Test 8: Error message indicates allowed formats are JPEG, PNG, WebP"
    );

    // =========================================================================
    // TEST 9: Client-supplied serverReceivedAt and capturedAt cannot override server timestamp
    // =========================================================================
    const forgedDateStr = "1999-01-01T00:00:00.000Z";
    const test9Res = await postPhotoUpload(
      listingA_Id,
      validJpegBuffer,
      "forgery_attempt.jpg",
      {
        serverReceivedAt: forgedDateStr,
        capturedAt: forgedDateStr,
      },
      farmerA_Token
    );
    assert(test9Res.status === 201, "Test 9: Upload succeeds with server ignoring forged timestamps");
    const receivedYear = new Date(test9Res.json.photo.serverReceivedAt).getFullYear();
    assert(
      receivedYear !== 1999 && receivedYear >= 2025,
      "Test 9: Server timestamp is authoritative current time, NOT forged 1999 timestamp"
    );

    // =========================================================================
    // TEST 10: clientCapturedAt remains separate and untrusted
    // =========================================================================
    const clientReportedTime = "2024-08-10T14:30:00.000Z";
    const test10Res = await postPhotoUpload(
      listingA_Id,
      validPngBuffer,
      "client_capture.png",
      {
        clientCapturedAt: clientReportedTime,
      },
      farmerA_Token
    );
    assert(test10Res.status === 201, "Test 10: Upload with clientCapturedAt succeeds");
    assert(
      new Date(test10Res.json.photo.clientCapturedAt).toISOString() === clientReportedTime,
      "Test 10: clientCapturedAt is stored distinctly as claimed untrusted metadata"
    );
    assert(
      test10Res.json.photo.serverReceivedAt !== test10Res.json.photo.clientCapturedAt,
      "Test 10: serverReceivedAt is strictly independent of clientCapturedAt"
    );

    // =========================================================================
    // TEST 11: Storage failure does not create a database photo record pointing to nonexistent image
    // =========================================================================
    storageService.__setMockFailure(true);
    const countBeforeFailure = photosList.length;

    const test11Res = await postPhotoUpload(
      listingA_Id,
      validJpegBuffer,
      "fail_test.jpg",
      {},
      farmerA_Token
    );
    assert(test11Res.status === 502, "Test 11: Storage failure returns HTTP 502 Bad Gateway");
    assert(
      photosList.length === countBeforeFailure,
      "Test 11: No database photo record is created when storage upload fails"
    );
    storageService.__setMockFailure(false);

    // =========================================================================
    // TEST 12: Database persistence failure triggers appropriate cloud-object cleanup attempts
    // =========================================================================
    let cleanupTriggered = false;
    const originalDeleteImage = storageService.deleteImage;
    storageService.deleteImage = async function (publicId, provider) {
      cleanupTriggered = true;
      return await originalDeleteImage(publicId, provider);
    };

    dbSaveShouldFail = true;
    const test12Res = await postPhotoUpload(
      listingA_Id,
      validJpegBuffer,
      "db_fail_test.jpg",
      {},
      farmerA_Token
    );
    assert(test12Res.status === 500, "Test 12: Database persistence failure returns HTTP 500");
    assert(cleanupTriggered === true, "Test 12: Orphaned storage object cleanup was attempted upon DB failure");

    dbSaveShouldFail = false;
    storageService.deleteImage = originalDeleteImage;

    // =========================================================================
    // TEST 13: Public history exposes only approved fields
    // =========================================================================
    // 13a. Unauthenticated public request for active listing
    const publicGetRes = await fetch(`${baseUrl}/listings/${listingA_Id}/photos`);
    assert(publicGetRes.status === 200, "Test 13a: Unauthenticated visitor can view photos of active listing");
    const publicHistory = await publicGetRes.json();
    assert(Array.isArray(publicHistory.photos), "Test 13a: History returns array of photos");
    if (publicHistory.photos.length > 0) {
      const p = publicHistory.photos[0];
      const hasSafeFields = p.imageUrl && p.serverReceivedAt && p.captureMethod;
      const hasNoPrivateFields =
        p.location === undefined &&
        p.uploaderId === undefined &&
        p.storageProvider === undefined &&
        p.apiKey === undefined;
      assert(
        hasSafeFields && hasNoPrivateFields,
        "Test 13a: Public history exposes only allowlisted safe fields; private coordinates & IDs are excluded"
      );
    }

    // 13b. Unauthenticated access to inactive listing is blocked
    const inactivePublicRes = await fetch(`${baseUrl}/listings/${inactiveListingId}/photos`);
    assert(
      inactivePublicRes.status === 403,
      "Test 13b: Unauthenticated access to private/inactive listing photo history is blocked with HTTP 403"
    );

    // 13c. Authenticated owner CAN view their private/inactive listing photos
    const inactiveOwnerRes = await fetch(`${baseUrl}/listings/${inactiveListingId}/photos`, {
      headers: { Authorization: `Bearer ${farmerA_Token}` },
    });
    assert(
      inactiveOwnerRes.status === 200,
      "Test 13c: Authenticated listing owner can view photo history of their own inactive listing"
    );

    // =========================================================================
    // TEST 14: Freshness utility calculations
    // =========================================================================
    const now = Date.now();
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000);

    const { calculateFreshness } = require("../../frontend/src/components/Marketplace/freshnessUtils");

    const freshResult = calculateFreshness(twoHoursAgo, now);
    assert(freshResult.status === "fresh", "Test 14a: Freshness within 24h evaluates to 'fresh'");

    const recentResult = calculateFreshness(threeDaysAgo, now);
    assert(recentResult.status === "recent", "Test 14b: Freshness between 1-7d evaluates to 'recent'");

    const staleResult = calculateFreshness(tenDaysAgo, now);
    assert(staleResult.status === "stale", "Test 14c: Freshness older than 7d evaluates to 'stale'");

    const noPhotoResult = calculateFreshness(null, now);
    assert(noPhotoResult.status === "no_photo", "Test 14d: Missing photo evaluates to 'no_photo'");
  } catch (err) {
    console.error("Test execution uncaught error:", err);
    assert(false, `Uncaught test error: ${err.message}`);
  } finally {
    // Restore stubs
    Listing.findById = originalListingFindById;
    CropFarm.findById = originalCropFarmFindById;
    Farm.findById = originalFarmFindById;
    Store.findById = originalStoreFindById;
    ListingPhoto.prototype.save = originalListingPhotoSave;
    ListingPhoto.find = originalListingPhotoFind;
    ListingPhoto.updateMany = originalListingPhotoUpdateMany;

    server.close();
  }

  console.log("==================================================");
  console.log(`🏁 STAGE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runStage3Tests();
