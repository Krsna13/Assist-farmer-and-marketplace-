import React, { useState, useEffect } from "react";
import {
  FaTimes,
  FaShoppingBag,
  FaShieldAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaClock,
  FaMapMarkerAlt,
} from "react-icons/fa";

const generateIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "BUY_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 9);
};

const BuyNowModal = ({
  listing,
  onClose,
  onOrderSuccess,
  apiBaseUrl = "http://localhost:5000/api/marketplace",
}) => {
  const [quantity, setQuantity] = useState(listing ? listing.minimumOrderQuantity || 1 : 1);
  const [shippingAddress, setShippingAddress] = useState("");
  const [city, setCity] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  useEffect(() => {
    setIdempotencyKey(generateIdempotencyKey());
  }, []);

  if (!listing) return null;

  const {
    id: listingId,
    title,
    fixedPricePerUnit,
    quantityUnit,
    quantityAvailable,
    minimumOrderQuantity = 1,
  } = listing;

  const parsedQty = Number(quantity) || 0;
  const calculatedSubtotal = Math.round(parsedQty * fixedPricePerUnit * 100) / 100;

  const isValidQty =
    parsedQty >= minimumOrderQuantity &&
    parsedQty <= quantityAvailable &&
    Number.isFinite(parsedQty) &&
    parsedQty > 0;

  const handleSubmitPurchase = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!isValidQty) {
      setErrorMessage(`Please enter a valid quantity between ${minimumOrderQuantity} and ${quantityAvailable} ${quantityUnit}.`);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setErrorMessage("Authentication token not found. Please log in again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        quantity: parsedQty,
        idempotencyKey,
        deliveryInfo: {
          shippingAddress: shippingAddress.trim(),
          city: city.trim(),
          contactPhone: contactPhone.trim(),
          deliveryNotes: deliveryNotes.trim(),
        },
      };

      const res = await fetch(`${apiBaseUrl}/listings/${listingId}/buy-now`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}: Failed to place purchase.`);
      }

      setConfirmedOrder(data.order);
      if (onOrderSuccess) {
        onOrderSuccess(data.order);
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-gray-200 my-auto text-gray-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-gray-900 text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-emerald-200 hover:text-white transition p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Close modal"
          >
            <FaTimes />
          </button>
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
            <FaShoppingBag /> Buy Now &bull; Instant Stock Reservation
          </div>
          <h3 className="text-xl font-black">{title}</h3>
          <p className="text-xs text-emerald-100/90 mt-1">
            Official Price: <strong>₹{fixedPricePerUnit}</strong> / {quantityUnit} &bull; Available: <strong>{quantityAvailable} {quantityUnit}</strong>
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {confirmedOrder ? (
            <div className="space-y-5 animate-fade-in text-center py-2">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner">
                <FaCheckCircle />
              </div>

              <div>
                <h4 className="text-xl font-black text-gray-900">Purchase Request Placed!</h4>
                <p className="text-xs text-gray-600 mt-1">
                  Inventory has been safely reserved in the database for your trade.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-left text-xs space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="font-semibold text-gray-600">Order Reference:</span>
                  <span className="font-mono font-black text-emerald-800">{confirmedOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="font-semibold text-gray-600">Reserved Quantity:</span>
                  <span className="font-bold text-gray-900">{parsedQty} {quantityUnit}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="font-semibold text-gray-600">Agreed Unit Price:</span>
                  <span className="font-bold text-gray-900">₹{fixedPricePerUnit} / {quantityUnit}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="font-semibold text-gray-600">Total Amount:</span>
                  <span className="font-black text-emerald-900 text-sm">₹{calculatedSubtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="font-semibold text-gray-600">Current Status:</span>
                  <span className="px-2 py-0.5 rounded-full font-bold uppercase text-[10px] bg-amber-100 text-amber-800 border border-amber-300">
                    {confirmedOrder.status || "Placed (Awaiting Farmer Confirmation)"}
                  </span>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-xs text-amber-900 text-left flex items-start gap-2">
                <FaClock className="text-amber-600 flex-shrink-0 mt-0.5 text-sm" />
                <p className="leading-relaxed">
                  <strong>24-Hour Confirmation Window:</strong> The grower has been notified. If the grower does not confirm the order within 24 hours, the stock reservation will expire automatically and release inventory.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition shadow-sm"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitPurchase} className="space-y-4 text-xs">
              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 flex items-start gap-2">
                  <FaExclamationTriangle className="text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Quantity Input */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="buy-quantity-input" className="font-bold text-gray-800">
                    Order Quantity ({quantityUnit}):
                  </label>
                  <span className="text-[11px] text-gray-500">
                    Min: {minimumOrderQuantity} &bull; Max: {quantityAvailable}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="buy-quantity-input"
                    type="number"
                    min={minimumOrderQuantity}
                    max={quantityAvailable}
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-gray-700 uppercase">{quantityUnit}</span>
                </div>
              </div>

              {/* Live Calculation Summary */}
              <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/80 space-y-2">
                <div className="flex justify-between text-gray-700">
                  <span>Unit Price:</span>
                  <span className="font-semibold">₹{fixedPricePerUnit} / {quantityUnit}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Quantity:</span>
                  <span className="font-semibold">{parsedQty || 0} {quantityUnit}</span>
                </div>
                <div className="border-t border-emerald-200 pt-2 flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-900">Calculated Subtotal:</span>
                  <span className="font-black text-emerald-900 text-base">
                    ₹{calculatedSubtotal > 0 ? calculatedSubtotal.toLocaleString() : 0}
                  </span>
                </div>
              </div>

              {/* Delivery & Contact Information */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-gray-900 flex items-center gap-1.5">
                  <FaMapMarkerAlt className="text-emerald-700" /> Delivery &amp; Contact Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="buy-phone-input" className="block text-gray-600 mb-1 font-medium">Contact Phone</label>
                    <input
                      id="buy-phone-input"
                      type="text"
                      placeholder="e.g. +91 98765 43210"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="buy-city-input" className="block text-gray-600 mb-1 font-medium">City / District</label>
                    <input
                      id="buy-city-input"
                      type="text"
                      placeholder="e.g. Pune, Maharashtra"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="buy-address-input" className="block text-gray-600 mb-1 font-medium">Delivery Destination / Warehouse</label>
                  <input
                    id="buy-address-input"
                    type="text"
                    placeholder="Street, Landmark, APMC Mandi or Warehouse Location"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="buy-notes-input" className="block text-gray-600 mb-1 font-medium">Special Transport / Packaging Notes</label>
                  <textarea
                    id="buy-notes-input"
                    rows="2"
                    placeholder="e.g. Gunny bag packaging preferred, delivery between 9 AM - 2 PM"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  ></textarea>
                </div>
              </div>

              {/* Safety & Idempotency Notice */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-[11px] text-gray-600 flex items-start gap-2">
                <FaShieldAlt className="text-emerald-700 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Atomic Transaction Protection:</strong> Your purchase is processed with a unique request key (<code>{idempotencyKey.slice(0, 16)}...</code>) preventing duplicate charges. Stock is atomically moved from available to reserved.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="w-1/3 py-2.5 px-4 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !isValidQty}
                  className={`w-2/3 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition shadow-sm flex items-center justify-center gap-2 ${
                    isSubmitting || !isValidQty
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-emerald-700 hover:bg-emerald-800"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Reserving Stock...</span>
                    </>
                  ) : (
                    <span>Confirm Purchase (₹{calculatedSubtotal.toLocaleString()})</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuyNowModal;
