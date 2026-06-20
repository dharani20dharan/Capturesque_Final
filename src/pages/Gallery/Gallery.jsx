// Gallery.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { FaSpinner, FaExclamationTriangle, FaDownload, FaTrashAlt } from 'react-icons/fa';
import './Gallery.css';
import { API_BASE_URL, ROOT_FOLDER, PAGE_SIZE, FALLBACK_IMG } from './config.js';
import { getCurrentUser, encodePath, normalizePathParts } from './helper.js';

import ConfirmModal from './components/ConfirmModal.jsx';
import Toast from './components/Toast.jsx';
import UploadArea from './components/UploadArea.jsx';
import ImageModal from './components/ImageModal.jsx';
import ImageGrid from './components/ImageGrid.jsx';
import GalleryHeader from './components/GalleryHeader.jsx';
import FolderCard from './components/FolderCard.jsx';
import UploadProgressWidget from './components/UploadProgressWidget.jsx';
import ListView from './components/ListView.jsx';

// modular functions (from components/Gallery)
import GetAuthHeaders from './components/GetAuthHeaders.jsx';
import FetchRootFolders from './services/FetchRootFolders.jsx';
import FetchImages from './services/FetchImages.jsx';
import ConfirmDelete from './services/ConfirmDelete.jsx';

// helpers
import fetchSubfolders from './helpers/FetchSubFolders.jsx';
import { downloadImage as helperDownloadImage, renameImage as helperRenameImage, downloadImagesAsZip } from './helpers/ImageActions.jsx';
import { toggleSelectImageHelper, selectAllHelper, clearSelectionHelper } from './helpers/Selection.jsx';
import { v4 as uuidv4 } from 'uuid';

