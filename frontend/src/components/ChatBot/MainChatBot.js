import React, { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import { sendMessageAPI } from './chatService';

function MainChatBot({ onBackToLanding }) {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "👋 Welcome to the Smart Agri AI Assistant! Ask me anything about crop cultivation, pest management, fertilizer ratios, livestock care, or farm operations."
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState("english");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async (userMessage) => {
    if (!userMessage || !userMessage.trim()) return;

    const newMessages = [...messages, { sender: 'user', text: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await sendMessageAPI(userMessage, language);
      const botResponse = { sender: 'bot', text: response.data.response };
      setMessages((prev) => [...prev, botResponse]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: "⚠️ Unable to reach the server. Please ensure the backend is running on http://localhost:5000."
        }
      ]);
    }

    setIsLoading(false);
  };

  const samplePrompts = [
    { label: "🌾 Wheat Care", query: "What are the key tips for wheat crop cultivation and fertilization?" },
    { label: "🐛 Pest Control", query: "How do I control insect pests and aphids effectively?" },
    { label: "💧 Water Schedule", query: "What is the best irrigation schedule for cereal crops?" },
    { label: "🐄 Livestock Milk", query: "How can I improve milk yield and animal nutrition?" }
  ];

  return (
    <div className="flex justify-center items-center h-[calc(100vh-64px)] bg-gray-100 p-2 sm:p-4">
      <div className="flex flex-col h-full max-h-[820px] w-full max-w-[700px] bg-white border border-gray-300 rounded-xl shadow-xl overflow-hidden">
        {/* Header Section */}
        <header className="bg-emerald-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            {onBackToLanding && (
              <button
                onClick={onBackToLanding}
                className="px-2.5 py-1 text-xs sm:text-sm font-semibold bg-emerald-800 hover:bg-emerald-900 rounded-md transition duration-150 flex items-center gap-1"
                title="Return to Dashboard"
              >
                ← Back
              </button>
            )}
            <div>
              <h2 className="font-bold text-base sm:text-lg flex items-center gap-2">
                🌾 Smart Agri AI Assistant
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse" title="Assistant Active"></span>
              </h2>
              <p className="text-xs text-emerald-100">Powered by Gemini AI & Agricultural Knowledge Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-emerald-100 hidden sm:inline">Language:</label>
            <select
              onChange={(e) => setLanguage(e.target.value)}
              value={language}
              className="px-2 py-1 text-xs font-medium text-gray-800 bg-white border border-emerald-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="english">English</option>
              <option value="urdu">اردو (Urdu)</option>
            </select>
          </div>
        </header>

        {/* Suggestion Chips */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-3 py-2 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="font-semibold text-emerald-900 shrink-0">Quick Ask:</span>
          {samplePrompts.map((item, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(item.query)}
              className="shrink-0 px-2.5 py-1 bg-white border border-emerald-200 text-emerald-800 rounded-full hover:bg-emerald-100 transition shadow-xs"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Chat Window */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col gap-3">
          {messages.map((msg, index) => (
            <MessageBubble key={index} sender={msg.sender} text={msg.text} />
          ))}
          {isLoading && (
            <div className="self-start bg-gray-200 text-gray-700 px-4 py-2 rounded-2xl text-sm flex items-center gap-2">
              <span className="animate-spin text-base">⏳</span> Consulting agricultural knowledge base...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Section */}
        <div className="p-3 border-t border-gray-200 bg-white">
          <ChatInput sendMessage={sendMessage} language={language} />
        </div>
      </div>
    </div>
  );
}

export default MainChatBot;

