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
  isPhotographer,
  isAdmin,
  isLoggedIn,
  selectedIds,
  onNavigate,
  onOpenAdminPanel,
}) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const pathSegments = selectedFolder ? selectedFolder.folderId.split('/') : [ROOT_FOLDER];

  return (
    <div className={`gallery-header ${scrolled ? 'scrolled' : ''}`}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {selectedFolder && (
          <button className="btn back-btn" onClick={goUpOneLevel} title="Go Up">
            <FaArrowLeft />
          </button>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="breadcrumbs" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '1.25rem' }}>
            {pathSegments.map((segment, index) => {
              const isLast = selectedFolder ? (index === pathSegments.length - 1) : true;
              const folderId = selectedFolder ? pathSegments.slice(0, index + 1).join('/') : ROOT_FOLDER;

              return (
                <React.Fragment key={folderId}>
                  {index > 0 && <span className="breadcrumb-separator" style={{ opacity: 0.4, margin: '0 4px' }}>/</span>}
                  {isLast ? (
                    <span className="breadcrumb-current" style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {segment}
                      {selectedFolder && isPhotographer && (
                        <button className="btn small" title="Rename folder" onClick={() => renameFolder(selectedFolder)} style={{ border: 'none', padding: 4 }}>
                          <FaPen size={10} />
                        </button>
                      )}
                    </span>
                  ) : (
                    <span
                       className="breadcrumb-link"
                       onClick={() => onNavigate(index === 0 ? null : folderId)}
                       style={{ cursor: 'pointer', color: '#007bff', fontWeight: 500 }}
                    >
                      {segment}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          {selectedFolder ? (
            <div className="text-subtle" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: '0.85rem' }}>
              {selectedFolder.folderId}
              <button className="btn small" style={{ border: 'none', padding: 0, color: 'inherit' }} onClick={refreshCurrent} title="Refresh">
                <FaRedo size={10} />
              </button>
            </div>
          ) : (
            isPhotographer && (
              <div style={{ marginTop: 8 }}>
                <button className="btn primary small" onClick={() => createFolder(true)}>
                  <FaFolderPlus /> New Folder
                </button>
              </div>
            )
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {isAdmin && (
          <button 
            className="btn small secondary" 
            onClick={onOpenAdminPanel}
            style={{ 
              background: 'rgba(255, 193, 7, 0.1)', 
              color: '#ffc107', 
              borderColor: '#ffc107',
              fontWeight: '600'
            }}
          >
            Admin Panel
          </button>
        )}
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