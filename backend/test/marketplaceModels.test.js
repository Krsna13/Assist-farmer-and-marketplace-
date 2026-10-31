const mongoose = require("mongoose");
const Listing = require("../models/Listing");
const ListingPhoto = require("../models/ListingPhoto");
const Bid = require("../models/Bid");
const Order = require("../models/Order");
const Notification = require("../models/Notification");

async function runMarketplaceModelTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING STAGE 2 CORRECTIVE MARKETPLACE MODEL TESTS");
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

  const dummyFarmerId = new mongoose.Types.ObjectId();
  const dummyCropFarmId = new mongoose.Types.ObjectId();
  const dummyLivestockFarmId = new mongoose.Types.ObjectId();
  const dummyStoreId = new mongoose.Types.ObjectId();
  const dummyBuyerId = new mongoose.Types.ObjectId();
  const dummyListingId = new mongoose.Types.ObjectId();
  const dummyCropRecordId = new mongoose.Types.ObjectId();
  const dummyAnimalId = new mongoose.Types.ObjectId();
  const dummyResourceId = new mongoose.Types.ObjectId();

  // =========================================================================
  // FIX 1: Support all existing farm & inventory locations (CropFarm, Farm, Store)
  // =========================================================================
  try {
    // 1a. CropFarm location
    const cropListing = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "CropFarm",
      locationId: dummyCropFarmId,
      sourceRecordType: "CropRecord",
      sourceRecordId: dummyCropRecordId,
      category: "crop",
      title: "Fresh Harvest Basmati Rice",
      quantityUnit: "quintal",
      quantityAvailable: 100,
      fixedPricePerUnit: 4200,
      status: "available",
    });
    assert(!cropListing.validateSync(), "Listing accepts locationModel 'CropFarm' with CropRecord source");

    // 1b. Farm location (Livestock)
    const livestockListing = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "Farm",
      locationId: dummyLivestockFarmId,
      sourceRecordType: "Animal",
      sourceRecordId: dummyAnimalId,
      category: "livestock",
      title: "Healthy Sahiwal Dairy Cow",
      quantityUnit: "piece",
      quantityAvailable: 1,
      fixedPricePerUnit: 150000,
      status: "available",
    });
    assert(!livestockListing.validateSync(), "Listing accepts locationModel 'Farm' with Animal source");

    // 1c. Store location (Resources / Seeds / Fertilizers)
    const storeListing = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "Store",
      locationId: dummyStoreId,
      sourceRecordType: "UnitResource",
      sourceRecordId: dummyResourceId,
      category: "produce",
      title: "Surplus Organic Compost Bags",
      quantityUnit: "kg",
      quantityAvailable: 200,
      fixedPricePerUnit: 25,
      status: "available",
    });
    assert(!storeListing.validateSync(), "Listing accepts locationModel 'Store' with UnitResource source");

    // 1d. Backward compatibility: passing farmId defaults to CropFarm locationId
    const legacyFarmIdListing = new Listing({
      farmerId: dummyFarmerId,
      farmId: dummyCropFarmId,
      category: "crop",
      title: "Legacy Plot Wheat",
      quantityUnit: "kg",
      quantityAvailable: 50,
      fixedPricePerUnit: 35,
      status: "available",
    });
    legacyFarmIdListing.validateSync();
    assert(
      legacyFarmIdListing.locationModel === "CropFarm" &&
      legacyFarmIdListing.locationId.toString() === dummyCropFarmId.toString(),
      "Listing backward compatibility: farmId maps cleanly to locationModel 'CropFarm' and locationId"
    );

    // 1e. Rejects mismatched sourceRecordType and locationModel
    const mismatchedListing = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "Store", // Mismatch: CropRecord cannot belong to Store
      locationId: dummyStoreId,
      sourceRecordType: "CropRecord",
      sourceRecordId: dummyCropRecordId,
      category: "crop",
      title: "Mismatched Location Listing",
      quantityUnit: "kg",
      quantityAvailable: 50,
      fixedPricePerUnit: 35,
      status: "available",
    });
    const mismatchErr = mismatchedListing.validateSync();
    assert(
      mismatchErr && mismatchErr.errors && mismatchErr.errors.locationModel,
      "Listing rejects source record 'CropRecord' linked to incorrect locationModel 'Store'"
    );

    // 1f. Rejects invalid non-allowlisted locationModel
    const illegalLocationListing = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "ArbitraryWarehouse",
      locationId: dummyStoreId,
      category: "produce",
      title: "Illegal Location Model",
      quantityUnit: "kg",
      quantityAvailable: 50,
      fixedPricePerUnit: 35,
      status: "available",
    });
    const illegalErr = illegalLocationListing.validateSync();
    assert(
      illegalErr && illegalErr.errors && illegalErr.errors.locationModel,
      "Listing rejects non-allowlisted locationModel ('ArbitraryWarehouse')"
    );
  } catch (e) {
    assert(false, `FIX 1 location tests error: ${e.message}`);
  }

  // =========================================================================
  // FIX 2: Separate server receipt time from claimed capture time in ListingPhoto
  // =========================================================================
  try {
    const beforeTime = new Date(Date.now() - 1000);
    const photo = new ListingPhoto({
      listingId: dummyListingId,
      uploaderId: dummyFarmerId,
      imageUrl: "https://storage.smartagri.org/photos/crop_harvest_1.jpg",
      captureMethod: "live_camera",
    });
    const afterTime = new Date(Date.now() + 1000);

    const err = photo.validateSync();
    assert(!err, "ListingPhoto validates required fields successfully");
    assert(
      photo.serverReceivedAt && photo.serverReceivedAt >= beforeTime && photo.serverReceivedAt <= afterTime,
      "ListingPhoto uses authoritative server-generated timestamp serverReceivedAt"
    );

    // Backward-compatible virtual capturedAt
    assert(
      photo.capturedAt && photo.capturedAt.getTime() === photo.serverReceivedAt.getTime(),
      "ListingPhoto capturedAt virtual reflects serverReceivedAt for backward compatibility"
    );

    // Client-reported capture time is untrusted and distinct
    const claimedCaptureTime = new Date("2024-05-15T10:30:00Z");
    const photoWithClaimedTime = new ListingPhoto({
      listingId: dummyListingId,
      uploaderId: dummyFarmerId,
      imageUrl: "https://storage.smartagri.org/photos/crop_harvest_2.jpg",
      captureMethod: "file_upload",
      clientCapturedAt: claimedCaptureTime,
    });
    photoWithClaimedTime.validateSync();
    assert(
      photoWithClaimedTime.clientCapturedAt.getTime() === claimedCaptureTime.getTime(),
      "ListingPhoto preserves clientCapturedAt distinctly"
    );
    assert(
      photoWithClaimedTime.serverReceivedAt.getTime() !== photoWithClaimedTime.clientCapturedAt.getTime(),
      "serverReceivedAt is independent and not overwritten by clientCapturedAt"
    );

    // Base64 storage rejection
    const base64Photo = new ListingPhoto({
      listingId: dummyListingId,
      uploaderId: dummyFarmerId,
      imageUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
      captureMethod: "file_upload",
    });
    const base64Err = base64Photo.validateSync();
    assert(
      base64Err && base64Err.errors && base64Err.errors.imageUrl,
      "ListingPhoto strictly rejects raw base64 data URLs in MongoDB"
    );

    // =========================================================================
    // REGRESSION TESTS: PRE-STAGE 3 TIMESTAMP INTEGRITY & READ-ONLY CAPTUREDAT
    // =========================================================================
    const forgedTimestamp = new Date("2011-03-14T08:00:00Z");

    // 2a. Forged serverReceivedAt in constructor payload is rejected & replaced with server time
    const photoWithForgedServerTime = new ListingPhoto({
      listingId: dummyListingId,
      uploaderId: dummyFarmerId,
      imageUrl: "https://storage.smartagri.org/photos/crop_harvest_3.jpg",
      captureMethod: "live_camera",
      serverReceivedAt: forgedTimestamp,
    });
    photoWithForgedServerTime.validateSync();
    assert(
      photoWithForgedServerTime.serverReceivedAt.getTime() !== forgedTimestamp.getTime() &&
      photoWithForgedServerTime.serverReceivedAt >= beforeTime &&
      photoWithForgedServerTime.serverReceivedAt <= new Date(Date.now() + 1000),
      "ListingPhoto rejects client-forged serverReceivedAt payload and generates authoritative server time"
    );

    // 2b. Forged legacy capturedAt in constructor payload cannot set serverReceivedAt
    const photoWithForgedCapturedAt = new ListingPhoto({
      listingId: dummyListingId,
      uploaderId: dummyFarmerId,
      imageUrl: "https://storage.smartagri.org/photos/crop_harvest_4.jpg",
      captureMethod: "live_camera",
      capturedAt: forgedTimestamp,
    });
    photoWithForgedCapturedAt.validateSync();
    assert(
      photoWithForgedCapturedAt.serverReceivedAt.getTime() !== forgedTimestamp.getTime() &&
      photoWithForgedCapturedAt.capturedAt.getTime() === photoWithForgedCapturedAt.serverReceivedAt.getTime(),
      "ListingPhoto ignores client-forged capturedAt in constructor; virtual getter returns authoritative serverReceivedAt"
    );

    // 2c. Direct property assignment to capturedAt virtual has no setter and cannot mutate serverReceivedAt
    photoWithForgedCapturedAt.capturedAt = new Date("2000-01-01T00:00:00Z");
    assert(
      photoWithForgedCapturedAt.capturedAt.getTime() === photoWithForgedCapturedAt.serverReceivedAt.getTime() &&
      photoWithForgedCapturedAt.serverReceivedAt.getTime() !== new Date("2000-01-01T00:00:00Z").getTime(),
      "ListingPhoto capturedAt virtual is read-only; mutation attempts do not alter serverReceivedAt"
    );

    // 2d. Direct assignment to serverReceivedAt on new document cannot override server time
    photoWithForgedCapturedAt.serverReceivedAt = new Date("2005-06-01T00:00:00Z");
    assert(
      photoWithForgedCapturedAt.serverReceivedAt.getTime() !== new Date("2005-06-01T00:00:00Z").getTime() &&
      photoWithForgedCapturedAt.serverReceivedAt >= beforeTime,
      "ListingPhoto rejects direct assignment of forged serverReceivedAt on new document"
    );

    // 2e. Hydration of existing DB document preserves stored serverReceivedAt
    const storedDbDate = new Date("2023-11-20T14:30:00Z");
    const hydratedPhoto = ListingPhoto.hydrate({
      _id: new mongoose.Types.ObjectId(),
      listingId: dummyListingId,
      uploaderId: dummyFarmerId,
      imageUrl: "https://storage.smartagri.org/photos/historical.jpg",
      captureMethod: "file_upload",
      serverReceivedAt: storedDbDate,
      isPrimary: false,
    });
    assert(
      hydratedPhoto.serverReceivedAt.getTime() === storedDbDate.getTime(),
      "ListingPhoto preserves historical serverReceivedAt when hydrating existing document from database"
    );
  } catch (e) {
    assert(false, `FIX 2 photo timestamp tests error: ${e.message}`);
  }

  // =========================================================================
  // FIX 3: Listing quantity and status consistency invariants
  // =========================================================================
  try {
    // 3a. Available listing with positive available quantity -> PASS
    const validAvailable = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "CropFarm",
      locationId: dummyCropFarmId,
      category: "crop",
      title: "Available Corn",
      quantityUnit: "kg",
      quantityAvailable: 500,
      quantityReserved: 50, // Partial reservation is allowed while available
      quantitySold: 0,
      fixedPricePerUnit: 30,
      status: "available",
    });
    assert(!validAvailable.validateSync(), "Listing: available with positive available quantity is VALID");

    // 3b. Available listing with zero available quantity -> REJECT
    const invalidAvailable = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "CropFarm",
      locationId: dummyCropFarmId,
      category: "crop",
      title: "Invalid Available Corn",
      quantityUnit: "kg",
      quantityAvailable: 0, // Must be > 0 for available status
      fixedPricePerUnit: 30,
      status: "available",
    });
    const errAvailable = invalidAvailable.validateSync();
    assert(
      errAvailable && errAvailable.errors && errAvailable.errors.quantityAvailable,
      "Listing: available with zero available quantity is REJECTED"
    );

    // 3c. Reserved listing with valid reserved quantity (available === 0, reserved > 0) -> PASS
    const validReserved = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "CropFarm",
      locationId: dummyCropFarmId,
      category: "crop",
      title: "Fully Reserved Barley",
      quantityUnit: "kg",
      quantityAvailable: 0,
      quantityReserved: 300,
      quantitySold: 0,
      fixedPricePerUnit: 35,
      status: "reserved",
    });
    assert(!validReserved.validateSync(), "Listing: reserved with available=0 and reserved>0 is VALID");

    // 3d. Invalid reserved listing: available > 0 -> REJECT
    const invalidReservedAvailable = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "CropFarm",
      locationId: dummyCropFarmId,
      category: "crop",
      title: "Invalid Reserved Listing",
      quantityUnit: "kg",
      quantityAvailable: 50, // Conflict: must be 0
      quantityReserved: 300,
      fixedPricePerUnit: 35,
      status: "reserved",
    });
    const errReservedAvail = invalidReservedAvailable.validateSync();
    assert(
      errReservedAvail && errReservedAvail.errors && errReservedAvail.errors.quantityAvailable,
      "Listing: reserved listing with quantityAvailable > 0 is REJECTED"
    );

    // 3e. Invalid reserved listing: reserved === 0 -> REJECT
    const invalidReservedZero = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "CropFarm",
      locationId: dummyCropFarmId,
      category: "crop",
      title: "Zero Reserved Listing",
      quantityUnit: "kg",
      quantityAvailable: 0,
      quantityReserved: 0, // Must be > 0
      fixedPricePerUnit: 35,
      status: "reserved",
    });
    const errReservedZero = invalidReservedZero.validateSync();
    assert(
      errReservedZero && errReservedZero.errors && errReservedZero.errors.quantityReserved,
      "Listing: reserved listing with quantityReserved = 0 is REJECTED"
    );

    // 3f. Sold listing: available=0, reserved=0, sold>0 -> PASS
    const validSold = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "CropFarm",
      locationId: dummyCropFarmId,
      category: "crop",
      title: "Completed Sold Batch",
      quantityUnit: "kg",
      quantityAvailable: 0,
      quantityReserved: 0,
      quantitySold: 500,
      fixedPricePerUnit: 40,
      status: "sold",
    });
    assert(!validSold.validateSync(), "Listing: sold with available=0, reserved=0, sold>0 is VALID");

    // 3g. Sold listing with remaining available quantity -> REJECT
    const invalidSoldAvailable = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "CropFarm",
      locationId: dummyCropFarmId,
      category: "crop",
      title: "Sold with remaining stock",
      quantityUnit: "kg",
      quantityAvailable: 100, // Conflict: must be 0
      quantityReserved: 0,
      quantitySold: 400,
      fixedPricePerUnit: 40,
      status: "sold",
    });
    const errSoldAvail = invalidSoldAvailable.validateSync();
    assert(
      errSoldAvail && errSoldAvail.errors && errSoldAvail.errors.quantityAvailable,
      "Listing: sold listing with remaining quantityAvailable > 0 is REJECTED"
    );

    // 3h. Sold listing with zero quantitySold -> REJECT
    const invalidSoldZero = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "CropFarm",
      locationId: dummyCropFarmId,
      category: "crop",
      title: "Sold with 0 sold quantity",
      quantityUnit: "kg",
      quantityAvailable: 0,
      quantityReserved: 0,
      quantitySold: 0, // Conflict: must be > 0
      fixedPricePerUnit: 40,
      status: "sold",
    });
    const errSoldZero = invalidSoldZero.validateSync();
    assert(
      errSoldZero && errSoldZero.errors && errSoldZero.errors.quantitySold,
      "Listing: sold listing with quantitySold = 0 is REJECTED"
    );

    // 3i. Inactive listing with remaining stock -> PASS
    const validInactive = new Listing({
      farmerId: dummyFarmerId,
      locationModel: "CropFarm",
      locationId: dummyCropFarmId,
      category: "crop",
      title: "Paused Winter Wheat",
      quantityUnit: "kg",
      quantityAvailable: 250,
      quantityReserved: 0,
      quantitySold: 100,
      fixedPricePerUnit: 35,
      status: "inactive",
    });
    assert(!validInactive.validateSync(), "Listing: inactive listing with remaining stock is VALID");
  } catch (e) {
    assert(false, `FIX 3 quantity invariant tests error: ${e.message}`);
  }

  // =========================================================================
  // FIX 4: Order item arithmetic and totals consistency
  // =========================================================================
  try {
    // 4a. Valid Order: arithmetic matches perfectly
    const validOrder = new Order({
      buyerId: dummyBuyerId,
      farmerId: dummyFarmerId,
      items: [
        {
          listingId: dummyListingId,
          title: "Fresh Tomatoes",
          quantity: 20,
          unit: "kg",
          agreedPricePerUnit: 35.5,
          subtotal: 710.0, // 20 * 35.50 = 710.00
        },
        {
          listingId: dummyListingId,
          title: "Bell Peppers",
          quantity: 10,
          unit: "kg",
          agreedPricePerUnit: 50.0,
          subtotal: 500.0, // 10 * 50.00 = 500.00
        },
      ],
      totalAmount: 1210.0, // 710.00 + 500.00 = 1210.00
      status: "placed",
      paymentMethod: "cod",
      paymentStatus: "unpaid",
    });
    assert(!validOrder.validateSync(), "Order: correct items arithmetic and matching totalAmount is VALID");

    // 4b. Deliberately incorrect item subtotal -> REJECT
    const incorrectSubtotalOrder = new Order({
      buyerId: dummyBuyerId,
      farmerId: dummyFarmerId,
      items: [
        {
          listingId: dummyListingId,
          title: "Fresh Tomatoes",
          quantity: 10,
          unit: "kg",
          agreedPricePerUnit: 40.0,
          subtotal: 999.0, // Deliberate mismatch: should be 400.00
        },
      ],
      totalAmount: 999.0,
      status: "placed",
    });
    const subtotalErr = incorrectSubtotalOrder.validateSync();
    assert(
      subtotalErr && subtotalErr.errors && subtotalErr.errors["items.0.subtotal"],
      "Order: rejects incorrect item subtotal (subtotal != quantity * price)"
    );

    // 4c. Mismatched order totalAmount -> REJECT
    const mismatchedTotalOrder = new Order({
      buyerId: dummyBuyerId,
      farmerId: dummyFarmerId,
      items: [
        {
          listingId: dummyListingId,
          title: "Fresh Tomatoes",
          quantity: 10,
          unit: "kg",
          agreedPricePerUnit: 40.0,
          subtotal: 400.0,
        },
      ],
      totalAmount: 550.0, // Deliberate mismatch: items sum is 400.00
      status: "placed",
    });
    const totalErr = mismatchedTotalOrder.validateSync();
    assert(
      totalErr && totalErr.errors && totalErr.errors.totalAmount,
      "Order: rejects totalAmount that does not match sum of item subtotals"
    );

    // 4d. Negative or non-finite quantities and prices -> REJECT
    const negativePriceOrder = new Order({
      buyerId: dummyBuyerId,
      farmerId: dummyFarmerId,
      items: [
        {
          listingId: dummyListingId,
          title: "Bad Price Item",
          quantity: 10,
          unit: "kg",
          agreedPricePerUnit: -25.0, // Negative!
          subtotal: -250.0,
        },
      ],
      totalAmount: -250.0,
      status: "placed",
    });
    const negErr = negativePriceOrder.validateSync();
    assert(
      negErr && negErr.errors && (negErr.errors["items.0.agreedPricePerUnit"] || negErr.errors["items.0.subtotal"]),
      "Order: rejects negative prices and negative subtotals"
    );
  } catch (e) {
    assert(false, `FIX 4 order arithmetic tests error: ${e.message}`);
  }

  // =========================================================================
  // FIX 5: Verify Schema Indexes and Key Declarations
  // =========================================================================
  try {
    const listingIndexes = Listing.schema.indexes();
    const photoIndexes = ListingPhoto.schema.indexes();
    const bidIndexes = Bid.schema.indexes();
    const orderIndexes = Order.schema.indexes();
    const notifIndexes = Notification.schema.indexes();

    // Check Listing compound index for locationModel + locationId
    const hasLocationIndex = listingIndexes.some(
      ([fields]) => fields.locationModel === 1 && fields.locationId === 1 && fields.status === 1
    );
    assert(hasLocationIndex, "Listing schema declares compound index on locationModel, locationId, status");

    const hasPhotoIndex = photoIndexes.some(
      ([fields]) => fields.listingId === 1 && fields.serverReceivedAt === -1
    );
    assert(hasPhotoIndex, "ListingPhoto schema declares index on listingId, serverReceivedAt");

    const hasBidIndex = bidIndexes.some(
      ([fields]) => fields.listingId === 1 && fields.status === 1
    );
    assert(hasBidIndex, "Bid schema declares compound index on listingId, status");

    const hasOrderBuyerIndex = orderIndexes.some(
      ([fields]) => fields.buyerId === 1 && fields.createdAt === -1
    );
    assert(hasOrderBuyerIndex, "Order schema declares compound index on buyerId, createdAt");

    const hasNotifIndex = notifIndexes.some(
      ([fields]) => fields.recipientId === 1 && fields.readAt === 1
    );
    assert(hasNotifIndex, "Notification schema declares compound index on recipientId, readAt");

    // Verify orderNumber unique index on schema path
    const orderNumberPath = Order.schema.paths["orderNumber"];
    assert(
      orderNumberPath && orderNumberPath.options && orderNumberPath.options.unique === true,
      "Order schema path 'orderNumber' is configured with unique: true"
    );
  } catch (e) {
    assert(false, `FIX 5 index verification error: ${e.message}`);
  }

  // =========================================================================
  // Existing Model Compatibility & Reference Verification
  // =========================================================================
  try {
    const listingFarmerRef = Listing.schema.paths["farmerId"].options.ref;
    const listingLocationRefPath = Listing.schema.paths["locationId"].options.refPath;
    const photoListingRef = ListingPhoto.schema.paths["listingId"].options.ref;
    const photoUploaderRef = ListingPhoto.schema.paths["uploaderId"].options.ref;
    const bidListingRef = Bid.schema.paths["listingId"].options.ref;
    const bidBuyerRef = Bid.schema.paths["buyerId"].options.ref;
    const orderBuyerRef = Order.schema.paths["buyerId"].options.ref;
    const orderFarmerRef = Order.schema.paths["farmerId"].options.ref;
    const notifRecipientRef = Notification.schema.paths["recipientId"].options.ref;

    assert(listingFarmerRef === "User", "Listing.farmerId references 'User'");
    assert(listingLocationRefPath === "locationModel", "Listing.locationId uses refPath 'locationModel'");
    assert(photoListingRef === "Listing", "ListingPhoto.listingId references 'Listing'");
    assert(photoUploaderRef === "User", "ListingPhoto.uploaderId references 'User'");
    assert(bidListingRef === "Listing", "Bid.listingId references 'Listing'");
    assert(bidBuyerRef === "User", "Bid.buyerId references 'User'");
    assert(orderBuyerRef === "User", "Order.buyerId references 'User'");
    assert(orderFarmerRef === "User", "Order.farmerId references 'User'");
    assert(notifRecipientRef === "User", "Notification.recipientId references 'User'");
  } catch (e) {
    assert(false, `Compatibility test error: ${e.message}`);
  }

  console.log("==================================================");
  console.log(`🏁 STAGE 2 CORRECTIVE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runMarketplaceModelTests();
