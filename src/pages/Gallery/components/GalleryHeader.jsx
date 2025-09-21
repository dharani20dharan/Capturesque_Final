import React from 'react';
import { FaArrowLeft, FaFolderPlus, FaSearch, FaCheckSquare, FaSquare, FaList, FaColumns, FaPen, FaRedo } from 'react-icons/fa';
import { ROOT_FOLDER } from '../config';

const GalleryHeader = ({
  selectedFolder,
  goUpOneLevel,
  createFolder,
  renameFolder,
  refreshCurrent,
  folderSearch,
  setFolderSearch,
  toggleSelectMode,
  setViewMode,
  viewMode,
  isAdmin,
  isLoggedIn,
  selectedIds,
}) => {
  return (
    <div className="gallery-header" style={{ alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {selectedFolder ? (
          <>
            <button className="back-btn" onClick={goUpOneLevel}><FaArrowLeft /> Up</button>
            <div>
              <h2 className="gallery-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedFolder.folderName}
                {isAdmin && (
                  <button className="btn small" title="Rename folder" onClick={() => renameFolder(selectedFolder)}><FaPen /></button>
                )}
              </h2>
              <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                {selectedFolder.folderId}
                <button className="btn small" style={{ marginLeft: 10 }} onClick={refreshCurrent} title="Refresh"><FaRedo /></button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="gallery-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {ROOT_FOLDER}
            </h2>
            {isAdmin && <button className="btn" onClick={() => createFolder(true)}><FaFolderPlus /> New folder</button>}
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {!selectedFolder ? (
          <div style={{ position: 'relative' }}>
            <input
              type="search"
              placeholder="Search folders..."
              value={folderSearch}
              onChange={e => setFolderSearch(e.target.value)}
              aria-label="Search folders"
            />
            <FaSearch style={{ position: 'absolute', right: 10, top: 7, opacity: 0.8 }} />
          </div>
        ) : (
          <>
            {isLoggedIn && (
              <button className="btn small" onClick={toggleSelectMode} title="Toggle select mode">
                {selectedIds.size > 0 ? <FaCheckSquare /> : <FaSquare />} Select
              </button>
            )}
            <button
              className="btn small"
              onClick={() => setViewMode(v => (v === 'grid' ? 'list' : 'grid'))}
              title="Toggle view"
            >
              {viewMode === 'grid' ? <FaList /> : <FaColumns />}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default GalleryHeader;