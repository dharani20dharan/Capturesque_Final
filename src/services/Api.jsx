// src/services/api.js
import axios from 'axios';
import { API_BASE_URL } from '../config/ApiConfig.jsx';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// attach token automatically if present
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
      }
    } catch (e) {
      // ignore
    }
    return config;
  },
  (err) => Promise.reject(err)
);

export default api;
