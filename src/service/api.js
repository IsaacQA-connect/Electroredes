import axios from 'axios';

const api = axios.create({
    baseURL: 'http://electroredes-api.test/api/v1'  || import.meta.env.VITE_API_BASE_URL || 'https://apielectroredes.soportecenter.com/api/v1', // Tu backend Laravel
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