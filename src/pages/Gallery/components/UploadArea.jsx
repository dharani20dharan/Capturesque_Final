import React, { useState } from 'react';
import { FaUpload, FaPlus, FaImage, FaCloudUploadAlt } from 'react-icons/fa';

function UploadArea({ fileInputRef, onFileInputChange, filePreviews, selectedFiles, onSelectFiles, onUpload, onCreateSubfolder, selectedFolder, isUploading, uploadProgress, onFilesDrop }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    if (onFilesDrop && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      // Filter out non-images to match the input's accept="image/*"
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        onFilesDrop(imageFiles);
      }
    }
  };

  return (
    <div
      className={`custom-upload-area ${dragOver ? 'active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={onFileInputChange} />

      <div style={{ pointerEvents: 'none' }}>
        <FaCloudUploadAlt size={48} color="var(--color-accent)" style={{ opacity: 0.7 }} />
      </div>

      <div>
        <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 500 }}>Upload Photos</h3>
        <p className="text-subtle" style={{ margin: 0 }}>Drag & drop files here or click to select</p>
      </div>

      <div className="upload-actions">
        <button className="btn primary" onClick={onSelectFiles}>
          <FaImage /> {selectedFiles.length ? `${selectedFiles.length} files selected` : 'Select Files'}
        </button>
        {selectedFiles.length > 0 && (
          <button className="btn" onClick={onUpload} disabled={isUploading}>
            {isUploading ? 'Uploading...' : 'Start Upload'}
          </button>
        )}
        <button className="btn" onClick={onCreateSubfolder}>
          <FaPlus /> New Folder
        </button>
      </div>

      {isUploading && (
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${uploadProgress.overall}%` }} />
        </div>
      )}

      {filePreviews.length > 0 && (
        <div className="preview-reel">
          {filePreviews.map((p, idx) => (
            <img key={idx} src={p.url} alt={p.name} className="preview-thumb" />
          ))}
        </div>
      )}

      {selectedFolder && (
        <div className="text-subtle">
          Uploading to: {selectedFolder.folderId}
        </div>
      )}
    </div>
  );
}

export default UploadArea;