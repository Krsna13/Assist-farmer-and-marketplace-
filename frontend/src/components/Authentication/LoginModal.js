import React, { useState, useEffect, useRef } from "react";
import "./Models.css";

const DEMO_PASSWORD = "DemoFarmerPass123!";

const LoginModal = ({ isOpen, onClose, onLoginSuccess }) => {
  // Top-level Section: 'farmer' (Section A) or 'buyer' (Section B)
  const [activeSection, setActiveSection] = useState("farmer");
  // Sub-account type under Buyer section: 'buyer' (individual) or 'bulk_buyer' (commercial)
  const [buyerType, setBuyerType] = useState("buyer");

  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const hasCheckedToken = useRef(false);

  // Decode JWT token function (safer version)
  const decodeToken = (token) => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload;
    } catch (err) {
      console.error("Invalid token format:", err);
      return null;
    }
  };

  // Auto-login from token on page load (only once)
  useEffect(() => {
    if (hasCheckedToken.current) return;

    const token = localStorage.getItem("token");
    if (token) {
      const payload = decodeToken(token);
      if (payload?.firstName && payload?.email) {
        onLoginSuccess(payload.firstName, payload.lastName, payload.email, payload.role);
      } else {
        localStorage.removeItem("token");
      }
    }

    hasCheckedToken.current = true;
  }, [onLoginSuccess]);

  // Validate input (email or phone)
  const validateInput = (input) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?\d{10,15}$/;
    return emailRegex.test(input) || phoneRegex.test(input);
  };

  // Helper to fill demo credentials for college presentation
  const handleQuickDemoFill = (email) => {
    setEmailOrPhone(email);
    setPassword(DEMO_PASSWORD);
    setError("");
    setNotice("");
  };

  // Handle login submission
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setSuccess("");

    if (!validateInput(emailOrPhone) || !password) {
      setError("Please enter a valid email or phone number and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Invalid email or password.");
        return;
      }

      // Store token and authoritative user info
      localStorage.setItem("token", data.token);

      const payload = decodeToken(data.token);
      const userRole = data.user?.role || payload?.role || "farmer";
      const firstName = data.user?.firstName || payload?.firstName || "";
      const lastName = data.user?.lastName || payload?.lastName || "";
      const email = data.user?.email || payload?.email || "";

      // Step 8 Verification: Check if authenticated user's role matches the selected login section
      const isFarmerSection = activeSection === "farmer";
      const isFarmerRole = userRole === "farmer";

      if (isFarmerSection && !isFarmerRole) {
        // User logged into Farmer portal with a Buyer or Bulk Buyer account
        setNotice(
          `Notice: Your account is registered as a ${
            userRole === "bulk_buyer" ? "Bulk Wholesale Buyer" : "Individual Buyer"
          }. Directing you to the Buyer Marketplace...`
        );
      } else if (!isFarmerSection && isFarmerRole) {
        // User logged into Buyer portal with a Farmer account
        setNotice(
          "Notice: Your account is registered as a Farmer. Directing you to your Farmer Dashboard..."
        );
      } else {
        setSuccess(
          `Login successful! Welcome ${
            userRole === "farmer"
              ? "Farmer"
              : userRole === "bulk_buyer"
              ? "Bulk Buyer"
              : "Buyer"
          } ${firstName}.`
        );
      }

      setTimeout(() => {
        onLoginSuccess(firstName, lastName, email, userRole);
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Login error:", err);
      setError("Something went wrong connecting to authentication server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "460px", padding: "24px" }}>
        <button onClick={onClose} className="close-button" title="Close">
          &times;
        </button>

        <h2 style={{ margin: "0 0 6px", fontSize: "22px", fontWeight: "800", color: "#111827" }}>
          Welcome Back
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "#6b7280" }}>
          Sign in to access your agricultural dashboard or marketplace discovery.
        </p>

        {/* STEP 8: EXACTLY TWO VISIBLE TOP-LEVEL SECTIONS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            marginBottom: "14px",
            backgroundColor: "#f3f4f6",
            padding: "4px",
            borderRadius: "10px",
          }}
        >
          {/* SECTION A: FARMER */}
          <button
            type="button"
            onClick={() => {
              setActiveSection("farmer");
              setError("");
              setNotice("");
            }}
            style={{
              padding: "10px 8px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: activeSection === "farmer" ? "700" : "600",
              fontSize: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
              backgroundColor: activeSection === "farmer" ? "#065f46" : "transparent",
              color: activeSection === "farmer" ? "#ffffff" : "#4b5563",
              boxShadow: activeSection === "farmer" ? "0 2px 6px rgba(6,95,70,0.3)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ fontSize: "16px" }}>🌾</span>
            <span>Section A: Farmer</span>
            <span style={{ fontSize: "10px", opacity: activeSection === "farmer" ? 0.9 : 0.7 }}>
              Producer & Grower
            </span>
          </button>

          {/* SECTION B: BUYER */}
          <button
            type="button"
            onClick={() => {
              setActiveSection("buyer");
              setError("");
              setNotice("");
            }}
            style={{
              padding: "10px 8px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: activeSection === "buyer" ? "700" : "600",
              fontSize: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
              backgroundColor: activeSection === "buyer" ? "#065f46" : "transparent",
              color: activeSection === "buyer" ? "#ffffff" : "#4b5563",
              boxShadow: activeSection === "buyer" ? "0 2px 6px rgba(6,95,70,0.3)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ fontSize: "16px" }}>🛒</span>
            <span>Section B: Buyer</span>
            <span style={{ fontSize: "10px", opacity: activeSection === "buyer" ? 0.9 : 0.7 }}>
              Individual & Bulk
            </span>
          </button>
        </div>

        {/* SUB-ACCOUNT SELECTOR FOR BUYER SECTION */}
        {activeSection === "buyer" && (
          <div
            style={{
              backgroundColor: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "8px",
              padding: "8px 10px",
              marginBottom: "14px",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: "10.5px", fontWeight: "700", color: "#065f46", marginBottom: "6px" }}>
              Buyer Account Category:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <button
                type="button"
                onClick={() => setBuyerType("buyer")}
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: buyerType === "buyer" ? "700" : "500",
                  backgroundColor: buyerType === "buyer" ? "#059669" : "#ffffff",
                  color: buyerType === "buyer" ? "#ffffff" : "#374151",
                  border: "1px solid " + (buyerType === "buyer" ? "#059669" : "#d1d5db"),
                  cursor: "pointer",
                }}
              >
                Individual Buyer
              </button>
              <button
                type="button"
                onClick={() => setBuyerType("bulk_buyer")}
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: buyerType === "bulk_buyer" ? "700" : "500",
                  backgroundColor: buyerType === "bulk_buyer" ? "#059669" : "#ffffff",
                  color: buyerType === "bulk_buyer" ? "#ffffff" : "#374151",
                  border: "1px solid " + (buyerType === "bulk_buyer" ? "#059669" : "#d1d5db"),
                  cursor: "pointer",
                }}
              >
                🏢 Bulk Buyer
              </button>
            </div>
            <p style={{ margin: "5px 0 0", fontSize: "10px", color: "#047857" }}>
              {buyerType === "buyer"
                ? "Retail household discovery & direct purchase."
                : "Commercial wholesale lots & container-grade farm produce."}
            </p>
          </div>
        )}

        {/* NOTICES, SUCCESS, AND ERROR BANNERS */}
        {error && (
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              padding: "8px 12px",
              borderRadius: "6px",
              fontSize: "11.5px",
              fontWeight: "600",
              marginBottom: "12px",
            }}
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            style={{
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1d4ed8",
              padding: "8px 12px",
              borderRadius: "6px",
              fontSize: "11.5px",
              fontWeight: "600",
              marginBottom: "12px",
            }}
          >
            {notice}
          </div>
        )}
        {success && (
          <div
            style={{
              backgroundColor: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#047857",
              padding: "8px 12px",
              borderRadius: "6px",
              fontSize: "11.5px",
              fontWeight: "600",
              marginBottom: "12px",
            }}
          >
            {success}
          </div>
        )}

        {/* LOGIN FORM */}
        <form className="form" onSubmit={handleLogin} style={{ gap: "10px" }}>
          <input
            type="text"
            placeholder={
              activeSection === "farmer"
                ? "Farmer Email or Phone"
                : buyerType === "bulk_buyer"
                ? "Bulk Buyer Email or Phone"
                : "Buyer Email or Phone"
            }
            value={emailOrPhone}
            onChange={(e) => setEmailOrPhone(e.target.value)}
            required
            style={{
              padding: "10px 12px",
              fontSize: "13px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "10px 12px",
              fontSize: "13px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
            }}
          />
          <button
            type="submit"
            className="button"
            disabled={loading}
            style={{
              backgroundColor: "#065f46",
              padding: "11px",
              borderRadius: "6px",
              fontWeight: "700",
              fontSize: "14px",
            }}
          >
            {loading
              ? "Signing In..."
              : activeSection === "farmer"
              ? "Log In as Farmer"
              : buyerType === "bulk_buyer"
              ? "Log In as Bulk Buyer"
              : "Log In as Buyer"}
          </button>
        </form>

        {/* DEMO QUICK-FILL HELPERS (COLLEGE EVALUATION ASSISTANT) */}
        <div
          style={{
            marginTop: "16px",
            paddingTop: "12px",
            borderTop: "1px dashed #e5e7eb",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: "700",
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "6px",
            }}
          >
            Demo Auto-Fill Credentials:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {activeSection === "farmer" ? (
              <>
                <button
                  type="button"
                  onClick={() => handleQuickDemoFill("farmer01.demo@example.test")}
                  style={{
                    backgroundColor: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "4px",
                    padding: "3px 8px",
                    fontSize: "10.5px",
                    color: "#065f46",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Demo Farmer 01 (Nashik)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoFill("farmer02.demo@example.test")}
                  style={{
                    backgroundColor: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "4px",
                    padding: "3px 8px",
                    fontSize: "10.5px",
                    color: "#065f46",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Demo Farmer 02 (Dindori)
                </button>
              </>
            ) : buyerType === "bulk_buyer" ? (
              <button
                type="button"
                onClick={() => handleQuickDemoFill("bulkbuyer.demo@example.test")}
                style={{
                  backgroundColor: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderRadius: "4px",
                  padding: "4px 10px",
                  fontSize: "11px",
                  color: "#065f46",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                🏢 Auto-Fill: bulkbuyer.demo@example.test
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleQuickDemoFill("buyer01.demo@example.test")}
                style={{
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "4px",
                  padding: "3px 8px",
                  fontSize: "10.5px",
                  color: "#065f46",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Auto-Fill Demo Individual Buyer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
