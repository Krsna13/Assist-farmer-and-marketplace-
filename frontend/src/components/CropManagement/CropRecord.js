/**
 * frontend/src/components/CropManagement/CropRecord.js
 *
 * Crop Record form with Marketplace Auto-Sync fields.
 * Sale fields are shown only to the account with auto-publish enabled
 * (verified via backend — not based on client-side state).
 */
import React, { useEffect, useState } from "react";
import axios from "axios";
import useAutoSyncStatus from "../../hooks/useAutoSyncStatus";
import MarketplaceSyncBanner from "../shared/MarketplaceSyncBanner";

const HARVEST_UNITS = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "quintal", label: "Quintals" },
  { value: "tonne", label: "Tonnes" },
  { value: "litre", label: "Litres" },
  { value: "piece", label: "Pieces" },
];

const CropRecord = ({ cropFarmId }) => {
  const [formData, setFormData] = useState({
    season: "",
    cropType: "",
    cropName: "",
    duration: "",
    seedingDate: "",
    seedQuantity: "",
    notes: "",
    // Harvest / sale fields
    harvestDate: "",
    harvestQty: "",
    harvestUnit: "kg",
    conditionNotes: "",
    forSale: false,
    marketSalePrice: "",
    minOrderQty: "1",
  });

  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [recordId, setRecordId] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  const { autoPublishEnabled } = useAutoSyncStatus();

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `http://localhost:5000/crop-records/${cropFarmId}`,
          { headers: { Authorization: token } }
        );

        if (res.data && res.data.length > 0) {
          const existing = res.data[0];
          setFormData({
            season: existing.season || "",
            cropType: existing.cropType || "",
            cropName: existing.cropName || "",
            duration: existing.duration || "",
            seedingDate: existing.seedingDate?.substring(0, 10) || "",
            seedQuantity: existing.seedQuantity || "",
            notes: existing.notes || "",
            harvestDate: existing.harvestDate
              ? new Date(existing.harvestDate).toISOString().substring(0, 10)
              : "",
            harvestQty: existing.harvestQty || "",
            harvestUnit: existing.harvestUnit || "kg",
            conditionNotes: existing.conditionNotes || "",
            forSale: !!existing.forSale,
            marketSalePrice: existing.marketSalePrice || "",
            minOrderQty: existing.minOrderQty || "1",
          });
          setIsEditMode(true);
          setRecordId(existing._id);
        }
      } catch (err) {
        console.error("Error fetching crop record:", err);
      }
    };

    fetchRecord();
  }, [cropFarmId]);

  const validate = () => {
    const newErrors = {};

    if (!formData.season.trim()) newErrors.season = "Season is required";
    if (!formData.cropType.trim()) newErrors.cropType = "Crop type is required";
    if (!formData.cropName.trim()) newErrors.cropName = "Crop name is required";
    if (!formData.duration || isNaN(formData.duration))
      newErrors.duration = "Valid duration is required";
    if (!formData.seedQuantity || isNaN(formData.seedQuantity))
      newErrors.seedQuantity = "Valid seed quantity is required";
    if (!formData.seedingDate.trim())
      newErrors.seedingDate = "Seeding date is required";

    // Harvest / sale validation (only if any harvest field is filled)
    if (formData.harvestQty && isNaN(formData.harvestQty))
      newErrors.harvestQty = "Harvest quantity must be a number";
    if (formData.harvestQty && Number(formData.harvestQty) < 0)
      newErrors.harvestQty = "Harvest quantity cannot be negative";

    if (formData.forSale) {
      if (!formData.harvestQty || Number(formData.harvestQty) <= 0)
        newErrors.harvestQty =
          "Harvest quantity is required to publish to marketplace";
      if (!formData.harvestDate)
        newErrors.harvestDate = "Harvest date is required to publish to marketplace";
      if (!formData.marketSalePrice || Number(formData.marketSalePrice) <= 0)
        newErrors.marketSalePrice =
          "Marketplace selling price is required (must be > 0)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
    setErrors({ ...errors, [name]: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSyncResult(null);

    try {
      const token = localStorage.getItem("token");
      const payload = {
        ...formData,
        harvestQty: formData.harvestQty ? Number(formData.harvestQty) : null,
        marketSalePrice: formData.marketSalePrice
          ? Number(formData.marketSalePrice)
          : null,
        minOrderQty: formData.minOrderQty ? Number(formData.minOrderQty) : 1,
        duration: Number(formData.duration),
        seedQuantity: Number(formData.seedQuantity),
      };

      let data;
      if (isEditMode && recordId) {
        const res = await axios.put(
          `http://localhost:5000/crop-records/${recordId}`,
          payload,
          { headers: { Authorization: token } }
        );
        data = res.data;
        setSuccessMsg("Crop Record Updated Successfully!");
      } else {
        const res = await axios.post(
          "http://localhost:5000/crop-records",
          { ...payload, cropFarmId },
          { headers: { Authorization: token } }
        );
        data = res.data;
        setSuccessMsg("Crop Record Created Successfully!");
      }

      // Handle sync result from backend response
      if (data && data.syncResult) {
        setSyncResult(data.syncResult);
      }

      setErrors({});
    } catch (err) {
      console.error(err);
      setSuccessMsg("");
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Error saving crop record.";
      setErrors({ general: msg });
      setTimeout(() => setErrors({}), 3000);
    }
  };

  return (
    <div className="w-4/5 mx-auto my-5 p-5 border border-gray-300 rounded-lg bg-gray-50 shadow-md flex flex-col gap-4">
      <h2 className="text-center text-2xl text-green-700">
        {isEditMode ? "Edit Crop Record" : "Create Crop Record"}
      </h2>

      {successMsg && (
        <p className="text-green-600 text-center font-medium">{successMsg}</p>
      )}
      {errors.general && (
        <p className="text-red-600 text-center font-medium text-sm">
          {errors.general}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* ── Basic crop fields ── */}
        <select
          name="season"
          value={formData.season}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        >
          <option value="">Select Season</option>
          <option value="rabi">Rabi</option>
          <option value="kharif">Kharif</option>
        </select>
        {errors.season && <p className="text-red-500 text-sm">{errors.season}</p>}

        <input
          type="text"
          name="cropType"
          placeholder="Crop Type (e.g. Vegetable, Grain, Fruit)"
          value={formData.cropType}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        {errors.cropType && <p className="text-red-500 text-sm">{errors.cropType}</p>}

        <input
          type="text"
          name="cropName"
          placeholder="Crop Name (e.g. Onion, Wheat, Mango)"
          value={formData.cropName}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        {errors.cropName && <p className="text-red-500 text-sm">{errors.cropName}</p>}

        <input
          type="number"
          name="duration"
          placeholder="Duration (days)"
          value={formData.duration}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        {errors.duration && <p className="text-red-500 text-sm">{errors.duration}</p>}

        <input
          type="number"
          name="seedQuantity"
          placeholder="Seed Quantity (kg)"
          value={formData.seedQuantity}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        {errors.seedQuantity && <p className="text-red-500 text-sm">{errors.seedQuantity}</p>}

        <label htmlFor="seedingDate" className="font-medium text-gray-700">
          Seeding Date (Date when crop was planted 👇)
        </label>
        <input
          type="date"
          name="seedingDate"
          value={formData.seedingDate}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        {errors.seedingDate && <p className="text-red-500 text-sm">{errors.seedingDate}</p>}

        <textarea
          name="notes"
          placeholder="Additional Notes (private — not published)"
          value={formData.notes}
          onChange={handleChange}
          className="w-full p-2 border rounded h-20"
        />

        {/* ── Harvest section ── */}
        <div className="border-t border-gray-200 pt-4 mt-2">
          <h3 className="text-lg font-semibold text-green-700 mb-2">
            🌾 Harvest Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Harvest Date
              </label>
              <input
                type="date"
                name="harvestDate"
                value={formData.harvestDate}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
              {errors.harvestDate && (
                <p className="text-red-500 text-sm mt-1">{errors.harvestDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Available Harvest Quantity
              </label>
              <input
                type="number"
                name="harvestQty"
                placeholder="e.g. 500"
                min="0"
                step="0.01"
                value={formData.harvestQty}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
              {errors.harvestQty && (
                <p className="text-red-500 text-sm mt-1">{errors.harvestQty}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Harvest Unit
              </label>
              <select
                name="harvestUnit"
                value={formData.harvestUnit}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              >
                {HARVEST_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition Notes (public)
              </label>
              <input
                type="text"
                name="conditionNotes"
                placeholder="e.g. Grade A, air-cured, dry"
                value={formData.conditionNotes}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
        </div>

        {/* ── Marketplace Sale section — owner only ── */}
        {autoPublishEnabled && (
          <div className="border border-emerald-300 bg-emerald-50 rounded-lg p-4 mt-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🛒</span>
              <h3 className="text-lg font-semibold text-emerald-800">
                Automatic Marketplace Publishing
              </h3>
            </div>
            <p className="text-sm text-emerald-700 mb-3">
              Your account has automatic marketplace sync enabled. Check the box
              below and fill in the selling price to publish this crop
              automatically when you save.
            </p>

            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input
                type="checkbox"
                name="forSale"
                checked={formData.forSale}
                onChange={handleChange}
                className="w-4 h-4 accent-emerald-600"
              />
              <span className="font-medium text-emerald-800">
                List this crop for sale on the Marketplace
              </span>
            </label>

            {formData.forSale && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-emerald-800 mb-1">
                    Marketplace Selling Price (₹ per {formData.harvestUnit})*
                  </label>
                  <input
                    type="number"
                    name="marketSalePrice"
                    placeholder="e.g. 2400"
                    min="0.01"
                    step="0.01"
                    value={formData.marketSalePrice}
                    onChange={handleChange}
                    className="w-full p-2 border border-emerald-300 rounded bg-white"
                    required={formData.forSale}
                  />
                  {errors.marketSalePrice && (
                    <p className="text-red-600 text-sm mt-1">
                      {errors.marketSalePrice}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    This is the public selling price — not your cost price.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-emerald-800 mb-1">
                    Minimum Order Quantity
                  </label>
                  <input
                    type="number"
                    name="minOrderQty"
                    placeholder="e.g. 10"
                    min="1"
                    step="0.01"
                    value={formData.minOrderQty}
                    onChange={handleChange}
                    className="w-full p-2 border border-emerald-300 rounded bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          {isEditMode ? "Update" : "Save"}
        </button>
      </form>

      {/* Sync result banner */}
      <MarketplaceSyncBanner
        syncResult={syncResult}
        autoPublishEnabled={autoPublishEnabled}
      />
    </div>
  );
};

export default CropRecord;
