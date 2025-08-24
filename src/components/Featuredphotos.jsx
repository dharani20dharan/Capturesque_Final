import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { FaChevronLeft, FaChevronRight, FaSpinner } from 'react-icons/fa';
import "./Featuredphotos.css";

// --- Configuration ---
const API_BASE_URL = "http://150.230.138.173:8087";
const FEATURE_FOLDER = "Feature";
const AUTOPLAY_INTERVAL = 5000; // 5 seconds for a more relaxed pace

// --- Custom Hook for Interval with Hover Pause ---
const useAutoplay = (callback, delay) => {
  const savedCallback = useRef();
  const intervalId = useRef(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const run = useCallback(() => {
    if (!isPaused) {
      savedCallback.current();
    }
  }, [isPaused]);

  useEffect(() => {
    if (delay !== null) {
      intervalId.current = setInterval(run, delay);
      return () => clearInterval(intervalId.current);
    }
  }, [delay, run]);

  return { pause: () => setIsPaused(true), resume: () => setIsPaused(false) };
};

// --- Main Component ---
const Featuredphotos = () => {
  const [categories, setCategories] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Unified status for loading, success, and error states
  const [status, setStatus] = useState({ state: 'loading', message: '' });

  // --- Fetch Categories ---
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/folders/${FEATURE_FOLDER}`);
        const subfolders = response.data?.subfolders || [];
        if (Array.isArray(subfolders)) {
          setCategories(["All", ...subfolders]);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
        // Still provide "All" as a fallback option
        setCategories(["All"]); 
      }
    };
    fetchCategories();
  }, []);

  // --- Fetch Images based on Active Category ---
  useEffect(() => {
    const fetchImages = async () => {
      setStatus({ state: 'loading', message: '' });
      setCurrentIndex(0);
      setPhotos([]);

      try {
        let fetchedImages = [];

        if (activeCategory === "All") {
          // Fetch categories again to ensure we have the list of subfolders
          const catResponse = await axios.get(`${API_BASE_URL}/api/folders/${FEATURE_FOLDER}`);
          const subfolders = catResponse.data?.subfolders || [];

          if (subfolders.length === 0) {
            throw new Error("No categories found to fetch images from.");
          }

          const imagePromises = subfolders.map(folder => {
            const path = `${FEATURE_FOLDER}_${encodeURIComponent(folder)}`;
            return axios.get(`${API_BASE_URL}/api/images/${path}`).then(res => 
              // Add category metadata to each photo object
              (res.data || []).map(photo => ({ ...photo, category: folder }))
            );
          });

          const results = await Promise.all(imagePromises);
          fetchedImages = results.flat();

        } else {
          const path = `${FEATURE_FOLDER}_${encodeURIComponent(activeCategory)}`;
          const response = await axios.get(`${API_BASE_URL}/api/images/${path}`);
          fetchedImages = (response.data || []).map(photo => ({ ...photo, category: activeCategory }));
        }

        if (fetchedImages.length > 0) {
          setPhotos(fetchedImages);
          setStatus({ state: 'success', message: '' });
        } else {
          setStatus({ state: 'error', message: `No images found in "${activeCategory}".` });
        }
      } catch (error) {
        console.error("Error fetching images:", error);
        setStatus({ state: 'error', message: `Failed to load images. Please try again later.` });
      }
    };

    fetchImages();
  }, [activeCategory]);
  
  // --- Carousel Navigation ---
  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % photos.length);
  }, [photos.length]);

  const goToPrev = () => {
    setCurrentIndex(prev => (prev - 1 + photos.length) % photos.length);
  };

  const { pause, resume } = useAutoplay(goToNext, photos.length > 1 ? AUTOPLAY_INTERVAL : null);

  const currentPhoto = photos[currentIndex];

  return (
    <section className="featured-photos-container">
      <div className="featured-photos-content">
        <h2>Featured Photos</h2>

        <div className="categories">
          {categories.map(category => (
            <button
              key={category}
              className={`category-btn ${activeCategory === category ? "active" : ""}`}
              onClick={() => setActiveCategory(category)}
              disabled={status.state === 'loading'}
            >
              {category}
            </button>
          ))}
        </div>

        <div 
          className="carousel-container"
          onMouseEnter={pause}
          onMouseLeave={resume}
        >
          <div className="carousel-body">
            {status.state === 'loading' && (
              <div className="status-overlay">
                <FaSpinner className="spinner-icon" />
              </div>
            )}

            {status.state === 'error' && (
              <div className="status-overlay">
                <p className="error-text">{status.message}</p>
              </div>
            )}

            {status.state === 'success' && photos.length > 0 && (
              <>
                {/* The key prop is crucial: it forces React to re-mount the component on change, which re-triggers the CSS animation */}
                <div className="photo-display" key={currentPhoto?.url || currentIndex}>
                  <img
                    src={currentPhoto.url}
                    alt={currentPhoto.name || `Featured Photo ${currentIndex + 1}`}
                    onError={(e) => { e.target.style.display = 'none'; }} // Hide broken images
                  />
                  <div className="photo-info">
                    <p className="photo-name">{currentPhoto.name}</p>
                    {currentPhoto.category && <p className="photo-category">{currentPhoto.category}</p>}
                  </div>
                </div>

                {photos.length > 1 && (
                  <>
                    <button className="carousel-btn prev" onClick={goToPrev} aria-label="Previous Photo">
                      <FaChevronLeft />
                    </button>
                    <button className="carousel-btn next" onClick={goToNext} aria-label="Next Photo">
                      <FaChevronRight />
                    </button>
                    <div className="carousel-dots">
                      {photos.map((_, index) => (
                        <button
                          key={index}
                          className={`dot ${index === currentIndex ? 'active' : ''}`}
                          onClick={() => setCurrentIndex(index)}
                          aria-label={`Go to photo ${index + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Featuredphotos;