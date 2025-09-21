// src/config/apiConfig.js
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
export const ROOT_FOLDER = import.meta.env.VITE_ROOT_FOLDER || 'root_folder';
export const PAGE_SIZE = Number(import.meta.env.VITE_PAGE_SIZE) || 24;
export const FALLBACK_IMG = '/assets/fallback.png';
