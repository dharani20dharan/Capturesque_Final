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

          {/* Add other links if they exist */}
          {/* Facebook Example (replace # with actual URL) */}
          {/*
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit our Facebook page"
            className="social-icon facebook"
          >
            <FaFacebookF />
          </a>
          */}

          {/* Twitter Example (replace # with actual URL) */}
          {/*
           <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit our Twitter profile"
            className="social-icon twitter"
           >
            <FaTwitter />
           </a>
          */}
        </div>

        <p className="footer-text">
          © {currentYear} Capturesque SNUC. All Rights Reserved.
        </p>
         {/* Optional: Add extra links like Privacy Policy, etc. */}
         {/*
         <div className="footer-links">
            <a href="/privacy-policy">Privacy Policy</a>
            <span>|</span>
            <a href="/terms-of-service">Terms of Service</a>
         </div>
         */}
      </div>
    </footer>
  );
}

export default Footer;