/**
 * backend/routes/unitResourceRoutes.js
 *
 * Extended with Marketplace Auto-Sync for the configured owner account.
 * Eligible resource types: Seeds, Fertilizer, Feeds (when forSale=true).
 */
const express = require("express");
const UnitResource = require("../models/UnitResource");
const UsageTracking = require("../models/UsageTracking");
const Store = require("../models/Store");
const authMiddleware = require("../middlewares/authMiddleware");
const { syncUnitResource, deactivateListingForSource } = require("../services/marketplaceAutoSyncService");

const router = express.Router();

// Strip server-controlled fields from any client body
function stripServerFields(body) {
  const copy = { ...body };
  delete copy.syncStatus;
  delete copy.syncListingId;
  delete copy.syncError;
  delete copy.lastSyncedAt;
  delete copy.userId; // always taken from JWT
  return copy;
}

// Create a new unit-based resource
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      storeId,
      resourceType,
      resourceName,
      uniqueId,
      quantity,
      unit,
      costPerUnit,
      totalCost,
      dateAdded,
      notes,
      // Sale fields
      forSale,
      marketSalePrice,
      minOrderQty,
    } = stripServerFields(req.body);
    const userId = req.user.id;

    // Verify store belongs to user
    const store = await Store.findOne({ _id: storeId, userId });
    if (!store) {
      return res.status(404).json({ message: "Store not found or not owned by you." });
    }

    // Scoped uniqueness check
    const existingResource = await UnitResource.findOne({ userId, storeId, uniqueId });
    if (existingResource) {
      return res.status(400).json({ message: "Unit ID already exists for this store and user." });
    }

    const newResource = new UnitResource({
      userId,
      storeId,
      resourceType,
      resourceName,
      uniqueId,
      quantity,
      unit,
      costPerUnit,
      totalCost,
      dateAdded,
      notes,
      forSale: !!forSale,
      marketSalePrice: marketSalePrice || null,
      minOrderQty: minOrderQty || 1,
    });
    await newResource.save();

    let syncResult = { synced: false, reason: "Auto-sync not attempted" };
    if (newResource.forSale) {
      syncResult = await syncUnitResource(newResource, userId);
      const statusFields = {
        syncStatus: syncResult.synced ? "synced" : "error",
        syncError: syncResult.synced ? null : syncResult.reason,
        lastSyncedAt: syncResult.synced ? new Date() : null,
      };
      if (syncResult.listingId) statusFields.syncListingId = syncResult.listingId;
      await UnitResource.findByIdAndUpdate(newResource._id, statusFields);
    }

    res.status(201).json({ resource: newResource, syncResult });
  } catch (error) {
    res.status(500).json({ message: "Error creating unit-based resource", error: error.message });
  }
});

// Update a unit resource (and re-sync if needed)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const safeBody = stripServerFields(req.body);
    const userId = req.user.id;

    const existing = await UnitResource.findOne({ _id: req.params.id, userId });
    if (!existing) return res.status(404).json({ message: "Resource not found." });

    Object.assign(existing, safeBody);
    await existing.save();

    let syncResult = { synced: false, reason: "Auto-sync not attempted" };
    if (existing.forSale) {
      syncResult = await syncUnitResource(existing, userId);
      const statusFields = {
        syncStatus: syncResult.synced ? "synced" : "error",
        syncError: syncResult.synced ? null : syncResult.reason,
        lastSyncedAt: syncResult.synced ? new Date() : null,
      };
      if (syncResult.listingId) statusFields.syncListingId = syncResult.listingId;
      await UnitResource.findByIdAndUpdate(existing._id, statusFields);
    } else {
      await deactivateListingForSource("UnitResource", existing._id);
      await UnitResource.findByIdAndUpdate(existing._id, {
        syncStatus: "inactive",
        lastSyncedAt: new Date(),
      });
      syncResult = { synced: true, action: "deactivated", message: "Listing deactivated as resource is no longer for sale" };
    }

    res.status(200).json({ resource: existing, syncResult });
  } catch (error) {
    res.status(500).json({ message: "Error updating unit-based resource", error: error.message });
  }
});

// Delete a unit resource and deactivate associated listing
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await UnitResource.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ message: "Resource not found" });
    await deactivateListingForSource("UnitResource", deleted._id);
    res.status(200).json({ message: "Resource deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting unit-based resource", error: error.message });
  }
});

// Track resource usage
router.post("/usage", authMiddleware, async (req, res) => {
  try {
    const {
      storeId,
      resourceId,
      quantityUsed,
      usagePurpose,
      dateOfUsage,
      notes,
    } = req.body;

    const newUsage = new UsageTracking({
      storeId,
      resourceId,
      quantityUsed,
      usagePurpose,
      dateOfUsage,
      notes,
    });
    await newUsage.save();
    res.status(201).json(newUsage);
  } catch (error) {
    res.status(500).json({ message: "Error tracking resource usage", error: error.message });
  }
});

// Get all unit-based resources for a specific store
router.get("/:storeId", authMiddleware, async (req, res) => {
  try {
    const resources = await UnitResource.find({ storeId: req.params.storeId });
    res.status(200).json(resources);
  } catch (error) {
    res.status(500).json({ message: "Error fetching unit-based resources", error: error.message });
  }
});

// Generate unique ID for unit resources
router.get("/generate-id/:storeId", authMiddleware, async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;

    const store = await Store.findOne({ _id: storeId, userId });
    if (!store) return res.status(404).json({ message: "Store not found" });

    const prefix = `FMS-${store.name}-Unit-`;
    const existing = await UnitResource.find({ storeId, userId });
    const usedNumbers = new Set();

    existing.forEach((resource) => {
      if (resource.uniqueId.startsWith(prefix)) {
        const numStr = resource.uniqueId.replace(prefix, "");
        const num = parseInt(numStr);
        if (!isNaN(num)) usedNumbers.add(num);
      }
    });

    let nextNumber = 1;
    while (usedNumbers.has(nextNumber)) nextNumber++;

    const newId = `${prefix}${nextNumber}`;
    res.status(200).json({ id: newId });
  } catch (error) {
    res.status(500).json({ message: "Error generating ID", error: error.message });
  }
});

module.exports = router;
