import React, { useState, useEffect } from "react";
import {
  FaTimes,
  FaStore,
  FaMapMarkerAlt,
  FaSeedling,
  FaBoxes,
  FaCamera,
  FaShieldAlt,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaUserCheck,
} from "react-icons/fa";
import { formatLocalDateTime } from "./freshnessUtils";

const FarmProfileModal = ({
  locationModel,
  locationId,
  onClose,
  onSelectListing,
  apiBaseUrl = "http://localhost:5000/api/marketplace",
}) => {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchFarmProfile = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch(`${apiBaseUrl}/farms/${locationModel}/${locationId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `Error ${res.status}: Failed to load farm profile`);
        }
        if (isMounted) {
          setProfile(data.farm);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (locationModel && locationId) {
      fetchFarmProfile();
    }

    return () => {
      isMounted = false;
    };
  }, [locationModel, locationId, apiBaseUrl]);

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
          <p className="text-sm font-semibold text-gray-700">Loading virtual farm profile...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !profile) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
          <FaExclamationTriangle className="text-rose-500 text-3xl mx-auto" />
          <h3 className="text-lg font-bold text-gray-900">Unable to Load Farm</h3>
          <p className="text-xs text-gray-600">{errorMessage || "Virtual farm profile not found."}</p>
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
    name,
    model,
    generalLocation,
    producerName,
    memberSince,
    cropSummary = [],
    livestockSummary = [],
    activeListingCount,
    activeListings = [],
    recentPhotos = [],
  } = profile;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden border border-gray-200 my-auto text-gray-800 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-gray-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-emerald-200 hover:text-white transition p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Close modal"
          >
            <FaTimes className="text-lg" />
          </button>

          <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <FaStore /> Public Virtual Farm Profile &bull; {model}
          </div>

          <h2 className="text-2xl md:text-3xl font-black">{name}</h2>

          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-emerald-100/90">
            <span className="flex items-center gap-1.5">
              <FaMapMarkerAlt className="text-emerald-400" />
              General Location: <strong>{generalLocation}</strong>
            </span>

            <span className="flex items-center gap-1.5">
              <FaUserCheck className="text-yellow-400" />
              Grower: <strong>{producerName}</strong>
            </span>

            {memberSince && (
              <span className="flex items-center gap-1.5">
                <FaCalendarAlt className="text-emerald-300" />
                Joined: {new Date(memberSince).getFullYear()}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Privacy Note */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2.5">
            <FaShieldAlt className="text-emerald-700 text-base flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Farmstead Privacy Protection:</strong> This public virtual farm profile shares verified produce and crop listings while protecting the grower&apos;s private land deeds, boundary coordinates, and financial records.
            </p>
          </div>

          {/* Crops & Agricultural Overview */}
          {(cropSummary.length > 0 || livestockSummary.length > 0) && (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <FaSeedling className="text-emerald-600" /> Agricultural Activity Overview
              </h3>

              {cropSummary.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-gray-500 block mb-1.5">
                    Currently Cultivated Crops:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {cropSummary.map((crop, idx) => (
                      <span
                        key={idx}
                        className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-1 rounded-full font-medium"
                      >
                        {crop}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {livestockSummary.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-gray-500 block mb-1.5">
                    Livestock Profile:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {livestockSummary.map((an, idx) => (
                      <span
                        key={idx}
                        className="bg-amber-100 text-amber-800 border border-amber-200 text-xs px-2.5 py-1 rounded-full font-medium"
                      >
                        {an}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Marketplace Listings from this Farm */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FaBoxes className="text-emerald-700" /> Available Produce Lots ({activeListingCount})
              </h3>
              <span className="text-xs text-gray-500">Live Inventory</span>
            </div>

            {activeListings.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-500 text-xs">
                No active lots currently published from this location.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeListings.map((lot) => (
                  <div
                    key={lot.id}
                    className="bg-white rounded-xl p-3.5 border border-gray-200 hover:border-emerald-500 transition shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          {lot.category}
                        </span>
                        <span className="text-xs font-extrabold text-emerald-900">
                          ₹{lot.pricePerUnit} / {lot.unit}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{lot.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Available: <strong>{lot.quantityAvailable} {lot.unit}</strong>
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        {lot.lastStockUpdatedAt ? `Checked ${formatLocalDateTime(lot.lastStockUpdatedAt)}` : "Live Stock"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onSelectListing) onSelectListing(lot.id);
                        }}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition"
                      >
                        View Lot &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Permitted Inventory Photo Timeline */}
          {recentPhotos.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <FaCamera className="text-blue-600" /> Recent Inventory Photo Timeline
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {recentPhotos.map((p) => (
                  <div
                    key={p.id}
                    className="relative rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group h-28"
                  >
                    <img
                      src={p.watermarkedUrl || p.imageUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                    />
                    {p.freshness && (
                      <span
                        className={`absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shadow-2xs ${p.freshness.badgeColor}`}
                      >
                        {p.freshness.label}
                      </span>
                    )}
                    <span className="absolute bottom-1 left-1 right-1 text-[9px] text-white bg-black/60 px-1 py-0.5 rounded backdrop-blur-2xs truncate font-mono">
                      {formatLocalDateTime(p.serverReceivedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-900 text-white font-semibold text-xs px-5 py-2 rounded-xl transition"
          >
            Close Farm Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default FarmProfileModal;
