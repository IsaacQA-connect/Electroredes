<script setup>
import { useAuthStore } from '@/stores/auth';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

onMounted(async () => {
    const token = route.query.token;
    const role = route.query.role;
    const error = route.query.error;

    if (error) {
        toast.add({
            severity: 'error',
            summary: 'Error de Autenticación',
            detail: 'No se pudo iniciar sesión con Google.',
            life: 4000
        });
        return router.push('/auth/login');
    }

    if (token) {
        // Guardar token y rol en localStorage
        localStorage.setItem('token', token);
        if (role) localStorage.setItem('user_role', role);

        // Cargar datos del usuario en la tienda de Pinia si existe el método fetchUser
        if (authStore.fetchUser) {
            await authStore.fetchUser();
        }

        toast.add({
            severity: 'success',
            summary: '¡Bienvenido!',
            detail: 'Iniciaste sesión con Google correctamente.',
            life: 3000
        });

        // Redirigir según el rol
        if (['ADMINISTRADOR', 'VENDEDOR', 'ADMIN'].includes(role)) {
            router.push({ name: 'dashboard' });
        } else {
            router.push({ name: 'catalog' });
        }
    } else {
        router.push('/auth/login');
    }
});
</script>

<template>
    <div class="min-h-screen flex align-items-center justify-content-center p-4 surface-ground">
        <div class="surface-card p-5 border-round-2xl shadow-3 text-center border-top-3" style="border-top-color: #D8AC67;">
            <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" fill="var(--surface-ground)" animationDuration=".8s" />
            <h2 class="text-xl font-bold mt-3 text-900">Procesando inicio de sesión...</h2>
            <p class="text-500 text-sm mt-1">Por favor espera un momento mientras validamos tu cuenta con Google.</p>
        </div>
    </div>
</template>