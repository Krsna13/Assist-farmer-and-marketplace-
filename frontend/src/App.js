import React, { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import Navbar from "./components/Navbar";
import LandingPage from "./components/LandingPage/LandingPage";
import SignUpModal from "./components/Authentication/SignUpModal";
import LoginModal from "./components/Authentication/LoginModal";
import Profile from "./components/profile/Profile";
import ServiceReminders from "./components/ServiceReminders/ServiceReminders";
import CropManagement from "./components/CropManagement/CropManagement";
import LivestockManagement from "./components/LivestockManagement/LivestockManagement";
import ResourceManagement from "./components/ResourceManagement/ResourceManagement";
import MainChatBot from "./components/ChatBot/MainChatBot";
import ReportGeneration from "./components/ReportGeneration/ReportGeneration";
import Marketplace from "./components/Marketplace/Marketplace";

const App = () => {
  const [isSignUpOpen, setSignUpOpen] = useState(false);
  const [isLoginOpen, setLoginOpen] = useState(false);
  const [isLoggedIn, setLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showServiceReminders, setShowServiceReminders] = useState(false);
  const [showCropManagement, setShowCropManagement] = useState(false);
  const [showLivestockManagement, setShowLivestockManagement] = useState(false);
  const [showResourceManagement, setShowResourceManagement] = useState(false);
  const [showReportGeneration, setShowReportGeneration] = useState(false);
  const [showChatBot, setShowChatBot] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const logoutNow = () => {
      localStorage.removeItem("token");
      alert("Session expired. Logging out now.");
      setLoggedIn(false);
      setUserRole(null);
      window.location.reload();
    };

    const checkTokenExpiration = () => {
      try {
        const decoded = jwtDecode(token.replace("Bearer ", ""));
        const currentTime = Date.now() / 1000;
        if (decoded.exp < currentTime) {
          logoutNow();
        } else {
          setLoggedIn(true);
          setUserRole(decoded.role || "farmer");
        }
      } catch (err) {
        console.error("Token decode error:", err);
        logoutNow();
      }
    };

    const intervalId = setInterval(checkTokenExpiration, 1000);
    checkTokenExpiration();

    return () => clearInterval(intervalId);
  }, []);

  const handleLoginSuccess = (firstName, lastName, email, role) => {
    setLoginOpen(false);
    setLoggedIn(true);
    const token = localStorage.getItem("token");
    let resolvedRole = role;
    if (!resolvedRole && token) {
      try {
        const decoded = jwtDecode(token.replace("Bearer ", ""));
        resolvedRole = decoded.role || "farmer";
      } catch (err) {
        console.error("Error decoding token on login:", err);
      }
    }
    const finalRole = resolvedRole || "farmer";
    setUserRole(finalRole);
    if (finalRole === "buyer" || finalRole === "bulk_buyer") {
      navigateToMarketplace();
    }
  };

  const handleSignUpSuccess = () => {
    setSignUpOpen(false);
    setLoggedIn(true);
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token.replace("Bearer ", ""));
        const role = decoded.role || "farmer";
        setUserRole(role);
        if (role === "buyer" || role === "bulk_buyer") {
          navigateToMarketplace();
        }
      } catch (err) {
        console.error("Error decoding token on signup:", err);
      }
    }
  };

  const toggleProfile = () => setShowProfile(!showProfile);

  const navigateToLanding = () => {
    setShowProfile(false);
    setShowMarketplace(false);
    setShowServiceReminders(false);
    setShowCropManagement(false);
    setShowLivestockManagement(false);
    setShowResourceManagement(false);
    setShowReportGeneration(false);
    setShowChatBot(false);
  };

  const navigateToMarketplace = () => {
    setShowProfile(false);
    setShowServiceReminders(false);
    setShowCropManagement(false);
    setShowLivestockManagement(false);
    setShowResourceManagement(false);
    setShowReportGeneration(false);
    setShowChatBot(false);
    setShowMarketplace(true);
  };

  const handleProtectedClick = (setter) => {
    if (!isLoggedIn) {
      setLoginOpen(true);
    } else {
      setter(true);
    }
  };

  return (
    <>
      <Navbar
        onSignUpClick={() => setSignUpOpen(true)}
        onLoginClick={() => setLoginOpen(true)}
        isLoggedIn={isLoggedIn}
        userRole={userRole}
        onProfileClick={toggleProfile}
        onNavigateToLanding={navigateToLanding}
        onMarketplaceClick={navigateToMarketplace}
        onAlertClick={() => {
          if (!isLoggedIn) {
            setLoginOpen(true);
          } else {
            setShowProfile(false);
            setShowMarketplace(false);
            setShowCropManagement(false);
            setShowLivestockManagement(false);
            setShowResourceManagement(false);
            setShowReportGeneration(false);
            setShowChatBot(false);
            setShowServiceReminders((prev) => !prev); // toggle reminders page
          }
        }}
      />

      {showProfile ? (
        <Profile onClose={toggleProfile} />
      ) : showMarketplace ? (
        <Marketplace
          onBackToLanding={navigateToLanding}
          onLoginRequired={() => setLoginOpen(true)}
          isLoggedIn={isLoggedIn}
          userRole={userRole}
        />
      ) : showServiceReminders ? (
        <ServiceReminders onBackToLanding={navigateToLanding} />
      ) : showCropManagement ? (
        <CropManagement onBackToLanding={navigateToLanding} />
      ) : showLivestockManagement ? (
        <LivestockManagement onBackToLanding={navigateToLanding} />
      ) : showResourceManagement ? (
        <ResourceManagement onBackToLanding={navigateToLanding} />
      ) : showReportGeneration ? (
        <ReportGeneration onBackToLanding={navigateToLanding} />
      ) : showChatBot ? (
        <MainChatBot onBackToLanding={navigateToLanding} />
      ) : (
        <LandingPage
          isLoggedIn={isLoggedIn}
          navigateToLogin={() => setLoginOpen(true)}
          onMarketplaceClick={navigateToMarketplace}
          onReminderServiceClick={() =>
            handleProtectedClick(setShowServiceReminders)
          }
          onCropManagementClick={() =>
            handleProtectedClick(setShowCropManagement)
          }
          onLivestockManagementClick={() =>
            handleProtectedClick(setShowLivestockManagement)
          }
          onResourceManagementClick={() =>
            handleProtectedClick(setShowResourceManagement)
          }
          onChatBotClick={() => handleProtectedClick(setShowChatBot)}
          onReportGenerationClick={() =>
            handleProtectedClick(setShowReportGeneration)
          }
        />
      )}

      <SignUpModal
        isOpen={isSignUpOpen}
        onClose={() => setSignUpOpen(false)}
        onSignUpSuccess={handleSignUpSuccess}
      />
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
};

export default App;
