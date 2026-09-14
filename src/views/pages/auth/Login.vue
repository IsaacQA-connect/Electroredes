<script setup>
import { useAuthStore } from '@/stores/auth';
import { useToast } from 'primevue/usetoast';
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Button from 'primevue/button';
import Divider from 'primevue/divider';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const toast = useToast();

const isSubmitting = ref(false);

const form = reactive({
    email: '',
    password: ''
});

const errors = reactive({
    email: '',
    password: ''
});

const validate = () => {
    let isValid = true;
    errors.email = '';
    errors.password = '';

    if (!form.email.trim()) {
        errors.email = 'El correo electrónico es requerido.';
        isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        errors.email = 'Ingrese un formato de correo válido.';
        isValid = false;
    }

    if (!form.password.trim()) {
        errors.password = 'La contraseña es requerida.';
        isValid = false;
    }

    return isValid;
};

const handleLogin = async () => {
    if (!validate()) return;

    isSubmitting.value = true;
    try {
        await authStore.login(form);

        toast.add({
            severity: 'success',
            summary: '¡Bienvenido!',
            detail: 'Sesión iniciada correctamente.',
            life: 3000
        });

        // 1. Obtener el rol guardado en localStorage o desde el store
        const userRole = (localStorage.getItem('user_role') || '').toUpperCase();
        
        // 2. Si hay una ruta de redirección previa, la respeta
        if (route.query.redirect) {
            return router.push(route.query.redirect);
        }

        // 3. Redirección basada en Rol
        if (['ADMINISTRADOR', 'VENDEDOR', 'ADMIN'].includes(userRole)) {
            router.push({ name: 'dashboard' }); // Redirige a /auth/dashboard
        } else {
            router.push({ name: 'catalog' });   // Redirige a / (Catálogo)
        }

    } catch (error) {
        if (error.response?.status === 422) {
            const apiErrors = error.response.data.errors || {};
            if (apiErrors.email) errors.email = apiErrors.email[0];
            if (apiErrors.password) errors.password = apiErrors.password[0];
        } else if (error.response?.status === 401) {
            toast.add({
                severity: 'error',
                summary: 'Acceso Denegado',
                detail: 'Las credenciales ingresadas son incorrectas.',
                life: 4000
            });
        } else {
            toast.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Ocurrió un problema al conectar con el servidor.',
                life: 4000
            });
        }
    } finally {
        isSubmitting.value = false;
    }
};

// Redirección hacia tu Backend para manejar OAuth2 / Laravel Socialite
const handleSocialLogin = (provider) => {
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
    window.location.href = `${backendUrl}/auth/${provider}/redirect`;
};
</script>

<template>
    <div class="min-h-screen flex align-items-center justify-content-center p-4 surface-ground">
        <div class="surface-card p-5 border-round-2xl shadow-3 w-full max-w-28rem border-top-3" style="border-top-color: #D8AC67;">
            
            <!-- IDENTIDAD E-COMMERCE -->
            <div class="text-center mb-4">
                <div class="inline-flex border-round p-3 align-items-center justify-content-center mb-3 shadow-1" style="background-color: #2D62A3;">
                    <i class="pi pi-bolt text-3xl text-white"></i>
                </div>
                <div class="text-2xl font-black tracking-wide" style="color: #2D62A3;">
                    ELECTRO<span style="color: #D8AC67;">REDES</span>
                </div>
                <p class="text-500 text-sm mt-1">Ingresa a tu cuenta institucional</p>
            </div>

            <!-- INICIO DE SESIÓN CON REDES SOCIALES (OAUTH) -->
            <div class="flex flex-column gap-2 mb-3">
                <Button 
                    type="button" 
                    outlined 
                    severity="secondary" 
                    class="w-full border-round-3xl flex align-items-center justify-content-center gap-2 py-2"
                    @click="handleSocialLogin('google')"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.27v3.14C3.25 21.27 7.31 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.62H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.38l4.01-3.14z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.73 1.27 6.62l4.01 3.14c.95-2.85 3.6-4.96 6.72-4.96z"/>
                    </svg>
                    <span class="font-bold text-sm text-700">Continuar con Google</span>
                </Button>

                <Button 
                    type="button" 
                    outlined 
                    severity="secondary" 
                    class="w-full border-round-3xl flex align-items-center justify-content-center gap-2 py-2"
                    @click="handleSocialLogin('microsoft')"
                >
                    <svg width="18" height="18" viewBox="0 0 23 23">
                        <path fill="#f35325" d="M1 1h10v10H1z"/>
                        <path fill="#81bc06" d="M12 1h10v10H12z"/>
                        <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                        <path fill="#ffba08" d="M12 12h10v10H12z"/>
                    </svg>
                    <span class="font-bold text-sm text-700">Continuar con Microsoft</span>
                </Button>
            </div>

            <Divider align="center" class="my-3">
                <span class="text-xs text-400 uppercase font-bold">o con tu correo</span>
            </Divider>

            <!-- FORMULARIO TRADICIONAL -->
            <form @submit.prevent="handleLogin" class="p-fluid">
                
                <!-- Correo Electrónico (Sintaxis PrimeVue 4) -->
                <div class="field mb-3">
                    <label class="font-bold text-xs text-700 mb-2 block uppercase">Correo Electrónico</label>
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="pi pi-envelope text-500" />
                        <InputText 
                            v-model="form.email" 
                            type="email" 
                            placeholder="ejemplo@electroredes.pe" 
                            :invalid="!!errors.email"
                            class="w-full border-round-xl text-sm py-2" 
                        />
                    </IconField>
                    <small class="text-red-500 font-semibold mt-1 block" v-if="errors.email">{{ errors.email }}</small>
                </div>

                <!-- Contraseña (con Toggle Mask) -->
                <div class="field mb-4">
                    <div class="flex justify-content-between align-items-center mb-2">
                        <label class="font-bold text-xs text-700 uppercase">Contraseña</label>
                        <a href="#" class="text-xs text-primary font-bold hover:underline" @click.prevent="router.push('/auth/forgot-password')">
                            ¿Olvidaste tu contraseña?
                        </a>
                    </div>
                    <Password 
                        v-model="form.password" 
                        :feedback="false" 
                        toggleMask 
                        placeholder="••••••••" 
                        :invalid="!!errors.password"
                        inputClass="w-full border-round-xl text-sm py-2"
                        class="w-full"
                    />
                    <small class="text-red-500 font-semibold mt-1 block" v-if="errors.password">{{ errors.password }}</small>
                </div>

                <!-- Botón Acción Principal -->
                <Button 
                    type="submit" 
                    label="Iniciar Sesión" 
                    icon="pi pi-sign-in" 
                    class="w-full border-round-3xl py-2 shadow-1" 
                    style="background-color: #2D62A3; border-color: #2D62A3; font-weight: bold;" 
                    :loading="isSubmitting" 
                />
            </form>

            <!-- NAVEGACIÓN SECUNDARIA -->
            <div class="text-center mt-4 pt-3 border-top-1 surface-border">
                <span class="text-600 text-sm">¿No tienes una cuenta? </span>
                <span class="font-bold text-sm cursor-pointer hover:underline" style="color: #2D62A3;" @click="router.push('/auth/register')">
                    Regístrate aquí
                </span>
            </div>

            <div class="text-center mt-3">
                <span class="text-xs text-500 cursor-pointer hover:text-900" @click="router.push('/catalog')">
                    <i class="pi pi-arrow-left text-xs mr-1"></i> Volver a la tienda
                </span>
            </div>
        </div>
    </div>
</template>