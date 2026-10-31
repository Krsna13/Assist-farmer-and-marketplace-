import React, { useState, useEffect, useCallback } from "react";
import {
  FaTimes,
  FaMapMarkerAlt,
  FaCamera,
  FaCheckCircle,
  FaExclamationTriangle,
  FaStore,
  FaUser,
  FaInfoCircle,
  FaShieldAlt,
} from "react-icons/fa";
import { formatLocalDateTime, FRESHNESS_DISCLAIMER } from "./freshnessUtils";
import BuyNowModal from "./BuyNowModal";
import BidModal from "./BidModal";

const ListingDetailModal = ({
  listingId,
  onClose,
  onSelectFarm,
  onLoginRequired,
  isLoggedIn,
  apiBaseUrl = "http://localhost:5000/api/marketplace",
}) => {
  const [listing, setListing] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showWatermarked, setShowWatermarked] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);

  const fetchListingDetail = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch(`${apiBaseUrl}/listings/${listingId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Error ${res.status}: Failed to load listing`);
      }
      setListing(data.listing);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [listingId, apiBaseUrl]);

  useEffect(() => {
    if (listingId) {
      fetchListingDetail();
    }
  }, [listingId, fetchListingDetail]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-4 animate-fade-in">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold text-gray-700">Loading public listing details...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !listing) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
          <FaExclamationTriangle className="text-rose-500 text-3xl mx-auto" />
          <h3 className="text-lg font-bold text-gray-900">Unable to Open Listing</h3>
          <p className="text-xs text-gray-600">{errorMessage || "Listing not found or no longer available."}</p>
          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs px-5 py-2 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const {
    title,
    description,
    category,
    fixedPricePerUnit,
    quantityUnit,
    quantityAvailable,
    minimumOrderQuantity,
    minimumBidPerUnit,
    harvestDate,
    conditionNotes,
    isAvailable,
    availabilityMessage,
    lastStockUpdatedAt,
    locationSummary,
    farmer,
    photos = [],
  } = listing;

  const currentPhoto = photos[selectedPhotoIndex] || null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden border border-gray-200 my-auto text-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-900 to-gray-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-emerald-600/90 text-emerald-100 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {category}
            </span>
            <span className="text-xs text-emerald-200/80">Public Marketplace Discovery</span>
          </div>

          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
            aria-label="Close modal"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>

        {/* Modal Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 max-h-[80vh] overflow-y-auto">
          {/* Left Column: Photo Gallery & Freshness Timeline */}
          <div className="bg-gray-50 p-6 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col justify-between space-y-4">
            <div>
              {/* Main Photo Display */}
              <div className="relative h-64 md:h-72 w-full bg-black/10 rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
                {currentPhoto ? (
                  <img
                    src={
                      showWatermarked && currentPhoto.watermarkedUrl
                        ? currentPhoto.watermarkedUrl
                        : currentPhoto.imageUrl
                    }
                    alt={title}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-6 text-gray-400">
                    <FaCamera className="text-4xl mx-auto mb-2 text-gray-300" />
                    <p className="text-xs font-medium">No verified photograph uploaded</p>
                  </div>
                )}

                {/* Freshness Badge on Main Image */}
                {currentPhoto && currentPhoto.freshness && (
                  <span
                    className={`absolute top-3 right-3 text-xs font-bold px-3 py-1 rounded-full border shadow-md flex items-center gap-1.5 ${currentPhoto.freshness.badgeColor}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current"></span>
                    {currentPhoto.freshness.label}
                  </span>
                )}

                {/* Watermark Toggle */}
                {currentPhoto && currentPhoto.watermarkedUrl && (
                  <button
                    onClick={() => setShowWatermarked(!showWatermarked)}
                    className="absolute bottom-3 right-3 bg-black/70 hover:bg-black/90 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md backdrop-blur-xs transition flex items-center gap-1"
                  >
                    <FaShieldAlt className="text-emerald-400" />
                    Watermark: {showWatermarked ? "ON" : "OFF"}
                  </button>
                )}
              </div>

              {/* Photo Thumbnails */}
              {photos.length > 1 && (
                <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                  {photos.map((ph, idx) => (
                    <button
                      key={ph.id || idx}
                      onClick={() => setSelectedPhotoIndex(idx)}
                      className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 transition ${
                        selectedPhotoIndex === idx
                          ? "border-emerald-600 ring-2 ring-emerald-500/30 scale-105"
                          : "border-gray-200 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={ph.watermarkedUrl || ph.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Authoritative Photo Metadata */}
              {currentPhoto && (
                <div className="mt-4 bg-white rounded-xl p-3 border border-gray-200 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="font-medium">Authoritative Server Receipt:</span>
                    <span className="font-mono font-semibold text-emerald-900">
                      {formatLocalDateTime(currentPhoto.serverReceivedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-gray-600">
                    <span className="font-medium">Capture Method:</span>
                    <span className="capitalize font-semibold text-gray-800">
                      {currentPhoto.captureMethod ? currentPhoto.captureMethod.replace("_", " ") : "File Upload"}
                    </span>
                  </div>

                  {currentPhoto.conditionNotes && (
                    <div className="pt-1.5 border-t border-gray-100 text-gray-600">
                      <span className="font-medium block text-gray-500 text-[11px]">Grower Photo Notes:</span>
                      <p className="italic text-gray-800 mt-0.5">&ldquo;{currentPhoto.conditionNotes}&rdquo;</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Freshness Policy Disclaimer */}
            <div className="bg-emerald-50/80 rounded-xl p-3 border border-emerald-100 text-[11px] text-emerald-950 flex items-start gap-2">
              <FaInfoCircle className="text-emerald-700 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">{FRESHNESS_DISCLAIMER}</p>
            </div>
          </div>

          {/* Right Column: Listing Details & Seller Summary */}
          <div className="p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              {/* Availability Banner */}
              <div
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  isAvailable
                    ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                    : "bg-rose-50 text-rose-900 border-rose-200"
                }`}
              >
                {isAvailable ? (
                  <FaCheckCircle className="text-emerald-600" />
                ) : (
                  <FaExclamationTriangle className="text-rose-600" />
                )}
                <span>{availabilityMessage}</span>
              </div>

              {/* Title & Description */}
              <div>
                <h2 className="text-2xl font-black text-gray-900 leading-tight">{title}</h2>
                {description && (
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed whitespace-pre-line">
                    {description}
                  </p>
                )}
              </div>

              {/* Price & Quantity Panel */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50/50 rounded-2xl p-4 border border-emerald-200/80 space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-emerald-700 font-semibold block">Fixed Asking Price</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-emerald-950">
                        ₹{Number(fixedPricePerUnit).toLocaleString("en-IN")}
                      </span>
                      <span className="text-sm font-bold text-emerald-800">/ {quantityUnit}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-gray-500 font-medium block">Available Stock</span>
                    <span className="text-lg font-extrabold text-gray-900">
                      {Number(quantityAvailable).toLocaleString("en-IN")}{" "}
                      <span className="text-xs font-semibold text-gray-700">{quantityUnit}</span>
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs text-emerald-900">
                  <span>Minimum Order:</span>
                  <span className="font-bold">
                    {minimumOrderQuantity} {quantityUnit}
                  </span>
                </div>

                {minimumBidPerUnit && (
                  <div className="flex items-center justify-between text-xs text-emerald-800">
                    <span>Negotiation Floor (Min Bid):</span>
                    <span className="font-semibold">₹{minimumBidPerUnit} / {quantityUnit}</span>
                  </div>
                )}
              </div>

              {/* Producer & Virtual Farm Reference */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold text-xs">
                      <FaUser />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">
                        {farmer ? farmer.name : "Verified Agricultural Grower"}
                      </span>
                      <span className="text-[11px] text-gray-500">Verified Producer</span>
                    </div>
                  </div>

                  {locationSummary && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onSelectFarm) {
                          onSelectFarm(locationSummary.model, locationSummary.id);
                        }
                      }}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1.5 rounded-lg border border-emerald-200 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <FaStore /> Virtual Farm Profile &rarr;
                    </button>
                  )}
                </div>

                <div className="text-xs text-gray-500 pt-2 border-t border-gray-100 flex items-center gap-2">
                  <FaMapMarkerAlt className="text-emerald-600" />
                  <span>
                    Location: <strong>{locationSummary ? locationSummary.generalLocation : "Regional Farm Zone"}</strong>
                  </span>
                </div>
              </div>

              {/* Dates & Lot Specifics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {harvestDate && (
                  <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                    <span className="text-gray-500 text-[11px] block">Harvest Date:</span>
                    <span className="font-semibold text-gray-800">
                      {new Date(harvestDate).toLocaleDateString()}
                    </span>
                  </div>
                )}

                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                  <span className="text-gray-500 text-[11px] block">Stock Checked:</span>
                  <span className="font-semibold text-gray-800">
                    {lastStockUpdatedAt ? formatLocalDateTime(lastStockUpdatedAt) : "Initial lot stock"}
                  </span>
                </div>
              </div>

              {conditionNotes && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs text-gray-700">
                  <span className="font-bold text-gray-600 block text-[11px] mb-1">
                    Condition & Storage Notes:
                  </span>
                  <p>{conditionNotes}</p>
                </div>
              )}
            </div>

            {/* Transactional Actions (Stage 6 Buy Now & Bidding) */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 flex items-center gap-2">
                <FaShieldAlt className="text-emerald-700 flex-shrink-0" />
                <span>
                  <strong>Live Transaction Desk:</strong> Buy directly with instant stock reservation or submit a price offer to negotiate with the grower.
                </span>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
                >
                  Close
                </button>

                {!isLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLoginRequired();
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition shadow-sm flex items-center justify-center gap-1.5"
                  >
                    Sign In / Register to Buy or Bid
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => setShowBuyModal(true)}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5 ${
                        isAvailable
                          ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Buy Now (₹{fixedPricePerUnit}/{quantityUnit})
                    </button>

                    <button
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => setShowBidModal(true)}
                      className={`py-2.5 px-4 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 ${
                        isAvailable
                          ? "border-emerald-700 text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/70"
                          : "border-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Make Offer / Bid
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Buy Now Modal */}
      {showBuyModal && (
        <BuyNowModal
          listing={listing}
          onClose={() => setShowBuyModal(false)}
          onOrderSuccess={() => {
            // Re-fetch listing to update quantityAvailable in real time
            fetchListingDetail();
          }}
          apiBaseUrl={apiBaseUrl}
        />
      )}

      {/* Bidding Room Modal */}
      {showBidModal && (
        <BidModal
          listing={listing}
          onClose={() => setShowBidModal(false)}
          onBidUpdated={() => {
            fetchListingDetail();
          }}
          apiBaseUrl={apiBaseUrl}
        />
      )}
    </div>
  );
};

export default ListingDetailModal;
