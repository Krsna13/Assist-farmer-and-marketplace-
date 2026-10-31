/**
 * backend/services/marketplaceAutoSyncService.js
 *
 * Automatic Marketplace Sync Service
 * ====================================
 * Synchronises eligible inventory from CropRecord, Animal and UnitResource
 * into the Farm Marketplace Listing collection — but ONLY for the account
 * configured via MARKETPLACE_AUTO_PUBLISH_EMAIL in .env.
 *
 * Security rules:
 *  - Email allowlist is read from process.env, never from the browser.
 *  - The authenticated User document is re-fetched from MongoDB; the
 *    email stored in the JWT payload is NOT trusted for this check.
 *  - No other user's data is touched.
 *  - quantityReserved and quantitySold are never overwritten by sync.
 *  - If quantityAvailable would drop below 0 after reservations, the
 *    listing is marked inactive rather than set to a negative value.
 *
 * Sync eligibility:
 *  - CropRecord: requires forSale=true, harvestQty > 0, marketSalePrice > 0,
 *                harvestUnit in ALLOWED_UNITS, harvestDate present.
 *  - Animal:     requires forSale=true, saleQty > 0, marketSalePrice > 0.
 *  - UnitResource: requires forSale=true, quantity > 0, marketSalePrice > 0,
 *                  resourceType in ['Seeds','Fertilizer','Feeds'] or explicit opt-in.
 *
 * Duplicate prevention:
 *  - Each source record maps to at most one active Listing via
 *    { sourceRecordType, sourceRecordId } compound lookup.
 *
 * Stock policy:
 *  - quantityAvailable = source quantity - quantityReserved - quantitySold
 *  - If result <= 0, listing becomes inactive (no delete).
 */

"use strict";

const mongoose = require("mongoose");
const Listing = require("../models/Listing");
const User = require("../models/User");
const CropFarm = require("../models/CropFarm");
const Farm = require("../models/Farm");
const Store = require("../models/Store");

// ---------------------------------------------------------------------------
// Helper: resolve and normalise the auto-publish allowlist email
// ---------------------------------------------------------------------------
function getAllowlistEmail() {
  const raw = process.env.MARKETPLACE_AUTO_PUBLISH_EMAIL || "";
  return raw.trim().toLowerCase();
}

/**
 * Resolve the MongoDB User document for a given user ID and verify it
 * matches the configured allowlist email.
 *
 * @param {string|ObjectId} userId  - The authenticated user's _id
 * @returns {Promise<boolean>}       - true if this user is on the allowlist
 */
async function isAllowlistedUser(userId) {
  const allowlistEmail = getAllowlistEmail();
  if (!allowlistEmail) return false; // No allowlist configured → nobody auto-syncs

  const user = await User.findById(userId).select("email").lean();
  if (!user) return false;

  return user.email.trim().toLowerCase() === allowlistEmail;
}

// ---------------------------------------------------------------------------
// Canonical unit normalisation (mirrors Listing.normalizeUnit)
// ---------------------------------------------------------------------------
const ALLOWED_UNITS = new Set(["kg", "quintal", "tonne", "litre", "piece", "head"]);

function normalizeUnit(unit) {
  if (!unit || typeof unit !== "string") return null;
  const lower = unit.toLowerCase().trim();
  if (lower === "ton" || lower === "tons" || lower === "metric ton") return "tonne";
  if (lower === "liter" || lower === "liters" || lower === "l") return "litre";
  if (lower === "pc" || lower === "pcs") return "piece";
  if (lower === "quintals" || lower === "qtl") return "quintal";
  if (lower === "units" || lower === "unit") return "piece";
  if (lower === "g" || lower === "grams") return null; // not in canonical list — skip
  return ALLOWED_UNITS.has(lower) ? lower : null;
}

// ---------------------------------------------------------------------------
// Core upsert helper
// ---------------------------------------------------------------------------
/**
 * Create or update a Listing from a source inventory record.
 * Never overwrites quantityReserved / quantitySold.
 * Applies stock policy: available = sourceQty - reserved - sold.
 *
 * @param {object} opts
 * @returns {Promise<{action: 'created'|'updated'|'deactivated'|'skipped', listingId?: string, reason?: string}>}
 */