const rootParts = normalizePathParts(ROOT_FOLDER);

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
  const isPhotographer = !!(user && (user.role === 'photographer' || user.role === 'admin' || user.is_admin === true));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Admin Dashboard States & API Methods
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [adminActiveTab, setAdminActiveTab] = useState('users'); // 'users' or 'logs'
  const [adminLoading, setAdminLoading] = useState(false);

  const fetchAdminData = useCallback(async () => {
    if (!isAdmin) return;
    setAdminLoading(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const [usersRes, logsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/admin/users`, { headers }),
        axios.get(`${API_BASE_URL}/api/admin/logs`, { headers })
      ]);
      setAdminUsers(usersRes.data || []);
      setAdminLogs(logsRes.data || []);
    } catch (err) {
      console.error("Failed to fetch admin dashboard data:", err);
    } finally {
      setAdminLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdminModalOpen) {
      fetchAdminData();
    }
  }, [isAdminModalOpen, fetchAdminData]);

  const togglePhotographerRole = async (targetUser) => {
    const newRole = targetUser.role === 'photographer' ? 'user' : 'photographer';
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const url = `${API_BASE_URL}/api/admin/users/${targetUser.id}/role`;
      const res = await axios.post(url, { role: newRole }, { headers });
      notify(res.data?.message || `Updated role to ${newRole}`);
      setAdminUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u));
    } catch (err) {
      alert(`Role change failed: ${err.response?.data?.error || err.message}`);
    }
  };

  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);
  const [folderSearch, setFolderSearch] = useState('');
  const [sortOrder] = useState('nameAsc');
  const [extFilter] = useState('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [viewMode, setViewMode] = useState('grid');

  // New Upload State
  const [uploadQueue, setUploadQueue] = useState({}); // { id: { file, status, progress, name } }
  const [isWidgetMinimized, setIsWidgetMinimized] = useState(false);
  const [uploadingActive, setUploadingActive] = useState(false);

  const notify = useCallback((msg, ms = 3500) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), ms);
  }, []);

  /* ------------------
     Modular wrappers
  ------------------- */
  const fetchRootFolders = useCallback(() => {
    return FetchRootFolders({ setLoading, setError, setFolders });
  }, []);

  const fetchImages = useCallback((folderId) => {
    return FetchImages({
      folderId,
      setLoading,
      setError,
      setImagesAll,
      setVisibleCount,
      setSelectedIds,
    });
  }, []);

  const fetchSubfoldersLocal = useCallback(async (folderId) => {
    await fetchSubfolders(folderId, setSubfolders);
  }, []);

  const refreshCurrent = useCallback(async () => {
    if (selectedFolder) {
      await fetchImages(selectedFolder.folderId);
      const depthRelative = normalizePathParts(selectedFolder.folderId).length - rootParts.length;
      if (depthRelative === 1) await fetchSubfoldersLocal(selectedFolder.folderId);
      else if (depthRelative === 0) await fetchSubfoldersLocal(selectedFolder.folderId); // Should ideally be fetchRootFolders if we treated root as folder, but separate logic exists
    } else {
      await fetchRootFolders();
    }
  }, [selectedFolder, fetchImages, fetchSubfoldersLocal, fetchRootFolders]);

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
  }, [fetchRootFolders]);

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
     Navigation
  ------------------- */
  const openFolder = async (folder) => {
    setSelectedFolder(folder);
    setImagesAll([]);
    setSubfolders([]);
    await fetchImages(folder.folderId);
    if (!folder.folderId) return;
    const depthRelative = normalizePathParts(folder.folderId).length - rootParts.length;
    if (depthRelative === 1) await fetchSubfoldersLocal(folder.folderId);
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

    // Fix: Use original string to preserve case
    const currentPath = selectedFolder.folderId;
    const newPathParts = currentPath.split('/');
    newPathParts.pop();
    const parentId = newPathParts.join('/');
    const parentName = newPathParts[newPathParts.length - 1] || ROOT_FOLDER;

    await openFolder({ folderName: parentName, folderId: parentId });
  };

  const navigateToFolderId = async (folderId) => {
    if (!folderId || folderId === ROOT_FOLDER) {
      setSelectedFolder(null);
      setImagesAll([]);
      setSubfolders([]);
      await fetchRootFolders();
      return;
    }
    const parts = folderId.split('/');
    const folderName = parts[parts.length - 1];
    await openFolder({ folderName, folderId });
  };

  /* ------------------
     Sequential Upload Logic
  ------------------- */
  const getAuthHeaders = GetAuthHeaders;

  const handleFilesAdded = (files) => {
    if (!files.length) return;
    if (!selectedFolder) {
      alert("Please select a folder first.");
      return;
    }

    const newQueue = { ...uploadQueue };
    files.forEach(file => {
      const id = uuidv4();
      newQueue[id] = {
        id,
        file,
        name: file.name,
        status: 'pending',
        progress: 0,
        folderId: selectedFolder.folderId
      };
    });

    setUploadQueue(newQueue);
    setUploadingActive(true);
    setIsWidgetMinimized(false);
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    handleFilesAdded(files);

    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Effect to process queue
  useEffect(() => {
    if (!uploadingActive) return;

    const processQueue = async () => {
      // Find visible pending file (First In First Out roughly, or simple iteration)
      const pendingIds = Object.keys(uploadQueue).filter(id => uploadQueue[id].status === 'pending');
      const uploadingIds = Object.keys(uploadQueue).filter(id => uploadQueue[id].status === 'uploading');

      if (uploadingIds.length > 0) return; // Wait for current upload to finish
      if (pendingIds.length === 0) {
        setUploadingActive(false); // All done
        refreshCurrent(); // Refresh view one last time
        return;
      }

      const nextId = pendingIds[0];
      const task = uploadQueue[nextId];

      // Start upload
      setUploadQueue(prev => ({
        ...prev,
        [nextId]: { ...prev[nextId], status: 'uploading' }
      }));

      try {
        const file = task.file;
        const folderId = task.folderId;
        const chunkSize = 5 * 1024 * 1024; // 5MB chunks
        const totalChunks = Math.ceil(file.size / chunkSize);
        let chunkIndex = 0;

        const uploadNextChunk = async () => {
          const start = chunkIndex * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const chunk = file.slice(start, end);

          const formData = new FormData();
          formData.append('file', chunk, file.name);
          formData.append('filename', file.name);
          formData.append('chunkIndex', chunkIndex);
          formData.append('totalChunks', totalChunks);
          formData.append('folderId', folderId);

          const url = `${API_BASE_URL}/api/upload-chunk`;
          await axios.post(url, formData, {
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'multipart/form-data',
            }
          });

          // Calculate overall progress percentage
          const percent = Math.round((end * 100) / file.size);
          setUploadQueue(prev => ({
            ...prev,
            [nextId]: { ...prev[nextId], progress: percent }
          }));

          if (chunkIndex < totalChunks - 1) {
            chunkIndex++;
            await uploadNextChunk();
          }
        };

        await uploadNextChunk();

        // Success
        setUploadQueue(prev => ({
          ...prev,
          [nextId]: { ...prev[nextId], status: 'completed', progress: 100 }
        }));

        if (selectedFolder && selectedFolder.folderId === task.folderId) {
          fetchImages(task.folderId);
        }

      } catch (err) {
        console.error('Upload error', err);
        setUploadQueue(prev => ({
          ...prev,
          [nextId]: { ...prev[nextId], status: 'error' }
        }));
      }
    };

    const timer = setTimeout(processQueue, 100); // small delay to allow state updates
    return () => clearTimeout(timer);
  }, [uploadQueue, uploadingActive, selectedFolder, fetchImages, getAuthHeaders, refreshCurrent]);


  /* ------------------
     Folder Create/Rename/Delete
  ------------------- */
  const createFolder = async (asRoot = true) => {
    if (!isPhotographer) return alert('Only photographers and admins can create folders.');
    const parentName = asRoot ? ROOT_FOLDER : selectedFolder?.folderName;
    let name = prompt(`Create a new folder under "${parentName}"`);
    if (!name?.trim()) return;
    const fullPath = asRoot ? `${ROOT_FOLDER}/${name}` : `${selectedFolder.folderId}/${name}`;
    const url = `${API_BASE_URL}/api/create-folder/${encodePath(fullPath)}`;
    try {
      const res = await axios.post(url, null, { headers: getAuthHeaders() });
      notify(res.data?.message || 'Folder created');
      refreshCurrent(); // Auto-refresh
    } catch (err) {
      alert(`Create folder failed: ${err.response?.data?.error || err.message}`);
    }
  };

  const renameFolder = async (folder) => {
    if (!isPhotographer) return alert('Only photographers and admins can rename folders.');
    if (!folder?.folderId) return;
    const currentName = folder.folderName;
    const newName = prompt(`Rename folder "${currentName}" to:`);
    if (!newName || newName.trim() === '' || newName === currentName) return;
    try {
      const url = `${API_BASE_URL}/api/rename-folder/${encodePath(folder.folderId)}`;
      await axios.post(url, { newName }, { headers: getAuthHeaders() });
      notify('Folder renamed');
      // Logic to decide what to refresh
      const parts = folder.folderId.split('/');
      parts.pop();
      const parent = parts.join('/');

      // If we renamed the CURRENT folder, we need to update state
      if (selectedFolder?.folderId === folder.folderId) {
        const renamed = { folderName: newName, folderId: `${parent}/${newName}` };
        setSelectedFolder(renamed);
        await fetchImages(renamed.folderId);
      }
      // Refresh parent to see new name in list
      if (!parent && !selectedFolder) fetchRootFolders(); // renamed root folder child
      else if (selectedFolder && parent === selectedFolder.folderId) fetchSubfoldersLocal(parent);
      else refreshCurrent();

    } catch (err) {
      alert(`Rename failed: ${err.response?.data?.error || err.message}`);
    }
  };

  /* ------------------
     Image actions
  ------------------- */
  const downloadImage = async (image) => {
    await helperDownloadImage({ image, selectedFolder, notify, isLoggedIn });
  };

  const downloadSelected = async () => {
    if (!isLoggedIn) return notify('Log in to download images.');
    const toDownload = imagesAll.filter(i => selectedIds.has(i.id));
    if (!toDownload.length) return notify('No images selected.');
    const filenames = toDownload.map(img => img.name);
    await downloadImagesAsZip({ filenames, selectedFolder, notify, isLoggedIn });
  };

  const requestDeleteImage = (image) => {
    if (!isPhotographer) return alert('Only photographers and admins can delete images.');
    setDeleteTarget({ image, folderId: selectedFolder?.folderId });
    setConfirmOpen(true);
  };

  const requestDeleteSelected = () => {
    if (!isPhotographer) return alert('Only photographers and admins can delete images.');
    const images = imagesAll.filter(i => selectedIds.has(i.id));
    if (!images.length) return notify('No images selected');
    setDeleteTarget({ images, folderId: selectedFolder?.folderId });
    setConfirmOpen(true);
  };

  const requestDeleteFolder = (folder) => {
    if (!isPhotographer) return alert('Only photographers and admins can delete folders.');
    setDeleteTarget({ type: 'folder', ...folder });
    setConfirmOpen(true);
  };

  const confirmDelete = useCallback(async () => {
    await ConfirmDelete({
      deleteTarget,
      setDeleteLoading,
      setDeleteTarget,
      setConfirmOpen,
      notify,
      fetchImages,
      // Instead of relying on ConfirmDelete to guess navigation, we provide explicit refresh logic or use ConfirmDelete's default if apt.
      // But ConfirmDelete uses goUpOneLevel for folder delete. We want to JUST REFRESH if we deleted a child folder.
      // We will trick it: we won't pass goUpOneLevel. We will handle refresh here manually?
      // Actually ConfirmDelete is imported. Let's see if we can pass a custom callback.
      // The imported function checks `if (typeof goUpOneLevel === 'function')`.
      // If we pass null, it calls `fetchRootFolders`.
      // But we want `refreshCurrent` (which might be fetchSubfoldersLocal).
      // Solution: Wrap goUpOneLevel logic, or simply perform refresh after ConfirmDelete returns?
      // ConfirmDelete is async.
      // But it executes the navigation internally.
      // We should Modify ConfirmDelete logic in previous step? No, reusing existing.
      // Let's pass a wrapper for goUpOneLevel that actually just Refreshes if we are deleting a subfolder of CURRENT folder.
      goUpOneLevel: async () => {
        // If we are deleting a folder, ConfirmDelete calls this.
        // Usually ConfirmDelete calls this assuming we deleted the CURRENT folder.
        // But here we only delete subfolders (via cards).
        // So we should NOT go up. We should refresh.
        await refreshCurrent();
      },
      fetchRootFolders: refreshCurrent, // Fallback
      setSelectMode,
    });
  }, [deleteTarget, notify, fetchImages, refreshCurrent]);

  /* ------------------
     Modal / selection helpers
  ------------------- */
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
    toggleSelectImageHelper(id, selectedIds, setSelectedIds);
  };

  const copyImageLink = (image) => {
    navigator.clipboard.writeText(image.url).then(() => notify('Link copied!'));
  };

  const renameImage = async (image) => {
    await helperRenameImage({ image, selectedFolder, notify, fetchImages, setSelectedImage, isAdmin: isPhotographer });
  };

  const selectAll = () => selectAllHelper(imagesVisible, setSelectedIds);
  const clearSelection = () => clearSelectionHelper(setSelectedIds);
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
          isPhotographer={isPhotographer}
          isAdmin={isAdmin}
          isLoggedIn={isLoggedIn}
          selectedIds={selectedIds}
          onNavigate={navigateToFolderId}
          onOpenAdminPanel={() => setIsAdminModalOpen(true)}
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
                    isAdmin={isPhotographer}
                  />
                ))}
              </div>
            )}

            {/* Standard Upload Area (Empty State or Initial) */}
            {isPhotographer && (
              <UploadArea
                fileInputRef={fileInputRef}
                onFileInputChange={handleFileInputChange}
                filePreviews={[]} // We don't show previews here anymore, they go to widget
                selectedFiles={[]}
                onSelectFiles={() => fileInputRef.current?.click()}
                onUpload={() => { }} // No manual upload trigger needed, happens on select
                onCreateSubfolder={() => createFolder(false)}
                selectedFolder={selectedFolder}
                isUploading={false}
                uploadProgress={{ overall: 0 }}
                onFilesDrop={handleFilesAdded}
              />
            )}

            {selectMode && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn" onClick={selectAll}>Select visible</button>
                <button className="btn" onClick={clearSelection}>Clear</button>
                {isPhotographer && <button className="btn danger" onClick={requestDeleteSelected}><FaTrashAlt /> Delete</button>}
                {isLoggedIn && <button className="btn" onClick={downloadSelected}><FaDownload /> Download</button>}
                <div style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>{selectedIds.size} selected</div>
              </div>
            )}
            {loading && !uploadingActive && <div className="gallery-message loading"><FaSpinner className="spinner-icon" /> Loading...</div>}
            {!loading && error && <div className="gallery-message error"><FaExclamationTriangle /> {error}</div>}

            {imagesVisible.length > 0 && (
              viewMode === 'grid' ? (
                <ImageGrid
                  images={imagesVisible}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onImageClick={(image) => selectMode ? toggleSelectImage(image.id) : openModal(image)}
                  onImageDelete={requestDeleteImage}
                  isAdmin={isPhotographer}
                />
              ) : (
                <ListView
                  images={imagesVisible}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onImageClick={(image) => selectMode ? toggleSelectImage(image.id) : openModal(image)}
                  onImageDelete={requestDeleteImage}
                  onImageDownload={downloadImage}
                  onImageCopyLink={copyImageLink}
                  isAdmin={isPhotographer}
                  isLoggedIn={isLoggedIn}
                />
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
                isAdmin={isPhotographer}
              />
            ))}
          </div>
        )}
      </div>

      <ImageModal
        open={isModalOpen}
        image={selectedImage}
        selectedFolder={selectedFolder}
        onClose={closeModal}
        onDownload={downloadImage}
        onRename={renameImage}
        onDelete={requestDeleteImage}
        isLoggedIn={isLoggedIn}
        isAdmin={isAdmin}
        isPhotographer={isPhotographer}
      />

      <ConfirmModal
        open={confirmOpen}
        title={deleteTarget?.type === 'folder' ? 'Delete Folder' : 'Delete Item(s)'}
        message={deleteTarget?.type === 'folder'
          ? `Are you sure you want to delete the folder "${deleteTarget?.folderName}" and all its contents?`
          : `Are you sure you want to delete ${deleteTarget?.images?.length || 1} item(s)?`}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
        loading={deleteLoading}
        confirmLabel={deleteTarget?.type === 'folder' ? 'Delete folder' : 'Delete'}
      />

      <UploadProgressWidget
        uploads={uploadQueue}
        onClose={() => setUploadQueue({})}
        minimized={isWidgetMinimized}
        toggleMinimized={() => setIsWidgetMinimized(!isWidgetMinimized)}
      />

      {/* Admin Dashboard Modal */}
      {isAdminModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setIsAdminModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 800, width: '90%' }}>
            <button className="modal-close-btn" onClick={() => setIsAdminModalOpen(false)} aria-label="Close admin dashboard">
              &times;
            </button>
            <h3 style={{ marginBottom: 16 }}>Admin Dashboard</h3>
            
            <div className="admin-tabs" style={{ display: 'flex', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8, marginBottom: 16 }}>
              <button 
                className={`btn small ${adminActiveTab === 'users' ? 'primary' : 'secondary'}`} 
                onClick={() => setAdminActiveTab('users')}
              >
                User Access Control
              </button>
              <button 
                className={`btn small ${adminActiveTab === 'logs' ? 'primary' : 'secondary'}`} 
                onClick={() => setAdminActiveTab('logs')}
              >
                Photographer Logs
              </button>
            </div>

            {adminLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <FaSpinner className="spinner-icon" /> Loading...
              </div>
            ) : adminActiveTab === 'users' ? (
              <div className="admin-table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ padding: 8 }}>Email</th>
                      <th style={{ padding: 8 }}>Role</th>
                      <th style={{ padding: 8, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: 8 }}>{u.email}</td>
                        <td style={{ padding: 8 }}>
                          <span className={`role-badge ${u.role}`} style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            backgroundColor: u.role === 'admin' ? '#dc3545' : u.role === 'photographer' ? '#17a2b8' : 'rgba(255,255,255,0.1)',
                            color: '#fff'
                          }}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: 8, textAlign: 'right' }}>
                          {u.role !== 'admin' && (
                            <button 
                              className={`btn small ${u.role === 'photographer' ? 'danger' : 'success'}`}
                              onClick={() => togglePhotographerRole(u)}
                            >
                              {u.role === 'photographer' ? 'Revoke Access' : 'Make Photographer'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ padding: 8 }}>Time</th>
                      <th style={{ padding: 8 }}>Photographer</th>
                      <th style={{ padding: 8 }}>Action</th>
                      <th style={{ padding: 8 }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminLogs.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                        <td style={{ padding: 8, whiteSpace: 'nowrap', opacity: 0.7 }}>{l.timestamp}</td>
                        <td style={{ padding: 8 }}>{l.userEmail}</td>
                        <td style={{ padding: 8 }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: l.action.includes('delete') ? 'rgba(220,53,69,0.2)' : 'rgba(40,167,69,0.2)',
                            color: l.action.includes('delete') ? '#ff6b6b' : '#2ecc71'
                          }}>
                            {l.action.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: 8, opacity: 0.8 }}>{l.details || '-'}</td>
                      </tr>
                    ))}
                    {adminLogs.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '20px 0', opacity: 0.5 }}>
                          No activity logs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button className="btn" onClick={() => setIsAdminModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}
