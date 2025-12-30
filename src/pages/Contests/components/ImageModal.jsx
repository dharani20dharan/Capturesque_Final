import React, { useEffect } from 'react';
import { FaTimes, FaDownload, FaPen, FaTrashAlt } from 'react-icons/fa';
import { FALLBACK_IMG } from '../config';

const ImageModal = ({
  open,
  image,
  onClose,
  onDownload,
  onRename,
  onDelete,
  isLoggedIn,
  isAdmin,
}) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!open || !image) return null;

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

        {/* Image */}
        <div className="modal-image-container">
          <img className="modal-image" src={image.url} alt={image.name} onError={e => e.currentTarget.src = FALLBACK_IMG} />
        </div>

        {/* Floating Actions Bar */}
        <div className="modal-actions-bar">
          {isLoggedIn && (
            <button className="modal-btn-download" onClick={() => onDownload(image)}>
              <FaDownload /> Download
            </button>
          )}

          {isAdmin && (
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