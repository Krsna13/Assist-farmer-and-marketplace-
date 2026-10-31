import React, { useState } from "react";
import {
  FaEdit,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSpinner,
} from "react-icons/fa";

const CATEGORIES = ["crop", "livestock", "produce", "other"];

const EditListingModal = ({
  listing,
  onClose,
  onSuccess,
  apiBaseUrl = "http://localhost:5000/api/marketplace",
}) => {
  const [title, setTitle] = useState(listing ? listing.title : "");
  const [category, setCategory] = useState(listing ? listing.category : "crop");
  const [description, setDescription] = useState(listing ? listing.description || "" : "");
  const [fixedPrice, setFixedPrice] = useState(listing ? listing.fixedPricePerUnit : "");
  const [minimumBid, setMinimumBid] = useState(listing ? listing.minimumBidPerUnit || "" : "");
  const [minOrderQty, setMinOrderQty] = useState(listing ? listing.minimumOrderQuantity || 1 : 1);
  const [conditionNotes, setConditionNotes] = useState(listing ? listing.conditionNotes || "" : "");
  const [harvestDate, setHarvestDate] = useState(
    listing && listing.harvestDate ? new Date(listing.harvestDate).toISOString().slice(0, 10) : ""
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!listing) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const price = Number(fixedPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setErrorMessage("Fixed price per unit must be greater than 0.");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      const res = await fetch(`${apiBaseUrl}/farmer/listings/${listing.id || listing._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: title.trim(),
          category,
          description: description.trim(),
          fixedPricePerUnit: price,
          minimumBidPerUnit: minimumBid ? Number(minimumBid) : null,
          minimumOrderQuantity: minOrderQty ? Number(minOrderQty) : 1,
          conditionNotes: conditionNotes.trim(),
          harvestDate: harvestDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Update failed with status ${res.status}`);
      }

      if (onSuccess) {
        onSuccess(data.listing);
      }
      onClose();
    } catch (err) {
      console.error("Listing update error:", err);
      setErrorMessage(err.message || "Failed to update listing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 animate-scale-up text-gray-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-gray-800 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaEdit className="text-emerald-300 text-lg" />
            <h3 className="font-bold text-base">Edit Produce Listing</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded transition"
            title="Close"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2">
              <FaExclamationTriangle className="mt-0.5 flex-shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Produce Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-xs capitalize focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Fixed Price per {listing.quantityUnit} (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={fixedPrice}
                onChange={(e) => setFixedPrice(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Min Bid per {listing.quantityUnit} (Optional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={minimumBid}
                onChange={(e) => setMinimumBid(e.target.value)}
                placeholder="Leave blank for fixed only"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Min Order Quantity ({listing.quantityUnit})
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={minOrderQty}
                onChange={(e) => setMinOrderQty(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Harvest / Availability Date
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
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder="Detailed description of produce, quality, moisture, packaging..."
              className="w-full p-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Storage / Condition Notes
            </label>
            <textarea
              rows={2}
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              maxLength={500}
              placeholder="Stored in dry cold room, pesticide free..."
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
                  <FaSpinner className="animate-spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <FaCheckCircle /> Save Listing Details
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditListingModal;
