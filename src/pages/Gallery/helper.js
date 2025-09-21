// All helper functions from the original file go here.
export const encodePath = (path = '') =>
  path
    .split('/')
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join('/');

export const normalizePathParts = (p = '') =>
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

export const getRelFolderFromImageUrl = (url) => {
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
    const p = (url.split('/api/image/')[1] || '').split('?')[0];
    const parts = p.split('/').filter(Boolean);
    if (parts.length <= 1) return '';
    parts.pop();
    return parts.join('/');
  }
};

function base64UrlDecode(input) {
  try {
    const pad = '='.repeat((4 - (input.length % 4)) % 4);
    const base64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    try { return decodeURIComponent([...decoded].map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')); }
    catch { return decoded; }
  } catch {
    return '';
  }
}

function decodeJwt(token) {
  if (!token || typeof token !== 'string' || token.split('.').length < 2) return null;
  try {
    const payload = token.split('.')[1];
    const json = base64UrlDecode(payload);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getCurrentUser() {
  const token = localStorage.getItem('token');
  const userStoredValue = localStorage.getItem('userRole');
  if (!token) return null;
  const p = decodeJwt(token);
  if (!p) return null;
  const role = p.role || (userStoredValue == "admin" ? 'admin' : 'user');
  return { ...p, role, token };
}