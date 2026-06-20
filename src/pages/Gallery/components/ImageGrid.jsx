import React from 'react';
import { FaCheckSquare, FaSquare, FaTrashAlt } from 'react-icons/fa';
import { FALLBACK_IMG } from '../config';

const ImageGrid = ({ images, selectMode, selectedIds, onImageClick, onImageDelete, isAdmin }) => {
  return (
    <div className="image-grid">
      {images.map((image) => (
        <div
          key={image.id}
          className={`image-item ${selectMode ? 'select-mode' : ''}`}
          onClick={() => onImageClick(image)}
          tabIndex={0}
        >
          {(() => {
            const ext = (image.name || '').split('.').pop().toLowerCase();
            const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
            if (isVideo) {
              return (
                <div className="video-thumbnail-wrapper" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <video
                    src={image.url}
                    preload="metadata"
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div className="video-play-indicator" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', fontSize: '28px', opacity: 0.85, textShadow: '0 2px 8px rgba(0,0,0,0.5)', pointerEvents: 'none' }}>
                    ▶
                  </div>
                </div>
              );
            }
            return (
              <img
                src={image.thumbnail}
                alt={image.name}
                loading="lazy"
                onError={e => e.currentTarget.src = FALLBACK_IMG}
              />
            );
          })()}
          {selectMode ? (
            <div className="image-select-checkbox">{selectedIds.has(image.id) ? <FaCheckSquare /> : <FaSquare />}</div>
          ) : (
            isAdmin && (
              <button
                className="image-delete-btn"
                onClick={e => {
                  e.stopPropagation();
                  onImageDelete(image);
                }}
              >
                <FaTrashAlt />
              </button>
            )
          )}
        </div>
      ))}
    </div>
  );
};

export default ImageGrid;