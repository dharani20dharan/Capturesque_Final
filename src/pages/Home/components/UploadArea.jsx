// src/components/UploadArea.js

/**
 * This component provides an area for users to upload files.
 * It supports both selecting files via a button and drag-and-drop functionality.
 * It displays previews of selected images and a progress bar during upload.
 */
import React, { useState } from 'react';
import { FaUpload, FaPlus } from 'react-icons/fa';
import { FALLBACK_IMG } from './config';

export function UploadArea({
  fileInputRef,
  onFileInputChange,
  filePreviews,
  selectedFiles,
  onSelectFiles,
  onUpload,
  onCreateSubfolder,
  selectedFolder,
  isUploading,
  uploadProgress,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer?.files?.length) onFileInputChange({ target: { files: e.dataTransfer.files } });
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        marginTop: 18,
        padding: 14,
        borderRadius: 8,
        border: isDragOver ? '2px dashed var(--accent-primary)' : '1px dashed rgba(255,255,255,0.06)',
        background: isDragOver ? 'rgba(255,255,255,0.02)' : 'transparent',
      }}
    >
      <input
        ref={fileInputRef}
        id="gallery-file-input"
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFileInputChange}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn upload-btn" onClick={onSelectFiles}>
            <FaUpload /> {selectedFiles.length ? `${selectedFiles.length} selected` : 'Select files'}
          </button>
          <button className="btn upload-action-btn" onClick={onUpload}>
            <FaUpload /> Upload
          </button>
          <button className="btn create-subfolder-btn" onClick={onCreateSubfolder}>
            <FaPlus /> New subfolder
          </button>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Drag &amp; drop images to upload to <strong>{selectedFolder?.folderName}</strong>
        </div>
      </div>

      {filePreviews.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          {filePreviews.map((p, idx) => (
            <div key={`${p.name}-${idx}`} style={{ width: 90, textAlign: 'center', color: 'var(--text-secondary)' }}>
              <img
                src={p.url}
                alt={p.name}
                style={{ width: 90, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMG;
                }}
              />
              <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
            </div>
          ))}
        </div>
      )}

      {isUploading && uploadProgress.overall !== undefined && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Uploading — {uploadProgress.overall}%</div>
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', height: 8, borderRadius: 6, marginTop: 6 }}>
            <div
              style={{
                width: `${uploadProgress.overall}%`,
                height: 8,
                borderRadius: 6,
                background: 'var(--accent-primary)',
                transition: 'width .2s ease',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}