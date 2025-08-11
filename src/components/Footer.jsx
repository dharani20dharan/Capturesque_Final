import React from 'react';
// Import icons you actually have links for
import { FaInstagram, FaFacebookF, FaTwitter } from 'react-icons/fa';
import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container"> {/* Use a container for content alignment */}

        <div className="social-links">
          {/* Instagram */}
          <a
            href="https://www.instagram.com/snuc_capturesque/" // Your actual link
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit our Instagram page"
            className="social-icon instagram"
          >
            <FaInstagram />
          </a>

        </div>

        <p className="footer-text">
          © {currentYear} Capturesque SNUC. All Rights Reserved.
        </p>
    
      </div>
    </footer>
  );
}

export default Footer;