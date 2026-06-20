import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaTimes, FaDownload, FaPen, FaTrashAlt, FaCog } from 'react-icons/fa';
import { FALLBACK_IMG, API_BASE_URL } from '../config';

const ImageModal = ({
  open,
  image,
  selectedFolder,
  onClose,
  onDownload,
  onRename,
  onDelete,
  isLoggedIn,
  isAdmin,
  isPhotographer,
}) => {
  const [showPlacementMenu, setShowPlacementMenu] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!open || !image) return null;

  const isVideo = (name) => {
    const ext = (name || '').split('.').pop().toLowerCase();
    return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
  };

  const handleAssignMedia = async (action, category = '') => {
    setAssigning(true);
    try {
      let filepath = image.name;
      if (selectedFolder && selectedFolder.folderId) {
        filepath = `${selectedFolder.folderId}/${image.name}`;
      }

      const res = await axios.post(`${API_BASE_URL}/api/admin/assign-media`, {
        filepath: filepath,
        action: action,
        category: category
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      alert(res.data?.message || "Operation successful!");
      setShowPlacementMenu(false);
    } catch (err) {
      console.error(err);
      alert("Failed to assign media: " + (err.response?.data?.error || err.message));
    } finally {
      setAssigning(false);
    }
  };

  const handleFeatureClick = () => {
    const cat = prompt("Enter a category name to feature this photo (e.g. Nature, Portraits, Sports):");
    if (!cat || !cat.trim()) return;
    handleAssignMedia("set_featured", cat.trim());
  };

  const handleRemoveFeatureClick = () => {
    const cat = prompt("Enter the category name to remove this photo from:");
    if (!cat || !cat.trim()) return;
    handleAssignMedia("remove_featured", cat.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>

        {/* Header Name */}
        <div style={{ position: 'absolute', top: 30, left: 40, right: 100, pointerEvents: 'none', zIndex: 20 }}>
          <h3 style={{ margin: 0, color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '1.5rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
            {image.name}
          </h3>
        </div>

        {/* Close Button */}
        <button className="modal-close-btn" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 30, right: 30, zIndex: 30 }}>
          <FaTimes />
        </button>

        {/* Media */}
        <div className="modal-image-container">
          {isVideo(image.name) ? (
            <video
              className="modal-image"
              src={image.url}
              controls
              autoPlay
              style={{ maxHeight: '80vh', maxWidth: '100%', objectFit: 'contain', outline: 'none' }}
            />
          ) : (
            <img
              className="modal-image"
              src={image.url}
              alt={image.name}
              onError={e => e.currentTarget.src = FALLBACK_IMG}
            />
          )}
        </div>

        {/* Floating Actions Bar */}
        <div className="modal-actions-bar" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isLoggedIn && (
            <button className="modal-btn-download" onClick={() => onDownload(image)}>
              <FaDownload /> Download
            </button>
          )}

          {isAdmin && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button 
                className="modal-btn-download" 
                onClick={() => setShowPlacementMenu(!showPlacementMenu)}
                style={{ background: '#f59e0b', color: '#000', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                disabled={assigning}
              >
                <FaCog /> {assigning ? 'Managing...' : '⚡ Manage Placement'}
              </button>
              {showPlacementMenu && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  right: 0,
                  marginBottom: 10,
                  background: '#1a1a24',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 200,
                  width: 220,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '6px 0',
                }}>
                  <button 
                    onClick={() => handleAssignMedia("set_hero")}
                    style={{ background: 'none', border: 'none', color: '#fff', padding: '10px 14px', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    🌅 Set as Hero Background
                  </button>
                  <button 
                    onClick={handleFeatureClick}
                    style={{ background: 'none', border: 'none', color: '#fff', padding: '10px 14px', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    ⭐ Feature on Homepage
                  </button>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                  <button 
                    onClick={() => handleAssignMedia("remove_hero")}
                    style={{ background: 'none', border: 'none', color: '#ff6b6b', padding: '10px 14px', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    🚫 Remove from Hero
                  </button>
                  <button 
                    onClick={handleRemoveFeatureClick}
                    style={{ background: 'none', border: 'none', color: '#ff6b6b', padding: '10px 14px', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    🚫 Remove from Featured
                  </button>
                </div>
              )}
            </div>
          )}

          {isPhotographer && (
            <>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }}></div>

              <button className="modal-btn-icon" onClick={() => onRename(image)} title="Rename Image">
                <FaPen size={16} />
              </button>

              <button className="modal-btn-icon danger" onClick={() => onDelete(image)} title="Delete Image">
                <FaTrashAlt size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageModal;