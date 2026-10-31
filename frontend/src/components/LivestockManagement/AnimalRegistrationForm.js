/**
 * frontend/src/components/LivestockManagement/AnimalRegistrationForm.js
 *
 * Animal Registration with Marketplace Auto-Sync fields for the owner account.
 */
import React, { useState, useEffect } from "react";
import axios from "axios";
import useAutoSyncStatus from "../../hooks/useAutoSyncStatus";
import MarketplaceSyncBanner from "../shared/MarketplaceSyncBanner";

const AnimalRegistrationForm = ({ farmId }) => {
  const [sex, setSex] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [animalCategory, setAnimalCategory] = useState("");
  const [otherCategory, setOtherCategory] = useState("");
  const [weight, setWeight] = useState("");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [healthStatus, setHealthStatus] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [medicine, setMedicine] = useState("");
  const [feedType, setFeedType] = useState("");
  const [milkingQuantity, setMilkingQuantity] = useState("");
  const [status, setStatus] = useState("");
  // Sale fields
  const [forSale, setForSale] = useState(false);
  const [saleQty, setSaleQty] = useState("1");
  const [marketSalePrice, setMarketSalePrice] = useState("");
  const [saleConditionNotes, setSaleConditionNotes] = useState("");

  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  const [syncResult, setSyncResult] = useState(null);
  const [animalIdPlaceholder, setAnimalIdPlaceholder] = useState(
    "Animal ID will be generated after category selection"
  );

  const { autoPublishEnabled } = useAutoSyncStatus();

  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  };

  useEffect(() => {
    const generateAnimalId = async (categoryName) => {
      try {
        const capitalizedCategory = capitalizeFirstLetter(categoryName);
        const res = await axios.get(
          `http://localhost:5000/animals/generate-id?farmId=${farmId}&category=${capitalizedCategory}`,
          { headers: { Authorization: localStorage.getItem("token") } }
        );
        const { animalId: generatedId } = res.data;
        setAnimalId(generatedId);
        setAnimalIdPlaceholder(generatedId);
      } catch (error) {
        console.error("Failed to generate animal ID", error);
        setAnimalIdPlaceholder("Error generating ID. Try again.");
      }
    };

    if (animalCategory && animalCategory !== "Others") {
      generateAnimalId(animalCategory);
    } else if (animalCategory === "Others" && otherCategory.trim()) {
      generateAnimalId(otherCategory.trim());
    }
  }, [animalCategory, otherCategory, farmId]);

  const handleSave = async () => {
    setErrors({});
    setSyncResult(null);
    const newErrors = {};
    if (!animalId) newErrors.animalId = "Animal ID is not generated yet.";
    if (!animalCategory) newErrors.animalCategory = "Animal category is required.";
    if (animalCategory === "Others" && !otherCategory)
      newErrors.otherCategory = "Please specify the other category.";
    if (!sex) newErrors.sex = "Gender is required.";
    if (!weight) newErrors.weight = "Weight is required.";
    if (!breed) newErrors.breed = "Breed is required.";
    if (!age) newErrors.age = "Age is required.";
    if (!healthStatus) newErrors.healthStatus = "Health status is required.";
    if (!feedType) newErrors.feedType = "Feed type is required.";
    if (!status) newErrors.status = "Animal status is required.";
    if (sex === "female" && !milkingQuantity)
      newErrors.milkingQuantity = "Milking quantity is required for females.";

    // Sale validation
    if (forSale) {
      if (!marketSalePrice || Number(marketSalePrice) <= 0)
        newErrors.marketSalePrice = "Marketplace selling price is required (must be > 0)";
      if (!saleQty || Number(saleQty) <= 0)
        newErrors.saleQty = "Sale quantity must be at least 1";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTimeout(() => setErrors({}), 3000);
      return;
    }

    const formattedCategory =
      animalCategory === "Others"
        ? capitalizeFirstLetter(otherCategory)
        : capitalizeFirstLetter(animalCategory);

    const animalData = {
      farmId,
      animalId,
      category: formattedCategory,
      sex,
      weight,
      breed,
      age,
      healthStatus,
      symptoms,
      medicine,
      feedType,
      milkingQuantity: sex === "male" ? null : milkingQuantity,
      status,
      forSale,
      saleQty: forSale ? Number(saleQty) : 1,
      marketSalePrice: forSale && marketSalePrice ? Number(marketSalePrice) : null,
      saleConditionNotes: saleConditionNotes || "",
    };

    try {
      const response = await axios.post(
        "http://localhost:5000/animals",
        animalData,
        { headers: { Authorization: localStorage.getItem("token") } }
      );
      setSuccessMsg("Animal registered successfully!");
      if (response.data && response.data.syncResult) {
        setSyncResult(response.data.syncResult);
      }
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error) {
      console.error("Error saving animal data:", error);
      if (error.response && error.response.status === 400) {
        setErrors({ animalId: error.response.data.message });
      } else {
        setErrors({ general: "An unexpected error occurred. Please try again." });
      }
    }
  };

  return (
    <div className="mt-4 border p-4 rounded-lg">
      {successMsg && (
        <p className="text-green-600 text-center font-medium mb-2">{successMsg}</p>
      )}
      <form className="space-y-4">
        <div>
          <input
            type="text"
            placeholder={animalIdPlaceholder}
            value={animalId}
            disabled
            className="w-full border rounded-lg p-2 bg-gray-100 text-gray-600"
          />
          {errors.animalId && <p className="text-red-500 text-sm">{errors.animalId}</p>}
        </div>

        <div>
          <select
            className="w-full border rounded-lg p-2"
            value={animalCategory}
            onChange={(e) => setAnimalCategory(e.target.value)}
            required
          >
            <option value="">Select Animal Category</option>
            <option value="cow">Cow</option>
            <option value="buffalo">Buffalo</option>
            <option value="camel">Camel</option>
            <option value="sheep">Sheep</option>
            <option value="goat">Goat</option>
            <option value="Others">Others</option>
          </select>
          {errors.animalCategory && (
            <p className="text-red-500 text-sm">{errors.animalCategory}</p>
          )}
        </div>

        {animalCategory === "Others" && (
          <div>
            <input
              type="text"
              placeholder="Specify Other Category"
              value={otherCategory}
              onChange={(e) => setOtherCategory(e.target.value)}
              className="w-full border rounded-lg p-2"
              required
            />
            {errors.otherCategory && (
              <p className="text-red-500 text-sm">{errors.otherCategory}</p>
            )}
          </div>
        )}

        <div>
          <select
            className="w-full border rounded-lg p-2"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            required
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          {errors.sex && <p className="text-red-500 text-sm">{errors.sex}</p>}
        </div>

        <div>
          <input
            type="number"
            placeholder="Weight (kg)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full border rounded-lg p-2"
            required
          />
          {errors.weight && <p className="text-red-500 text-sm">{errors.weight}</p>}
        </div>

        <div>
          <input
            type="text"
            placeholder="Breed"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            className="w-full border rounded-lg p-2"
            required
          />
          {errors.breed && <p className="text-red-500 text-sm">{errors.breed}</p>}
        </div>

        <div>
          <input
            type="number"
            placeholder="Age (years)"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full border rounded-lg p-2"
            required
          />
          {errors.age && <p className="text-red-500 text-sm">{errors.age}</p>}
        </div>

        <div>
          <select
            className="w-full border rounded-lg p-2"
            value={healthStatus}
            onChange={(e) => setHealthStatus(e.target.value)}
            required
          >
            <option value="">Select Health Status</option>
            <option value="healthy">Healthy</option>
            <option value="sick">Sick</option>
            <option value="recovering">Recovering</option>
          </select>
          {errors.healthStatus && (
            <p className="text-red-500 text-sm">{errors.healthStatus}</p>
          )}
        </div>

        <div>
          <textarea
            placeholder="Symptoms (private — not published to marketplace)"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            className="w-full border rounded-lg p-2"
            rows="2"
          />
        </div>

        <div>
          <textarea
            placeholder="Medicine Prescribed (private)"
            value={medicine}
            onChange={(e) => setMedicine(e.target.value)}
            className="w-full border rounded-lg p-2"
            rows="2"
          />
        </div>

        <div>
          <select
            className="w-full border rounded-lg p-2"
            value={feedType}
            onChange={(e) => setFeedType(e.target.value)}
            required
          >
            <option value="">Select Feed Type</option>
            <option value="hay">Hay</option>
            <option value="grain">Grain</option>
            <option value="silage">Silage</option>
            <option value="Others">Others</option>
          </select>
          {errors.feedType && <p className="text-red-500 text-sm">{errors.feedType}</p>}
        </div>

        <div>
          <input
            type="number"
            placeholder="Milking Quantity (liters)"
            value={milkingQuantity}
            onChange={(e) => setMilkingQuantity(e.target.value)}
            className="w-full border rounded-lg p-2"
            disabled={sex === "male"}
            required={sex === "female"}
          />
          {errors.milkingQuantity && (
            <p className="text-red-500 text-sm">{errors.milkingQuantity}</p>
          )}
        </div>

        <div>
          <select
            className="w-full border rounded-lg p-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            required
          >
            <option value="">Select Animal Status</option>
            <option value="alive">Alive</option>
            <option value="dead">Dead</option>
            <option value="sold">Sold</option>
          </select>
          {errors.status && <p className="text-red-500 text-sm">{errors.status}</p>}
        </div>

        {/* ── Marketplace Sale section — owner only ── */}
        {autoPublishEnabled && (
          <div className="border border-emerald-300 bg-emerald-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🛒</span>
              <h3 className="text-base font-semibold text-emerald-800">
                Marketplace Auto-Sync
              </h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={forSale}
                onChange={(e) => setForSale(e.target.checked)}
                className="w-4 h-4 accent-emerald-600"
              />
              <span className="font-medium text-emerald-800">
                Offer this animal for sale on the Marketplace
              </span>
            </label>
            {forSale && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-emerald-800 mb-1">
                    Selling Price (₹ per head)*
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 15000"
                    min="0.01"
                    step="0.01"
                    value={marketSalePrice}
                    onChange={(e) => setMarketSalePrice(e.target.value)}
                    className="w-full p-2 border border-emerald-300 rounded bg-white"
                  />
                  {errors.marketSalePrice && (
                    <p className="text-red-600 text-sm mt-1">{errors.marketSalePrice}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Selling price — not feeding/purchase cost.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-emerald-800 mb-1">
                    Number of Animals for Sale (head)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={saleQty}
                    onChange={(e) => setSaleQty(e.target.value)}
                    className="w-full p-2 border border-emerald-300 rounded bg-white"
                  />
                  {errors.saleQty && (
                    <p className="text-red-600 text-sm mt-1">{errors.saleQty}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-emerald-800 mb-1">
                    Public Condition Notes (shown on listing)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Well-fed, vaccinated, healthy"
                    value={saleConditionNotes}
                    onChange={(e) => setSaleConditionNotes(e.target.value)}
                    className="w-full p-2 border border-emerald-300 rounded bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Symptoms and medicine details are never published.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 w-full"
        >
          Register Animal
        </button>
        {errors.general && (
          <p className="text-red-500 text-sm">{errors.general}</p>
        )}
      </form>

      <MarketplaceSyncBanner
        syncResult={syncResult}
        autoPublishEnabled={autoPublishEnabled}
      />
    </div>
  );
};

export default AnimalRegistrationForm;
