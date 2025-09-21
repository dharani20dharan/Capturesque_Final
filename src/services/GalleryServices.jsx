// src/services/galleryService.js
import api from '../services/api.js';
import { encodePath } from '../../component/Gallery/helper.js'; // adjust if you move helper.js
import { ROOT_FOLDER } from '../config/ApiConfig..jsx';

// Fetch all root folders
export async function fetchRootFolders() {
  const { data } = await api.get(`/folders/${ROOT_FOLDER}`);
  return data;
}

// Fetch subfolders of a given folder
export async function fetchSubfolders(folderId) {
  const { data } = await api.get(`/folders/${encodePath(folderId)}`);
  return data;
}

// Fetch images inside a folder
export async function fetchImages(folderId) {
  const { data } = await api.get(`/images/${encodePath(folderId)}`);
  return data;
}

// Upload files into a folder
export async function uploadFiles(folderId, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const { data } = await api.post(`/upload/${encodePath(folderId)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data;
}

// Create a new folder
export async function createFolder(parentId, name) {
  const { data } = await api.post(`/folders/${encodePath(parentId)}`, { name });
  return data;
}

// Rename a folder
export async function renameFolder(folderId, newName) {
  const { data } = await api.put(`/folders/${encodePath(folderId)}`, { name: newName });
  return data;
}

// Delete an image
export async function deleteImage(imageId) {
  const { data } = await api.delete(`/images/${encodePath(imageId)}`);
  return data;
}

// Download an image
export async function downloadImage(imageId) {
  const { data } = await api.get(`/images/${encodePath(imageId)}/download`, {
    responseType: 'blob',
  });
  return data;
}
