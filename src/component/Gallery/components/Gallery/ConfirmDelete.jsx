// confirmDelete.js
import axios from 'axios';
import { API_BASE_URL } from "../../config.js";
import { encodePath } from "../../helper.js";
import getAuthHeaders from "./GetAuthHeaders.jsx";

export default async function confirmDelete({
  deleteTarget,
  setDeleteLoading,
  setDeleteTarget,
  setConfirmOpen,
  notify,
  fetchImages,
  fetchRootFolders,
  goUpOneLevel,
  setSelectMode,
}) {
  if (!deleteTarget) return;
  setDeleteLoading(true);
  try {
    if (deleteTarget.type === 'folder') {
      const url = `${API_BASE_URL}/api/folders/${encodePath(deleteTarget.folderId)}`;
      await axios.delete(url, { headers: getAuthHeaders() });
      notify('Folder deleted');
      if (typeof goUpOneLevel === 'function') {
        await goUpOneLevel();
      } else {
        await fetchRootFolders();
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
      if (deleteTarget.images && typeof setSelectMode === 'function') setSelectMode(false);
    }
  } catch (err) {
    alert(`Delete failed: ${err.response?.data?.error || err.message}`);
  } finally {
    setDeleteTarget(null);
    setConfirmOpen(false);
    setDeleteLoading(false);
  }
}