async function upsertListing({
  farmerId,
  locationModel,
  locationId,
  sourceRecordType,
  sourceRecordId,
  category,
  title,
  description,
  quantityUnit,
  sourceQty,       // the raw quantity from inventory
  fixedPricePerUnit,
  minimumOrderQuantity,
  harvestDate,
  conditionNotes,
}) {
  // Find existing non-deleted listing for this source record
  const existing = await Listing.findOne({
    sourceRecordType,
    sourceRecordId: mongoose.Types.ObjectId.isValid(sourceRecordId)
      ? new mongoose.Types.ObjectId(sourceRecordId)
      : sourceRecordId,
    status: { $ne: "sold" }, // don't touch sold-out listings
  });

  const reserved = existing ? Number(existing.quantityReserved || 0) : 0;
  const sold = existing ? Number(existing.quantitySold || 0) : 0;
  const available = Math.max(0, Math.round((sourceQty - reserved - sold) * 100) / 100);

  if (available <= 0) {
    // Deactivate rather than delete
    if (existing && existing.status !== "inactive") {
      existing.status = "inactive";
      existing.quantityAvailable = 0;
      existing.lastStockUpdatedAt = new Date();
      await existing.save({ validateBeforeSave: false });
      return { action: "deactivated", listingId: existing._id.toString() };
    }
    return { action: "skipped", reason: "No available quantity after reservations/sales" };
  }

  const fields = {
    farmerId,
    locationModel,
    locationId,
    sourceRecordType,
    sourceRecordId,
    category,
    title: title.slice(0, 120),
    description: (description || "").slice(0, 2000),
    quantityUnit,
    quantityAvailable: available,
    fixedPricePerUnit: Math.round(fixedPricePerUnit * 100) / 100,
    minimumOrderQuantity: minimumOrderQuantity || 1,
    status: "available",
    lastStockUpdatedAt: new Date(),
  };
  if (harvestDate) fields.harvestDate = harvestDate;
  if (conditionNotes) fields.conditionNotes = conditionNotes.slice(0, 500);

  if (existing) {
    // Preserve sold/reserved quantities
    Object.assign(existing, fields);
    // Re-check status consistency
    if (existing.quantityAvailable > 0) existing.status = "available";
    await existing.save({ validateBeforeSave: false });
    return { action: "updated", listingId: existing._id.toString() };
  }

  // Create new listing
  fields.quantityReserved = 0;
  fields.quantitySold = 0;
  const listing = new Listing(fields);
  await listing.save({ validateBeforeSave: false });
  return { action: "created", listingId: listing._id.toString() };
}

// ===========================================================================
// PUBLIC API
// ===========================================================================

/**
 * Sync a CropRecord into the marketplace.
 *
 * Eligible when: forSale=true, harvestQty > 0, marketSalePrice > 0,
 * harvestUnit maps to a canonical unit, harvestDate present.
 *
 * @param {object} cropRecord   - CropRecord mongoose document (already saved)
 * @param {string} userId       - Authenticated user's _id string
 * @returns {Promise<SyncResult>}
 */
async function syncCropRecord(cropRecord, userId) {
  try {
    if (!(await isAllowlistedUser(userId))) {
      return { synced: false, reason: "User not on allowlist" };
    }

    if (!cropRecord.forSale) {
      return { synced: false, reason: "Crop not marked for sale" };
    }

    const harvestQty = Number(cropRecord.harvestQty);
    const salePrice = Number(cropRecord.marketSalePrice);

    if (!harvestQty || harvestQty <= 0) {
      return { synced: false, reason: "Missing or zero harvest quantity" };
    }
    if (!salePrice || salePrice <= 0) {
      return { synced: false, reason: "Missing or invalid marketplace sale price" };
    }

    const unit = normalizeUnit(cropRecord.harvestUnit || "kg");
    if (!unit) {
      return { synced: false, reason: `Unit '${cropRecord.harvestUnit}' is not a valid marketplace unit` };
    }

    if (!cropRecord.harvestDate) {
      return { synced: false, reason: "Harvest date is required for marketplace listing" };
    }

    // Verify the CropFarm belongs to this user
    const cropFarm = await CropFarm.findOne({
      _id: cropRecord.cropFarmId,
      userId,
    }).lean();
    if (!cropFarm) {
      return { synced: false, reason: "CropFarm not found or not owned by this user" };
    }

    const title = `${cropRecord.cropName} (${cropRecord.cropType}) — ${cropRecord.season} harvest`;
    const description = cropRecord.notes
      ? `Harvest notes: ${cropRecord.notes}`
      : `${cropRecord.cropName} — ${cropRecord.season} season crop`;

    const result = await upsertListing({
      farmerId: userId,
      locationModel: "CropFarm",
      locationId: cropFarm._id,
      sourceRecordType: "CropRecord",
      sourceRecordId: cropRecord._id,
      category: "crop",
      title,
      description,
      quantityUnit: unit,
      sourceQty: harvestQty,
      fixedPricePerUnit: salePrice,
      minimumOrderQuantity: cropRecord.minOrderQty || 1,
      harvestDate: new Date(cropRecord.harvestDate),
      conditionNotes: cropRecord.conditionNotes || "",
    });

    return { synced: true, ...result };
  } catch (err) {
    console.error("[AutoSync] CropRecord sync error:", err.message);
    return { synced: false, reason: `Sync error: ${err.message}` };
  }
}

