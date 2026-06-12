import React from 'react';
import { FaCheckSquare, FaSquare, FaTrashAlt, FaDownload, FaLink } from 'react-icons/fa';
import { FALLBACK_IMG } from '../config';

const ListView = ({
  images,
  selectMode,
  selectedIds,
  onImageClick,
  onImageDelete,
  onImageDownload,
  onImageCopyLink,
  isAdmin,
  isLoggedIn,
}) => {
  return (
    <div className="list-view-container" style={{ width: '100%', overflowX: 'auto', marginTop: 12 }}>
      <table className="list-view-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>
            {selectMode && <th style={{ padding: '8px 12px', width: 40 }}>Select</th>}
            <th style={{ padding: '8px 12px', width: 60 }}>Preview</th>
            <th style={{ padding: '8px 12px' }}>Name</th>
            <th style={{ padding: '8px 12px', width: 80 }}>Type</th>
            <th style={{ padding: '8px 12px', width: 150, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {images.map((image) => {
            const ext = (image.name || '').split('.').pop().toUpperCase();
            const isSelected = selectedIds.has(image.id);
            return (
              <tr
                key={image.id}
                className={`list-view-row ${isSelected ? 'selected' : ''}`}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                onClick={() => onImageClick(image)}
              >
                {selectMode && (
                  <td style={{ padding: '12px' }} onClick={(e) => { e.stopPropagation(); onImageClick(image); }}>
                    {isSelected ? <FaCheckSquare color="#007bff" /> : <FaSquare opacity={0.5} />}
                  </td>
                )}
                <td style={{ padding: '8px 12px' }}>
                  <img
                    src={image.thumbnail}
                    alt={image.name}
                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                    onError={e => e.currentTarget.src = FALLBACK_IMG}
                  />
                </td>
                <td style={{ padding: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {image.name}
                </td>
                <td style={{ padding: '12px', opacity: 0.7, fontSize: '0.9rem' }}>
                  {ext}
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'inline-flex', gap: 8 }}>
                    <button
                      className="btn small"
                      title="Copy Link"
                      onClick={() => onImageCopyLink(image)}
                      style={{ padding: '6px 10px' }}
                    >
                      <FaLink size={12} />
                    </button>
                    {isLoggedIn && (
                      <button
                        className="btn small"
                        title="Download"
                        onClick={() => onImageDownload(image)}
                        style={{ padding: '6px 10px' }}
                      >
                        <FaDownload size={12} />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        className="btn small danger"
                        title="Delete"
                        onClick={() => onImageDelete(image)}
                        style={{ padding: '6px 10px' }}
                      >
                        <FaTrashAlt size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ListView;
