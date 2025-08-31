import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Hero.css';

const API_BASE_URL = "http://150.230.138.173:8087";
const HERO_FOLDER = "Hero"; // Define the folder name

const Hero = () => {
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1); // For crossfade
  const [isFading, setIsFading] = useState(false); // Control fade state
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Loading state

  // Fetch Images
  useEffect(() => {
    const fetchHeroImages = async () => {
      setIsLoading(true);
      setError(null); // Reset error on fetch
      try {
        const response = await axios.get(`${API_BASE_URL}/api/images/${HERO_FOLDER}`);
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          // Preload images slightly for smoother transition (optional but good)
          response.data.forEach(img => {
            const image = new Image();
            image.src = img.url;
          });
          setImages(response.data);
          setCurrentIndex(0);
          setNextIndex(response.data.length > 1 ? 1 : 0); // Set initial next index
        } else {
          setError("No images found for Hero section or invalid data format.");
        }
      } catch (error) {
        console.error("API Error:", error); // Log the actual error
        setError(`Failed to load Hero images. ${error.message || 'Server might be down.'}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeroImages();
  }, []); // Fetch only once on mount

  // Image Slideshow Timer & Crossfade Logic
  useEffect(() => {
    if (images.length <= 1) return; // No slideshow needed for 0 or 1 image

    const interval = setInterval(() => {
      setIsFading(true); // Start fade-out of current image

      // After the fade duration, update indices and end fade
      const fadeTimer = setTimeout(() => {
        const newCurrentIndex = (currentIndex + 1) % images.length;
        setCurrentIndex(newCurrentIndex);
        setNextIndex((newCurrentIndex + 1) % images.length); // Prepare the next image
        setIsFading(false); // End fade-out, new image is now visible
      }, 1000); // Match this duration to CSS transition duration

      // Clear timeout if component unmounts or images change
      return () => clearTimeout(fadeTimer);

    }, 5000); // Time each image is fully visible (e.g., 5 seconds)

    // Clear interval on unmount or when images change
    return () => clearInterval(interval);

  }, [images, currentIndex]); // Rerun effect if images array or current index changes


  // Determine URLs for current and next images
  const currentImageUrl = images[currentIndex]?.url;
  const nextImageUrl = images.length > 1 ? images[nextIndex]?.url : currentImageUrl; // Use current if only 1 image

  return (
    <section className="hero">
      {/* Background Image Layer (Optional subtle movement) */}
      <div className="hero-background-image"></div>

      {/* Gradient Overlay */}
      <div className="hero-overlay"></div>

      {/* Content */}
      <div className="hero-content-container"> {/* Added container for centering */}
        <div className="hero-content">
          <h1>Capture the Moment</h1>
          <p>Join our vibrant community, share your passion, and grow your skills.</p>
          <Link to="/Gallery" className="btn-explore">
            Discover Our Work
          </Link>
        </div>

        <div className="hero-image-container">
          {isLoading ? (
            <div className="hero-loader">Loading Images...</div>
          ) : error ? (
            <div className="hero-error">{error}</div>
          ) : images.length > 0 ? (
            <div className="hero-slideshow">
              {/* Render current image (potentially fading out) */}
              <img
                key={currentIndex} // Key helps React differentiate elements
                src={currentImageUrl}
                alt={`Hero Slide ${currentIndex + 1}`}
                className={`hero-slide-image ${isFading ? 'fade-out' : 'fade-in'}`}
              />
              {/* Preload next image (hidden but ready, potentially fading in) */}
               {images.length > 1 && (
                  <img
                    key={nextIndex}
                    src={nextImageUrl}
                    alt={`Hero Slide ${nextIndex + 1}`}
                    className="hero-slide-image preload" // Hidden by default
                  />
               )}
            </div>
          ) : (
             // Fallback if no images and no error (shouldn't happen often with current logic)
            <div className="hero-error">No images available.</div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Hero;