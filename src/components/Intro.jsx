import React from "react";
import { Link } from 'react-router-dom';
import { FaSignInAlt } from 'react-icons/fa'; // Import login icon
import "./Intro.css";

const Intro = () => {
  return (
    <section className="intro">
      {/* Optional: Add pseudo-elements for background effects via CSS */}
      <div className="intro-background-overlay"></div>

      <div className="intro-content">
        <h2 className="intro-heading">
          Unlock Your Photos with Intelligent Recognition
        </h2>
        <p className="intro-text">
          Experience the future of photo organization. Our cutting-edge <span className="highlight-term">AI Face Recognition</span> automatically tags and sorts club event photos, making discovery effortless.
        </p>
        <p className="intro-highlight">
          Log in to access your personalized gallery, view tagged images, and securely download your moments.
        </p>
        <Link to="/Login" className="btn-login">
          <FaSignInAlt className="btn-icon" /> {/* Add icon */}
          Access Your Gallery
        </Link>
      </div>
    </section>
  );
};

export default Intro;