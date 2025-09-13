// src/components/config.js

/**
 * This file contains the configuration constants for the application.
 * It centralizes values like the API base URL, the root folder name,
 * pagination size, and a fallback image placeholder.
 */
let API_BASE_URL = 'http://150.230.138.173:8087';

if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
  API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
} else if (typeof process !== 'undefined' && process.env?.REACT_APP_API_BASE_URL) {
  API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
}

export const ROOT_FOLDER = 'Gallery';
export const PAGE_SIZE = 24;

export const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
       <rect width="100%" height="100%" fill="#222"/>
       <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#aaa" font-size="14" font-family="sans-serif">image unavailable</text>
     </svg>`
  );

export { API_BASE_URL };
