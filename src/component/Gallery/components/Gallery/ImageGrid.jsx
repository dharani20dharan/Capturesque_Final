import React from 'react';
import { FaCheckSquare, FaSquare, FaTrashAlt } from 'react-icons/fa';
import { FALLBACK_IMG } from '../../config';

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
          <img
            src={image.thumbnail}
            alt={image.name}
            loading="lazy"
            onError={e => e.currentTarget.src = FALLBACK_IMG}
          />
          <div className="image-overlay" />
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