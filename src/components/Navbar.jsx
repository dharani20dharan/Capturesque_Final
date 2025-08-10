
import React, { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaUserCircle,
  FaHome,
  FaImages,
  FaTrophy,
  FaInfoCircle,
  FaSignInAlt,
  FaSignOutAlt,
} from "react-icons/fa";
import "./Navbar.css";

// Custom Hook to detect clicks outside a referenced element
function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}


const Navbar = () => {
  // Track if the user is logged in
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));
  
  // Track dropdown menu visibility
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // React Router's navigation hook
  const navigate = useNavigate();
  
  // Ref for dropdown menu to detect outside clicks
  const dropdownRef = useRef(null);

  // Hook to close dropdown if clicked outside
  useClickOutside(dropdownRef, () => setIsDropdownOpen(false));

  // Effect to listen for auth state dchanges
  useEffect(() => {
    const handleAuthChange = () => {
      setIsLoggedIn(!!localStorage.getItem("token"));
    };

    // Listen for storage changes
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("authChange", handleAuthChange);
   
    handleAuthChange(); // Initial check

    // Cleanup event listeners on unmount
    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("authChange", handleAuthChange);
    };
  }, []);

  // Handle user logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setIsLoggedIn(false);
    setIsDropdownOpen(false);

    // Dispatch a custom event to notify other comp
    window.dispatchEvent(new Event("authChange"));
    
    navigate("/login"); //Redirect to login page
  };

    // Toggle dropdown
  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  // Active class for styling navlinks
  const getNavLinkClass = ({ isActive }) => (isActive ? "nav-link active" : "nav-link");
  const getLoginLinkClass = ({ isActive }) => isActive ? "nav-link login-link active" : "nav-link login-link";


return (
    <header className="navbar">
      <div className="navbar-container">

        {/* Logo section linking to homepage */}
        <NavLink to="/" className="navbar-logo-link" aria-label="Go to Homepage">
          <img
            src="src/Assets/logo1.jpg"
            alt="Capturesque Logo"
            className="logo"
          />
          {/* Optional text-based logo */}
          {/* <span className="logo-text">PhotoClub</span> */}
        </NavLink>

        {/* Navigation Links */}
        <nav className="navbar-links" aria-label="Main navigation">
          <ul>
            <li>
              <NavLink to="/home" className={getNavLinkClass}>
                <FaHome className="link-icon" aria-hidden="true" />
                <span className="link-text">Home</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/gallery" className={getNavLinkClass}>
                <FaImages className="link-icon" aria-hidden="true" />
                <span className="link-text">Gallery</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/contests" className={getNavLinkClass}>
                <FaTrophy className="link-icon" aria-hidden="true" />
                <span className="link-text">Contests</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/club_info" className={getNavLinkClass}>
                <FaInfoCircle className="link-icon" aria-hidden="true" />
                <span className="link-text">Club Info</span>
              </NavLink>
            </li>
          </ul>
        </nav>

        {/* Login / Profile Actions */}
        <div className="navbar-actions">
          {isLoggedIn ? (
            // Profile dropdown when logged in
            <div
              className={`profile-dropdown ${isDropdownOpen ? "open" : ""}`}
              ref={dropdownRef}
            >
              {/* Profile icon button */}
              <button
                className="profile-trigger"
                onClick={toggleDropdown}
                aria-label="User menu"
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
                aria-controls="dropdown-menu"
              >
                <FaUserCircle className="user-icon" aria-hidden="true" />
              </button>

              {/* Dropdown menu */}
              <ul className="dropdown-menu" id="dropdown-menu" role="menu">
                <li role="none">
                  <button
                    onClick={handleLogout}
                    className="logout-button"
                    role="menuitem"
                  >
                    <FaSignOutAlt aria-hidden="true" /> Logout
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            // Login button if not logged in
            <NavLink to="/login" className={getLoginLinkClass}>
              <FaSignInAlt className="link-icon" aria-hidden="true" />
              <span className="link-text">Login</span>
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;