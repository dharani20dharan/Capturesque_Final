// fetchImages.js
import axios from 'axios';
import { API_BASE_URL, PAGE_SIZE } from "../../config.js";
import { encodePath, normalizePathParts, getRelFolderFromImageUrl } from "../../helper.js";


export default async function fetchImagesFn({
  folderId,
  setLoading,
  setError,
  setImagesAll,
  setVisibleCount,
  setSelectedIds,
}) {
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
}
