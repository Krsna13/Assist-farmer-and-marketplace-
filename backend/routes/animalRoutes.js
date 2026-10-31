/**
 * backend/routes/animalRoutes.js
 *
 * Extended with Marketplace Auto-Sync for the configured owner account.
 */
const express = require("express");
const Animal = require("../models/Animal");
const authMiddleware = require("../middlewares/authMiddleware");
const { syncAnimal, deactivateListingForSource } = require("../services/marketplaceAutoSyncService");
const Farm = require("../models/Farm");

const router = express.Router();

// Strip server-managed sync status fields from any client submission
function stripServerFields(body) {
  const copy = { ...body };
  delete copy.syncStatus;
  delete copy.syncListingId;
  delete copy.syncError;
  delete copy.lastSyncedAt;
  return copy;
}

// Resolve the Farm's owner userId from the farmId
async function getFarmOwnerId(farmId) {
  const farm = await Farm.findById(farmId).select("userId").lean();
  return farm ? farm.userId.toString() : null;
}

// Create a new animal
router.post("/", authMiddleware, async (req, res) => {
  try {
    const safeBody = stripServerFields(req.body);
    const animalData = {
      ...safeBody,
      forSale: !!safeBody.forSale,
      saleQty: safeBody.saleQty || 1,
      marketSalePrice: safeBody.marketSalePrice || null,
      saleConditionNotes: safeBody.saleConditionNotes || "",
    };

    const newAnimal = new Animal(animalData);
    await newAnimal.save();

    let syncResult = { synced: false, reason: "Auto-sync not attempted" };
    if (newAnimal.forSale) {
      const ownerId = await getFarmOwnerId(newAnimal.farmId);
      if (ownerId && ownerId === req.user.id) {
        syncResult = await syncAnimal(newAnimal, req.user.id);
        const statusFields = {
          syncStatus: syncResult.synced ? "synced" : "error",
          syncError: syncResult.synced ? null : syncResult.reason,
          lastSyncedAt: syncResult.synced ? new Date() : null,
        };
        if (syncResult.listingId) statusFields.syncListingId = syncResult.listingId;
        await Animal.findByIdAndUpdate(newAnimal._id, statusFields);
      }
    }

    res.status(201).json({ animal: newAnimal, syncResult });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "This animal ID is already in use. Animal ID must be unique." });
    }
    res.status(500).json({ message: "Error creating animal", error: error.message });
  }
});

// Get all animals for a specific farm
router.get("/farm/:farmId", authMiddleware, async (req, res) => {
  try {
    const animals = await Animal.find({ farmId: req.params.farmId });
    res.status(200).json(animals);
  } catch (error) {
    res.status(500).json({ message: "Error fetching animals", error: error.message });
  }
});

// Generate a unique Animal ID
router.get("/generate-id", authMiddleware, async (req, res) => {
  try {
    const { farmId, category } = req.query;
    if (!farmId || !category) {
      return res.status(400).json({ message: "Missing farmId or category" });
    }

    const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();

    const existingAnimals = await Animal.find({
      farmId,
      category: capitalizedCategory,
    });

    const ids = existingAnimals
      .map((a) => a.animalId)
      .filter((id) => id.startsWith(`FMS-Livestock-${capitalizedCategory}-`))
      .map((id) => parseInt(id.split("-").pop()))
      .filter((num) => !isNaN(num));

    const nextNumber = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    const newId = `FMS-Livestock-${capitalizedCategory}-${nextNumber}`;
    return res.status(200).json({ animalId: newId });
  } catch (error) {
    console.error("Error generating ID", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update an animal and re-sync if needed
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const safeBody = stripServerFields(req.body);

    const updated = await Animal.findByIdAndUpdate(
      req.params.id,
      safeBody,
      { new: true, runValidators: false }
    );
    if (!updated) return res.status(404).json({ message: "Animal not found" });

    // Verify ownership via Farm
    const ownerId = await getFarmOwnerId(updated.farmId);
    if (!ownerId || ownerId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    let syncResult = { synced: false, reason: "Auto-sync not attempted" };
    if (updated.forSale) {
      syncResult = await syncAnimal(updated, req.user.id);
      const statusFields = {
        syncStatus: syncResult.synced ? "synced" : "error",
        syncError: syncResult.synced ? null : syncResult.reason,
        lastSyncedAt: syncResult.synced ? new Date() : null,
      };
      if (syncResult.listingId) statusFields.syncListingId = syncResult.listingId;
      await Animal.findByIdAndUpdate(updated._id, statusFields);
    } else {
      await deactivateListingForSource("Animal", updated._id);
      await Animal.findByIdAndUpdate(updated._id, {
        syncStatus: "inactive",
        lastSyncedAt: new Date(),
      });
      syncResult = { synced: true, action: "deactivated", message: "Listing deactivated as animal is no longer for sale" };
    }

    res.status(200).json({ animal: updated, syncResult });
  } catch (error) {
    res.status(500).json({ message: "Error updating animal", error: error.message });
  }
});

// Delete an animal and deactivate associated listing
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const animal = await Animal.findById(req.params.id);
    if (!animal) return res.status(404).json({ message: "Animal not found" });

    const ownerId = await getFarmOwnerId(animal.farmId);
    if (!ownerId || ownerId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await Animal.findByIdAndDelete(req.params.id);
    await deactivateListingForSource("Animal", animal._id);
    res.status(200).json({ message: "Animal deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting animal", error: error.message });
  }
});

module.exports = router;
