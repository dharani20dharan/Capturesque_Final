import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'; // Import icons for buttons
import "./Featuredphotos.css";

const API_BASE_URL = "http://150.230.138.173:8087";
const FEATURE_FOLDER = "Feature";

const Featuredphotos = () => {
  const [categories, setCategories] = useState(["All"]);
  const [photos, setPhotos] = useState([]); // Main store if needed, currently unused based on logic
  const [filteredPhotos, setFilteredPhotos] = useState([]); // This holds the photos to display
  const [activeCategory, setActiveCategory] = useState("All");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animate, setAnimate] = useState(false); // Tracks animation state
  const [error, setError] = useState(null);

  // Fetch subfolders inside "Feature" folder
  useEffect(() => {
    const fetchCategories = async () => {
      // Reset error at the beginning
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/folders/${FEATURE_FOLDER}`);
        console.log("Fetched categories:", response.data);

        if (response.data && response.data.subfolders && Array.isArray(response.data.subfolders)) {
          setCategories(["All", ...response.data.subfolders]);
        } else {
          // Keep "All" even if no subfolders found? Or set error?
          // Assuming we show error if subfolders array is missing/not an array
          setCategories(["All"]); // Keep 'All' as a minimum option
          setError("No specific categories found, showing all."); // Info message instead of hard error
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
        setCategories(["All"]); // Fallback to 'All'
        setError("Failed to load categories. Please check your server.");
      }
    };

    fetchCategories();
  }, []);

  // Fetch images from selected folder or all folders
    // Fetch images from selected folder or all folders
    useEffect(() => {
      const fetchImages = async () => {
        setFilteredPhotos([]);
        setError(null);
        setCurrentIndex(0);
    
        if (activeCategory === "All") {
          try {
            const catResponse = await axios.get(`${API_BASE_URL}/api/folders/${FEATURE_FOLDER}`);
            const subfolders = catResponse.data?.subfolders || [];
    
            if (!Array.isArray(subfolders) || subfolders.length === 0) {
              setError("No categories found to fetch images from.");
              return;
            }
    
            const imageFetchPromises = subfolders.map((folder) => {
              const categoryPath = `${FEATURE_FOLDER}_${encodeURIComponent(folder)}`;
              return axios.get(`${API_BASE_URL}/api/images/${categoryPath}`);
            });
    
            const results = await Promise.allSettled(imageFetchPromises);
    
            const allImages = results
              .filter(result => result.status === "fulfilled" && Array.isArray(result.value.data))
              .flatMap(result => result.value.data);
    
            if (allImages.length > 0) {
              setFilteredPhotos(allImages);
            } else {
              setError("No images found across all categories.");
            }
          } catch (error) {
            console.error("Error fetching all category images:", error);
            setError(`Failed to load images (${error.message || 'Server Error'}).`);
          }
        } else {
          try {
            const categoryPath = `${FEATURE_FOLDER}_${encodeURIComponent(activeCategory)}`;
            const response = await axios.get(`${API_BASE_URL}/api/images/${categoryPath}`);
    
            if (response.data && Array.isArray(response.data) && response.data.length > 0) {
              setFilteredPhotos(response.data);
            } else {
              setError(`No images found in the "${activeCategory}" category.`);
            }
          } catch (error) {
            console.error(`Error fetching images for ${activeCategory}:`, error);
            setError(`Failed to load images (${error.message || 'Server Error'}).`);
          }
        }
      };
    
      fetchImages();
    }, [activeCategory]);
    
        

  // Auto-slide every 3 seconds (Adjusted interval)
  useEffect(() => {
    if (filteredPhotos.length > 1) {
      const timer = setInterval(() => {
        nextPhoto();
      }, 4000); // Changed interval to 4 seconds
      return () => clearInterval(timer);
    }
  }, [filteredPhotos, currentIndex]); // Rerun if photos or index change

  // Next and previous photo functions using 'animate' state
  const nextPhoto = () => {
    if (filteredPhotos.length <= 1 || animate) return; // Prevent action during animation or if only one photo
    setAnimate(true); // Trigger fade-out/slide-out
    setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % filteredPhotos.length);
      // Set animate back to false slightly after index changes, allowing fade-in class to apply
      setTimeout(() => setAnimate(false), 50); // Short delay before allowing fade-in
    }, 500); // Duration should match CSS transition time for fade-out
  };

  const prevPhoto = () => {
    if (filteredPhotos.length <= 1 || animate) return;
    setAnimate(true);
    setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex - 1 + filteredPhotos.length) % filteredPhotos.length);
       setTimeout(() => setAnimate(false), 50);
    }, 500);
  };

  // Determine the CSS class for animation based on 'animate' state
  const photoClassName = `photo ${animate ? 'fade-out' : 'fade-in'}`;
  const currentPhotoData = filteredPhotos[currentIndex]; // Get current photo data

  return (
    <section className="featured-photos">
      {/* Overlay and Background handled by CSS */}
      <div className="featured-photos-overlay"></div>
      <div className="featured-photos-content">
        <h2>Featured Photos</h2>

        {/* Categories Section */}
        <div className="categories">
          {/* Optional: Add loading state for categories if fetch takes time */}
          {categories.length > 0 ? (
             categories.map((category) => (
              <button
                key={category}
                className={`category-btn ${activeCategory === category ? "active" : ""}`}
                onClick={() => setActiveCategory(category)}
                // Optional: disable while images are loading? Add isLoadingImages state if needed
                // disabled={isLoadingImages}
              >
                {category}
              </button>
            ))
          ) : (
             // Show message if categories array is empty (excluding 'All')
             <p className="info-text">No categories defined yet.</p>
          )}
          {/* Display category fetch error */}
          {error && categories.length <= 1 && <p className="error-text">{error}</p>}
        </div>

        {/* Carousel Section */}
        <div className="carousel-container">
          {/* Conditionally render carousel or error/info message */}
          {filteredPhotos.length > 0 ? (
            <div className="carousel">
              <button
                className="carousel-btn prev"
                onClick={prevPhoto}
                aria-label="Previous Photo"
                disabled={animate || filteredPhotos.length <= 1}
              >
                <FaChevronLeft />
              </button>

              <div className="photo-wrapper">
                {/* Display current photo */}
                {currentPhotoData && (
                  <div className={photoClassName} key={currentIndex}>
                    <img
                      src={currentPhotoData.url}
                      alt={currentPhotoData.name || `Featured Photo ${currentIndex + 1}`}
                      onError={(e) => e.target.src = '/images/placeholder.png'} // Fallback image
                    />
                    {/* Display category name if available */}
                    {currentPhotoData.category && currentPhotoData.category !== "All" && (
                       <p className="photo-category">{currentPhotoData.category}</p>
                    )}
                  </div>
                )}
              </div>

              <button
                className="carousel-btn next"
                onClick={nextPhoto}
                aria-label="Next Photo"
                disabled={animate || filteredPhotos.length <= 1}
              >
                <FaChevronRight />
              </button>

              {/* Optional: Dots for navigation */}
               <div className="carousel-dots">
                 {filteredPhotos.map((_, index) => (
                   <button
                     key={index}
                     className={`dot ${index === currentIndex ? 'active' : ''}`}
                     onClick={() => {
                        // Direct navigation via dots
                        if (!animate && index !== currentIndex) {
                           setAnimate(true);
                           setTimeout(() => {
                               setCurrentIndex(index);
                               setTimeout(() => setAnimate(false), 50);
                           }, 500);
                        }
                     }}
                     aria-label={`Go to photo ${index + 1}`}
                   />
                 ))}
               </div>

            </div>
          ) : (
            // Show error message if fetching images failed or no images found
            <div className="carousel-message error">
              {error || `No photos available${activeCategory !== 'All' ? ` in the "${activeCategory}" category` : ''}.`}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Featuredphotos;