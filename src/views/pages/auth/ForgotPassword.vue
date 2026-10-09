<script setup>
import axios from 'axios';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';

const router = useRouter();
const toast = useToast();

const email = ref('');
const error = ref('');
const isSubmitting = ref(false);

// Obtener la URL del backend igual que en tu Login
const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://electroredes-api.test/api/v1';

const handleForgotPassword = async () => {
    error.value = '';

    if (!email.value.trim()) {
        error.value = 'El correo electrónico es requerido.';
        return;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
        error.value = 'Ingrese un formato de correo válido.';
        return;
    }

    isSubmitting.value = true;
    try {
        const response = await axios.post(`${API_URL}/forgot-password`, { 
            email: email.value.trim() 
        });

        toast.add({
            severity: 'success',
            summary: 'Enlace Enviado',
            detail: response.data.message || 'Revisa tu bandeja de entrada para restablecer tu contraseña.',
            life: 5000
        });

        email.value = '';
    } catch (err) {
        error.value = err.response?.data?.message || 'Ocurrió un error al enviar el correo.';
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.value,
            life: 4000
        });
    } finally {
        isSubmitting.value = false;
    }
};
</script>

<template>
    <div class="min-h-screen flex align-items-center justify-content-center p-4 surface-ground">
        <div class="surface-card p-5 border-round-2xl shadow-3 w-full max-w-28rem border-top-3" style="border-top-color: #D8AC67;">
            
            <div class="text-center mb-4">
                <div class="inline-flex border-round p-3 align-items-center justify-content-center mb-3 shadow-1" style="background-color: #2D62A3;">
                    <i class="pi pi-key text-3xl text-white"></i>
                </div>
                <div class="text-2xl font-black tracking-wide" style="color: #2D62A3;">
                    RECUPERAR <span style="color: #D8AC67;">CLAVE</span>
                </div>
                <p class="text-500 text-sm mt-1">Ingresa tu correo para enviarte un enlace de recuperación</p>
            </div>

            <form @submit.prevent="handleForgotPassword" class="p-fluid">
                <div class="field mb-4">
                    <label class="font-bold text-xs text-700 mb-2 block uppercase">Correo Electrónico</label>
                    <IconField iconPosition="left" class="w-full">
                        <InputIcon class="pi pi-envelope text-500" />
                        <InputText 
                            v-model="email" 
                            type="email" 
                            placeholder="ejemplo@electroredes.pe" 
                            :invalid="!!error"
                            class="w-full border-round-xl text-sm py-2" 
                        />
                    </IconField>
                    <small class="text-red-500 font-semibold mt-1 block" v-if="error">{{ error }}</small>
                </div>

                <Button 
                    type="submit" 
                    label="Enviar Enlace" 
                    icon="pi pi-send" 
                    class="w-full border-round-3xl py-2 shadow-1 mb-3" 
                    style="background-color: #2D62A3; border-color: #2D62A3; font-weight: bold;" 
                    :loading="isSubmitting" 
                />
            </form>

            <div class="text-center mt-3">
                <span class="text-xs text-500 cursor-pointer hover:text-900 font-bold" @click="router.push('/auth/login')">
                    <i class="pi pi-arrow-left text-xs mr-1"></i> Volver al Inicio de Sesión
                </span>
            </div>
        </div>
    </div>
</template>