/**
 * Sync an Animal record into the marketplace (sale-designated animals only).
 *
 * Eligible when: forSale=true (animal.status === 'forSale' or explicit flag),
 * saleQty > 0, marketSalePrice > 0.
 *
 * @param {object} animal   - Animal mongoose document
 * @param {string} userId   - Authenticated user's _id string
 * @returns {Promise<SyncResult>}
 */
async function syncAnimal(animal, userId) {
  try {
    if (!(await isAllowlistedUser(userId))) {
      return { synced: false, reason: "User not on allowlist" };
    }

    // An animal is eligible only if explicitly offered for sale
    if (!animal.forSale) {
      return { synced: false, reason: "Animal not marked for sale" };
    }

    const saleQty = Number(animal.saleQty || 1);
    const salePrice = Number(animal.marketSalePrice);

    if (!salePrice || salePrice <= 0) {
      return { synced: false, reason: "Missing or invalid marketplace sale price" };
    }
    if (saleQty <= 0) {
      return { synced: false, reason: "Sale quantity must be positive" };
    }

    // Verify Farm ownership
    const farm = await Farm.findOne({ _id: animal.farmId }).lean();
    if (!farm) {
      return { synced: false, reason: "Farm not found for animal" };
    }
    if (farm.userId.toString() !== userId.toString()) {
      return { synced: false, reason: "Farm not owned by this user" };
    }

    const categoryLabel = animal.category || "Livestock";
    const title = `${categoryLabel} for Sale — ${animal.breed} (${animal.sex}, ${animal.age}yr)`;
    const description = `Breed: ${animal.breed}. Health: ${animal.healthStatus}.${
      animal.symptoms ? ` Notes: ${animal.symptoms}` : ""
    }`;

    const result = await upsertListing({
      farmerId: userId,
      locationModel: "Farm",
      locationId: farm._id,
      sourceRecordType: "Animal",
      sourceRecordId: animal._id,
      category: "livestock",
      title,
      description,
      quantityUnit: "head",
      sourceQty: saleQty,
      fixedPricePerUnit: salePrice,
      minimumOrderQuantity: 1,
      conditionNotes: `Health status: ${animal.healthStatus}`,
    });

    return { synced: true, ...result };
  } catch (err) {
    console.error("[AutoSync] Animal sync error:", err.message);
    return { synced: false, reason: `Sync error: ${err.message}` };
  }
}

/**
 * Sync a UnitResource into the marketplace.
 *
 * Eligible when: forSale=true, quantity > 0, marketSalePrice > 0,
 * unit maps to a canonical marketplace unit.
 * Only resourceTypes: Seeds, Fertilizer, Feeds (or any with explicit forSale).
 *
 * @param {object} resource   - UnitResource mongoose document
 * @param {string} userId     - Authenticated user's _id string
 * @returns {Promise<SyncResult>}
 */
async function syncUnitResource(resource, userId) {
  try {
    if (!(await isAllowlistedUser(userId))) {
      return { synced: false, reason: "User not on allowlist" };
    }

    if (!resource.forSale) {
      return { synced: false, reason: "Resource not marked for sale" };
    }

    const qty = Number(resource.quantity);
    const salePrice = Number(resource.marketSalePrice);

    if (!qty || qty <= 0) {
      return { synced: false, reason: "Zero quantity" };
    }
    if (!salePrice || salePrice <= 0) {
      return { synced: false, reason: "Missing or invalid marketplace sale price" };
    }

    const unit = normalizeUnit(resource.unit);
    if (!unit) {
      return { synced: false, reason: `Unit '${resource.unit}' is not a valid marketplace unit` };
    }

    // Verify Store ownership
    const store = await Store.findOne({ _id: resource.storeId, userId }).lean();
    if (!store) {
      return { synced: false, reason: "Store not found or not owned by this user" };
    }

    const title = `${resource.resourceType}: ${resource.resourceName}`;
    const description = resource.notes
      ? resource.notes
      : `${resource.resourceType} — ${resource.resourceName}`;

    const result = await upsertListing({
      farmerId: userId,
      locationModel: "Store",
      locationId: store._id,
      sourceRecordType: "UnitResource",
      sourceRecordId: resource._id,
      category: "other",
      title,
      description,
      quantityUnit: unit,
      sourceQty: qty,
      fixedPricePerUnit: salePrice,
      minimumOrderQuantity: resource.minOrderQty || 1,
    });

    return { synced: true, ...result };
  } catch (err) {
    console.error("[AutoSync] UnitResource sync error:", err.message);
    return { synced: false, reason: `Sync error: ${err.message}` };
  }
}

/**
 * Deactivate a listing when a source record is deleted or made unavailable.
 * Never hard-deletes the listing. Preserves photo and order history.
 *
 * @param {string} sourceRecordType
 * @param {string|ObjectId} sourceRecordId
 */
