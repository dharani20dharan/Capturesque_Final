import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  FaFolder,
  FaArrowLeft,
  FaDownload,
  FaTimes,
  FaSpinner,
  FaExclamationTriangle,
  FaUpload,
  FaPlus,
  FaFolderPlus,
  FaSearch,
  FaRedo,
  FaTrashAlt,
  FaCheckSquare,
  FaSquare,
  FaColumns,
  FaList,
  FaLink,
  FaPen,
} from 'react-icons/fa';
import './Gallery.css';

/* ------------------
   Config
------------------- */
let API_BASE_URL = 'http://150.230.138.173:8087'; // default fallback

// Check if running in Vite
if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
  API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
}

// Check if running in CRA
else if (typeof process !== 'undefined' && process.env?.REACT_APP_API_BASE_URL) {
  API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
}

const ROOT_FOLDER = 'Gallery';
const PAGE_SIZE = 24;


// tiny inline SVG as a safe placeholder (no external asset required)
const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
       <rect width="100%" height="100%" fill="#222"/>
       <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#aaa" font-size="14" font-family="sans-serif">image unavailable</text>
     </svg>`
  );

/* ------------------
   Helpers
------------------- */
const encodePath = (path = '') =>
  path
    .split('/')
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join('/');

const normalizePathParts = (p = '') =>
  (p || '')
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s).trim().toLowerCase();
      } catch {
        return (s || '').trim().toLowerCase();
      }
    });

// Extract relative folder from mix of absolute/relative image URLs returned by backend
const getRelFolderFromImageUrl = (url) => {
  if (!url) return '';
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    const prefix = '/api/image/';
    const idx = pathname.indexOf(prefix);
    const after = idx === -1 ? pathname : pathname.slice(idx + prefix.length);
    const parts = after.split('/').filter(Boolean);
    if (parts.length <= 1) return '';
    parts.pop();
    return parts.join('/');
  } catch {
    // fallback if URL parsing fails
    const p = (url.split('/api/image/')[1] || '').split('?')[0];
    const parts = p.split('/').filter(Boolean);
    if (parts.length <= 1) return '';
    parts.pop();
    return parts.join('/');
  }
};

/* ------------------
   Small reusable components (Modal, Toast)
------------------- */
const ConfirmModal = ({ open, title, message, onConfirm, onCancel, loading }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <button className="modal-close-btn" onClick={onCancel} aria-label="Close confirm dialog">
          <FaTimes />
        </button>
        <h3 id="confirm-title">{title}</h3>
        <p style={{ marginTop: 8 }}>{message}</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="btn danger" onClick={onConfirm} disabled={loading}>
            {loading ? <FaSpinner className="spinner-icon" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Toast = ({ message }) => (message ? <div className="toast">{message}</div> : null);

/* ------------------
   Main Component
------------------- */
export default function Gallery() {
  // folders
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [subfolders, setSubfolders] = useState([]);

  // images
  const [imagesAll, setImagesAll] = useState([]);
  const [imagesVisible, setImagesVisible] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ui
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // auth reactivity (rerender on token change across tabs)
  const [, setAuthVersion] = useState(0);
  const isLoggedIn = !!localStorage.getItem('token');

  // modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // upload
  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});

  // search / filters
  const [folderSearch, setFolderSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('nameAsc');
  const [extFilter, setExtFilter] = useState('all');

  // delete confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // selection (batch actions)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // view mode
  const [viewMode, setViewMode] = useState('grid');

  const notify = (msg, ms = 3500) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), ms);
  };

  const rootParts = normalizePathParts(ROOT_FOLDER);

  /* ------------------
     Mount / Unmount
  ------------------- */
  useEffect(() => {
    fetchRootFolders();

    const onAuthEvent = () => setAuthVersion((v) => v + 1);
    window.addEventListener('storage', onAuthEvent);
    window.addEventListener('authChange', onAuthEvent);

    return () => {
      window.removeEventListener('storage', onAuthEvent);
      window.removeEventListener('authChange', onAuthEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      filePreviews.forEach((p) => {
        try {
          URL.revokeObjectURL(p.url);
        } catch {}
      });
    };
  }, [filePreviews]);

  /* ------------------
     Data Filtering & Sorting
  ------------------- */
  useEffect(() => {
    let arr = [...imagesAll];

    if (extFilter !== 'all') {
      arr = arr.filter(
        (img) => (img.name || '').split('.').pop().toLowerCase() === extFilter.toLowerCase()
      );
    }

    arr.sort((a, b) => {
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (sortOrder === 'nameAsc') return an < bn ? -1 : 1;
      if (sortOrder === 'nameDesc') return an > bn ? -1 : 1;
      const ae = (a.name || '').split('.').pop().toLowerCase();
      const be = (b.name || '').split('.').pop().toLowerCase();
      if (sortOrder === 'extAsc') return ae < be ? -1 : 1;
      if (sortOrder === 'extDesc') return ae > be ? -1 : 1;
      return 0;
    });

    setImagesVisible(arr.slice(0, visibleCount));
  }, [imagesAll, visibleCount, sortOrder, extFilter]);

  /* ------------------
     API Helpers
  ------------------- */
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  /* ------------------
     Folder Logic
  ------------------- */
  const fetchRootFolders = async () => {
    setLoading(true);
    setError(null);
    try {
        const res = await axios.get(`${API_BASE_URL}/api/folders/${encodePath(ROOT_FOLDER)}`);
        if (res?.data?.subfolders && Array.isArray(res.data.subfolders)) {
          const list = res.data.subfolders.map((name) => ({
            folderName: name,
            folderId: `${ROOT_FOLDER}/${name}`,
          }));
          setFolders(list);
        }
    } catch (err) {
      console.error('Failed to fetch root folders', err);
      setError('Failed to load folders.');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubfolders = async (folderId) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/folders/${encodePath(folderId)}`);
      if (res?.data?.subfolders && Array.isArray(res.data.subfolders)) {
        setSubfolders(
          res.data.subfolders.map((name) => ({ folderName: name, folderId: `${folderId}/${name}` }))
        );
      }
    } catch (err) {
      console.warn('fetchSubfolders failed', err?.message || err);
      setSubfolders([]);
    }
  };

  /* ------------------
     Image Logic
  ------------------- */
  const fetchImages = useCallback(async (folderId) => {
    if (!folderId) return;
    setLoading(true);
    setError(null);
    setImagesAll([]);
    setVisibleCount(PAGE_SIZE);
    setSelectedIds(new Set());

    try {
      const response = await axios.get(`${API_BASE_URL}/api/images/${encodePath(folderId)}`);
      let data = response.data?.images || response.data || [];
      if (!Array.isArray(data)) data = [];

      const selParts = normalizePathParts(folderId);
      const filtered = data
        .filter((img) => {
          const rel = getRelFolderFromImageUrl(img.url || img.thumbnail || '');
          const relParts = normalizePathParts(rel);
          return relParts.length === selParts.length && relParts.every((p, i) => p === selParts[i]);
        })
        .map((img, idx) => ({
          id: img.id || img.name || `img-${idx}`,
          name: img.name || `image_${idx}`,
          url: img.url || img.thumbnail,
          thumbnail: img.thumbnail || img.url,
          raw: img,
        }));

      setImagesAll(filtered);
      if (!filtered.length) setError('No images found in this folder.');
    } catch (err) {
      console.error('Failed to load images:', err);
      setError(`Failed to load images (${err.message || 'Server error'})`);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ------------------
     Navigation
  ------------------- */
  const openFolder = async (folder) => {
    setSelectedFolder(folder);
    setImagesAll([]);
    setSubfolders([]);
    await fetchImages(folder.folderId);
    
    const depthRelative = normalizePathParts(folder.folderId).length - rootParts.length;
    if (depthRelative === 1) await fetchSubfolders(folder.folderId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goUpOneLevel = async () => {
    if (!selectedFolder) return;
    const parts = normalizePathParts(selectedFolder.folderId);
    if (parts.length <= rootParts.length + 1) {
      setSelectedFolder(null);
      setImagesAll([]);
      setSubfolders([]);
      await fetchRootFolders();
      return;
    }
    parts.pop();
    const parentId = parts.join('/');
    const parentName = parts[parts.length - 1] || ROOT_FOLDER;
    await openFolder({ folderName: parentName, folderId: parentId });
  };

  /* ------------------
     Upload Logic
  ------------------- */
  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setFilePreviews(files.map(f => ({ name: f.name, url: URL.createObjectURL(f) })));
  };

  const uploadFiles = async () => {
    if (!selectedFolder?.folderId || !selectedFiles.length) {
      alert(!selectedFolder?.folderId ? 'Select a folder first.' : 'No files selected.');
      return;
    }

    const url = `${API_BASE_URL}/api/upload/${encodePath(selectedFolder.folderId)}`;
    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('file', f));

    setLoading(true);
    setUploadProgress({ overall: 0 });
    try {
      const resp = await axios.post(url, formData, {
        headers: getAuthHeaders(),
        onUploadProgress: (ev) => {
          const percent = Math.round((ev.loaded / (ev.total || 1)) * 100);
          setUploadProgress({ overall: percent });
        },
      });
      notify(`Uploaded ${resp.data?.files?.length || 0} file(s).`);
      setSelectedFiles([]);
      setFilePreviews([]);
      setUploadProgress({});
      await fetchImages(selectedFolder.folderId);
    } catch (err) {
      alert(`Upload failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /* ------------------
     Create Folder Logic
  ------------------- */
  const createFolder = async (asRoot = true) => {
    const parentName = asRoot ? ROOT_FOLDER : selectedFolder?.folderName;
    let name = prompt(`Create a new folder under "${parentName}"`);
    if (!name?.trim()) return;

    const fullPath = asRoot ? `${ROOT_FOLDER}/${name}` : `${selectedFolder.folderId}/${name}`;
    const url = `${API_BASE_URL}/api/create-folder/${encodePath(fullPath)}`;
    try {
      const res = await axios.post(url, null, { headers: getAuthHeaders() });
      notify(res.data?.message || 'Folder created');
      if (asRoot) await fetchRootFolders();
      else await fetchSubfolders(selectedFolder.folderId);
    } catch (err) {
      alert(`Create folder failed: ${err.response?.data?.error || err.message}`);
    }
  };
    
  // All other functions like downloadImage, delete logic, modals, etc remain here
  const downloadImage = async (image) => {
    if (!isLoggedIn) return alert('Please log in to download images.');
    if (!image.name || !selectedFolder?.folderId) return alert('Error: Missing image data.');
    
    const downloadPath = `${encodePath(selectedFolder.folderId)}/${encodeURIComponent(image.name)}`;
    const downloadUrl = `${API_BASE_URL}/api/download/${downloadPath}`;

    try {
        const response = await axios.get(downloadUrl, {
            headers: getAuthHeaders(),
            responseType: 'blob',
        });
        const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', image.name);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
        notify('Download started');
    } catch(err) {
        alert(`Download failed: ${err.message}`);
    }
  };

  const downloadSelected = async () => {
    const toDownload = imagesAll.filter(i => selectedIds.has(i.id));
    if (!toDownload.length) return notify('No images selected.');
    for (const img of toDownload) {
      // eslint-disable-next-line no-await-in-loop
      await downloadImage(img);
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const requestDeleteImage = (image) => {
    setDeleteTarget({ image, folderId: selectedFolder?.folderId });
    setConfirmOpen(true);
  };
    
  const requestDeleteSelected = () => {
    const images = imagesAll.filter(i => selectedIds.has(i.id));
    if (!images.length) return notify('No images selected');
    setDeleteTarget({ images, folderId: selectedFolder?.folderId });
    setConfirmOpen(true);
  };

  const requestDeleteFolder = (folder) => {
    setDeleteTarget({ type: 'folder', ...folder });
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    try {
      if (deleteTarget.type === 'folder') {
        const url = `${API_BASE_URL}/api/folders/${encodePath(deleteTarget.folderId)}`;
        await axios.delete(url, { headers: getAuthHeaders() });
        notify('Folder deleted');
        if (selectedFolder?.folderId === deleteTarget.folderId) {
            goUpOneLevel();
        } else {
            fetchRootFolders(); // Refresh root list
        }
      } else {
        const items = deleteTarget.images || [deleteTarget.image];
        const promises = items.map(img => {
            const url = `${API_BASE_URL}/api/delete/${encodePath(deleteTarget.folderId)}/${encodeURIComponent(img.name)}`;
            return axios.delete(url, { headers: getAuthHeaders() });
        });
        await Promise.all(promises);
        notify(`Deleted ${items.length} image(s).`);
        await fetchImages(deleteTarget.folderId);
        if(deleteTarget.images) setSelectMode(false);
      }
    } catch (err) {
      alert(`Delete failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setDeleteTarget(null);
      setConfirmOpen(false);
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (!isModalOpen) return;
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen]);

  const openModal = (image) => {
    setSelectedImage(image);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedIds(new Set());
  };

  const toggleSelectImage = (id) => {
    const newIds = new Set(selectedIds);
    if (newIds.has(id)) newIds.delete(id);
    else newIds.add(id);
    setSelectedIds(newIds);
  };
    
    const copyImageLink = (image) => {
        // Implementation for copying link
        navigator.clipboard.writeText(image.url).then(() => notify('Link copied!'));
    };

    const renameImage = (image) => {
        alert('Rename functionality is not implemented.');
    };

    const refreshCurrent = async () => {
        if (selectedFolder) {
          await fetchImages(selectedFolder.folderId);
        } else {
          await fetchRootFolders();
        }
        notify('Refreshed');
    };

    const selectAll = () => setSelectedIds(new Set(imagesVisible.map(i => i.id)));
    const clearSelection = () => setSelectedIds(new Set());
    const loadMore = () => setVisibleCount(c => c + PAGE_SIZE);

    const visibleFoldersFiltered = folders.filter(f => 
        f.folderName.toLowerCase().includes(folderSearch.trim().toLowerCase())
    );

  /* ------------------
     Render
  ------------------- */
  return (
    <div className="gallery-page">
      <div className="gallery-container">
        {/* Header */}
        <div className="gallery-header" style={{ alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {selectedFolder ? (
                <>
                <button className="back-btn" onClick={goUpOneLevel}><FaArrowLeft /> Up</button>
                <div>
                    <h2 className="gallery-title">{selectedFolder.folderName}</h2>
                    <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                    {selectedFolder.folderId}
                    <button className="btn small" style={{ marginLeft: 10 }} onClick={refreshCurrent} title="Refresh"><FaRedo /></button>
                    </div>
                </div>
                </>
            ) : (
                <>
                <h2 className="gallery-title">{ROOT_FOLDER}</h2>
                <button className="btn" onClick={() => createFolder(true)}><FaFolderPlus /> New folder</button>
                </>
            )}
            </div>
            {/* Header Controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!selectedFolder ? (
                    <div style={{ position: 'relative' }}>
                        <input type="search" placeholder="Search folders..." value={folderSearch} onChange={e => setFolderSearch(e.target.value)} aria-label="Search folders" />
                        <FaSearch style={{ position: 'absolute', right: 10, top: 7, opacity: 0.8 }} />
                    </div>
                ) : (
                    <>
                    <button className="btn small" onClick={toggleSelectMode} title="Toggle select mode">{selectMode ? <FaCheckSquare /> : <FaSquare />} Select</button>
                    <button className="btn small" onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')} title="Toggle view">{viewMode === 'grid' ? <FaList /> : <FaColumns />}</button>
                    </>
                )}
            </div>
        </div>
        
        {/* Folder View */}
        {!selectedFolder ? (
          <div className="folders" style={{ marginTop: 12 }}>
            {visibleFoldersFiltered.map(folder => (
              <div key={folder.folderId} className="folder-card" onClick={() => openFolder(folder)} role="button" tabIndex={0}>
                <FaFolder className="folder-icon" />
                <h3 className="folder-name">{folder.folderName}</h3>
                {isLoggedIn && <button className="btn small danger folder-delete-btn" onClick={e => {e.stopPropagation(); requestDeleteFolder(folder);}}><FaTrashAlt /></button>}
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Subfolder View */}
            {subfolders.length > 0 && (
                 <div className="folders" style={{ marginTop: 8 }}>
                    {subfolders.map(sf => (
                        <div key={sf.folderId} className="folder-card" onClick={() => openFolder(sf)} style={{minHeight: 120}}>
                           <FaFolder className="folder-icon"/>
                           <h4 className="folder-name">{sf.folderName}</h4>
                           {isLoggedIn && <button className="btn small danger folder-delete-btn" onClick={e => {e.stopPropagation(); requestDeleteFolder(sf);}}><FaTrashAlt /></button>}
                        </div>
                    ))}
                 </div>
            )}
            {/* Upload Area */}
            <UploadArea
              fileInputRef={fileInputRef}
              onFileInputChange={handleFileInputChange}
              filePreviews={filePreviews}
              selectedFiles={selectedFiles}
              onSelectFiles={() => fileInputRef.current?.click()}
              onUpload={uploadFiles}
              onCreateSubfolder={() => createFolder(false)}
              selectedFolder={selectedFolder}
              isUploading={loading && uploadProgress.overall > 0}
              uploadProgress={uploadProgress}
            />
            {/* Selection Action Bar */}
            {selectMode && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn" onClick={selectAll}>Select visible</button>
                <button className="btn" onClick={clearSelection}>Clear</button>
                <button className="btn danger" onClick={requestDeleteSelected}><FaTrashAlt /> Delete</button>
                <button className="btn" onClick={downloadSelected}><FaDownload /> Download</button>
                <div style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>{selectedIds.size} selected</div>
              </div>
            )}
            
            {/* Status Messages */}
            {loading && <div className="gallery-message loading"><FaSpinner className="spinner-icon"/> Loading images...</div>}
            {!loading && error && <div className="gallery-message error"><FaExclamationTriangle /> {error}</div>}

            {/* Image Grid/List */}
            {!loading && !error && imagesVisible.length > 0 && (
                viewMode === 'grid' ? (
                <div className="image-grid">
                    {imagesVisible.map((image) => (
                    <div key={image.id} className={`image-item ${selectMode ? 'select-mode' : ''}`} onClick={() => selectMode ? toggleSelectImage(image.id) : openModal(image)} tabIndex={0}>
                        <img src={image.thumbnail} alt={image.name} loading="lazy" onError={e => e.currentTarget.src = FALLBACK_IMG} />
                        <div className="image-overlay" />
                        {selectMode ? <div className="image-select-checkbox">{selectedIds.has(image.id) ? <FaCheckSquare /> : <FaSquare />}</div> :
                        isLoggedIn && <button className="image-delete-btn" onClick={e => {e.stopPropagation(); requestDeleteImage(image);}}><FaTrashAlt /></button>}
                    </div>
                    ))}
                </div>
                ) : (
                    // List View would go here if implemented
                    <div>List View Not Implemented</div>
                )
            )}

            {!loading && imagesAll.length > imagesVisible.length && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button className="btn" onClick={loadMore}>Load more</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && selectedImage && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeModal} aria-label="Close"><FaTimes /></button>
            <img className="modal-image" src={selectedImage.url} alt={selectedImage.name} onError={e => e.currentTarget.src = FALLBACK_IMG} />
            <div className="modal-actions">
              <button className="modal-download-btn" onClick={() => downloadImage(selectedImage)}><FaDownload /> Download</button>
              <button className="btn small" onClick={() => copyImageLink(selectedImage)}><FaLink /></button>
              <button className="btn small" onClick={() => renameImage(selectedImage)}><FaPen /></button>
              <div style={{ flex: 1 }}></div>
              <button className="btn danger small" onClick={() => requestDeleteImage(selectedImage)}><FaTrashAlt /> Delete</button>
            </div>
          </div>
        </div>
      )}
      
      <ConfirmModal open={confirmOpen} title={deleteTarget?.type === 'folder' ? 'Delete Folder' : 'Delete Item(s)'} message={`Are you sure you want to delete ${deleteTarget?.images?.length || 1} item(s)? This cannot be undone.`} onConfirm={confirmDelete} onCancel={() => setConfirmOpen(false)} loading={deleteLoading} />
      <Toast message={toast} />
    </div>
  );
}

// UploadArea Component (defined in the same file)
function UploadArea({ fileInputRef, onFileInputChange, filePreviews, selectedFiles, onSelectFiles, onUpload, onCreateSubfolder, selectedFolder, isUploading, uploadProgress }) {
    // ... JSX and logic for UploadArea ...
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
                {filePreviews.map((p, idx) => <img key={idx} src={p.url} alt={p.name} style={{ width: 90, height: 60, objectFit: 'cover' }}/>)}
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
    </div>
    );
}