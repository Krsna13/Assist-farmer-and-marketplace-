import React, { useState } from "react";
import {
  FaTimes,
  FaGavel,
  FaHistory,
  FaCheck,
  FaBan,
  FaUndo,
  FaExchangeAlt,
  FaExclamationTriangle,
  FaInfoCircle,
} from "react-icons/fa";

const BidModal = ({
  listing,
  existingBid,
  currentUserId,
  currentUserRole = "buyer",
  onClose,
  onBidUpdated,
  apiBaseUrl = "http://localhost:5000/api/marketplace",
}) => {
  const [bid, setBid] = useState(existingBid || null);

  // New Bid / Counter Form State
  const [offeredPrice, setOfferedPrice] = useState(
    listing ? listing.minimumBidPerUnit || listing.fixedPricePerUnit || 1 : 1
  );
  const [offeredQuantity, setOfferedQuantity] = useState(
    listing ? listing.minimumOrderQuantity || 1 : 1
  );
  const [bidMessage, setBidMessage] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(48);

  // Counter mode toggle
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterQty, setCounterQty] = useState("");
  const [counterMsg, setCounterMsg] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!listing && !bid) return null;

  const listingTitle = listing ? listing.title : bid?.listingId?.title || "Produce Lot";
  const unit = listing ? listing.quantityUnit : bid?.listingId?.quantityUnit || "unit";
  const availableQty = listing ? listing.quantityAvailable : bid?.listingId?.quantityAvailable || 0;
  const minBid = listing ? listing.minimumBidPerUnit : null;
  const minOrderQty = listing ? listing.minimumOrderQuantity || 1 : 1;

  // Active negotiation details
  const activeOffer = bid ? bid.currentOffer : null;
  const isTerminal = bid && ["accepted", "rejected", "withdrawn", "expired"].includes(bid.status);

  // Determine if it is current user's turn to respond
  let isMyTurnToRespond = false;
  let isMyActiveOffer = false;

  if (bid && !isTerminal && activeOffer) {
    if (activeOffer.pendingResponderId) {
      isMyTurnToRespond = activeOffer.pendingResponderId.toString() === currentUserId?.toString();
    } else {
      isMyTurnToRespond =
        (activeOffer.pendingResponderRole === "farmer" && currentUserRole === "farmer") ||
        (activeOffer.pendingResponderRole === "buyer" && currentUserRole !== "farmer");
    }

    if (activeOffer.offeredBy) {
      isMyActiveOffer = activeOffer.offeredBy.toString() === currentUserId?.toString();
    }
  }

  // Handle Initial Bid Submit
  const handleCreateBid = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const parsedPrice = Number(offeredPrice);
    const parsedQty = Number(offeredQuantity);

    if (minBid && parsedPrice < minBid) {
      setErrorMessage(`Bid price cannot be lower than the seller's minimum bid of ₹${minBid}/${unit}.`);
      return;
    }
    if (parsedQty < minOrderQty) {
      setErrorMessage(`Bid quantity cannot be less than the minimum order quantity (${minOrderQty} ${unit}).`);
      return;
    }
    if (parsedQty > availableQty) {
      setErrorMessage(`Bid quantity (${parsedQty} ${unit}) exceeds available stock (${availableQty} ${unit}).`);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setErrorMessage("Please log in to submit a bid.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/listings/${listing.id || listing._id}/bids`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bidPricePerUnit: parsedPrice,
          quantity: parsedQty,
          message: bidMessage.trim(),
          expiresInHours: Number(expiresInHours),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit bid.");
      }

      setBid(data.bid);
      setSuccessMessage("Bid submitted successfully! The farmer has been notified.");
      if (onBidUpdated) onBidUpdated(data.bid);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Counter Offer
  const handleCounterSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const parsedPrice = Number(counterPrice);
    const parsedQty = Number(counterQty);

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setErrorMessage("Counter-offer price must be a positive number.");
      return;
    }
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setErrorMessage("Counter-offer quantity must be a positive number.");
      return;
    }

    const token = localStorage.getItem("token");
    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/bids/${bid._id}/counter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pricePerUnit: parsedPrice,
          quantity: parsedQty,
          message: counterMsg.trim(),
          expiresInHours: 48,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit counter-offer.");
      }

      setBid(data.bid);
      setShowCounterForm(false);
      setSuccessMessage("Counter-offer submitted successfully. Awaiting counterparty response.");
      if (onBidUpdated) onBidUpdated(data.bid);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Accept
  const handleAcceptBid = async () => {
    if (!window.confirm("Accept this offer? This will atomically reserve inventory and create an official purchase order.")) {
      return;
    }

    setErrorMessage("");
    const token = localStorage.getItem("token");
    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/bids/${bid._id}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to accept bid.");
      }

      setBid(data.bid);
      setSuccessMessage(`Offer accepted! Order #${data.order.orderNumber} created with reserved stock.`);
      if (onBidUpdated) onBidUpdated(data.bid);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reject
  const handleRejectBid = async () => {
    if (!window.confirm("Reject this offer? This negotiation will be closed.")) return;

    setErrorMessage("");
    const token = localStorage.getItem("token");
    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/bids/${bid._id}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject offer.");

      setBid(data.bid);
      setSuccessMessage("Offer has been rejected.");
      if (onBidUpdated) onBidUpdated(data.bid);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Withdraw
  const handleWithdrawBid = async () => {
    if (!window.confirm("Withdraw your active offer?")) return;

    setErrorMessage("");
    const token = localStorage.getItem("token");
    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/bids/${bid._id}/withdraw`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to withdraw offer.");

      setBid(data.bid);
      setSuccessMessage("Your offer has been withdrawn.");
      if (onBidUpdated) onBidUpdated(data.bid);
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
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-gray-200 my-auto text-gray-800 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-gray-900 to-emerald-950 text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-emerald-200 hover:text-white transition p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Close modal"
          >
            <FaTimes />
          </button>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FaGavel /> Price Negotiation &bull; {bid ? "Bidding Room" : "Submit Offer"}
          </div>
          <h3 className="text-lg md:text-xl font-black">{listingTitle}</h3>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 flex items-start gap-2">
              <FaExclamationTriangle className="text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 flex items-start gap-2">
              <FaCheck className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {!bid ? (
            /* New Bid Form */
            <form onSubmit={handleCreateBid} className="space-y-4">
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-2.5 text-emerald-950">
                <FaInfoCircle className="text-emerald-700 flex-shrink-0 mt-0.5 text-sm" />
                <p className="leading-relaxed">
                  <strong>Non-binding submission:</strong> Submitting a bid does not reserve inventory. Stock will be atomically locked only once the grower reviews and accepts your agreed price.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bid-price-input" className="block font-bold text-gray-700 mb-1">
                    Offered Price (₹ / {unit})
                  </label>
                  <input
                    id="bid-price-input"
                    type="number"
                    step="any"
                    min="0.01"
                    value={offeredPrice}
                    onChange={(e) => setOfferedPrice(e.target.value)}
                    required
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm font-bold text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {minBid && (
                    <span className="text-[10px] text-gray-500 mt-1 block">Min bid: ₹{minBid}/{unit}</span>
                  )}
                </div>

                <div>
                  <label htmlFor="bid-quantity-input" className="block font-bold text-gray-700 mb-1">
                    Desired Quantity ({unit})
                  </label>
                  <input
                    id="bid-quantity-input"
                    type="number"
                    step="any"
                    min={minOrderQty}
                    max={availableQty}
                    value={offeredQuantity}
                    onChange={(e) => setOfferedQuantity(e.target.value)}
                    required
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Avail: {availableQty} {unit} &bull; Min order: {minOrderQty}
                  </span>
                </div>
              </div>

              {/* Subtotal Preview */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-600">Total Offer Valuation:</span>
                <span className="font-black text-emerald-800 text-sm">
                  ₹{(Number(offeredPrice || 0) * Number(offeredQuantity || 0)).toLocaleString()}
                </span>
              </div>

              <div>
                <label htmlFor="bid-expiry-select" className="block font-bold text-gray-700 mb-1">Offer Response Window</label>
                <select
                  id="bid-expiry-select"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={24}>24 Hours</option>
                  <option value={48}>48 Hours (Recommended)</option>
                  <option value={72}>72 Hours</option>
                  <option value={168}>7 Days</option>
                </select>
              </div>

              <div>
                <label htmlFor="bid-message-input" className="block font-bold text-gray-700 mb-1">Message to Seller (Optional)</label>
                <textarea
                  id="bid-message-input"
                  rows="3"
                  maxLength={500}
                  placeholder="e.g. Inquiring for bulk delivery to Pune mandi. Willing to schedule immediate transport."
                  value={bidMessage}
                  onChange={(e) => setBidMessage(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-2.5 px-4 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? "Submitting..." : "Send Offer to Grower"}
                </button>
              </div>
            </form>
          ) : (
            /* Active Bid & Auditable History Room */
            <div className="space-y-4">
              {/* Negotiation Status Banner */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  bid.status === "accepted"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : bid.status === "rejected" || bid.status === "withdrawn"
                    ? "bg-rose-50 border-rose-300 text-rose-900"
                    : isMyTurnToRespond
                    ? "bg-amber-50 border-amber-300 text-amber-950"
                    : "bg-blue-50 border-blue-200 text-blue-900"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm uppercase tracking-wide">
                      Status: {bid.status}
                    </span>
                    {activeOffer && (
                      <span className="text-[11px] font-semibold bg-white/70 px-2 py-0.5 rounded-full border">
                        ₹{activeOffer.pricePerUnit}/{unit} &bull; {activeOffer.quantity} {unit}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1">
                    {bid.status === "accepted"
                      ? "Trade agreed! Purchase order created and inventory reserved."
                      : isMyTurnToRespond
                      ? "Action Required: You are the designated responder. You may Accept, Counter, or Reject."
                      : "Awaiting response from counterparty."}
                  </p>
                </div>

                {!isTerminal && (
                  <div className="text-right flex-shrink-0 text-[11px] font-mono">
                    Expires: {new Date(activeOffer?.expiresAt || bid.expiresAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              {!isTerminal && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {isMyTurnToRespond && (
                    <>
                      <button
                        type="button"
                        onClick={handleAcceptBid}
                        disabled={isSubmitting}
                        className="py-2 px-4 rounded-xl font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition flex items-center gap-1.5 shadow-sm"
                      >
                        <FaCheck /> Accept Active Offer
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCounterPrice(activeOffer?.pricePerUnit || "");
                          setCounterQty(activeOffer?.quantity || "");
                          setShowCounterForm(!showCounterForm);
                        }}
                        disabled={isSubmitting}
                        className="py-2 px-4 rounded-xl font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition flex items-center gap-1.5"
                      >
                        <FaExchangeAlt /> {showCounterForm ? "Close Counter Form" : "Make Counter-Offer"}
                      </button>

                      <button
                        type="button"
                        onClick={handleRejectBid}
                        disabled={isSubmitting}
                        className="py-2 px-4 rounded-xl font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 transition flex items-center gap-1.5"
                      >
                        <FaBan /> Reject
                      </button>
                    </>
                  )}

                  {isMyActiveOffer && (
                    <button
                      type="button"
                      onClick={handleWithdrawBid}
                      disabled={isSubmitting}
                      className="py-2 px-4 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition flex items-center gap-1.5"
                    >
                      <FaUndo /> Withdraw My Offer
                    </button>
                  )}
                </div>
              )}

              {/* Collapsible Counter-Offer Form */}
              {showCounterForm && !isTerminal && (
                <form
                  onSubmit={handleCounterSubmit}
                  className="bg-gray-50 border border-gray-300 rounded-xl p-4 space-y-3 animate-fade-in"
                >
                  <h4 className="font-bold text-gray-900 flex items-center gap-1.5">
                    <FaExchangeAlt className="text-emerald-700" /> Propose Counter-Offer
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="counter-price-input" className="block font-semibold text-gray-700 mb-1">
                        New Price (₹ / {unit})
                      </label>
                      <input
                        id="counter-price-input"
                        type="number"
                        step="any"
                        min="0.01"
                        value={counterPrice}
                        onChange={(e) => setCounterPrice(e.target.value)}
                        required
                        className="w-full p-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                      />
                    </div>
                    <div>
                      <label htmlFor="counter-quantity-input" className="block font-semibold text-gray-700 mb-1">
                        New Quantity ({unit})
                      </label>
                      <input
                        id="counter-quantity-input"
                        type="number"
                        step="any"
                        min="0.01"
                        max={availableQty}
                        value={counterQty}
                        onChange={(e) => setCounterQty(e.target.value)}
                        required
                        className="w-full p-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="counter-message-input" className="block font-semibold text-gray-700 mb-1">Notes / Terms</label>
                    <textarea
                      id="counter-message-input"
                      rows="2"
                      placeholder="Explain revised price or quantity terms..."
                      value={counterMsg}
                      onChange={(e) => setCounterMsg(e.target.value)}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    ></textarea>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCounterForm(false)}
                      className="py-1.5 px-3 bg-gray-200 text-gray-700 rounded-lg font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="py-1.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Counter-Offer"}
                    </button>
                  </div>
                </form>
              )}

              {/* Auditable Offer History Timeline */}
              <div className="pt-2 border-t border-gray-200 space-y-3">
                <h4 className="font-bold text-gray-900 flex items-center gap-1.5">
                  <FaHistory className="text-gray-500" /> Negotiation History ({bid.offerHistory?.length || 1})
                </h4>

                <div className="space-y-2">
                  {(bid.offerHistory && bid.offerHistory.length > 0
                    ? bid.offerHistory
                    : [
                        {
                          offerNumber: 1,
                          role: "buyer",
                          pricePerUnit: bid.bidPricePerUnit,
                          quantity: bid.quantity,
                          message: bid.message,
                          createdAt: bid.createdAt,
                        },
                      ]
                  ).map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex flex-col justify-between gap-1.5 ${
                        item.role === "buyer"
                          ? "bg-gray-50 border-gray-200"
                          : "bg-emerald-50/50 border-emerald-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold capitalize flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              item.role === "buyer" ? "bg-blue-600" : "bg-emerald-600"
                            }`}
                          ></span>
                          {item.role === "buyer" ? "Buyer Offer" : "Farmer Counter-Offer"} #{item.offerNumber || idx + 1}
                        </span>
                        <span className="font-mono text-gray-500 text-[10px]">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 font-semibold text-gray-800 text-xs">
                        <span>Price: <strong>₹{item.pricePerUnit}</strong>/{unit}</span>
                        <span>Quantity: <strong>{item.quantity}</strong> {unit}</span>
                        <span>Total: <strong>₹{(item.pricePerUnit * item.quantity).toLocaleString()}</strong></span>
                      </div>

                      {item.message && (
                        <p className="italic text-gray-600 text-[11px] pt-1 border-t border-gray-200/50">
                          &ldquo;{item.message}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BidModal;
