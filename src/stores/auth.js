import api from '@/service/api';
import { defineStore } from 'pinia';
import { useCartStore } from './cart';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: JSON.parse(localStorage.getItem('user')) || null,
        token: localStorage.getItem('token') || null,
        role: localStorage.getItem('user_role') || null,
    }),

    getters: {
        // Getter reactivo para consultar el estado de la sesión
        isAuthenticated: (state) => !!state.token,
    },

    actions: {
        async login(credentials) {
            const response = await api.post('/auth/login', credentials);
            
            const token = response.data.token;
            const user = response.data.user;
            const role = user.role?.name || user.role || 'CLIENTE';

            this.setAuthData({ token, user, role });
        },

        // Nueva acción: Registra sesión reactivamente (usado por Google OAuth)
        setAuthData({ token, user = null, role = 'CLIENTE' }) {
            this.token = token;
            this.role = (role || 'CLIENTE').toUpperCase();
            
            if (user) {
                this.user = user;
                localStorage.setItem('user', JSON.stringify(user));
            }

            localStorage.setItem('token', token);
            localStorage.setItem('user_role', this.role);
        },

        // Cargar los datos del usuario autenticado desde el backend (/me)
        async fetchUser() {
            if (!this.token) return;
            try {
                const response = await api.get('/auth/me');
                this.user = response.data;
                localStorage.setItem('user', JSON.stringify(response.data));
            } catch (error) {
                this.logout();
            }
        },

        logout() {
            this.token = null;
            this.user = null;
            this.role = null;

            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('user_role');

            const cartStore = useCartStore();
            cartStore.clearCart();

            if (this.router) {
                this.router.push('/auth/login');
            }
        }
    }
});