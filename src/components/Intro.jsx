import React from "react";
import { Link } from 'react-router-dom';
import { FaSignInAlt } from 'react-icons/fa'; // Login icon
import "./Intro.css";

const Intro = () => {
  return (
    <section className="intro">
      {/* Background overlay (styling handled in CSS) */}
      <div className="intro-background-overlay"></div>

      {/* Main content block */}
      <div className="intro-content">
        <h2 className="intro-heading">
          Unlock Your Photos with Intelligent Recognition
        </h2>

        {/* Description of the AI face recognition feature */}
        <p className="intro-text">
          Experience the future of photo organization. Our cutting-edge <span className="highlight-term">AI Face Recognition</span> automatically tags and sorts club event photos, making discovery effortless.
        </p>

        {/* Call-to-action highlighting login benefits */}
        <p className="intro-highlight">
          Log in to access your personalized gallery, view tagged images, and securely download your moments.
        </p>

        {/* Login button with icon */}
        <Link to="/Login" className="btn-login">
          <FaSignInAlt className="btn-icon" />
          Access Your Gallery
        </Link>
      </div>
    </section>
  );
};

export default Intro;