async function deactivateListingForSource(sourceRecordType, sourceRecordId) {
  try {
    await Listing.updateMany(
      {
        sourceRecordType,
        sourceRecordId,
        status: { $in: ["available", "inactive"] },
      },
      {
        $set: { status: "inactive", quantityAvailable: 0, lastStockUpdatedAt: new Date() },
      }
    );
  } catch (err) {
    console.error("[AutoSync] Deactivate error:", err.message);
  }
}

/**
 * Reconcile / backfill: find all eligible source records for the allowlisted
 * user and return a preview report. Does NOT save unless dryRun=false.
 *
 * @param {string} userId
 * @param {boolean} dryRun  - default true (safe preview)
 * @returns {Promise<ReconcileReport>}
 */
async function reconcileOwnerInventory(userId, dryRun = true) {
  if (!(await isAllowlistedUser(userId))) {
    return { allowed: false, message: "User not on allowlist" };
  }

  const CropRecord = require("../models/CropRecord");
  const Animal = require("../models/Animal");
  const UnitResource = require("../models/UnitResource");

  const report = {
    dryRun,
    cropRecords: [],
    animals: [],
    unitResources: [],
    summary: { created: 0, updated: 0, deactivated: 0, skipped: 0, missingData: 0 },
  };

  // --- Crop records ---
  const cropFarms = await CropFarm.find({ userId }).lean();
  const cropFarmIds = cropFarms.map((f) => f._id);
  const cropRecords = await CropRecord.find({ user: userId, cropFarmId: { $in: cropFarmIds }, forSale: true }).lean();

  for (const cr of cropRecords) {
    const missing = [];
    if (!cr.harvestQty || cr.harvestQty <= 0) missing.push("harvestQty");
    if (!cr.marketSalePrice || cr.marketSalePrice <= 0) missing.push("marketSalePrice");
    if (!cr.harvestDate) missing.push("harvestDate");
    if (!normalizeUnit(cr.harvestUnit || "kg")) missing.push("harvestUnit");

    if (missing.length > 0) {
      report.cropRecords.push({ id: cr._id, action: "missing_data", fields: missing });
      report.summary.missingData++;
      continue;
    }

    if (!dryRun) {
      const result = await syncCropRecord(cr, userId);
      report.cropRecords.push({ id: cr._id, ...result });
      if (result.action) report.summary[result.action]++;
    } else {
      report.cropRecords.push({ id: cr._id, action: "would_sync", cropName: cr.cropName });
    }
  }

  // --- Animals ---
  const farms = await Farm.find({ userId }).lean();
  const farmIds = farms.map((f) => f._id);
  const animals = await Animal.find({ farmId: { $in: farmIds }, forSale: true }).lean();

  for (const a of animals) {
    const missing = [];
    if (!a.marketSalePrice || a.marketSalePrice <= 0) missing.push("marketSalePrice");
    if (!a.saleQty || a.saleQty <= 0) missing.push("saleQty");

    if (missing.length > 0) {
      report.animals.push({ id: a._id, action: "missing_data", fields: missing });
      report.summary.missingData++;
      continue;
    }

    if (!dryRun) {
      const result = await syncAnimal(a, userId);
      report.animals.push({ id: a._id, ...result });
      if (result.action) report.summary[result.action]++;
    } else {
      report.animals.push({ id: a._id, action: "would_sync", category: a.category });
    }
  }

  // --- Unit resources ---
  const stores = await Store.find({ userId }).lean();
  const storeIds = stores.map((s) => s._id);
  const eligibleResourceTypes = ["Seeds", "Fertilizer", "Feeds"];
  const unitResources = await UnitResource.find({
    userId,
    storeId: { $in: storeIds },
    forSale: true,
    resourceType: { $in: eligibleResourceTypes },
  }).lean();

  for (const ur of unitResources) {
    const missing = [];
    if (!ur.marketSalePrice || ur.marketSalePrice <= 0) missing.push("marketSalePrice");
    if (!ur.quantity || ur.quantity <= 0) missing.push("quantity");
    if (!normalizeUnit(ur.unit)) missing.push("unit");

    if (missing.length > 0) {
      report.unitResources.push({ id: ur._id, action: "missing_data", fields: missing });
      report.summary.missingData++;
      continue;
    }

    if (!dryRun) {
      const result = await syncUnitResource(ur, userId);
      report.unitResources.push({ id: ur._id, ...result });
      if (result.action) report.summary[result.action]++;
    } else {
      report.unitResources.push({ id: ur._id, action: "would_sync", resourceName: ur.resourceName });
    }
  }

  return report;
}

module.exports = {
  isAllowlistedUser,
  syncCropRecord,
  syncAnimal,
  syncUnitResource,
  deactivateListingForSource,
  reconcileOwnerInventory,
  getAllowlistEmail,
  normalizeUnit,
};
