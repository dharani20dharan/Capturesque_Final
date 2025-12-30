// fetchSubfolders.js
import axios from 'axios';
import { API_BASE_URL } from '../config.js';
import { encodePath } from '../helper.js';

export default async function fetchSubfolders(folderId, setSubfolders) {
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
}
