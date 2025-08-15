import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
// Import necessary icons
import { FaArrowLeft, FaTimes, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import "./contests.css"; // Ensure CSS file name matches

const API_BASE_URL = "http://150.230.138.173:8087";

// Static folder data as provided
const folderData = [
  { folderName: "Blinding Lights", folderId: "BlindingLights" },
  { folderName: "Creatures", folderId: "Creatures" },
  { folderName: "Dusk", folderId: "Dusk" },
];

const Contests = () => {
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch images logic (unchanged from your working version)
  const fetchImages = useCallback(async (folderId) => {
    setLoading(true);
    setError(null);
    setImages([]); // Clear previous images
    try {
      // *** Ensure API path is correct based on your backend ***
      // Example: Using folderId directly if it includes any necessary prefix
       const apiPath = folderId;
      // Or if you need to add a prefix like 'Contests/':
      // const apiPath = `Contests/${folderId}`; // Adjust if needed

      const response = await axios.get(`${API_BASE_URL}/api/images/${apiPath}`);
      console.log(`Fetched images for ${apiPath}:`, response.data);

      // Check response structure - Adapt if needed!
      if (response.data && Array.isArray(response.data)) {
         setImages(response.data);
         if(response.data.length === 0) {
             setError("No images found in this contest folder.");
         }
      } else if (response.data?.success && Array.isArray(response.data.images)) {
          // Handle nested structure if applicable
          setImages(response.data.images);
          if(response.data.images.length === 0) {
             setError("No images found in this contest folder.");
         }
      } else {
        console.error("Unexpected API response structure:", response.data);
        setError("Received invalid data format for images.");
      }
    } catch (err) {
      console.error("Failed to load images:", err);
      setError(`Failed to load images (${err.message || 'Server error'}).`);
    } finally {
      setLoading(false);
    }
  }, []); // Keep dependencies empty if API_BASE_URL is constant

  // Folder/Modal interaction logic (unchanged)
  const openFolder = (folder) => {
    setSelectedFolder(folder);
    fetchImages(folder.folderId);
  };

   const closeFolder = () => {
    setSelectedFolder(null);
    setImages([]); // Clear images when going back
    setError(null); // Clear error
  }

  const openModal = (image) => {
    setSelectedImage(image);
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  };

  const closeModal = () => {
    setSelectedImage(null);
    setIsModalOpen(false);
     document.body.style.overflow = ''; // Restore background scrolling
  };

  return (
    // Changed class name for clarity
    <div className="contests-page">
      <div className="contests-container">
        {!selectedFolder ? (
          // Folder Selection View
          <>
            <h1 className="contest-page-title">Theme Contests</h1>
            <div className="folders">
              {folderData.map((folder) => (
                <div
                  key={folder.folderId}
                  className="folder-card"
                  onClick={() => openFolder(folder)}
                  role="button"
                  tabIndex="0"
                >
                  {/* Changed h2 to h3 for semantics */}
                  <h3 className="folder-name">{folder.folderName}</h3>
                  {/* Optional: Add subtle background or decorative element */}
                  <div className="folder-card-bg-element"></div>
                </div>
              ))}
            </div>
          </>
        ) : (
          // Image Grid View for Selected Folder
          <div className="image-section">
             <div className="image-section-header">
                <button className="back-btn" onClick={closeFolder}>
                   <FaArrowLeft /> Back to Contests
                </button>
                {/* Display selected folder name as title */}
                <h2 className="contest-title">{selectedFolder.folderName}</h2>
             </div>

            {/* Loading State */}
            {loading && (
              <div className="contest-message loading">
                <FaSpinner className="spinner-icon" /> Loading Images...
              </div>
            )}

            {/* Error State */}
            {!loading && error && (
              <div className="contest-message error">
                <FaExclamationTriangle /> {error}
              </div>
            )}

            {/* Image Grid */}
            {!loading && !error && images.length > 0 && (
              <div className="image-grid">
                {images.map((photo, index) => (
                  <div
                    // Use a unique identifier if available (photo.id, photo.name), fallback to index
                    key={photo.id || photo.name || index}
                    className="image-item"
                    onClick={() => openModal(photo)}
                    role="button" tabIndex="0"
                  >
                     {/* *** Use correct property for image URL *** */}
                    <img
                       src={photo.url || photo.thumbnail} // Adjust based on API
                       alt={photo.title || photo.name || `Contest Image ${index + 1}`} // Adjust based on API
                       loading="lazy"
                       onError={(e) => e.target.src = '/images/placeholder.png'} // Fallback
                    />
                     <div className="image-overlay">
                         {/* Can add view icon here if desired */}
                     </div>
                  </div>
                ))}
              </div>
            )}

            {/* No Images Message */}
             {!loading && !error && images.length === 0 && (
                <div className="contest-message info">
                    No submissions found for this contest theme yet.
                </div>
             )}

          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && selectedImage && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeModal} aria-label="Close image view">
                <FaTimes />
            </button>
            {/* *** Use correct property for FULL image URL *** */}
            <img
                src={selectedImage.url || selectedImage.thumbnail} // Use full URL if available
                alt={selectedImage.title || selectedImage.name || "Contest Image"}
                className="modal-image"
            />
            {/* No download button as per original component */}
          </div>
        </div>
      )}
    </div>
  );
};

export default Contests;