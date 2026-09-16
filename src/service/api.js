import axios from 'axios';

// Detecta si estás en desarrollo local o en producción
const baseURL = import.meta.env.DEV
    ? 'http://electroredes-api.test/api/v1' 
    : (import.meta.env.VITE_API_BASE_URL || 'https://apielectroredes.soportecenter.com/api/v1');

const api = axios.create({
    baseURL: baseURL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;