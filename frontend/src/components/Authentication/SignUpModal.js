import React, { useState, useEffect } from "react";
import axios from "axios";
import "./Models.css";

const SignUpModal = ({ isOpen, onClose, onSignUpSuccess }) => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    role: "farmer",
  });

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [waitingVerification, setWaitingVerification] = useState(false);
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let countdown;
    if (waitingVerification) {
      countdown = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(countdown);
            setWaitingVerification(false);
            setError("Verification timed out. Please try again.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdown);
  }, [waitingVerification]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:5000/auth/signup",
        formData
      );
      if (response.status === 200) {
        setWaitingVerification(true);
        setTimer(60);
        if (response.data?.code) {
          setCode(response.data.code);
          setSuccess("Verification code generated! Auto-filled below.");
        }
      }
    } catch (err) {
      setWaitingVerification(false);
      setTimer(60);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/auth/verify-code", {
        email: formData.email,
        code,
      });

      if (res.status === 201 && res.data.token) {
        localStorage.setItem("token", res.data.token);

        const payload = decodeToken(res.data.token);
        if (payload?.firstName && payload?.email) {
          setSuccess("Sign up successful!");
          setError("");
          setWaitingVerification(false);
          setTimeout(() => {
            onSignUpSuccess();
            onClose();
          }, 1000);
        } else {
          setError("Verification succeeded, but user decoding failed.");
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const decodeToken = (token) => {
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch (err) {
      console.error("Invalid token format:", err);
      return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>
          ×
        </button>
        {waitingVerification ? (
          <>
            <div className="verification-wait-box">
              <h2>🔒 Enter Verification Code</h2>
              <p>
                A 6-digit code has been sent to{" "}
                <strong>{formData.email}</strong>.
              </p>
              <input
                type="text"
                placeholder="Enter Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength="6"
              />
              <button className="button" onClick={handleCodeSubmit} disabled={loading}>
                {loading ? "Verifying..." : "Verify Code"}
              </button>
              <p className="timer-text">
                ⏳ Time left: <strong>{timer} seconds</strong>
              </p>
              {success && <p className="success-message">{success}</p>}
              {error && <p className="error-message">{error}</p>}
            </div>
          </>
        ) : (
          <>
            <h2>Sign Up</h2>
            {error && <p className="error-message">{error}</p>}
            <form className="form" onSubmit={handleSignUp}>
              <input
                type="text"
                name="firstName"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
              <input
                type="text"
                name="lastName"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
              <input
                type="tel"
                name="phone"
                placeholder="Phone"
                value={formData.phone}
                onChange={handleChange}
                required
              />
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />

              {/* STEP 8: TWO TOP-LEVEL REGISTRATION SECTIONS */}
              <div className="text-left my-2">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Registration Category:
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    className={`py-2 px-2 text-xs font-bold rounded-lg border transition flex items-center justify-center gap-1.5 ${
                      formData.role === "farmer"
                        ? "bg-emerald-800 text-white border-emerald-900 shadow-sm"
                        : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                    }`}
                    onClick={() => setFormData((prev) => ({ ...prev, role: "farmer" }))}
                  >
                    <span>🌾</span> Section A: Farmer
                  </button>
                  <button
                    type="button"
                    className={`py-2 px-2 text-xs font-bold rounded-lg border transition flex items-center justify-center gap-1.5 ${
                      formData.role === "buyer" || formData.role === "bulk_buyer"
                        ? "bg-emerald-800 text-white border-emerald-900 shadow-sm"
                        : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                    }`}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        role: prev.role === "bulk_buyer" ? "bulk_buyer" : "buyer",
                      }))
                    }
                  >
                    <span>🛒</span> Section B: Buyer
                  </button>
                </div>

                {/* Sub-account selection within Buyer Section */}
                {(formData.role === "buyer" || formData.role === "bulk_buyer") && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mb-2">
                    <span className="block text-[11px] font-bold text-emerald-900 mb-1.5">
                      Select Buyer Account Type:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={`py-1.5 px-2 text-xs font-semibold rounded border transition ${
                          formData.role === "buyer"
                            ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                        onClick={() => setFormData((prev) => ({ ...prev, role: "buyer" }))}
                      >
                        Individual Buyer
                      </button>
                      <button
                        type="button"
                        className={`py-1.5 px-2 text-xs font-semibold rounded border transition ${
                          formData.role === "bulk_buyer"
                            ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                        onClick={() => setFormData((prev) => ({ ...prev, role: "bulk_buyer" }))}
                      >
                        🏢 Bulk Buyer
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-gray-600 mt-1 italic">
                  {formData.role === "farmer" && "• Section A (Farmer): For producers publishing harvest lots and managing farm locations."}
                  {formData.role === "buyer" && "• Section B (Individual Buyer): For household and retail produce discovery."}
                  {formData.role === "bulk_buyer" && "• Section B (Bulk Buyer): For commercial trade, wholesale volume orders & institutional procurement."}
                </p>
              </div>

              <button type="submit" className="button" disabled={loading}>
                {loading ? "Signing Up..." : "Sign Up"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default SignUpModal;
