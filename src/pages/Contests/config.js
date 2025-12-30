// This file can be used for shared constants if needed.
// The code from the original file is commented out but can be moved here.
export const API_BASE_URL = 'http://150.230.138.173:8087';
export const API_BASE_URL_CONTEST = 'http://150.230.138.173:8087';
export const ROOT_FOLDER = 'Contests';
export const PAGE_SIZE = 24;
export const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
      <rect width="100%" height="100%" fill="#222"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#aaa" font-size="14" font-family="sans-serif">image unavailable</text>
     </svg>`
  );