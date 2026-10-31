import React, { useState } from "react";
import {
  FaBoxes,
  FaTimes,
  FaExclamationTriangle,
  FaCheckCircle,
  FaLock,
  FaInfoCircle,
  FaSpinner,
} from "react-icons/fa";

/**
 * StockUpdateModal
 * Safely updates marketplace-available inventory.
 * Strictly preserves reserved and sold quantities and explains the distinction
 * from physical farm stock.
 */
const StockUpdateModal = ({
  listing,
  onClose,
  onSuccess,
  apiBaseUrl = "http://localhost:5000/api/marketplace",
}) => {
  const [newQuantity, setNewQuantity] = useState(
    listing ? listing.quantityAvailable : 0
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!listing) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const parsed = Number(newQuantity);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setErrorMessage("Available quantity must be a non-negative number.");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      const res = await fetch(`${apiBaseUrl}/farmer/listings/${listing.id || listing._id}/stock`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          quantityAvailable: parsed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Stock update failed with status ${res.status}`);
      }

      if (onSuccess) {
        onSuccess(data.stock);
      }
      onClose();
    } catch (err) {
      console.error("Stock update error:", err);
      setErrorMessage(err.message || "Failed to update stock quantity.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 animate-scale-up text-gray-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-gray-800 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaBoxes className="text-emerald-300 text-lg" />
            <h3 className="font-bold text-base">Update Marketplace Stock</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded transition"
            title="Close"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {listing.title}
            </h4>
            <p className="text-xs text-gray-500">
              Unit: <span className="font-bold uppercase text-emerald-700">{listing.unit || listing.quantityUnit}</span>
            </p>
          </div>

          {/* Current Stock Breakdown Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Current Inventory Breakdown
            </span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                <span className="text-gray-500 text-[10px] block">Marketplace Available</span>
                <span className="font-bold text-emerald-800 text-sm">
                  {listing.quantityAvailable} {listing.unit || listing.quantityUnit}
                </span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                <span className="text-gray-500 text-[10px] block flex items-center justify-center gap-1">
                  <FaLock className="text-[9px]" /> Reserved
                </span>
                <span className="font-bold text-amber-800 text-sm">
                  {listing.quantityReserved || 0} {listing.unit || listing.quantityUnit}
                </span>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                <span className="text-gray-500 text-[10px] block">Sold To Date</span>
                <span className="font-bold text-blue-800 text-sm">
                  {listing.quantitySold || 0} {listing.unit || listing.quantityUnit}
                </span>
              </div>
            </div>
          </div>

          {/* Safe Inventory Rule Explanation */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-start gap-2">
            <FaInfoCircle className="mt-0.5 text-emerald-600 flex-shrink-0" />
            <p className="text-[11px] leading-relaxed">
              <strong>Safe Stock Guarantee:</strong> Editing marketplace stock modifies only the quantity
              offered to buyers. Your physical farm records, existing buyer reservations, and completed
              sales remain strictly intact.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2">
              <FaExclamationTriangle className="mt-0.5 flex-shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Input Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              New Available Quantity ({listing.unit || listing.quantityUnit})
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              required
            />
            {Number(newQuantity) === 0 && (
              <p className="text-[11px] text-amber-700 mt-1">
                Setting available stock to 0 will pause this listing to prevent new buyer orders.
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
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
                  <FaSpinner className="animate-spin" /> Updating...
                </>
              ) : (
                <>
                  <FaCheckCircle /> Save Stock Update
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockUpdateModal;
