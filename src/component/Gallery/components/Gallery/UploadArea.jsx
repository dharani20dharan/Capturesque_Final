import React from 'react';
import { FaUpload, FaPlus } from 'react-icons/fa';

function UploadArea({ fileInputRef, onFileInputChange, filePreviews, selectedFiles, onSelectFiles, onUpload, onCreateSubfolder, selectedFolder, isUploading, uploadProgress }) {
  return (
    <div style={{ marginTop: 18, padding: 14, borderRadius: 8, border: '1px dashed grey', background: 'transparent' }}>
      <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={onFileInputChange} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn" onClick={onSelectFiles}><FaUpload /> {selectedFiles.length ? `${selectedFiles.length} files` : 'Select'}</button>
        {selectedFiles.length > 0 && <button className="btn" onClick={onUpload}>Upload</button>}
        <button className="btn" onClick={onCreateSubfolder}><FaPlus /> New Subfolder</button>
      </div>
      {filePreviews.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          {filePreviews.map((p, idx) => <img key={idx} src={p.url} alt={p.name} style={{ width: 90, height: 60, objectFit: 'cover' }} />)}
        </div>
      )}
      {isUploading && (
        <div style={{ marginTop: 12 }}>
          <div>Uploading: {uploadProgress.overall}%</div>
          <div style={{ width: '100%', background: '#333', height: 8, borderRadius: 4, marginTop: 4 }}>
            <div style={{ width: `${uploadProgress.overall}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: 4 }} />
          </div>
        </div>
      )}
      {selectedFolder && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          Uploading to: <strong>{selectedFolder.folderId}</strong>
        </div>
      )}
    </div>
  );
}

export default UploadArea;