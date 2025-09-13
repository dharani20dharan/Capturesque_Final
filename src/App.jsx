import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Gallery from "./component/Gallery/Gallery.jsx";
import Login from "./pages/Login";
import ClubInfo from "./pages/ClubInfo";
import Contests from "./pages/Contests.jsx";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check login state from localStorage
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("token");
      setIsAuthenticated(!!token);
    };
    checkAuth();

    // Update auth state if another tab logs in/out
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  return (
    <Router>
      <Navbar />
      <Routes>
        {/* Redirect root to /home */}
        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* Home page */}
        <Route path="/home" element={<Home />} />

        {/* Protected gallery */}
        <Route path="/gallery" element={<Gallery isAuthenticated={isAuthenticated} />} />

        {/* Login */}
        <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />

        {/* Info & contests */}
        <Route path="/club_info" element={<ClubInfo />} />
        <Route path="/contests" element={<Contests />} />
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;
