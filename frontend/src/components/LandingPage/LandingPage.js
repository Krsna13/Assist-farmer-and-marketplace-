import React from "react";
import HeroSectionImage from "../../assets/main_page.jpeg"
import visionImage from "../../assets/vision.jpg";
import service1 from "../../assets/service1.jpg";
import service2 from "../../assets/service2.jpg";
import service3 from "../../assets/service3.jpg";
import service4 from "../../assets/service4.jpg";
import service5 from "../../assets/service5.jpg";
import service6 from "../../assets/service6.jpg";
import { FaStore, FaSeedling, FaRobot, FaHandshake } from "react-icons/fa";
import "./HeroSection.css";
import "./Vision.css";
import "./Services.css";
import "./Footer.css";

const LandingPage = ({
  isLoggedIn,
  navigateToLogin,
  onReminderServiceClick,
  onCropManagementClick,
  onLivestockManagementClick,
  onResourceManagementClick,
  onChatBotClick,
  onReportGenerationClick,
  onMarketplaceClick,
}) => {
  const handleGetStarted = () => {
    const servicesSection = document.getElementById("services-section");
    servicesSection.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div>
      <section className="hero" id="hero-section" style={
        {
          backgroundImage: `url(${HeroSectionImage})`
        }
      }>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1>Smart Farming, Managed Together!</h1>
          <p className="w-[550px] mx-auto">
          From crop tracking and livestock management to basic resource planning — manage your farming operations and improve productivity with simple digital tools.
          </p>
          <button className="button" onClick={handleGetStarted}>
            Get Started
          </button>
        </div>
      </section>
      <section className="vision">
        <div className="text">
          <h2>Vision</h2>
          <p>
            To empower small-scale farmers by digitizing agricultural
            operations, enabling efficient farm management, and fostering
            sustainable agricultural practices. Our Farm Management System aims
            to transform traditional farming methods by providing a centralized
            platform for crop planning, livestock tracking, resource management,
            and intelligent decision-making tools like Chatbot, reminders,
            and Record Summary.
          </p>
        </div>
        <div className="image">
          <img src={visionImage} alt="Vision" />
        </div>
      </section>
      <section className="services" id="services-section">
        <h2>Our Services</h2>
        <div className="service-list">
          <div
            className="service-item"
            onClick={() => {
              if (isLoggedIn) {
                onCropManagementClick();
              } else {
                navigateToLogin();
              }
            }}
          >
            <img src={service1} alt="Crop Management" />
            <h3>Crop Management</h3>
            <p>
            Record and monitor your crop fields, activities, and costs. Track sowing, fertilization, and harvest, with summaries of yield and profit for each plot.
            </p>
          </div>
          <div
            className="service-item"
            onClick={() => {
              if (isLoggedIn) {
                onLivestockManagementClick();
              } else {
                navigateToLogin();
              }
            }}
          >
            <img src={service2} alt="Livestock Management" />
            <h3>Livestock Management</h3>
            <p>
            Track health, feeding, and breeding of your animals with precision. Keep your records organized and your livestock cared for.
            </p>
          </div>
          <div
            className="service-item"
            onClick={() => {
              if (isLoggedIn) {
                onResourceManagementClick();
              } else {
                navigateToLogin();
              }
            }}
          >
            <img src={service3} alt="Resource Management" />
            <h3>Resource Management</h3>
            <p>
              Streamline your resource allocation by tracking and managing
              seeds, fertilizers, equipment, and more for optimal usage and ensure timely availability.
            </p>
          </div>
          <div
            className="service-item"
            onClick={() => {
              if (isLoggedIn) {
                onChatBotClick();
              } else {
                navigateToLogin();
              }
            }}
          >
            <img src={service4} alt="ChatBot" />
            <h3>ChatBot</h3>
            <p>
              Get real-time answers to your farming queries with an intelligent
              chatbot integrated with your farm's data.
            </p>
          </div>
          <div className="service-item" onClick={onReminderServiceClick}>
            <img src={service5} alt="Reminders Service" />
            <h3>Reminders Service</h3>
            <p>
            Create custom reminders for planting, feeding, irrigation, and more. Stay on top of tasks with manual alerts you set yourself.
            </p>
          </div>
          <div
            className="service-item"
            onClick={() => {
              if (isLoggedIn) {
                onReportGenerationClick();
              } else {
                navigateToLogin();
              }
            }}
          >
            <img src={service6} alt="Report Generation" />
            <h3>Interactive Record Builder</h3>
            <p>
            Generate and download summaries of crop and resource records. Includes yield, costs, and profit details saved to your device.
            </p>
          </div>
          {/* Card 7: Farm Marketplace (Stage 1) */}
          <div
            className="service-item cursor-pointer flex flex-col justify-between"
            onClick={onMarketplaceClick}
          >
            <div>
              <div className="w-[100px] h-[100px] mx-auto mb-[15px] rounded-full bg-emerald-700/80 border-2 border-white/40 flex items-center justify-center text-4xl text-yellow-300 shadow-md transform transition hover:scale-110">
                <FaStore />
              </div>
              <h3>Farm Marketplace</h3>
              <p>
                Explore farm produce, check available agricultural stock, and connect farmers with individual and bulk buyers.
              </p>
            </div>
            <div className="mt-4">
              <button
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-full shadow-md transition transform hover:scale-105 inline-block"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarketplaceClick();
                }}
              >
                Explore Marketplace →
              </button>
            </div>
          </div>
        </div>
      </section>
      {/* About Us Section */}
      <section className="about-section py-16 px-6" id="about-section">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider mb-3">
            About Smart Agri Management
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-emerald-950 mb-4">
            Empowering Farmers With a Connected Digital Ecosystem
          </h2>
          <p className="text-gray-700 text-base md:text-lg leading-relaxed max-w-3xl mx-auto mb-12">
            <strong>Smart Agri Management</strong> is an all-in-one farm management and trading platform designed to simplify daily agricultural operations. We empower growers to digitize plot records, monitor livestock health, automate resource inventory, track costs, and connect directly with verified buyers—eliminating middlemen and paperwork.
          </p>

          {/* How It Works Heading */}
          <h3 className="text-2xl font-bold text-emerald-900 mb-8 flex items-center justify-center gap-2">
            <span>⚙️</span> How It Works (In 3 Simple Steps)
          </h3>

          {/* 3 Workflow Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {/* Step 1 */}
            <div className="bg-white p-6 rounded-2xl shadow-md border border-emerald-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold mb-4">
                <FaSeedling />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Step 1</span>
              <h4 className="text-xl font-bold text-gray-900 mt-1 mb-2">Plan & Record</h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                Log crop lifecycle stages, track plots and soil details, manage livestock medical & breeding history, and organize warehouse supplies (seeds, fertilizers) in secure digital logs.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-6 rounded-2xl shadow-md border border-emerald-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold mb-4">
                <FaRobot />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Step 2</span>
              <h4 className="text-xl font-bold text-gray-900 mt-1 mb-2">Automate & Advise</h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                Receive proactive task reminders, monitor operational expenses vs. yield revenue, consult our 24/7 AI ChatBot for crop care, and generate PDF financial summaries.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-6 rounded-2xl shadow-md border border-emerald-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold mb-4">
                <FaHandshake />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Step 3</span>
              <h4 className="text-xl font-bold text-gray-900 mt-1 mb-2">Connect & Sell</h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                List saleable harvests or livestock on our Farm Marketplace. Buyers discover fresh produce on a regional interactive map, inspect freshness photos, and buy or bid directly at fair prices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <h3>Smart Agri Management</h3>
        <p>
          <strong>Email:</strong> support@smartagrimanagement.com
        </p>
        <p>
          <strong>Platform:</strong> Smart Agri Farm Management System
        </p>
        <p>
          <strong>Support:</strong> Available 24/7 for farmers
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
