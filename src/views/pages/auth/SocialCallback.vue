<script setup>
import { useAuthStore } from '@/stores/auth';
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
        // 1. Registrar token y rol en Pinia (esto actualiza localStorage Y el estado reactivo)
        authStore.setAuthData({ token, role });

        // 2. Cargar datos del usuario desde el backend (/me)
        if (authStore.fetchUser) {
            await authStore.fetchUser();
        }

        toast.add({
            severity: 'success',
            summary: '¡Bienvenido!',
            detail: 'Iniciaste sesión con Google correctamente.',
            life: 3000
        });

        // 3. Redirigir según el rol
        const normalizedRole = (role || '').toUpperCase();
        if (['ADMINISTRADOR', 'VENDEDOR', 'ADMIN'].includes(normalizedRole)) {
            router.push({ name: 'dashboard' });
        } else {
            router.push({ name: 'catalog' });
        }
    } else {
        router.push('/auth/login');
    }
});
</script>