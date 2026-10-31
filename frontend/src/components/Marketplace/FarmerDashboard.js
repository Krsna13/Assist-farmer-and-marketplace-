import React, { useState, useEffect, useCallback } from "react";
import {
  FaStore,
  FaBoxes,
  FaSeedling,
  FaCamera,
  FaClock,
  FaGavel,
  FaShoppingBag,
  FaPlus,
  FaEdit,
  FaPause,
  FaPlay,
  FaExclamationTriangle,
  FaSpinner,
  FaArrowLeft,
  FaSearch,
  FaFilter,
  FaCheckCircle,
  FaTimes,
  FaImage,
} from "react-icons/fa";
import { calculateFreshness, formatLocalDateTime } from "./freshnessUtils";
import StockUpdateModal from "./StockUpdateModal";
import EditListingModal from "./EditListingModal";
import PublishListingModal from "./PublishListingModal";
import InventoryPhotoCapture from "./InventoryPhotoCapture";
import InventoryPhotoTimeline from "./InventoryPhotoTimeline";

const FarmerDashboard = ({
  onBackToMarketplace,
  onBackToLanding,
  apiBaseUrl = "http://localhost:5000/api/marketplace",
}) => {
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'listings' | 'publish' | 'bids' | 'orders'

  // Dashboard Data states
  const [metrics, setMetrics] = useState(null);
  const [photoHealth, setPhotoHealth] = useState(null);
  const [listings, setListings] = useState([]);
  const [sourceInventory, setSourceInventory] = useState(null);
  const [recentBids, setRecentBids] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  // Loading & Error states
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState("all");

  // Active Modals
  const [stockModalListing, setStockModalListing] = useState(null);
  const [editModalListing, setEditModalListing] = useState(null);
  const [publishModalSource, setPublishModalSource] = useState(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Stage 3 Photo Modals
  const [photoCaptureListing, setPhotoCaptureListing] = useState(null);
  const [photoTimelineListing, setPhotoTimelineListing] = useState(null);
  const [timelinePhotos, setTimelinePhotos] = useState([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

  const getAuthHeader = useCallback(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Fetch Dashboard Metrics & Lists
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const headers = getAuthHeader();

      // Parallel data loading
      const [dashRes, listingsRes, sourceRes, bidsRes, ordersRes] = await Promise.all([
        fetch(`${apiBaseUrl}/farmer/dashboard`, { headers }),
        fetch(`${apiBaseUrl}/farmer/listings`, { headers }),
        fetch(`${apiBaseUrl}/farmer/source-inventory`, { headers }),
        fetch(`${apiBaseUrl}/farmer/bids`, { headers }),
        fetch(`${apiBaseUrl}/farmer/orders`, { headers }),
      ]);

      if (!dashRes.ok || !listingsRes.ok) {
        if (dashRes.status === 401 || listingsRes.status === 401) {
          throw new Error("Authentication session expired. Please log in again.");
        }
        if (dashRes.status === 403 || listingsRes.status === 403) {
          throw new Error("Access restricted: Farmer privileges are required to access this dashboard.");
        }
        throw new Error("Failed to load farmer marketplace data.");
      }

      const dashData = await dashRes.json();
      const listingsData = await listingsRes.json();

      setMetrics(dashData.metrics || null);
      setPhotoHealth(dashData.photoHealth || null);
      setListings(listingsData.listings || []);

      if (sourceRes.ok) {
        const sourceData = await sourceRes.json();
        setSourceInventory(sourceData);
      }

      if (bidsRes.ok) {
        const bidsData = await bidsRes.json();
        setRecentBids(bidsData.bids || []);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setRecentOrders(ordersData.orders || []);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setErrorMessage(err.message || "Unable to connect to marketplace server.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, getAuthHeader]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Open Stage 3 Photo Timeline
  const openPhotoTimeline = async (listing) => {
    setPhotoTimelineListing(listing);
    setIsLoadingPhotos(true);
    try {
      const res = await fetch(`${apiBaseUrl}/listings/${listing.id || listing._id}/photos`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setTimelinePhotos(data.photos || []);
      } else {
        setTimelinePhotos([]);
      }
    } catch (e) {
      console.warn("Could not load photos for timeline:", e);
      setTimelinePhotos([]);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  // Toggle Pause / Resume Status
  const handleToggleListingStatus = async (listing) => {
    const isCurrentlyActive = listing.status === "available";
    const targetStatus = isCurrentlyActive ? "inactive" : "available";

    if (targetStatus === "available" && listing.quantityAvailable <= 0) {
      setErrorMessage(`Cannot resume '${listing.title}' with 0 available stock. Please update stock quantity first.`);
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/farmer/listings/${listing.id || listing._id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update listing status.");
      }

      setSuccessToast(`Listing is now ${targetStatus === "available" ? "active on marketplace" : "paused"}.`);
      setTimeout(() => setSuccessToast(""), 3500);
      fetchDashboardData();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // Filtered Listings
  const filteredListings = listings.filter((l) => {
    const matchesSearch =
      l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.category && l.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" ? true : l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered Source Inventory
  const filteredSourceInventory = sourceInventory && sourceInventory.inventoryItems
    ? sourceInventory.inventoryItems.filter((item) => {
        if (inventoryCategoryFilter === "all") return true;
        if (inventoryCategoryFilter === "crop") return item.sourceRecordType === "CropRecord";
        if (inventoryCategoryFilter === "livestock")
          return item.sourceRecordType === "Animal" || item.sourceRecordType === "Production";
        if (inventoryCategoryFilter === "resources")
          return item.sourceRecordType === "UnitResource" || item.sourceRecordType === "ItemResource";
        return true;
      })
    : [];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-16">
      {/* Top Navigation Bar */}
      <header className="bg-emerald-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToMarketplace || onBackToLanding}
              className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-white font-medium px-3.5 py-1.5 rounded-lg transition text-xs shadow-sm"
              title="Return to Marketplace"
            >
              <FaArrowLeft /> Back to Marketplace
            </button>
            <span className="text-emerald-300">/</span>
            <div className="flex items-center gap-2">
              <FaStore className="text-yellow-400" />
              <span className="font-bold text-sm tracking-wide">Farmer Marketplace Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPublishModalSource(null);
                setIsPublishModalOpen(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow transition"
            >
              <FaPlus /> + Publish Produce
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-2 border-t border-emerald-800/80 overflow-x-auto text-xs font-semibold">
          {[
            { id: "overview", label: "Dashboard Overview", icon: FaStore },
            { id: "listings", label: `My Listings (${listings.length})`, icon: FaBoxes },
            { id: "publish", label: "Publish Farm Inventory", icon: FaSeedling },
            { id: "bids", label: `Incoming Bids (${recentBids.length})`, icon: FaGavel },
            { id: "orders", label: `Orders (${recentOrders.length})`, icon: FaShoppingBag },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-4 border-b-2 font-medium flex items-center gap-2 whitespace-nowrap transition ${
                  isActive
                    ? "border-yellow-400 text-yellow-300 bg-emerald-950/40"
                    : "border-transparent text-emerald-200 hover:text-white hover:bg-emerald-800/40"
                }`}
              >
                <Icon /> {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Toast Notifications */}
      {successToast && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs flex items-center gap-2 shadow-sm animate-fade-in">
            <FaCheckCircle className="text-emerald-600 text-base flex-shrink-0" />
            <span>{successToast}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <FaExclamationTriangle className="text-rose-500 text-base flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage("")}
              className="text-gray-400 hover:text-gray-600 font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Loading Spinner */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <FaSpinner className="animate-spin text-3xl text-emerald-600 mx-auto" />
            <p className="text-xs text-gray-500 font-medium">Loading your marketplace inventory records...</p>
          </div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* TAB 1: DASHBOARD OVERVIEW */}
            {/* ========================================================================= */}
            {activeTab === "overview" && metrics && (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-emerald-600">
                    <span className="text-[11px] font-semibold text-gray-500 block uppercase">Active Listings</span>
                    <span className="text-2xl font-black text-gray-900 mt-1 block">
                      {metrics.activeListingsCount}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-medium">Open to buyer orders</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-600">
                    <span className="text-[11px] font-semibold text-gray-500 block uppercase">Total Stock Available</span>
                    <span className="text-2xl font-black text-blue-900 mt-1 block">
                      {metrics.totalAvailableStock}
                    </span>
                    <span className="text-[10px] text-gray-500">Units currently on sale</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-amber-600">
                    <span className="text-[11px] font-semibold text-gray-500 block uppercase">Reserved Stock</span>
                    <span className="text-2xl font-black text-amber-900 mt-1 block">
                      {metrics.totalReservedStock}
                    </span>
                    <span className="text-[10px] text-amber-700 font-medium">Pending transaction</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-600">
                    <span className="text-[11px] font-semibold text-gray-500 block uppercase">Estimated Value</span>
                    <span className="text-2xl font-black text-purple-900 mt-1 block">
                      ₹{metrics.totalStockValue}
                    </span>
                    <span className="text-[10px] text-gray-500">Active lot valuation</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-gray-600">
                    <span className="text-[11px] font-semibold text-gray-500 block uppercase">Sold Quantity</span>
                    <span className="text-2xl font-black text-gray-800 mt-1 block">
                      {metrics.totalSoldStock}
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">{metrics.soldListingsCount} completed lots</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-rose-500">
                    <span className="text-[11px] font-semibold text-gray-500 block uppercase">Stale Photo Alert</span>
                    <span className="text-2xl font-black text-rose-700 mt-1 block">
                      {photoHealth ? photoHealth.withStalePhotos : 0}
                    </span>
                    <span className="text-[10px] text-rose-600 font-medium">Photos &gt; 7 days old</span>
                  </div>
                </div>

                {/* Photo Freshness & Health Banner */}
                {photoHealth && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl flex-shrink-0">
                        <FaCamera />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">
                          Farm Inventory Photo Health
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {photoHealth.withPhotos} with uploaded photos &bull; {photoHealth.withStalePhotos} need fresh updates &bull; {photoHealth.withoutPhotos} listings without photos.
                        </p>
                      </div>
                    </div>
                    {photoHealth.latestPhotoReceivedAt && (
                      <div className="text-right text-xs">
                        <span className="text-gray-500 block">Latest Photo Upload:</span>
                        <span className="font-mono font-bold text-emerald-800">
                          {formatLocalDateTime(photoHealth.latestPhotoReceivedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Two-Column Overview Section: Bids & Orders */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Bids Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                        <FaGavel className="text-amber-600" />
                        <span>Incoming Buyer Inquiries & Bids</span>
                      </div>
                      <button
                        onClick={() => setActiveTab("bids")}
                        className="text-xs text-emerald-700 font-semibold hover:underline"
                      >
                        View All ({recentBids.length})
                      </button>
                    </div>

                    {recentBids.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg text-xs text-gray-500">
                        No incoming bids received yet. Active buyer bids will appear here.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {recentBids.slice(0, 3).map((b) => (
                          <div
                            key={b.id}
                            className="p-3 bg-gray-50 hover:bg-gray-100/80 rounded-lg border border-gray-200 text-xs flex justify-between items-center gap-2 transition"
                          >
                            <div>
                              <span className="font-bold text-gray-900 block">{b.listingTitle}</span>
                              <span className="text-gray-500 text-[11px]">
                                By: {b.buyerName} ({b.buyerRole}) &bull; Qty: {b.quantity} {b.listingUnit}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-emerald-700 block">₹{b.totalOffer}</span>
                              <span className="capitalize text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                                {b.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Orders Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                        <FaShoppingBag className="text-blue-600" />
                        <span>Recent Marketplace Orders</span>
                      </div>
                      <button
                        onClick={() => setActiveTab("orders")}
                        className="text-xs text-emerald-700 font-semibold hover:underline"
                      >
                        View All ({recentOrders.length})
                      </button>
                    </div>

                    {recentOrders.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg text-xs text-gray-500">
                        No orders recorded yet. Completed buyer orders will appear here.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {recentOrders.slice(0, 3).map((o) => (
                          <div
                            key={o.id}
                            className="p-3 bg-gray-50 hover:bg-gray-100/80 rounded-lg border border-gray-200 text-xs flex justify-between items-center gap-2 transition"
                          >
                            <div>
                              <span className="font-mono font-bold text-gray-900 block">{o.orderNumber}</span>
                              <span className="text-gray-500 text-[11px]">
                                Buyer: {o.buyerName} &bull; {o.itemsCount} product(s)
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-emerald-700 block">₹{o.totalAmount}</span>
                              <span className="capitalize text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                                {o.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: MY LISTINGS (MANAGEMENT & STOCK CONTROLS) */}
            {/* ========================================================================= */}
            {activeTab === "listings" && (
              <div className="space-y-4">
                {/* Search & Filter Header */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="relative w-full sm:w-80">
                    <FaSearch className="absolute left-3 top-3 text-gray-400 text-xs" />
                    <input
                      type="text"
                      placeholder="Search my listings..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-gray-500 flex items-center gap-1 font-semibold">
                      <FaFilter /> Status:
                    </span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    >
                      <option value="all">All Statuses</option>
                      <option value="available">Available (Active)</option>
                      <option value="reserved">Reserved</option>
                      <option value="sold">Sold</option>
                      <option value="inactive">Paused (Inactive)</option>
                    </select>

                    <button
                      onClick={() => {
                        setPublishModalSource(null);
                        setIsPublishModalOpen(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-2 rounded-lg text-xs flex items-center gap-1 transition shadow-sm ml-auto"
                    >
                      <FaPlus /> New Listing
                    </button>
                  </div>
                </div>

                {/* Listings Grid */}
                {filteredListings.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center space-y-3">
                    <FaBoxes className="text-4xl text-gray-300 mx-auto" />
                    <h4 className="font-bold text-gray-700 text-sm">No Listings Match Current Filter</h4>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Publish inventory from your farm records or add a new lot to start receiving buyer inquiries.
                    </p>
                    <button
                      onClick={() => {
                        setPublishModalSource(null);
                        setIsPublishModalOpen(true);
                      }}
                      className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-xs inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <FaPlus /> Publish First Produce Lot
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredListings.map((listing) => {
                      const freshness = calculateFreshness(listing.latestPhotoServerReceivedAt);
                      const isPaused = listing.status === "inactive";

                      return (
                        <div
                          key={listing.id}
                          className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition"
                        >
                          <div>
                            {/* Photo Thumbnail Header */}
                            <div className="relative aspect-video bg-gray-900 flex items-center justify-center overflow-hidden">
                              {listing.primaryPhotoUrl ? (
                                <img
                                  src={listing.primaryPhotoWatermarkedUrl || listing.primaryPhotoUrl}
                                  alt={listing.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="text-center p-4 text-gray-400">
                                  <FaImage className="text-3xl mx-auto mb-1 opacity-40" />
                                  <span className="text-[11px] block">No verified photo uploaded</span>
                                </div>
                              )}

                              {/* Freshness Badge */}
                              <div className="absolute top-2.5 right-2.5">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full border font-bold flex items-center gap-1 shadow-sm ${freshness.badgeColor}`}
                                >
                                  <FaClock className="text-[9px]" /> {freshness.label}
                                </span>
                              </div>

                              {/* Status Badge */}
                              <div className="absolute top-2.5 left-2.5">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shadow-sm ${
                                    listing.status === "available"
                                      ? "bg-emerald-600 text-white"
                                      : listing.status === "reserved"
                                      ? "bg-amber-500 text-white"
                                      : listing.status === "sold"
                                      ? "bg-blue-600 text-white"
                                      : "bg-gray-600 text-white"
                                  }`}
                                >
                                  {listing.status}
                                </span>
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-4 space-y-3">
                              <div>
                                <h4 className="font-bold text-sm text-gray-900 truncate" title={listing.title}>
                                  {listing.title}
                                </h4>
                                <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                                  <span className="capitalize font-medium">{listing.category}</span>
                                  <span>&bull;</span>
                                  <span>Location: {listing.locationModel}</span>
                                </div>
                              </div>

                              {/* Quantities & Price Breakdown */}
                              <div className="bg-gray-50 rounded-lg p-2.5 text-xs grid grid-cols-3 gap-1 text-center border border-gray-100">
                                <div>
                                  <span className="text-[10px] text-gray-400 block uppercase">Available</span>
                                  <span className="font-bold text-emerald-800 text-xs">
                                    {listing.quantityAvailable} {listing.quantityUnit}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-400 block uppercase">Reserved</span>
                                  <span className="font-bold text-amber-700 text-xs">
                                    {listing.quantityReserved || 0}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-400 block uppercase">Sold</span>
                                  <span className="font-bold text-blue-700 text-xs">
                                    {listing.quantitySold || 0}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs pt-1">
                                <div>
                                  <span className="text-gray-500 text-[11px]">Price: </span>
                                  <span className="font-bold text-emerald-900 text-sm">
                                    ₹{listing.fixedPricePerUnit}
                                  </span>
                                  <span className="text-[10px] text-gray-400">/{listing.quantityUnit}</span>
                                </div>
                                <span className="text-[11px] text-gray-400">
                                  {listing.photoCount} photo(s)
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Action Footer */}
                          <div className="p-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-1 text-xs">
                            <button
                              onClick={() => setStockModalListing(listing)}
                              className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 font-semibold border border-emerald-300 rounded transition flex items-center gap-1 shadow-2xs"
                              title="Update Marketplace Available Quantity"
                            >
                              <FaBoxes /> Stock
                            </button>

                            <button
                              onClick={() => setEditModalListing(listing)}
                              className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 font-medium border border-gray-300 rounded transition flex items-center gap-1 shadow-2xs"
                              title="Edit Title, Price, Description"
                            >
                              <FaEdit /> Edit
                            </button>

                            <button
                              onClick={() => setPhotoCaptureListing(listing)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded transition flex items-center gap-1 shadow-2xs"
                              title="Capture / Upload Photo via Stage 3 Camera"
                            >
                              <FaCamera /> Photo
                            </button>

                            <button
                              onClick={() => openPhotoTimeline(listing)}
                              className="px-2 py-1.5 text-gray-600 hover:text-emerald-700 font-medium transition"
                              title="View Photo History"
                            >
                              <FaClock /> History
                            </button>

                            <button
                              onClick={() => handleToggleListingStatus(listing)}
                              className={`p-1.5 rounded transition ${
                                isPaused
                                  ? "text-emerald-700 hover:bg-emerald-100"
                                  : "text-amber-700 hover:bg-amber-100"
                              }`}
                              title={isPaused ? "Reactivate Listing" : "Pause Listing"}
                            >
                              {isPaused ? <FaPlay /> : <FaPause />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: PUBLISH FARM INVENTORY (FROM REAL FARM RECORDS) */}
            {/* ========================================================================= */}
            {activeTab === "publish" && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">
                      Eligible Farm Inventory Records
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Select any existing crop harvest, livestock, or resource record to publish directly to the marketplace.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInventoryCategoryFilter("all")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        inventoryCategoryFilter === "all"
                          ? "bg-emerald-700 text-white shadow"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      All Records
                    </button>
                    <button
                      onClick={() => setInventoryCategoryFilter("crop")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        inventoryCategoryFilter === "crop"
                          ? "bg-emerald-700 text-white shadow"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Crops
                    </button>
                    <button
                      onClick={() => setInventoryCategoryFilter("livestock")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        inventoryCategoryFilter === "livestock"
                          ? "bg-emerald-700 text-white shadow"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Livestock
                    </button>
                    <button
                      onClick={() => setInventoryCategoryFilter("resources")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        inventoryCategoryFilter === "resources"
                          ? "bg-emerald-700 text-white shadow"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Resources
                    </button>
                  </div>
                </div>

                {filteredSourceInventory.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center space-y-3">
                    <FaSeedling className="text-4xl text-gray-300 mx-auto" />
                    <h4 className="font-bold text-gray-700 text-sm">No Eligible Farm Records Found</h4>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Add records in your Crop, Livestock, or Resource Management modules to populate this list, or create an independent listing.
                    </p>
                    <button
                      onClick={() => {
                        setPublishModalSource(null);
                        setIsPublishModalOpen(true);
                      }}
                      className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-xs inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <FaPlus /> Create Independent Listing
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSourceInventory.map((item, idx) => (
                      <div
                        key={`${item.sourceRecordType}_${item.sourceRecordId}_${idx}`}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-gray-400">
                            <span className="font-semibold uppercase text-emerald-800">
                              {item.sourceRecordType}
                            </span>
                            <span>{item.locationName}</span>
                          </div>

                          <h4 className="font-bold text-sm text-gray-900 mt-1">
                            {item.title}
                          </h4>

                          <div className="mt-2 space-y-1 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                            <div className="flex justify-between">
                              <span>Physical Stock:</span>
                              <span className="font-bold text-gray-800">
                                {item.availablePhysicalStock} {item.suggestedUnit}
                              </span>
                            </div>
                            {item.suggestedPrice && (
                              <div className="flex justify-between">
                                <span>Unit Cost:</span>
                                <span className="font-bold text-emerald-800">
                                  ₹{item.suggestedPrice}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          {item.isAlreadyListed ? (
                            <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-center text-xs font-semibold">
                              Already Published on Marketplace
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setPublishModalSource(item);
                                setIsPublishModalOpen(true);
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition shadow-sm flex items-center justify-center gap-1.5"
                            >
                              <FaPlus /> Publish to Marketplace
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: INCOMING BIDS */}
            {/* ========================================================================= */}
            {activeTab === "bids" && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">
                    Incoming Inquiries & Bids
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Live bidding records received from registered retail buyers and commercial bulk purchasers.
                  </p>
                </div>

                {recentBids.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl text-xs text-gray-500">
                    No active bids received yet. Bids will be listed here as buyers place offers on your published lots.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                          <th className="py-2.5 px-3 font-semibold">Listing</th>
                          <th className="py-2.5 px-3 font-semibold">Buyer</th>
                          <th className="py-2.5 px-3 font-semibold">Bid Price</th>
                          <th className="py-2.5 px-3 font-semibold">Quantity</th>
                          <th className="py-2.5 px-3 font-semibold">Total Offer</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          <th className="py-2.5 px-3 font-semibold">Expires At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {recentBids.map((bid) => (
                          <tr key={bid.id} className="hover:bg-gray-50/70 transition">
                            <td className="py-3 px-3 font-bold text-gray-900">{bid.listingTitle}</td>
                            <td className="py-3 px-3">
                              <span className="font-semibold block">{bid.buyerName}</span>
                              <span className="text-[10px] text-gray-400 capitalize">{bid.buyerRole}</span>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-emerald-800">₹{bid.bidPricePerUnit}</td>
                            <td className="py-3 px-3 font-semibold">
                              {bid.quantity} {bid.listingUnit}
                            </td>
                            <td className="py-3 px-3 font-bold text-emerald-900">₹{bid.totalOffer}</td>
                            <td className="py-3 px-3">
                              <span className="capitalize text-[10px] px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800">
                                {bid.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-gray-500 text-[11px]">
                              {bid.expiresAt ? formatLocalDateTime(bid.expiresAt) : "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: ORDERS */}
            {/* ========================================================================= */}
            {activeTab === "orders" && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">
                    Marketplace Orders Received
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Orders placed by buyers for your farm produce.
                  </p>
                </div>

                {recentOrders.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl text-xs text-gray-500">
                    No orders received yet. Completed orders and shipping workflows will activate in Stage 6.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                          <th className="py-2.5 px-3 font-semibold">Order #</th>
                          <th className="py-2.5 px-3 font-semibold">Buyer</th>
                          <th className="py-2.5 px-3 font-semibold">Items</th>
                          <th className="py-2.5 px-3 font-semibold">Total Amount</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          <th className="py-2.5 px-3 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {recentOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50/70 transition">
                            <td className="py-3 px-3 font-mono font-bold text-gray-900">{order.orderNumber}</td>
                            <td className="py-3 px-3 font-semibold">{order.buyerName}</td>
                            <td className="py-3 px-3">
                              {order.items && order.items.length > 0 ? (
                                <ul className="text-[11px] list-disc list-inside text-gray-600">
                                  {order.items.map((it, i) => (
                                    <li key={i}>
                                      {it.title}: {it.quantity} {it.unit}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                "No items"
                              )}
                            </td>
                            <td className="py-3 px-3 font-bold text-emerald-800 text-sm">₹{order.totalAmount}</td>
                            <td className="py-3 px-3">
                              <span className="capitalize text-[10px] px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800">
                                {order.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-gray-500 text-[11px]">
                              {formatLocalDateTime(order.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Stock Update Modal */}
      {stockModalListing && (
        <StockUpdateModal
          listing={stockModalListing}
          onClose={() => setStockModalListing(null)}
          onSuccess={() => {
            setSuccessToast(`Stock for '${stockModalListing.title}' updated successfully.`);
            setTimeout(() => setSuccessToast(""), 3500);
            fetchDashboardData();
          }}
          apiBaseUrl={apiBaseUrl}
        />
      )}

      {/* Edit Listing Modal */}
      {editModalListing && (
        <EditListingModal
          listing={editModalListing}
          onClose={() => setEditModalListing(null)}
          onSuccess={() => {
            setSuccessToast(`Listing '${editModalListing.title}' details updated.`);
            setTimeout(() => setSuccessToast(""), 3500);
            fetchDashboardData();
          }}
          apiBaseUrl={apiBaseUrl}
        />
      )}

      {/* Publish Listing Modal */}
      {isPublishModalOpen && (
        <PublishListingModal
          initialSourceItem={publishModalSource}
          locations={sourceInventory ? sourceInventory.locations : null}
          onClose={() => {
            setIsPublishModalOpen(false);
            setPublishModalSource(null);
          }}
          onSuccess={(newListing) => {
            setSuccessToast(`Listing '${newListing.title}' published to marketplace!`);
            setTimeout(() => setSuccessToast(""), 4000);
            setActiveTab("listings");
            fetchDashboardData();
          }}
          apiBaseUrl={apiBaseUrl}
        />
      )}

      {/* Stage 3 Photo Capture Modal */}
      {photoCaptureListing && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-xl w-full my-auto">
            <InventoryPhotoCapture
              listingId={photoCaptureListing.id || photoCaptureListing._id}
              listingTitle={photoCaptureListing.title}
              onCancel={() => setPhotoCaptureListing(null)}
              onUploadSuccess={() => {
                setSuccessToast(`New photograph verified and uploaded for '${photoCaptureListing.title}'.`);
                setTimeout(() => setSuccessToast(""), 4000);
                fetchDashboardData();
                setPhotoCaptureListing(null);
              }}
              apiBaseUrl={apiBaseUrl}
            />
          </div>
        </div>
      )}

      {/* Stage 3 Photo Timeline Modal */}
      {photoTimelineListing && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full my-auto bg-white rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
            <div className="p-2 flex justify-end bg-gray-900">
              <button
                onClick={() => setPhotoTimelineListing(null)}
                className="text-gray-400 hover:text-white p-2"
                title="Close"
              >
                <FaTimes />
              </button>
            </div>
            {isLoadingPhotos ? (
              <div className="p-12 text-center text-xs text-gray-500">
                <FaSpinner className="animate-spin text-2xl mx-auto mb-2 text-emerald-600" />
                Loading photo timeline...
              </div>
            ) : (
              <InventoryPhotoTimeline
                photos={timelinePhotos}
                listingTitle={photoTimelineListing.title}
                canUpload={true}
                onOpenUpload={() => {
                  setPhotoCaptureListing(photoTimelineListing);
                  setPhotoTimelineListing(null);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmerDashboard;
