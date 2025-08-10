import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Hero.css';

// API details
const API_BASE_URL = "http://150.230.138.173:8087";
const HERO_FOLDER = "Hero"; // Folder name on server for Hero images

const Hero = () => {
  // State variables
  const [images, setImages] = useState([]); // All fetched images
  const [currentIndex, setCurrentIndex] = useState(0); // Currently displayed image
  const [nextIndex, setNextIndex] = useState(1); // Next image in slideshow
  const [isFading, setIsFading] = useState(false); // Fade animation trigger
  const [error, setError] = useState(null); // API error messages
  const [isLoading, setIsLoading] = useState(true); // Loading state

  /**
   * Fetch hero section images from the API
   * Runs once when the component mounts
   */
  useEffect(() => {
    const fetchHeroImages = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await axios.get(`${API_BASE_URL}/api/images/${HERO_FOLDER}`);

        // Validate API response
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          // Preload images for smoother slideshow transitions
          response.data.forEach(img => {
            const image = new Image();
            image.src = img.url;
          });

          // Set image data & initial indices
          setImages(response.data);
          setCurrentIndex(0);
          setNextIndex(response.data.length > 1 ? 1 : 0);
        } else {
          setError("No images found for Hero section or invalid data format.");
        }
      } catch (error) {
        console.error("API Error:", error);
        setError(`Failed to load Hero images. ${error.message || 'Server might be down.'}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeroImages();
  }, []);

  /**
   * Slideshow & crossfade animation effect
   * Runs when images are available and currentIndex changes
   */
  useEffect(() => {
    if (images.length <= 1) return; // Skip if no slideshow needed

    const interval = setInterval(() => {
      setIsFading(true); // Start fade-out animation

      // After fade duration, change image and reset fade
      const fadeTimer = setTimeout(() => {
        const newCurrentIndex = (currentIndex + 1) % images.length;
        setCurrentIndex(newCurrentIndex);
        setNextIndex((newCurrentIndex + 1) % images.length);
        setIsFading(false);
      }, 1000); // Match CSS fade duration

      // Cleanup fade timeout
      return () => clearTimeout(fadeTimer);

    }, 5000); // Time between image changes

    // Cleanup slideshow interval
    return () => clearInterval(interval);

  }, [images, currentIndex]);

  // Current and next image URLs
  const currentImageUrl = images[currentIndex]?.url;
  const nextImageUrl = images.length > 1 ? images[nextIndex]?.url : currentImageUrl;

  return (
    <section className="hero">
      {/* Optional background layer */}
      <div className="hero-background-image"></div>

      {/* Dark gradient overlay */}
      <div className="hero-overlay"></div>

      {/* Content & image container */}
      <div className="hero-content-container">
        
        {/* Hero text content */}
        <div className="hero-content">
          <h1>Capture the Moment</h1>
          <p>Join our vibrant community, share your passion, and grow your skills.</p>
          <Link to="/Gallery" className="btn-explore">
            Discover Our Work
          </Link>
        </div>

        {/* Image slideshow area */}
        <div className="hero-image-container">
          {isLoading ? (
            // Show loading text
            <div className="hero-loader">Loading Images...</div>
          ) : error ? (
            // Show API error
            <div className="hero-error">{error}</div>
          ) : images.length > 0 ? (
            <div className="hero-slideshow">
              {/* Current image (fading in or out) */}
              <img
                key={currentIndex}
                src={currentImageUrl}
                alt={`Hero Slide ${currentIndex + 1}`}
                className={`hero-slide-image ${isFading ? 'fade-out' : 'fade-in'}`}
              />

              {/* Preload next image (hidden) */}
              {images.length > 1 && (
                <img
                  key={nextIndex}
                  src={nextImageUrl}
                  alt={`Hero Slide ${nextIndex + 1}`}
                  className="hero-slide-image preload"
                />
              )}
            </div>
          ) : (
            // Fallback if no images found
            <div className="hero-error">No images available.</div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Hero;
