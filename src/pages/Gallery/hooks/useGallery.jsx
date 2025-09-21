// src/pages/Gallery/hooks/useGallery.js
import { useState, useEffect } from 'react';
import {
  fetchRootFolders,
  fetchSubfolders,
  fetchImages,
  uploadFiles,
  createFolder,
  renameFolder,
  deleteImage,
  downloadImage,
} from '../../../services/galleryService.js';

export function useGallery() {
  const [folders, setFolders] = useState([]);
  const [subfolders, setSubfolders] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Example: load root folders at start
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchRootFolders();
        setFolders(data);
      } catch (err) {
        setError(err.message || 'Failed to load folders');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return {
    folders,
    subfolders,
    images,
    loading,
    error,
    setFolders,
    setSubfolders,
    setImages,
    // expose actions
    fetchSubfolders,
    fetchImages,
    uploadFiles,
    createFolder,
    renameFolder,
    deleteImage,
    downloadImage,
  };
}
