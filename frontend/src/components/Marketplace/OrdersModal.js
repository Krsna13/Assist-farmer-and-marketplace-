import React, { useState, useEffect, useCallback } from "react";
import {
  FaTimes,
  FaShoppingBag,
  FaCheck,
  FaBan,
  FaClock,
  FaSyncAlt,
  FaExclamationTriangle,
} from "react-icons/fa";

const OrdersModal = ({
  role = "buyer",
  onClose,
  apiBaseUrl = "http://localhost:5000/api/marketplace",
}) => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [activeOrderId, setActiveOrderId] = useState(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    const token = localStorage.getItem("token");
    if (!token) {
      setErrorMessage("Please log in to view your orders.");
      setIsLoading(false);
      return;
    }

    try {
      const endpoint = role === "farmer" ? `${apiBaseUrl}/farmer/orders` : `${apiBaseUrl}/buyer/orders`;
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load orders.");
      }

      setOrders(data.orders || []);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [role, apiBaseUrl]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleConfirmOrder = async (orderId) => {
    if (!window.confirm("Confirm this order? This locks in the stock reservation against auto-expiry.")) return;

    setActiveOrderId(orderId);
    setErrorMessage("");
    setActionSuccess("");

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${apiBaseUrl}/orders/${orderId}/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to confirm order.");

      setActionSuccess(`Order #${data.order.orderNumber} confirmed successfully!`);
      fetchOrders();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setActiveOrderId(null);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm("Cancel this order? Reserved stock will be restored to available inventory.")) return;

    setActiveOrderId(orderId);
    setErrorMessage("");
    setActionSuccess("");

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${apiBaseUrl}/orders/${orderId}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to cancel order.");

      setActionSuccess(`Order #${data.order.orderNumber} has been cancelled and stock released.`);
      fetchOrders();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setActiveOrderId(null);
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
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden border border-gray-200 my-auto text-gray-800 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-gray-900 to-emerald-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center text-emerald-300">
              <FaShoppingBag />
            </div>
            <div>
              <h3 className="text-lg font-black">
                {role === "farmer" ? "Grower Incoming Orders" : "My Placed Orders"}
              </h3>
              <p className="text-xs text-emerald-200/80">
                {role === "farmer" ? "Review and confirm buyer purchase requests" : "Track status of purchases and stock reservations"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              disabled={isLoading}
              className="p-2 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition"
              title="Refresh Orders"
            >
              <FaSyncAlt className={isLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition"
              aria-label="Close"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {actionSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 flex items-center gap-2 animate-fade-in">
              <FaCheck className="text-emerald-600 flex-shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 flex items-center gap-2 animate-fade-in">
              <FaExclamationTriangle className="text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 text-center text-gray-400 space-y-2">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p>Loading orders from database...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-2xl border border-gray-200 p-8">
              <FaShoppingBag className="text-4xl text-gray-300 mx-auto mb-2" />
              <h4 className="font-bold text-gray-700">No Orders Found</h4>
              <p className="text-[11px] text-gray-400 mt-1">
                {role === "farmer"
                  ? "Orders submitted by buyers via Buy Now or accepted bids will appear here."
                  : "Purchases you make via Buy Now or accepted trade bids will appear here."}
              </p>
            </div>
          ) : (
            orders.map((ord) => {
              const isPlaced = ord.status === "placed";
              const isConfirmed = ord.status === "confirmed";
              const isCancelled = ord.status === "cancelled";
              const isExpired = ord.status === "expired";

              return (
                <div
                  key={ord._id}
                  className="bg-white rounded-xl border border-gray-200 shadow-2xs p-4 space-y-3 hover:border-emerald-500 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
                    <div>
                      <span className="font-mono font-black text-emerald-900 text-sm">
                        {ord.orderNumber}
                      </span>
                      <span className="text-gray-400 text-[10px] ml-2">
                        {new Date(ord.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border ${
                          isConfirmed
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : isPlaced
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : isCancelled || isExpired
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : "bg-gray-100 text-gray-700 border-gray-300"
                        }`}
                      >
                        {isPlaced ? "Placed (Awaiting Confirmation)" : ord.status}
                      </span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-1.5">
                    {ord.items &&
                      ord.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-xs py-1 border-b border-gray-50"
                        >
                          <div>
                            <span className="font-bold text-gray-900">{item.title}</span>
                            <span className="text-gray-500 text-[11px] ml-1.5">
                              ({item.quantity} {item.unit} @ ₹{item.agreedPricePerUnit}/{item.unit})
                            </span>
                          </div>
                          <span className="font-bold text-gray-800">
                            ₹{Number(item.subtotal || 0).toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* Total & Action Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div>
                      <span className="text-gray-500 font-medium">Order Total: </span>
                      <span className="font-black text-emerald-950 text-sm">
                        ₹{Number(ord.totalAmount || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPlaced && role === "farmer" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleConfirmOrder(ord._id)}
                            disabled={activeOrderId === ord._id}
                            className="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition shadow-2xs flex items-center gap-1"
                          >
                            <FaCheck /> Confirm Order
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelOrder(ord._id)}
                            disabled={activeOrderId === ord._id}
                            className="py-1.5 px-2.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold rounded-lg transition flex items-center gap-1"
                          >
                            <FaBan /> Reject
                          </button>
                        </>
                      )}

                      {isPlaced && role === "buyer" && (
                        <button
                          type="button"
                          onClick={() => handleCancelOrder(ord._id)}
                          disabled={activeOrderId === ord._id}
                          className="py-1.5 px-3 bg-gray-100 hover:bg-rose-100 text-gray-700 hover:text-rose-800 font-semibold rounded-lg transition flex items-center gap-1"
                        >
                          <FaBan /> Cancel Order
                        </button>
                      )}

                      {isPlaced && ord.reservationExpiresAt && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 flex items-center gap-1">
                          <FaClock />
                          Auto-expires: {new Date(ord.reservationExpiresAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default OrdersModal;
