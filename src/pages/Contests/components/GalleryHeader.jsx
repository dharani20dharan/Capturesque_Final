import React, { useEffect, useState } from 'react';
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`gallery-header ${scrolled ? 'scrolled' : ''}`}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {selectedFolder ? (
          <>
            <button className="btn back-btn" onClick={goUpOneLevel} title="Go Up">
              <FaArrowLeft />
            </button>
            <div>
              <h2 className="gallery-title">
                {selectedFolder.folderName}
                {isAdmin && (
                  <button className="btn small" title="Rename folder" onClick={() => renameFolder(selectedFolder)} style={{ marginLeft: 8, border: 'none', padding: 4 }}>
                    <FaPen size={12} />
                  </button>
                )}
              </h2>
              <div className="text-subtle" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                {selectedFolder.folderId}
                <button className="btn small" style={{ border: 'none', padding: 0, color: 'inherit' }} onClick={refreshCurrent} title="Refresh">
                  <FaRedo />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="gallery-title">
              {ROOT_FOLDER}
            </h2>
            {isAdmin && <button className="btn primary small" onClick={() => createFolder(true)}><FaFolderPlus /> New Folder</button>}
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {!selectedFolder ? (
          <div style={{ position: 'relative' }}>
            <input
              type="search"
              placeholder="Search folders..."
              value={folderSearch}
              onChange={e => setFolderSearch(e.target.value)}
              aria-label="Search folders"
            />
            <FaSearch style={{ position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }} />
          </div>
        ) : (
          <>
            {isLoggedIn && (
              <button className={`btn small ${selectedIds.size > 0 ? 'primary' : ''}`} onClick={toggleSelectMode} title="Toggle selection">
                {selectedIds.size > 0 ? <FaCheckSquare /> : <FaSquare />} {selectedIds.size > 0 ? `${selectedIds.size} Selected` : 'Select'}
              </button>
            )}
            <button
              className="btn small"
              onClick={() => setViewMode(v => (v === 'grid' ? 'list' : 'grid'))}
              title={viewMode === 'grid' ? "Switch to List View" : "Switch to Grid View"}
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