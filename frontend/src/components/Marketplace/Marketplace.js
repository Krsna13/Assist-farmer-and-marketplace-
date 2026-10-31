import React, { useState, useEffect, useCallback } from "react";
import {
  FaSearch,
  FaFilter,
  FaStore,
  FaArrowLeft,
  FaSeedling,
  FaInfoCircle,
  FaLock,
  FaUserTag,
  FaBoxes,
  FaTachometerAlt,
  FaMapMarkedAlt,
  FaThLarge,
  FaRedo,
  FaChevronLeft,
  FaChevronRight,
  FaSortAmountDown,
  FaLeaf,
  FaShoppingBag,
} from "react-icons/fa";
import FarmerDashboard from "./FarmerDashboard";
import ListingCard from "./ListingCard";
import ListingDetailModal from "./ListingDetailModal";
import FarmProfileModal from "./FarmProfileModal";
import MarketplaceMap from "./MarketplaceMap";
import OrdersModal from "./OrdersModal";

const CANONICAL_UNITS = ["kg", "quintal", "tonne", "litre", "piece", "head"];

const CATEGORY_TABS = [
  { id: "all", label: "All Produce" },
  { id: "crop", label: "Crops & Grains" },
  { id: "produce", label: "Fresh Produce" },
  { id: "livestock", label: "Livestock" },
  { id: "other", label: "Resources & Seeds" },
];

const FRESHNESS_OPTIONS = [
  { id: "all", label: "All Photos" },
  { id: "fresh", label: "Fresh Today (≤ 24h)" },
  { id: "recent", label: "Recent Photo (1-7d)" },
  { id: "stale", label: "Photo Outdated (> 7d)" },
  { id: "no_photo", label: "No Photo" },
];

const SORT_OPTIONS = [
  { id: "newest", label: "Newest Listings" },
  { id: "price_asc", label: "Price: Low to High" },
  { id: "price_desc", label: "Price: High to Low" },
  { id: "latest_stock", label: "Latest Stock Check" },
  { id: "latest_photo", label: "Latest Photo Upload" },
];

