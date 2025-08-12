import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import axios from 'axios';
import { FaFolder, FaArrowLeft, FaDownload, FaTimes, FaSpinner, FaExclamationTriangle } from 'react-icons/fa'; // Added more icons
import './Gallery.css';

const API_BASE_URL = "http://150.230.138.173:8087";

// Assuming folderData is static or fetched elsewhere if needed
// If dynamic, you'd fetch this similar to how categories were fetched before
const folderData = [
  { folderName: 'Basketball', folderId: 'Basketball' },
  { folderName: 'Campus', folderId: 'Campus' },
  { folderName: 'Enchante', folderId: 'Enchante' },
  { folderName: 'Flashmob', folderId: 'Flashmob' },
  { folderName: 'Football', folderId: 'Football' },
  { folderName: 'Handila', folderId: 'Handila' },
];

const Gallery = () => {
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [images, setImages] = useState([]); // Holds images for the selected folder
  // Removed 'photos' and 'filteredPhotos' state as 'images' seems to hold the display data
  const [selectedImage, setSelectedImage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));

  // Check login status on mount and storage changes
  useEffect(() => {
    const checkLoginStatus = () => {
      setIsLoggedIn(!!localStorage.getItem("token"));
    };
    checkLoginStatus(); // Initial check
    window.addEventListener("storage", checkLoginStatus);
    window.addEventListener("authChange", checkLoginStatus); // Listen for custom auth events
    return () => {
      window.removeEventListener("storage", checkLoginStatus);
      window.removeEventListener("authChange", checkLoginStatus);
    }
  }, []);

  // Fetch images function using useCallback
  const fetchImages = useCallback(async (folderId) => {
    // *** Assuming API path requires FolderName, not just FolderId if they differ ***
    // If folderId is like "Feature/Basketball", use it directly.
    // If folderId is just "Basketball" and API needs "Feature/Basketball", adjust here:
    const apiPath = folderId; // Or construct as needed: `Feature/${folderId}`
    // const apiPath = `Feature/${folderId}`; // Example if prefix needed

    setLoading(true);
    setError(null);
    setImages([]); // Clear previous images
    try {
      const response = await axios.get(`${API_BASE_URL}/api/images/${apiPath}`);
      console.log(`Fetched images for ${apiPath}:`, response.data);

      // ***** Check actual API response structure *****
      // Option 1: Response.data is the array
      if (response.data && Array.isArray(response.data)) {
          setImages(response.data);
          if (response.data.length === 0) {
              setError('No images found in this folder.');
          }
      // Option 2: Array is nested, e.g., response.data.images
      } else if (response.data?.success && Array.isArray(response.data.images)) {
         setImages(response.data.images);
          if (response.data.images.length === 0) {
              setError('No images found in this folder.');
          }
      } else {
          // Handle unexpected structure
          console.error("Unexpected API response structure:", response.data);
          setError('Received invalid data format for images.');
      }
    } catch (err) {
      console.error("Failed to load images:", err);
      setError(`Failed to load images (${err.message || 'Server error'}).`);
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies needed if API_BASE_URL is constant

  const openFolder = (folder) => {
    setSelectedFolder(folder);
    fetchImages(folder.folderId); // Use folderId to fetch
  };

  const closeFolder = () => {
    setSelectedFolder(null);
    setImages([]); // Clear images when going back
    setError(null); // Clear error
  }

  const openModal = (image) => {
    // Find the full image data if needed, assuming 'image' has enough info (like URL)
    // If you only have thumbnails in the grid, you might need to fetch full image details here
    setSelectedImage(image);
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  };

  const closeModal = () => {
    setSelectedImage(null);
    setIsModalOpen(false);
    document.body.style.overflow = ''; // Restore background scrolling
  };

  // Download function (make sure image object has 'name' property)
  const downloadImage = async (image) => {
    if (!isLoggedIn) {
      alert("Please log in to download images.");
      // Consider redirecting to login: navigate('/login');
      return;
    }

    if (!selectedFolder || !selectedFolder.folderId) {
        console.error("Error: Folder context is missing for download.");
        alert("Error: Cannot determine folder for download.");
        return;
    }

    // *** Verify the property name for the filename in your image object ***
    const filename = image.name || image.filename || image.title; // Adjust as needed

    if (!filename) {
      console.error("Error: Image filename is missing!", image);
      alert("Error: Cannot download image, filename is missing.");
      return;
    }

    // *** Construct download URL based on API endpoint ***
    // Option 1: /api/download/FolderName/FileName
    const downloadPath = `${selectedFolder.folderId}/${encodeURIComponent(filename)}`;
    // Option 2: /api/download/FileName?folder=FolderName (example)
    // const downloadPath = `${encodeURIComponent(filename)}?folder=${encodeURIComponent(selectedFolder.folderId)}`

    const downloadUrl = `${API_BASE_URL}/api/download/${downloadPath}`;

    console.log("Attempting download from:", downloadUrl);

    try {
      // Add Authorization header
      const token = localStorage.getItem("token");
      if (!token) {
          alert("Authentication token not found. Please log in again.");
          return;
      }

      const response = await axios.get(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob", // Crucial for file download
      });

      // Create a link and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      // Determine filename (prefer Content-Disposition, fallback to original filename)
      const contentDisposition = response.headers['content-disposition'];
      let downloadFilename = filename; // Default
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d'')?([^'";]+)['"]?/);
        if (filenameMatch && filenameMatch[1]) {
          downloadFilename = decodeURIComponent(filenameMatch[1]);
        }
      }

      link.setAttribute("download", downloadFilename);
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      console.log("Download initiated for:", downloadFilename);

    } catch (err) {
      console.error("Download error:", err);
      // Handle specific errors (e.g., 401 Unauthorized, 404 Not Found)
       if (err.response?.status === 401) {
           alert("Download failed: Unauthorized. Please log in again.");
       } else if (err.response?.status === 404) {
            alert("Download failed: Image not found on server.");
       } else {
           alert(`Download failed: ${err.message || 'Please try again.'}`);
       }
    }
  };

  return (
    // Changed class name to gallery-page for clarity
    <div className="gallery-page">
      <div className="gallery-container">
        {!selectedFolder ? (
          <>
            <h2 className="gallery-title">Event Folders</h2>
            {/* Folder Grid */}
            <div className="folders">
              {folderData.map((folder) => (
                <div key={folder.folderId} className="folder-card" onClick={() => openFolder(folder)} role="button" tabIndex="0">
                  <div className="folder-icon-wrapper">
                    <FaFolder className="folder-icon" />
                  </div>
                  <h3 className="folder-name">{folder.folderName}</h3>
                </div>
              ))}
            </div>
          </>
        ) : (
           // Image Grid View
          <>
            <div className="gallery-header">
              <button className="back-btn" onClick={closeFolder}>
                <FaArrowLeft /> Back to Folders
              </button>
              <h2 className="gallery-title">{selectedFolder.folderName}</h2>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="gallery-message loading">
                <FaSpinner className="spinner-icon" /> Loading Images...
              </div>
            )}

            {/* Error State */}
            {!loading && error && (
              <div className="gallery-message error">
                <FaExclamationTriangle /> {error}
              </div>
            )}

            {/* Image Grid */}
            {!loading && !error && images.length > 0 && (
              <div className="image-grid">
                {images.map((image, index) => (
                  // *** Ensure image object has a unique 'id' or use index carefully ***
                  // If 'id' is not present, use another unique field or index as key
                  <div
                    key={image.id || image.name || index} // Prioritize unique ID
                    className="image-item"
                    onClick={() => openModal(image)}
                    role="button" tabIndex="0"
                  >
                    {/* *** Use correct property for image URL (e.g., url, path, thumbnail) *** */}
                    <img
                        src={image.url || image.thumbnail} // Adjust property name based on your API data
                        alt={image.title || image.name || `Image ${index + 1}`} // Adjust property name
                        loading="lazy" // Lazy load images
                        onError={(e) => e.target.src = '/images/placeholder.png'} // Fallback
                     />
                     <div className="image-overlay">
                         {/* Optional: Show title or icon on hover */}
                     </div>
                  </div>
                ))}
              </div>
            )}

             {/* No Images Message (when not loading and no error) */}
             {!loading && !error && images.length === 0 && (
                <div className="gallery-message info">
                    No images are currently available in this folder.
                </div>
             )}
          </>
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
               src={selectedImage.url || selectedImage.thumbnail} // Preferably use a full URL if 'thumbnail' is small
               alt={selectedImage.title || selectedImage.name || 'Selected Image'}
               className="modal-image"
            />
            <div className="modal-actions">
                {/* Display image title or name */}
                {/* <p className="image-title">{selectedImage.title || selectedImage.name}</p> */}
                {isLoggedIn && (
                <button className="modal-download-btn" onClick={() => downloadImage(selectedImage)}>
                    <FaDownload /> Download
                </button>
                )}
                {!isLoggedIn && (
                    <p className="login-prompt">Please log in to download.</p>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;