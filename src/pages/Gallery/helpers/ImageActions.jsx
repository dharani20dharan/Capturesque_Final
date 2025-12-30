import axios from "axios";
import { API_BASE_URL } from '../config.js';
import { encodePath } from '../helper.js';
import { getAuthHeaders } from "../utils/authHeaders.js";





/**
 * Download single image
 * params: { image, selectedFolder, notify, isLoggedIn }
 */
export async function downloadImage({ image, selectedFolder, notify, isLoggedIn }) {
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
}

/**
 * Rename image
 * params: { image, selectedFolder, notify, fetchImages, setSelectedImage, isAdmin }
 */
export async function renameImage({ image, selectedFolder, notify, fetchImages, setSelectedImage, isAdmin }) {
  if (!isAdmin) return alert('Only admins can rename images.');
  if (!image?.name || !selectedFolder?.folderId) return;
  const newName = prompt(`Rename image "${image.name}" to:`);
  if (!newName || newName.trim() === '' || newName === image.name) return;
  try {
    const url = `${API_BASE_URL}/api/rename-image/${encodePath(selectedFolder.folderId)}/${encodeURIComponent(image.name)}`;
    await axios.post(url, { newName }, { headers: getAuthHeaders() });
    notify('Image renamed');
    await fetchImages(selectedFolder.folderId);
    setSelectedImage((prev) => (prev ? { ...prev, name: newName } : prev));
  } catch (err) {
    alert(`Rename failed: ${err.response?.data?.error || err.message}`);
  }
}