const Marketplace = ({
  onBackToLanding,
  onLoginRequired,
  isLoggedIn,
  userRole,
  apiBaseUrl = "http://localhost:5000/api/marketplace",
}) => {
  // Navigation / View Modes
  const [viewMode, setViewMode] = useState("buyer"); // 'buyer' | 'farmer_dashboard'
  const [displayView, setDisplayView] = useState("grid"); // 'grid' | 'map'
  const [showFilters, setShowFilters] = useState(false);
  const [previewNotification, setPreviewNotification] = useState("");

  // Modals state
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [selectedFarm, setSelectedFarm] = useState(null); // { model, id }
  const [showOrdersModal, setShowOrdersModal] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [selectedFreshness, setSelectedFreshness] = useState("all");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState("newest");
  const [page, setPage] = useState(1);

  // Data State
  const [listings, setListings] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1); // Reset page on new search
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset page when key filters change
  const handleCategoryChange = (catId) => {
    setSelectedCategory(catId);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setSelectedCategory("all");
    setSelectedUnit("all");
    setMinPrice("");
    setMaxPrice("");
    setMinQuantity("");
    setSelectedFreshness("all");
    setLocationQuery("");
    setSelectedSort("newest");
    setPage(1);
  };

  const activeFilterCount =
    (debouncedSearch ? 1 : 0) +
    (selectedCategory !== "all" ? 1 : 0) +
    (selectedUnit !== "all" ? 1 : 0) +
    (minPrice !== "" ? 1 : 0) +
    (maxPrice !== "" ? 1 : 0) +
    (minQuantity !== "" ? 1 : 0) +
    (selectedFreshness !== "all" ? 1 : 0) +
    (locationQuery ? 1 : 0);

  // Fetch Public Marketplace Listings
  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    setFetchError("");

    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedCategory && selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedUnit && selectedUnit !== "all") {
        params.set("unit", selectedUnit);
        if (minPrice !== "") params.set("minPrice", minPrice);
        if (maxPrice !== "") params.set("maxPrice", maxPrice);
      }
      if (minQuantity !== "") params.set("minQuantity", minQuantity);
      if (selectedFreshness && selectedFreshness !== "all") params.set("freshness", selectedFreshness);
      if (locationQuery) params.set("location", locationQuery.trim());
      if (selectedSort) {
        const isPriceSort = selectedSort === "price_asc" || selectedSort === "price_desc";
        if (!isPriceSort || (selectedUnit && selectedUnit !== "all")) {
          params.set("sort", selectedSort);
        }
      }
      params.set("page", page);
      params.set("limit", 12);

      const res = await fetch(`${apiBaseUrl}/listings?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}: Failed to fetch listings`);
      }

      setListings(data.listings || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error("Marketplace fetch error:", err);
      setFetchError(err.message);
      setListings([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    debouncedSearch,
    selectedCategory,
    selectedUnit,
    minPrice,
    maxPrice,
    minQuantity,
    selectedFreshness,
    locationQuery,
    selectedSort,
    page,
    apiBaseUrl,
  ]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Auth & Action Guards
  const handleProtectedAction = (actionType, requiredRole = null) => {
    if (!isLoggedIn) {
      setPreviewNotification(
        "Authentication required: Please log in or sign up to interact with marketplace listings."
      );
      setTimeout(() => {
        onLoginRequired();
      }, 700);
      return;
    }

    const effectiveRole = userRole || "farmer";
    if (requiredRole && effectiveRole !== requiredRole && effectiveRole !== "farmer") {
      setPreviewNotification(
        `Access Notice: This action requires '${requiredRole}' privileges. Your current active role is '${effectiveRole}'.`
      );
      return;
    }

    if (actionType === "listProduce") {
      if (effectiveRole === "farmer") {
        setViewMode("farmer_dashboard");
      } else {
        setPreviewNotification(
          "Produce publishing is available for registered Farmers. Your current role is " + effectiveRole
        );
      }
    } else if (actionType === "placeBid" || actionType === "buyProduce") {
      setPreviewNotification(
        "Bidding and checkout transactions will become active once listings are opened for public bidding in Stage 6."
      );
    }
  };

  // If in Farmer Dashboard mode, delegate to Stage 4 FarmerDashboard component
  if (viewMode === "farmer_dashboard") {
    return (
      <FarmerDashboard
        onBackToBuyerMarketplace={() => setViewMode("buyer")}
        onBackToHome={onBackToLanding}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-gray-50 to-emerald-50/30 text-gray-800 flex flex-col justify-between">
      <div>
        {/* Top Header / Breadcrumb Bar */}
        <header className="bg-emerald-900 text-white shadow-md sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={onBackToLanding}
                className="flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-700 text-white font-medium px-3.5 py-1.5 rounded-lg transition shadow-xs text-xs"
                title="Return to Main Dashboard"
              >
                <FaArrowLeft /> Dashboard
              </button>
              <span className="text-emerald-400">/</span>
              <span className="text-emerald-100 font-bold text-sm tracking-tight flex items-center gap-1.5">
                <FaLeaf className="text-emerald-400" /> Smart Agri Marketplace
              </span>
            </div>

            {/* User Session & Role Controls */}
            <div className="flex items-center gap-2.5">
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={() => setShowOrdersModal(true)}
                  className="flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-xs border border-emerald-600/50 cursor-pointer"
                  title="View order requests and trade contracts"
                >
                  <FaShoppingBag className="text-yellow-300" />
                  <span>{userRole === "farmer" ? "Incoming Orders" : "My Orders"}</span>
                </button>
              )}

              {isLoggedIn && (!userRole || userRole === "farmer") && (
                <button
                  onClick={() => setViewMode("farmer_dashboard")}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-xs border border-emerald-400/40 cursor-pointer"
                >
                  <FaTachometerAlt className="text-yellow-300" /> Farmer Dashboard
                </button>
              )}

              {isLoggedIn ? (
                <div className="flex items-center gap-1.5 bg-emerald-950/70 px-3 py-1.5 rounded-full border border-emerald-700/60 text-xs text-emerald-100">
                  <FaUserTag className="text-emerald-300" />
                  <span className="capitalize font-bold text-yellow-300">
                    {userRole ? userRole.replace("_", " ") : "Farmer"}
                  </span>
                </div>
              ) : (
                <button
                  onClick={onLoginRequired}
                  className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 rounded-full text-xs font-semibold text-white transition shadow-xs cursor-pointer"
                >
                  <FaLock className="text-yellow-300" /> Sign In / Register
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-gray-900 text-white py-10 px-4 sm:px-6 relative overflow-hidden shadow-inner">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#34d399_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="max-w-5xl mx-auto text-center relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/80 border border-emerald-600 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
              <FaStore /> Direct Farm-to-Buyer Exchange &bull; Public Inventory Discovery
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight">
              Farm Marketplace
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-emerald-100/90 max-w-2xl mx-auto leading-relaxed">
              Discover real farm produce lots, check live grower stock, and inspect authoritative server-received photo timelines with verified timestamps.
            </p>

            {/* Quick Actions */}
            <div className="pt-2 flex flex-wrap justify-center gap-2.5">
              <button
                onClick={() => handleProtectedAction("listProduce", "farmer")}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold px-4 py-2 rounded-lg shadow-md transition flex items-center gap-1.5 text-xs"
              >
                <FaSeedling /> + Publish Produce Lot
              </button>
              <button
                onClick={() => setDisplayView(displayView === "grid" ? "map" : "grid")}
                className="bg-white/10 hover:bg-white/20 text-white font-medium border border-white/20 px-4 py-2 rounded-lg transition flex items-center gap-1.5 text-xs backdrop-blur-xs"
              >
                {displayView === "grid" ? (
                  <>
                    <FaMapMarkedAlt className="text-emerald-300" /> Explore on Farm Map
                  </>
                ) : (
                  <>
                    <FaThLarge className="text-emerald-300" /> View Inventory Grid
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Step 9: Transparent Simulated Demo Dataset Indicator */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-900 font-medium flex flex-wrap items-center justify-center gap-2 shadow-xs">
          <span className="bg-amber-200 text-amber-900 text-[10.5px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wide">
            DEMO DATASET ACTIVE
          </span>
          <span>
            Demonstration Mode: Displaying 25 simulated Nashik agricultural producers & regional lots for academic demonstration.
          </span>
        </div>

        {/* Toast Notification */}
        {previewNotification && (
          <div className="max-w-4xl mx-auto mt-4 px-4 sm:px-6">
            <div className="bg-emerald-50 border-l-4 border-emerald-600 p-3.5 rounded-r-lg shadow-sm flex items-start justify-between gap-3 animate-fade-in text-xs text-emerald-950">
              <div className="flex items-center gap-2.5">
                <FaInfoCircle className="text-emerald-600 text-base flex-shrink-0" />
                <p>{previewNotification}</p>
              </div>
              <button
                onClick={() => setPreviewNotification("")}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                &times;
              </button>
            </div>
          </div>
        )}

        {/* Main Discovery Interface */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Search, Filter Bar, and View Controls */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-4">
            {/* Search Input & View Toggles */}
            <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
              {/* Search Bar */}
              <div className="relative w-full md:w-96">
                <FaSearch className="absolute left-3.5 top-3.5 text-gray-400 text-xs" />
                <input
                  type="text"
                  placeholder="Search crops, produce lots, seeds (e.g. Wheat, Basmati, Tomato)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-xs outline-none"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* View & Filter Toggle Controls */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                {/* Filter Toggle */}
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                    showFilters || activeFilterCount > 0
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <FaFilter className="text-emerald-600" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* Sort Selector */}
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <FaSortAmountDown className="text-gray-400" />
                  <select
                    value={selectedSort}
                    onChange={(e) => setSelectedSort(e.target.value)}
                    className="p-1.5 border border-gray-200 rounded-xl text-xs bg-gray-50 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {SORT_OPTIONS.map((opt) => {
                      const isPriceSort = opt.id === "price_asc" || opt.id === "price_desc";
                      const isDisabled = isPriceSort && selectedUnit === "all";
                      return (
                        <option key={opt.id} value={opt.id} disabled={isDisabled}>
                          {opt.label} {isDisabled ? "(Requires Unit Selection)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Grid vs Map Toggle */}
                <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => setDisplayView("grid")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                      displayView === "grid"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <FaThLarge /> Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayView("map")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                      displayView === "map"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <FaMapMarkedAlt /> Map
                  </button>
                </div>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-gray-100">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleCategoryChange(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex-shrink-0 ${
                    selectedCategory === tab.id
                      ? "bg-emerald-700 text-white shadow-2xs"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Collapsible Advanced Filters Drawer */}
            {showFilters && (
              <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 animate-fade-in">
                {/* Canonical Unit Filter */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Quantity Unit</label>
                  <select
                    value={selectedUnit}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      setSelectedUnit(newUnit);
                      if (newUnit === "all") {
                        setMinPrice("");
                        setMaxPrice("");
                        if (selectedSort === "price_asc" || selectedSort === "price_desc") {
                          setSelectedSort("newest");
                        }
                      }
                      setPage(1);
                    }}
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-emerald-500 uppercase font-medium"
                  >
                    <option value="all">All Units</option>
                    {CANONICAL_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Min / Max Price Filter */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1 flex items-center justify-between">
                    <span>Price Range {selectedUnit !== "all" ? `(₹ / ${selectedUnit})` : "(Select Unit First)"}</span>
                    {selectedUnit === "all" && (
                      <span className="text-[10px] text-amber-600 font-semibold">Unit required</span>
                    )}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="number"
                      placeholder={selectedUnit !== "all" ? `Min ₹/${selectedUnit}` : "Select unit"}
                      value={minPrice}
                      disabled={selectedUnit === "all"}
                      onChange={(e) => {
                        setMinPrice(e.target.value);
                        setPage(1);
                      }}
                      min="0"
                      className={`w-full p-2 border rounded-lg text-xs outline-none transition ${
                        selectedUnit === "all"
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-white border-gray-300 focus:ring-2 focus:ring-emerald-500"
                      }`}
                    />
                    <input
                      type="number"
                      placeholder={selectedUnit !== "all" ? `Max ₹/${selectedUnit}` : "Select unit"}
                      value={maxPrice}
                      disabled={selectedUnit === "all"}
                      onChange={(e) => {
                        setMaxPrice(e.target.value);
                        setPage(1);
                      }}
                      min="0"
                      className={`w-full p-2 border rounded-lg text-xs outline-none transition ${
                        selectedUnit === "all"
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-white border-gray-300 focus:ring-2 focus:ring-emerald-500"
                      }`}
                    />
                  </div>
                  {selectedUnit === "all" ? (
                    <p className="text-[10px] text-amber-600 mt-1 leading-tight">
                      Prices across different units (e.g. ₹/kg vs ₹/tonne) cannot be compared directly. Select a unit to filter or sort by price.
                    </p>
                  ) : (
                    <p className="text-[10px] text-emerald-700 mt-1 leading-tight">
                      Comparing prices expressed specifically in ₹ per {selectedUnit}.
                    </p>
                  )}
                </div>

                {/* Min Quantity Available */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Min Available Quantity</label>
                  <input
                    type="number"
                    placeholder="e.g. 50"
                    value={minQuantity}
                    onChange={(e) => {
                      setMinQuantity(e.target.value);
                      setPage(1);
                    }}
                    min="0"
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Photo Freshness Filter */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Photo Freshness</label>
                  <select
                    value={selectedFreshness}
                    onChange={(e) => {
                      setSelectedFreshness(e.target.value);
                      setPage(1);
                    }}
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    {FRESHNESS_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location Filter & Reset */}
                <div className="flex flex-col justify-between">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">General Location</label>
                    <input
                      type="text"
                      placeholder="Region / City (e.g. Pune)..."
                      value={locationQuery}
                      onChange={(e) => {
                        setLocationQuery(e.target.value);
                        setPage(1);
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="mt-2 text-rose-600 hover:text-rose-700 font-bold text-xs flex items-center justify-end gap-1"
                  >
                    <FaRedo className="text-[10px]" /> Reset All Filters
                  </button>
                </div>
              </div>
            )}

            {/* Active Filters Pill Bar */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs">
                <span className="font-semibold text-gray-500 text-[11px] mr-1">Active Filters:</span>
                {debouncedSearch && (
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    Search: &ldquo;{debouncedSearch}&rdquo;
                    <button onClick={() => setSearchTerm("")}>&times;</button>
                  </span>
                )}
                {selectedCategory !== "all" && (
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 capitalize">
                    Category: {selectedCategory}
                    <button onClick={() => setSelectedCategory("all")}>&times;</button>
                  </span>
                )}
                {selectedUnit !== "all" && (
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 uppercase">
                    Unit: {selectedUnit}
                    <button onClick={() => setSelectedUnit("all")}>&times;</button>
                  </span>
                )}
                {(minPrice !== "" || maxPrice !== "") && (
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    Price: ₹{minPrice || "0"} - ₹{maxPrice || "Any"}
                    <button
                      onClick={() => {
                        setMinPrice("");
                        setMaxPrice("");
                      }}
                    >
                      &times;
                    </button>
                  </span>
                )}
                {selectedFreshness !== "all" && (
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    Freshness: {selectedFreshness}
                    <button onClick={() => setSelectedFreshness("all")}>&times;</button>
                  </span>
                )}
                {locationQuery && (
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    Location: {locationQuery}
                    <button onClick={() => setLocationQuery("")}>&times;</button>
                  </span>
                )}
                <button
                  onClick={handleClearFilters}
                  className="text-gray-500 hover:text-rose-600 underline text-[11px] ml-1 font-semibold"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {fetchError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <FaInfoCircle className="text-rose-600 text-base" />
                <span>{fetchError}</span>
              </div>
              <button
                onClick={fetchListings}
                className="bg-rose-600 text-white font-bold px-3 py-1 rounded-lg text-xs"
              >
                Retry
              </button>
            </div>
          )}

          {/* VIEW: Farm Map View */}
          {displayView === "map" && (
            <section aria-label="Agricultural Map Discovery">
              <MarketplaceMap
                onSelectListing={(id) => setSelectedListingId(id)}
                onSelectFarm={(model, id) => setSelectedFarm({ model, id })}
                apiBaseUrl={apiBaseUrl}
              />
            </section>
          )}

          {/* VIEW: Listings Grid View */}
          {displayView === "grid" && (
            <section aria-label="Available Produce Listings">
              {/* Results Count & Meta */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3 px-1">
                <span>
                  Showing <strong>{listings.length}</strong> of <strong>{pagination.total}</strong> active produce lots
                </span>
                {pagination.totalPages > 1 && (
                  <span>
                    Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>
                  </span>
                )}
              </div>

              {/* Loading Indicator for active query */}
              {isLoading && listings.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-emerald-700 font-semibold animate-pulse">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Updating marketplace listings...</span>
                </div>
              )}

              {/* Empty State when no listings match or initial */}
              {listings.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center max-w-2xl mx-auto my-6 space-y-4">
                  <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
                    <FaBoxes className="text-3xl text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {activeFilterCount > 0 ? "No Listings Match Your Filters" : "No Marketplace Listings Published Yet"}
                  </h3>
                  <p className="text-xs text-gray-600 max-w-md mx-auto leading-relaxed">
                    {activeFilterCount > 0
                      ? "Try broadening your search term, clearing price limits, or selecting 'All Produce' to see more produce."
                      : "Registered growers publish fresh harvests, grains, and livestock lots continuously. Registered farmers can publish lots using their dashboard."}
                  </p>

                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    {activeFilterCount > 0 ? (
                      <button
                        onClick={handleClearFilters}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs"
                      >
                        Reset All Filters
                      </button>
                    ) : (
                      <button
                        onClick={() => handleProtectedAction("listProduce", "farmer")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs"
                      >
                        + Post First Produce Lot
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Cards Grid */}
              {!isLoading && listings.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {listings.map((item) => (
                    <ListingCard
                      key={item.id}
                      listing={item}
                      onSelectListing={(id) => setSelectedListingId(id)}
                      onSelectFarm={(model, id) => setSelectedFarm({ model, id })}
                    />
                  ))}
                </div>
              )}

              {/* Server-Side Pagination Controls */}
              {!isLoading && pagination.totalPages > 1 && (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-2 pt-4 border-t border-gray-200">
                  <button
                    disabled={!pagination.hasPrev}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition"
                  >
                    <FaChevronLeft className="text-[10px]" /> Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {[...Array(pagination.totalPages)].map((_, idx) => {
                      const pageNum = idx + 1;
                      // Show first, last, current, and immediate neighbors
                      if (
                        pageNum === 1 ||
                        pageNum === pagination.totalPages ||
                        Math.abs(pageNum - pagination.page) <= 1
                      ) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`w-8 h-8 rounded-xl text-xs font-bold transition ${
                              pagination.page === pageNum
                                ? "bg-emerald-700 text-white shadow-xs"
                                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        pageNum === pagination.page - 2 ||
                        pageNum === pagination.page + 2
                      ) {
                        return (
                          <span key={pageNum} className="text-gray-400 text-xs px-1">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <button
                    disabled={!pagination.hasNext}
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition"
                  >
                    Next <FaChevronRight className="text-[10px]" />
                  </button>
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-12 bg-gray-900 text-gray-400 py-6 px-4 sm:px-6 text-center text-xs border-t border-gray-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>&copy; {new Date().getFullYear()} Smart Agriculture Management System &bull; Farm Marketplace Exchange</p>
          <div className="flex items-center gap-4 text-gray-400">
            <span>Stage 5 Buyer Discovery Active</span>
            <span>&bull;</span>
            <span>Stage 6 Bidding &amp; Contracts (Next)</span>
          </div>
        </div>
      </footer>

      {/* Detail Modal */}
      {selectedListingId && (
        <ListingDetailModal
          listingId={selectedListingId}
          onClose={() => setSelectedListingId(null)}
          onSelectFarm={(model, id) => {
            setSelectedListingId(null);
            setSelectedFarm({ model, id });
          }}
          onLoginRequired={onLoginRequired}
          isLoggedIn={isLoggedIn}
          apiBaseUrl={apiBaseUrl}
        />
      )}

      {/* Virtual Farm Profile Modal */}
      {selectedFarm && (
        <FarmProfileModal
          locationModel={selectedFarm.model}
          locationId={selectedFarm.id}
          onClose={() => setSelectedFarm(null)}
          onSelectListing={(id) => {
            setSelectedFarm(null);
            setSelectedListingId(id);
          }}
          apiBaseUrl={apiBaseUrl}
        />
      )}

      {/* Orders Management Modal */}
      {showOrdersModal && (
        <OrdersModal
          role={userRole === "farmer" ? "farmer" : "buyer"}
          onClose={() => setShowOrdersModal(false)}
          apiBaseUrl={apiBaseUrl}
        />
      )}
    </div>
  );
};

export default Marketplace;
