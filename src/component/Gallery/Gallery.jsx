import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { FaSpinner, FaExclamationTriangle, FaCheckSquare, FaSquare, FaDownload, FaTrashAlt } from 'react-icons/fa';
import './Gallery.css';
import { API_BASE_URL, ROOT_FOLDER, PAGE_SIZE, FALLBACK_IMG } from '../config';
import { getCurrentUser, encodePath, normalizePathParts, getRelFolderFromImageUrl } from './helper.js';
import ConfirmModal from './components/Gallery/ConfirmModal.jsx';
import Toast from './components/Gallery/Toast.jsx';
import UploadArea from './components/Gallery/UploadArea.jsx';
import ImageModal from './components/Gallery/ImageModal';
import ImageGrid from './components/Gallery/ImageGrid.jsx';
import GalleryHeader from './components/Gallery/GalleryHeader.jsx';
import FolderCard from './components/Gallery/FolderCard.jsx';

export default function Gallery() {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [subfolders, setSubfolders] = useState([]);
  const [imagesAll, setImagesAll] = useState([]);
  const [imagesVisible, setImagesVisible] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [, setAuthVersion] = useState(0);
  const user = getCurrentUser();
  const isLoggedIn = !!user;
  const isAdmin = !!(user && (user.role === 'admin' || user.is_admin === true));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [folderSearch, setFolderSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('nameAsc');
  const [extFilter, setExtFilter] = useState('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
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
  }, []);

  useEffect(() => {
    return () => {
      filePreviews.forEach((p) => {
        try {
          URL.revokeObjectURL(p.url);
        } catch { }
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
    Upload Logic (admin only)
  ------------------- */
  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setFilePreviews(files.map(f => ({ name: f.name, url: URL.createObjectURL(f) })));
  };

  const uploadFiles = async () => {
    if (!isAdmin) return alert('Only admins can upload files.');
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
    Folder Create/Rename/Delete (admin only)
  ------------------- */
  const createFolder = async (asRoot = true) => {
    if (!isAdmin) return alert('Only admins can create folders.');
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

  const renameFolder = async (folder) => {
    if (!isAdmin) return alert('Only admins can rename folders.');
    if (!folder?.folderId) return;
    const currentName = folder.folderName;
    const newName = prompt(`Rename folder "${currentName}" to:`);
    if (!newName || newName.trim() === '' || newName === currentName) return;
    try {
      const url = `${API_BASE_URL}/api/rename-folder/${encodePath(folder.folderId)}`;
      await axios.post(url, { newName }, { headers: getAuthHeaders() });
      notify('Folder renamed');
      if (selectedFolder?.folderId === folder.folderId) {
        const parts = folder.folderId.split('/');
        parts.pop();
        const parent = parts.join('/');
        await fetchSubfolders(parent);
        const renamed = { folderName: newName, folderId: `${parent}/${newName}` };
        setSelectedFolder(renamed);
        await fetchImages(renamed.folderId);
      } else {
        const depthRelative = normalizePathParts(folder.folderId).length - rootParts.length;
        if (depthRelative === 1) await fetchRootFolders();
        else if (selectedFolder) await fetchSubfolders(selectedFolder.folderId);
      }
    } catch (err) {
      alert(`Rename failed: ${err.response?.data?.error || err.message}`);
    }
  };

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
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const downloadSelected = async () => {
    if (!isLoggedIn) return notify('Log in to download images.');
    const toDownload = imagesAll.filter(i => selectedIds.has(i.id));
    if (!toDownload.length) return notify('No images selected.');
    for (const img of toDownload) {
      await downloadImage(img);
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const requestDeleteImage = (image) => {
    if (!isAdmin) return alert('Only admins can delete images.');
    setDeleteTarget({ image, folderId: selectedFolder?.folderId });
    setConfirmOpen(true);
  };

  const requestDeleteSelected = () => {
    if (!isAdmin) return alert('Only admins can delete images.');
    const images = imagesAll.filter(i => selectedIds.has(i.id));
    if (!images.length) return notify('No images selected');
    setDeleteTarget({ images, folderId: selectedFolder?.folderId });
    setConfirmOpen(true);
  };

  const requestDeleteFolder = (folder) => {
    if (!isAdmin) return alert('Only admins can delete folders.');
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
          fetchRootFolders();
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
        if (deleteTarget.images) setSelectMode(false);
      }
    } catch (err) {
      alert(`Delete failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setDeleteTarget(null);
      setConfirmOpen(false);
      setDeleteLoading(false);
    }
  };

  const openModal = (image) => {
    setSelectedImage(image);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const toggleSelectMode = () => {
    if (!isLoggedIn) return notify('Log in to use selection actions.');
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
    navigator.clipboard.writeText(image.url).then(() => notify('Link copied!'));
  };

  const renameImage = async (image) => {
    if (!isAdmin) return alert('Only admins can rename images.');
    if (!image?.name || !selectedFolder?.folderId) return;
    const newName = prompt(`Rename image "${image.name}" to:`);
    if (!newName || newName.trim() === '' || newName === image.name) return;
    try {
      const url = `${API_BASE_URL}/api/rename-image/${encodePath(selectedFolder.folderId)}/${encodeURIComponent(image.name)}`;
      await axios.post(url, { newName }, { headers: getAuthHeaders() });
      notify('Image renamed');
      await fetchImages(selectedFolder.folderId);
      setSelectedImage((prev) => prev ? { ...prev, name: newName } : prev);
    } catch (err) {
      alert(`Rename failed: ${err.response?.data?.error || err.message}`);
    }
  };

  const refreshCurrent = async () => {
    if (selectedFolder) {
      await fetchImages(selectedFolder.folderId);
      const depthRelative = normalizePathParts(selectedFolder.folderId).length - rootParts.length;
      if (depthRelative === 1) await fetchSubfolders(selectedFolder.folderId);
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

  return (
    <div className="gallery-page">
      <div className="gallery-container">
        <GalleryHeader
          selectedFolder={selectedFolder}
          goUpOneLevel={goUpOneLevel}
          createFolder={createFolder}
          renameFolder={renameFolder}
          refreshCurrent={refreshCurrent}
          folderSearch={folderSearch}
          setFolderSearch={setFolderSearch}
          toggleSelectMode={toggleSelectMode}
          setViewMode={setViewMode}
          viewMode={viewMode}
          isAdmin={isAdmin}
          isLoggedIn={isLoggedIn}
          selectedIds={selectedIds} 
        />
        {selectedFolder ? (
          <>
            {subfolders.length > 0 && (
              <div className="folders" style={{ marginTop: 8 }}>
                {subfolders.map(sf => (
                  <FolderCard
                    key={sf.folderId}
                    folder={sf}
                    onOpen={openFolder}
                    onRename={renameFolder}
                    onDelete={requestDeleteFolder}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            )}
            {isAdmin && (
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
            )}
            {selectMode && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn" onClick={selectAll}>Select visible</button>
                <button className="btn" onClick={clearSelection}>Clear</button>
                {isAdmin && <button className="btn danger" onClick={requestDeleteSelected}><FaTrashAlt /> Delete</button>}
                {isLoggedIn && <button className="btn" onClick={downloadSelected}><FaDownload /> Download</button>}
                <div style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>{selectedIds.size} selected</div>
              </div>
            )}
            {loading && <div className="gallery-message loading"><FaSpinner className="spinner-icon" /> Loading images...</div>}
            {!loading && error && <div className="gallery-message error"><FaExclamationTriangle /> {error}</div>}
            {!loading && !error && imagesVisible.length > 0 && (
              viewMode === 'grid' ? (
                <ImageGrid
                  images={imagesVisible}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onImageClick={(image) => selectMode ? toggleSelectImage(image.id) : openModal(image)}
                  onImageDelete={requestDeleteImage}
                  isAdmin={isAdmin}
                />
              ) : (
                <div>List View Not Implemented</div>
              )
            )}
            {!loading && imagesAll.length > imagesVisible.length && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button className="btn" onClick={loadMore}>Load more</button>
              </div>
            )}
          </>
        ) : (
          <div className="folders" style={{ marginTop: 12 }}>
            {visibleFoldersFiltered.map(folder => (
              <FolderCard
                key={folder.folderId}
                folder={folder}
                onOpen={openFolder}
                onRename={renameFolder}
                onDelete={requestDeleteFolder}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </div>
      <ImageModal
        open={isModalOpen}
        image={selectedImage}
        onClose={closeModal}
        onDownload={downloadImage}
        onCopyLink={copyImageLink}
        onRename={renameImage}
        onDelete={requestDeleteImage}
        isLoggedIn={isLoggedIn}
        isAdmin={isAdmin}
      />
      <ConfirmModal
        open={confirmOpen}
        title={deleteTarget?.type === 'folder' ? 'Delete Folder' : 'Delete Item(s)'}
        message={deleteTarget?.type === 'folder'
          ? `Are you sure you want to delete the folder "${deleteTarget?.folderName}" and all its contents? This cannot be undone.`
          : `Are you sure you want to delete ${deleteTarget?.images?.length || 1} item(s)? This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
        loading={deleteLoading}
        confirmLabel={deleteTarget?.type === 'folder' ? 'Delete folder' : 'Delete'}
      />
      <Toast message={toast} />
    </div>
  );
}