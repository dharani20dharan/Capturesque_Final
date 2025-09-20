// fetchRootFolders.js
import axios from "axios";
import { API_BASE_URL, ROOT_FOLDER } from "../../config.js";
import { encodePath } from "../../helper.js";

export default async function fetchRootFoldersFn({ setLoading, setError, setFolders }) {
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
}
