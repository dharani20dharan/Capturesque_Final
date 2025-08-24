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
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://150.230.138.173:8087';
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
   Small reusable confirm modal
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
  const [deleteTarget, setDeleteTarget] = useState(null); // { type?: 'folder', folderId, folderName } | { image, images[], folderId }
  const [deleteLoading, setDeleteLoading] = useState(false);

  // selection (batch actions)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // view mode
  const [viewMode, setViewMode] = useState('grid'); // or 'list'

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

  // Revoke created preview URLs when filePreviews changes or on unmount
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
     Update visible slice on images / filters / search
  ------------------- */
  useEffect(() => {
    let arr = [...imagesAll];

    // extension filter
    if (extFilter !== 'all') {
      arr = arr.filter(
        (img) => (img.name || '').split('.').pop().toLowerCase() === extFilter.toLowerCase()
      );
    }

    // sort
    arr.sort((a, b) => {
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (sortOrder === 'nameAsc') return an < bn ? -1 : an > bn ? 1 : 0;
      if (sortOrder === 'nameDesc') return an > bn ? -1 : an < bn ? 1 : 0;
      const ae = (a.name || '').split('.').pop().toLowerCase();
      const be = (b.name || '').split('.').pop().toLowerCase();
      if (sortOrder === 'extAsc') return ae < be ? -1 : ae > be ? 1 : 0;
      if (sortOrder === 'extDesc') return ae > be ? -1 : ae < be ? 1 : 0;
      return 0;
    });

    setImagesVisible(arr.slice(0, visibleCount));
  }, [imagesAll, visibleCount, sortOrder, extFilter]);

  /* ------------------
     API helpers
  ------------------- */
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  /* ------------------
     FOLDERS
  ------------------- */
  const fetchRootFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      // Prefer /api/folders/<ROOT_FOLDER>
      try {
        const res = await axios.get(`${API_BASE_URL}/api/folders/${encodePath(ROOT_FOLDER)}`);
        if (res?.data?.subfolders && Array.isArray(res.data.subfolders)) {
          const list = res.data.subfolders.map((name) => ({
            folderName: name,
            folderId: `${ROOT_FOLDER}/${name}`,
          }));
          setFolders(list);
          return;
        }
      } catch (err) {
        console.warn('fetchRootFolders fallback to /api/images', err?.message || err);
      }

      // fallback to /api/images
      const res2 = await axios.get(`${API_BASE_URL}/api/images`);
      if (res2?.data?.folders && Array.isArray(res2.data.folders)) {
        setFolders(res2.data.folders.map((name) => ({ folderName: name, folderId: name })));
      } else if (Array.isArray(res2.data)) {
        setFolders(res2.data.map((name) => ({ folderName: name, folderId: name })));
      } else {
        setFolders([]);
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
        return;
      }
    } catch (err) {
      console.warn('fetchSubfolders failed', err?.message || err);
    }
    setSubfolders([]);
  };

  /* ------------------
     IMAGES
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
      let data = response.data;
      if (data?.images && Array.isArray(data.images)) data = data.images;
      else if (!Array.isArray(data)) data = [];

      // keep only direct children (non-recursive)
      const selParts = normalizePathParts(folderId);
      const filtered = data
        .filter((img) => {
          const rel = getRelFolderFromImageUrl(img.url || img.thumbnail || img.download || '');
          const relParts = normalizePathParts(rel);
          if (relParts.length !== selParts.length) return false;
          for (let i = 0; i < selParts.length; i++) if (relParts[i] !== selParts[i]) return false;
          return true;
        })
        .map((img, idx) => ({
          id: img.id || img.name || img.filename || idx,
          name: img.name || img.filename || img.title || `image_${idx}`,
          url: img.url || img.download || img.thumbnail || '',
          thumbnail: img.thumbnail || img.url || '',
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
     Navigation helpers
  ------------------- */
  const openFolder = async (folder) => {
    setSelectedFolder(folder);
    setImagesAll([]);
    setImagesVisible([]);
    setSubfolders([]);
    await fetchImages(folder.folderId);

    // show child subfolders only when depthRelative === 1
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
      setImagesVisible([]);
      setSubfolders([]);
      await fetchRootFolders();
      return;
    }
    parts.pop();
    const parentId = parts.join('/');
    const parentName = parts[parts.length - 1] || ROOT_FOLDER;
    const parentFolder = { folderName: parentName, folderId: parentId };
    await openFolder(parentFolder);
  };

  /* ------------------
     Upload
  ------------------- */
  const onFilesSelected = (files) => {
    const arr = Array.from(files || []);
    setSelectedFiles(arr);

    // create previews (revoke old ones handled by effect)
    const previews = arr.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    setFilePreviews(previews);
  };

  const handleFileInputChange = (e) => onFilesSelected(e.target.files);

  const uploadFiles = async () => {
    if (!selectedFolder?.folderId) {
      alert('Select a folder before uploading.');
      return;
    }
    if (!selectedFiles.length) {
      alert('No files selected.');
      return;
    }

    const url = `${API_BASE_URL}/api/upload/${encodePath(selectedFolder.folderId)}`;
    const formData = new FormData();
    selectedFiles.forEach((f) => formData.append('file', f));

    try {
      setLoading(true);
      setUploadProgress({ overall: 0 });
      const headers = getAuthHeaders();
      const resp = await axios.post(url, formData, {
        headers,
        onUploadProgress: (ev) => {
          const total =
            ev.total || selectedFiles.reduce((s, f) => s + (typeof f.size === 'number' ? f.size : 0), 0) || 1;
          const percent = Math.max(0, Math.min(100, Math.round((ev.loaded / total) * 100)));
          setUploadProgress({ overall: percent });
        },
      });

      const uploaded = resp?.data?.files || [];
      const skipped = resp?.data?.skipped || [];
      if (uploaded.length) notify(`Uploaded ${uploaded.length} file${uploaded.length > 1 ? 's' : ''}`);
      if (skipped.length) notify(`Skipped ${skipped.length} file${skipped.length > 1 ? 's' : ''}`);
      setSelectedFiles([]);
      setFilePreviews([]); // cleanup handled by effect
      setUploadProgress({});
      await fetchImages(selectedFolder.folderId);
    } catch (err) {
      console.error('Upload error', err);
      alert(`Upload failed: ${err?.response?.data?.error || err.message || 'Server error'}`);
    } finally {
      setLoading(false);
    }
  };

  /* ------------------
     Create folder
  ------------------- */
  const createFolder = async (asRoot = true) => {
    let name = prompt(
      asRoot
        ? `Create a new folder under "${ROOT_FOLDER}" (no slashes)`
        : `Create a new subfolder under "${selectedFolder?.folderName}" (no slashes)`
    );
    if (!name) return;
    name = name.trim();
    if (!name) return;

    const fullPath = asRoot ? `${ROOT_FOLDER}/${name}` : `${selectedFolder.folderId}/${name}`;
    const url = `${API_BASE_URL}/api/create-folder/${encodePath(fullPath)}`;
    try {
      const headers = getAuthHeaders();
      const res = await axios.post(url, null, { headers });
      notify(res?.data?.message || 'Folder created');
      if (asRoot) await fetchRootFolders();
      else await fetchSubfolders(selectedFolder.folderId);
    } catch (err) {
      console.error('Create folder error', err);
      alert(`Create folder failed: ${err?.response?.data?.error || err.message || 'Server error'}`);
    }
  };

  /* ------------------
     Download
  ------------------- */
  const downloadImage = async (image) => {
    if (!isLoggedIn) {
      alert('Please log in to download images.');
      return;
    }
    if (!selectedFolder?.folderId) {
      alert('Error: Cannot determine folder for download.');
      return;
    }
    const filename = image?.name;
    if (!filename) {
      alert('Error: filename missing');
      return;
    }

    const downloadPath = `${encodePath(selectedFolder.folderId)}/${encodeURIComponent(filename)}`;
    const downloadUrl = `${API_BASE_URL}/api/download/${downloadPath}`;
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication token not found. Please log in again.');
        return;
      }
      const response = await axios.get(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;

      const contentDisposition = response.headers['content-disposition'];
      let downloadFilename = filename;
      if (contentDisposition) {
        const m = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d'')?([^'";]+)['"]?/);
        if (m && m[1]) {
          try {
            downloadFilename = decodeURIComponent(m[1]);
          } catch {
            downloadFilename = m[1];
          }
        }
      }
      link.setAttribute('download', downloadFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      notify('Download started');
    } catch (err) {
      console.error('Download error', err);
      if (err?.response?.status === 401) alert('Unauthorized. Please log in again.');
      else if (err?.response?.status === 404) alert('Download failed: file not found.');
      else alert(`Download failed: ${err.message || 'Server error'}`);
    }
  };

  const downloadSelected = async () => {
    if (!selectedIds.size) {
      notify('No images selected');
      return;
    }
    const toDownload = imagesAll.filter((i) => selectedIds.has(i.id));
    for (const img of toDownload) {
      // sequential downloads to avoid parallel limits
      // eslint-disable-next-line no-await-in-loop
      await downloadImage(img);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  /* ------------------
     Delete image(s) & folders
  ------------------- */
  const requestDeleteImage = (image) => {
    setDeleteTarget({ image, folderId: selectedFolder?.folderId });
    setConfirmOpen(true);
  };

  const requestDeleteSelected = () => {
    const imgs = imagesAll.filter((i) => selectedIds.has(i.id));
    if (!imgs.length) {
      notify('No images selected');
      return;
    }
    setDeleteTarget({ images: imgs, folderId: selectedFolder?.folderId });
    setConfirmOpen(true);
  };

  const requestDeleteFolder = (folder) => {
    setDeleteTarget({ type: 'folder', folderId: folder.folderId, folderName: folder.folderName });
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    try {
      // Folder deletion
      if (deleteTarget.type === 'folder') {
        const folderId = deleteTarget.folderId;
        const url = `${API_BASE_URL}/api/folders/${encodePath(folderId)}`;
        const headers = getAuthHeaders();
        await axios.delete(url, { headers });
        notify('Folder deleted');

        // If the deleted folder was currently open, go back to root
        if (selectedFolder && selectedFolder.folderId === folderId) {
          setSelectedFolder(null);
          setImagesAll([]);
          setImagesVisible([]);
          await fetchRootFolders();
        } else {
          // refresh listing
          await fetchRootFolders();
          if (selectedFolder) {
            const depthRelative =
              normalizePathParts(selectedFolder.folderId).length - rootParts.length;
            if (depthRelative === 1) await fetchSubfolders(selectedFolder.folderId);
          }
        }

        setConfirmOpen(false);
        setDeleteTarget(null);
        return;
      }

      // existing image(s) deletion logic
      const { image, images, folderId } = deleteTarget;
      if (!folderId) {
        alert('Folder unknown. Cannot delete.');
        return;
      }

      if (images && images.length) {
        // optimistic removal
        const names = images.map((i) => i.name);
        setImagesAll((prev) => prev.filter((i) => !names.includes(i.name)));
        setSelectedIds(new Set());

        const promises = images.map((img) => {
          const filename = img.name;
          const deletePath = `${encodePath(folderId)}/${encodeURIComponent(filename)}`;
          const url = `${API_BASE_URL}/api/delete/${deletePath}`;
          const headers = getAuthHeaders();
          return axios.delete(url, { headers });
        });

        const results = await Promise.allSettled(promises);
        const failed = results.filter((r) => r.status === 'rejected');
        if (failed.length) {
          notify(`${failed.length} delete(s) failed`);
          await fetchImages(folderId);
        } else {
          notify('Deleted selected images');
        }
      } else if (image) {
        const filename = image.name;
        const deletePath = `${encodePath(folderId)}/${encodeURIComponent(filename)}`;
        const url = `${API_BASE_URL}/api/delete/${deletePath}`;
        const headers = getAuthHeaders();
        await axios.delete(url, { headers });
        notify('Deleted');
        await fetchImages(folderId);
      }

      setConfirmOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete error', err);
      alert(`Delete failed: ${err?.response?.data?.error || err.message || 'Server error'}`);
      // try to recover listing
      if (deleteTarget?.type === 'folder') await fetchRootFolders();
      else if (deleteTarget?.folderId) await fetchImages(deleteTarget.folderId);
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ------------------
     Modal navigation + helpers
  ------------------- */
  useEffect(() => {
    const onKey = (e) => {
      if (!isModalOpen) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowLeft') modalPrev();
      if (e.key === 'ArrowRight') modalNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen, imagesVisible, imagesAll, selectedImage]);

  const openModal = (image) => {
    if (!image) return;
    setSelectedImage(image);
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };
  const closeModal = () => {
    setSelectedImage(null);
    setIsModalOpen(false);
    document.body.style.overflow = '';
  };

  const modalPrev = () => {
    if (!selectedImage) return;
    const list = imagesVisible.length ? imagesVisible : imagesAll;
    const idx = list.findIndex((i) => (i.name || i.id) === (selectedImage.name || selectedImage.id));
    if (idx > 0) setSelectedImage(list[idx - 1]);
  };
  const modalNext = () => {
    if (!selectedImage) return;
    const list = imagesVisible.length ? imagesVisible : imagesAll;
    const idx = list.findIndex((i) => (i.name || i.id) === (selectedImage.name || selectedImage.id));
    if (idx < list.length - 1) setSelectedImage(list[idx + 1]);
  };

  // selection helpers
  const toggleSelectMode = () => {
    setSelectMode((m) => {
      if (m) setSelectedIds(new Set());
      return !m;
    });
  };

  const toggleSelectImage = (id) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const selectAll = () => {
    const s = new Set(imagesVisible.map((i) => i.id));
    setSelectedIds(s);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const copyImageLink = async (image) => {
    try {
      const link =
        image.url ||
        `${API_BASE_URL}/api/download/${encodePath(selectedFolder.folderId)}/${encodeURIComponent(
          image.name
        )}`;
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        notify('Link copied to clipboard');
      } else {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = link;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        notify('Link copied to clipboard');
      }
    } catch (err) {
      console.error('Copy failed', err);
      notify('Failed to copy link');
    }
  };

  /* ------------------
     Pagination & derived
  ------------------- */
  const loadMore = () => setVisibleCount((c) => c + PAGE_SIZE);

  const visibleFoldersFiltered = folders.filter((f) => {
    if (!folderSearch.trim()) return true;
    return f.folderName.toLowerCase().includes(folderSearch.trim().toLowerCase());
  });

  const extOptions = React.useMemo(() => {
    const s = new Set();
    imagesAll.forEach((img) => {
      const ext = (img.name || '').split('.').pop().toLowerCase();
      if (ext) s.add(ext);
    });
    return ['all', ...Array.from(s)];
  }, [imagesAll]);

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

  /* ------------------
     Render
  ------------------- */
  return (
    <div className="gallery-page">
      <div className="gallery-container">
        <div className="gallery-header" style={{ alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {selectedFolder ? (
              <>
                <button className="back-btn" onClick={goUpOneLevel}>
                  <FaArrowLeft /> Up
                </button>
                <div style={{ textAlign: 'left' }}>
                  <h2 className="gallery-title">{selectedFolder.folderName}</h2>
                  <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                    {selectedFolder.folderId}
                    <button
                      className="btn small"
                      style={{ marginLeft: 10 }}
                      onClick={refreshCurrent}
                      title="Refresh"
                    >
                      <FaRedo /> Refresh
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="gallery-title">{ROOT_FOLDER}</h2>
                <div style={{ marginLeft: 12 }}>
                  <button className="btn create-folder-btn" onClick={() => createFolder(true)}>
                    <FaFolderPlus /> New folder
                  </button>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!selectedFolder && (
              <div style={{ position: 'relative' }}>
                <input
                  type="search"
                  placeholder="Search folders..."
                  value={folderSearch}
                  onChange={(e) => setFolderSearch(e.target.value)}
                  style={{
                    padding: '8px 36px 8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--element-border)',
                    background: 'rgba(0,0,0,0.35)',
                    color: 'var(--text-primary)',
                  }}
                  aria-label="Search folders"
                />
                <FaSearch style={{ position: 'absolute', right: 10, top: 7, opacity: 0.8 }} />
              </div>
            )}

            {selectedFolder && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="btn small"
                  style={{ padding: '8px 10px' }}
                  aria-label="Sort order"
                >
                  <option value="nameAsc">Name ▲</option>
                  <option value="nameDesc">Name ▼</option>
                  <option value="extAsc">Ext ▲</option>
                  <option value="extDesc">Ext ▼</option>
                </select>

                <select
                  value={extFilter}
                  onChange={(e) => setExtFilter(e.target.value)}
                  className="btn small"
                  style={{ padding: '8px 10px' }}
                  aria-label="Extension filter"
                >
                  {extOptions.map((ext) => (
                    <option key={ext} value={ext}>
                      {ext === 'all' ? 'All' : ext.toUpperCase()}
                    </option>
                  ))}
                </select>

                <button className="btn small" onClick={toggleSelectMode} title="Toggle select mode">
                  {selectMode ? (
                    <>
                      <FaCheckSquare /> Selecting
                    </>
                  ) : (
                    <>
                      <FaSquare /> Select
                    </>
                  )}
                </button>

                <button
                  className="btn small"
                  onClick={() => setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))}
                  title="Toggle view"
                  aria-label="Toggle view"
                >
                  {viewMode === 'grid' ? <FaList /> : <FaColumns />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ROOT: folder grid */}
        {!selectedFolder ? (
          <>
            <h4 style={{ textAlign: 'left', color: 'var(--text-secondary)', marginTop: 6 }}>
              Folders
            </h4>
            <div className="folders" style={{ marginTop: 12 }}>
              {visibleFoldersFiltered.length === 0 ? (
                <div className="gallery-message info">No folders found.</div>
              ) : (
                visibleFoldersFiltered.map((folder) => (
                  <div
                    key={folder.folderId}
                    className="folder-card"
                    onClick={() => openFolder(folder)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && openFolder(folder)}
                    aria-label={`Open folder ${folder.folderName}`}
                  >
                    <div className="folder-icon-wrapper">
                      <FaFolder className="folder-icon" />
                    </div>
                    <h3 className="folder-name">{folder.folderName}</h3>

                    {isLoggedIn && (
                      <button
                        className="btn small danger folder-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          requestDeleteFolder(folder);
                        }}
                        title={`Delete folder ${folder.folderName}`}
                        aria-label={`Delete folder ${folder.folderName}`}
                      >
                        <FaTrashAlt />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Subfolders (only for immediate children of root) */}
            {subfolders.length > 0 &&
              normalizePathParts(selectedFolder.folderId).length - rootParts.length === 1 && (
                <>
                  <h4
                    style={{ textAlign: 'left', color: 'var(--text-secondary)', marginTop: 12 }}
                  >
                    Subfolders
                  </h4>
                  <div className="folders" style={{ marginTop: 8 }}>
                    {subfolders.map((sf) => (
                      <div
                        key={sf.folderId}
                        className="folder-card"
                        onClick={() => openFolder(sf)}
                        role="button"
                        style={{ minHeight: 120 }}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && openFolder(sf)}
                        aria-label={`Open subfolder ${sf.folderName}`}
                      >
                        <div className="folder-icon-wrapper">
                          <FaFolder className="folder-icon" />
                        </div>
                        <h4 className="folder-name" style={{ fontSize: '1rem' }}>
                          {sf.folderName}
                        </h4>

                        {isLoggedIn && (
                          <button
                            className="btn small danger folder-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              requestDeleteFolder(sf);
                            }}
                            title={`Delete folder ${sf.folderName}`}
                            aria-label={`Delete folder ${sf.folderName}`}
                          >
                            <FaTrashAlt />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

            {/* Upload area */}
            <UploadArea
              fileInputRef={fileInputRef}
              onFileInputChange={handleFileInputChange}
              filePreviews={filePreviews}
              selectedFiles={selectedFiles}
              onSelectFiles={() => fileInputRef.current && fileInputRef.current.click()}
              onUpload={uploadFiles}
              onCreateSubfolder={() => createFolder(false)}
              selectedFolder={selectedFolder}
              isUploading={loading && !!uploadProgress.overall}
              uploadProgress={uploadProgress}
            />

            {/* action bar when in selection mode */}
            {selectMode && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn" onClick={selectAll}>
                  Select visible
                </button>
                <button className="btn" onClick={clearSelection}>
                  Clear
                </button>
                <button className="btn danger" onClick={requestDeleteSelected}>
                  <FaTrashAlt /> Delete selected
                </button>
                <button className="btn" onClick={downloadSelected}>
                  <FaDownload /> Download selected
                </button>
                <div style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>
                  {selectedIds.size} selected
                </div>
              </div>
            )}

            {/* Loading / Error */}
            {loading && (
              <div className="gallery-message loading" style={{ marginTop: 24 }}>
                <FaSpinner className="spinner-icon" /> Loading images...
              </div>
            )}
            {!loading && error && (
              <div className="gallery-message error" style={{ marginTop: 24 }}>
                <FaExclamationTriangle /> {error}
              </div>
            )}

            {/* Images grid or list */}
            {!loading && !error && imagesVisible.length > 0 && (
              viewMode === 'grid' ? (
                <div className="image-grid" style={{ marginTop: 18 }}>
                  {imagesVisible.map((image, index) => (
                    <div
                      key={image.id ?? image.name ?? index}
                      className={`image-item ${selectMode ? 'select-mode' : ''}`}
                      onClick={() => (selectMode ? toggleSelectImage(image.id) : openModal(image))}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && (selectMode ? toggleSelectImage(image.id) : openModal(image))
                      }
                      aria-label={`Open image ${image.name || index + 1}`}
                    >
                      <img
                        src={image.thumbnail || image.url}
                        alt={image.title || image.name || `Image ${index + 1}`}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_IMG;
                        }}
                      />
                      <div className="image-overlay" />

                      {selectMode ? (
                        <button
                          className="image-select-checkbox"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectImage(image.id);
                          }}
                          title="Toggle select"
                          aria-label="Toggle select"
                        >
                          {selectedIds.has(image.id) ? <FaCheckSquare /> : <FaSquare />}
                        </button>
                      ) : (
                        isLoggedIn && (
                          <button
                            className="image-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDeleteImage(image);
                            }}
                            title="Delete image"
                            aria-label="Delete image"
                          >
                            <FaTrashAlt />
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="image-list" style={{ marginTop: 18 }}>
                  {imagesVisible.map((image, index) => (
                    <div
                      key={image.id ?? image.name ?? index}
                      className="image-list-row"
                      onClick={() => (selectMode ? toggleSelectImage(image.id) : openModal(image))}
                      role="button"
                      tabIndex={0}
                    >
                      <img
                        src={image.thumbnail || image.url}
                        alt={image.name || `Image ${index + 1}`}
                        style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6 }}
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_IMG;
                        }}
                      />
                      <div style={{ marginLeft: 12, flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{image.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {image.raw?.size ? `${Math.round(image.raw.size / 1024)} KB` : ''}
                          {image.raw?.createdAt ? ` • ${new Date(image.raw.createdAt).toLocaleString()}` : ''}
                        </div>
                      </div>
                      {selectMode ? (
                        <button
                          className="image-select-checkbox"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectImage(image.id);
                          }}
                          title="Toggle select"
                          aria-label="Toggle select"
                        >
                          {selectedIds.has(image.id) ? <FaCheckSquare /> : <FaSquare />}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            className="btn small"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyImageLink(image);
                            }}
                            title="Copy link"
                            aria-label="Copy link"
                          >
                            <FaLink />
                          </button>
                          {isLoggedIn && (
                            <button
                              className="btn small danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDeleteImage(image);
                              }}
                              aria-label="Delete image"
                              title="Delete image"
                            >
                              <FaTrashAlt />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {!loading && !error && imagesVisible.length === 0 && (
              <div className="gallery-message info" style={{ marginTop: 24 }}>
                No images available in this folder.
              </div>
            )}

            {!loading && imagesAll.length > imagesVisible.length && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button className="btn" onClick={loadMore}>
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && selectedImage && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeModal} aria-label="Close">
              <FaTimes />
            </button>
            <div className="modal-image-container">
              <img
                className="modal-image"
                src={selectedImage.url || selectedImage.thumbnail}
                alt={selectedImage.name || 'Image'}
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMG;
                }}
              />
            </div>
            <div className="modal-actions">
              {isLoggedIn ? (
                <button className="modal-download-btn" onClick={() => downloadImage(selectedImage)}>
                  <FaDownload /> Download
                </button>
              ) : (
                <p className="login-prompt">Please log in to download.</p>
              )}
              <button className="btn small" onClick={() => copyImageLink(selectedImage)} title="Copy link">
                <FaLink />
              </button>
              {isLoggedIn && (
                <button className="btn small" onClick={() => renameImage(selectedImage)} title="Rename">
                  <FaPen />
                </button>
              )}
              <div style={{ flex: 1 }} />
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{selectedImage.name}</div>
              {isLoggedIn && (
                <button
                  className="btn danger small"
                  style={{ marginLeft: 12 }}
                  onClick={() => requestDeleteImage(selectedImage)}
                >
                  <FaTrashAlt /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title={deleteTarget?.type === 'folder' ? 'Delete folder' : 'Delete image(s)'}
        message={
          deleteTarget
            ? deleteTarget.type === 'folder'
              ? `Delete folder "${deleteTarget.folderName}"? This will remove the folder and all its contents. This action cannot be undone.`
              : deleteTarget.images
              ? `Delete ${deleteTarget.images.length} images? This action cannot be undone.`
              : deleteTarget.image?.name
              ? `Delete "${deleteTarget.image.name}"? This action cannot be undone.`
              : 'Delete item?'
            : ''
        }
        onConfirm={confirmDelete}
        onCancel={() => {
          setConfirmOpen(false);
          setDeleteTarget(null);
        }}
        loading={deleteLoading}
      />

      <Toast message={toast} />
    </div>
  );
}

/* ------------------
   UploadArea (kept separate)
------------------- */
function UploadArea({
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

/* ------------------
   Optional simple drag-drop uploader (separate export)
------------------- */
export const SimpleUploadArea = ({ onUpload }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer?.files?.length) {
      onUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className={`upload-area ${isDragOver ? 'drag-over' : ''}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <p>Drag &amp; drop files here, or click to select files</p>
      <input id="simple-file-input" type="file" multiple onChange={(e) => onUpload(e.target.files)} style={{ display: 'none' }} />
      <label htmlFor="simple-file-input" className="upload-button">
        Select Files
      </label>
    </div>
  );
};
