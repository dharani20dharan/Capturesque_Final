// src/components/Navbar/Navbar.js
// NO CHANGES NEEDED HERE from the previous refined version.
// Keep the code with useClickOutside, dropdown state, etc.

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
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  useClickOutside(dropdownRef, () => setIsDropdownOpen(false));

  useEffect(() => {
    const handleAuthChange = () => {
      setIsLoggedIn(!!localStorage.getItem("token"));
    };

    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("authChange", handleAuthChange);
    handleAuthChange(); // Initial check

    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("authChange", handleAuthChange);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setIsLoggedIn(false);
    setIsDropdownOpen(false);
    window.dispatchEvent(new Event("authChange"));
    navigate("/login");
  };

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  const getNavLinkClass = ({ isActive }) => (isActive ? "nav-link active" : "nav-link");
  const getLoginLinkClass = ({ isActive }) => isActive ? "nav-link login-link active" : "nav-link login-link";


  return (
    <header className="navbar">
      <div className="navbar-container">
        <NavLink to="/" className="navbar-logo-link" aria-label="Go to Homepage">
          <img src="/Assets/logo1.jpg" alt="PhotoClub Logo" className="logo" />
          {/* <span className="logo-text">PhotoClub</span> */}
        </NavLink>

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

        <div className="navbar-actions">
          {isLoggedIn ? (
            <div className={`profile-dropdown ${isDropdownOpen ? 'open' : ''}`} ref={dropdownRef}>
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
              <ul
                className="dropdown-menu"
                id="dropdown-menu"
                role="menu"
              >
                 {/* Example Profile Link
                <li role="none">
                  <NavLink to="/profile" role="menuitem" onClick={() => setIsDropdownOpen(false)}>
                    Profile
                  </NavLink>
                </li>
                 */}
                <li role="none">
                  <button onClick={handleLogout} className="logout-button" role="menuitem">
                    <FaSignOutAlt aria-hidden="true" /> Logout
                  </button>
                </li>
              </ul>
            </div>
          ) : (
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