import api from '@/service/api';
import { defineStore } from 'pinia';

import { useCartStore } from './cart'; // 1. Importar el store del carrito

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: JSON.parse(localStorage.getItem('user')) || null,
        token: localStorage.getItem('token') || null,
        role: localStorage.getItem('user_role') || null,
    }),
    actions: {
        async login(credentials) {
            const response = await api.post('/auth/login', credentials);
            
            const token = response.data.token;
            const user = response.data.user;
            // Manejar variaciones de la respuesta de tu backend (role, role_name, etc.)
            const role = user.role?.name || user.role || 'CLIENTE';

            this.token = token;
            this.user = user;
            this.role = role.toUpperCase();

            // Persistencia en LocalStorage
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('user_role', this.role);
        },
        logout() {
            this.token = null;
            this.user = null;
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // 3. Forzar la limpieza física del carrito en memoria y en LocalStorage
            const cartStore = useCartStore();
            cartStore.clearCart();

            // 4. Redirigir al Login
            if (this.router) {
                this.router.push('/auth/login');
            }
        }
    }
});