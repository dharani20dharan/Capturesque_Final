import React, { useEffect } from 'react';
import { FaTimes, FaDownload, FaLink, FaPen, FaTrashAlt } from 'react-icons/fa';
import { FALLBACK_IMG } from '../../config';

const ImageModal = ({
  open,
  image,
  onClose,
  onDownload,
  onCopyLink,
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
        <button className="modal-close-btn" onClick={onClose} aria-label="Close"><FaTimes /></button>
        <img className="modal-image" src={image.url} alt={image.name} onError={e => e.currentTarget.src = FALLBACK_IMG} />
        <div className="modal-actions">
          {isLoggedIn && <button className="modal-download-btn" onClick={() => onDownload(image)}><FaDownload /> Download</button>}
          <button className="btn small" onClick={() => onCopyLink(image)} title="Copy link"><FaLink /></button>
          {isAdmin && <button className="btn small" onClick={() => onRename(image)} title="Rename"><FaPen /></button>}
          <div style={{ flex: 1 }}></div>
          {isAdmin && <button className="btn danger small" onClick={() => onDelete(image)}><FaTrashAlt /> Delete</button>}
        </div>
      </div>
    </div>
  );
};

export default ImageModal;