// uploadFiles.js
import axios from 'axios';
import { API_BASE_URL } from "../../config.js";
import { encodePath } from "../../helper.js";
import getAuthHeaders from "./GetAuthHeaders.jsx"; // same folder, so ./ is fine

export default async function uploadFilesFn({
  isAdmin,
  selectedFolder,
  selectedFiles,
  setLoading,
  setUploadProgress,
  setSelectedFiles,
  setFilePreviews,
  notify,
  fetchImages,
}) {
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
}
