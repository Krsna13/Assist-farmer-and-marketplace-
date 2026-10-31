import React, { useState, useEffect } from "react";
import {
  FaSeedling,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSpinner,
  FaMapMarkerAlt,
  FaLink,
} from "react-icons/fa";

const ALLOWED_UNITS = ["kg", "quintal", "tonne", "litre", "piece", "head"];
const ALLOWED_CATEGORIES = ["crop", "livestock", "produce", "other"];

const normalizeUnit = (unit) => {
  if (!unit || typeof unit !== "string") return unit;
  const lower = unit.toLowerCase().trim();
  if (lower === "ton" || lower === "tons" || lower === "metric ton") return "tonne";
  if (lower === "liter" || lower === "liters" || lower === "l") return "litre";
  if (lower === "pc" || lower === "pcs") return "piece";
  if (lower === "quintals" || lower === "qtl") return "quintal";
  return lower;
};

const getCategoryUnits = (cat) => {
  if (cat === "livestock") return ["head", "piece"];
  if (cat === "crop" || cat === "produce") return ["kg", "quintal", "tonne", "litre", "piece"];
  return ALLOWED_UNITS;
};

const PublishListingModal = ({
  initialSourceItem = null,
  locations = null,
  onClose,
  onSuccess,
  apiBaseUrl = "http://localhost:5000/api/marketplace",
}) => {
  const [sourceType] = useState(
    initialSourceItem ? initialSourceItem.sourceRecordType : null
  );
  const [sourceId] = useState(
    initialSourceItem ? initialSourceItem.sourceRecordId : null
  );
  const [locationModel, setLocationModel] = useState(
    initialSourceItem ? initialSourceItem.locationModel : "CropFarm"
  );
  const [locationId, setLocationId] = useState(
    initialSourceItem ? initialSourceItem.locationId : ""
  );

  const [title, setTitle] = useState(
    initialSourceItem ? initialSourceItem.title : ""
  );
  const [category, setCategory] = useState(
    initialSourceItem ? initialSourceItem.suggestedCategory || "crop" : "crop"
  );
  const [quantityUnit, setQuantityUnit] = useState(
    initialSourceItem ? normalizeUnit(initialSourceItem.suggestedUnit) || "kg" : "kg"
  );
  const [quantityAvailable, setQuantityAvailable] = useState(
    initialSourceItem ? initialSourceItem.availablePhysicalStock || "" : ""
  );
  const [fixedPrice, setFixedPrice] = useState(
    initialSourceItem && initialSourceItem.suggestedPrice ? initialSourceItem.suggestedPrice : ""
  );
  const [minimumBid, setMinimumBid] = useState("");
  const [minimumOrderQuantity, setMinimumOrderQuantity] = useState(1);
  const [description, setDescription] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [harvestDate, setHarvestDate] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Auto-select first location if not set
  useEffect(() => {
    if (!locationId && locations) {
      if (locationModel === "CropFarm" && locations.cropFarms && locations.cropFarms[0]) {
        setLocationId(locations.cropFarms[0].id);
      } else if (locationModel === "Farm" && locations.farms && locations.farms[0]) {
        setLocationId(locations.farms[0].id);
      } else if (locationModel === "Store" && locations.stores && locations.stores[0]) {
        setLocationId(locations.stores[0].id);
      }
    }
  }, [locationModel, locationId, locations]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!title.trim()) {
      setErrorMessage("Please enter a produce title.");
      return;
    }

    if (!locationId) {
      setErrorMessage("Please select a farm or store inventory location.");
      return;
    }

    const qty = Number(quantityAvailable);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorMessage("Available quantity must be greater than 0.");
      return;
    }

    const price = Number(fixedPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setErrorMessage("Fixed price per unit must be greater than 0.");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      const res = await fetch(`${apiBaseUrl}/farmer/listings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          locationModel,
          locationId,
          sourceRecordType: sourceType || null,
          sourceRecordId: sourceId || null,
          category,
          title: title.trim(),
          description: description.trim(),
          quantityUnit: normalizeUnit(quantityUnit),
          quantityAvailable: qty,
          fixedPricePerUnit: price,
          minimumBidPerUnit: minimumBid ? Number(minimumBid) : null,
          minimumOrderQuantity: minimumOrderQuantity ? Number(minimumOrderQuantity) : 1,
          conditionNotes: conditionNotes.trim(),
          harvestDate: harvestDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to publish with status ${res.status}`);
      }

      if (onSuccess) {
        onSuccess(data.listing);
      }
      onClose();
    } catch (err) {
      console.error("Publish listing error:", err);
      setErrorMessage(err.message || "Failed to publish listing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-gray-200 animate-scale-up text-gray-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaSeedling className="text-emerald-300 text-lg" />
            <h3 className="font-bold text-base">Publish to Farm Marketplace</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded transition"
            title="Close"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Source Link Information Banner */}
          {sourceType ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2.5">
              <FaLink className="mt-0.5 text-emerald-600 flex-shrink-0" />
              <div>
                <span className="font-bold block">
                  Publishing from Farm Record: {sourceType}
                </span>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Linked to location: <strong>{initialSourceItem ? initialSourceItem.locationName : locationModel}</strong>.
                  Marketplace listing is independent of physical inventory balances.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-700 flex items-start gap-2.5">
              <FaMapMarkerAlt className="mt-0.5 text-gray-500 flex-shrink-0" />
              <div>
                <span className="font-bold block text-gray-900">Direct Farm Listing</span>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Publishing a lot not linked to a specific farm record. Please choose the source location.
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2">
              <FaExclamationTriangle className="mt-0.5 flex-shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Location Selector (if independent listing or multiple locations available) */}
          {!sourceType && locations && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Location Model *
                </label>
                <select
                  value={locationModel}
                  onChange={(e) => {
                    setLocationModel(e.target.value);
                    setLocationId("");
                  }}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  <option value="CropFarm">Crop Farm</option>
                  <option value="Farm">Livestock Farm</option>
                  <option value="Store">Warehouse / Store</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Specific Location *
                </label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                >
                  <option value="">-- Choose Location --</option>
                  {locationModel === "CropFarm" &&
                    locations.cropFarms &&
                    locations.cropFarms.map((cf) => (
                      <option key={cf.id} value={cf.id}>
                        {cf.name}
                      </option>
                    ))}
                  {locationModel === "Farm" &&
                    locations.farms &&
                    locations.farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  {locationModel === "Store" &&
                    locations.stores &&
                    locations.stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Listing Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Organic Sharbati Wheat Lot"
              className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              required
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const newCat = e.target.value;
                  setCategory(newCat);
                  const validUnits = getCategoryUnits(newCat);
                  if (!validUnits.includes(quantityUnit)) {
                    setQuantityUnit(validUnits[0]);
                  }
                }}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-xs capitalize focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                {ALLOWED_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Quantity Unit *
              </label>
              <select
                value={quantityUnit}
                onChange={(e) => setQuantityUnit(normalizeUnit(e.target.value))}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-xs uppercase font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                {getCategoryUnits(category).map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Available Marketplace Quantity *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={quantityAvailable}
                onChange={(e) => setQuantityAvailable(e.target.value)}
                placeholder="e.g. 500"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Fixed Price per {quantityUnit} (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={fixedPrice}
                onChange={(e) => setFixedPrice(e.target.value)}
                placeholder="e.g. 45"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>
          </div>

          {/* Subtotal preview */}
          {Number(quantityAvailable) > 0 && Number(fixedPrice) > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-900 flex justify-between items-center">
              <span className="font-medium text-emerald-800">Estimated Total Value:</span>
              <span className="font-bold font-mono text-emerald-950">
                ₹{(Number(quantityAvailable) * Number(fixedPrice)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-emerald-700 font-normal ml-1">
                  ({quantityAvailable} {quantityUnit} @ ₹{fixedPrice}/{quantityUnit})
                </span>
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Min Bid per {quantityUnit} (Optional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={minimumBid}
                onChange={(e) => setMinimumBid(e.target.value)}
                placeholder="Leave blank if fixed-only"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Min Order Quantity ({quantityUnit})
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={minimumOrderQuantity}
                onChange={(e) => setMinimumOrderQuantity(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Harvest / Ready-by Date (Optional)
            </label>
            <input
              type="date"
              value={harvestDate}
              onChange={(e) => setHarvestDate(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder="Provide quality details, grain grade, or delivery logistics..."
              className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Condition Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              maxLength={500}
              placeholder="e.g. Moisture level < 12%, pesticide free, freshly harvested..."
              className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-semibold px-5 py-2 rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <FaSpinner className="animate-spin" /> Publishing...
                </>
              ) : (
                <>
                  <FaCheckCircle /> Publish Listing Now
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PublishListingModal;
