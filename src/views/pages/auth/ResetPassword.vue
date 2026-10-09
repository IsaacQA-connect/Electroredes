<script setup>
import axios from 'axios';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Button from 'primevue/button';
import Password from 'primevue/password';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const isSubmitting = ref(false);

const form = reactive({
    token: '',
    email: '',
    password: '',
    password_confirmation: ''
});

const errors = reactive({
    password: '',
    password_confirmation: ''
});

const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://electroredes-api.test/api/v1';

onMounted(() => {
    form.token = route.query.token || '';
    form.email = route.query.email || '';
});

const validate = () => {
    let isValid = true;
    errors.password = '';
    errors.password_confirmation = '';

    if (!form.password || form.password.length < 8) {
        errors.password = 'La contraseña debe tener al menos 8 caracteres.';
        isValid = false;
    }

    if (form.password !== form.password_confirmation) {
        errors.password_confirmation = 'Las contraseñas no coinciden.';
        isValid = false;
    }

    return isValid;
};

const handleResetPassword = async () => {
    if (!validate()) return;

    isSubmitting.value = true;
    try {
        const response = await axios.post(`${API_URL}/reset-password`, form);

        toast.add({
            severity: 'success',
            summary: '¡Éxito!',
            detail: response.data.message || 'Tu contraseña ha sido restablecida.',
            life: 3000
        });

        setTimeout(() => {
            router.push('/auth/login');
        }, 2000);
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: err.response?.data?.message || 'Error al restablecer la contraseña.',
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
                    <i class="pi pi-lock text-3xl text-white"></i>
                </div>
                <div class="text-2xl font-black tracking-wide" style="color: #2D62A3;">
                    NUEVA <span style="color: #D8AC67;">CONTRASEÑA</span>
                </div>
                <p class="text-500 text-sm mt-1">Ingresa tu nueva clave de acceso</p>
            </div>

            <form @submit.prevent="handleResetPassword" class="p-fluid">
                <!-- Nueva Contraseña -->
                <div class="field mb-3">
                    <label class="font-bold text-xs text-700 uppercase mb-2 block">Nueva Contraseña</label>
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

                <!-- Confirmar Contraseña -->
                <div class="field mb-4">
                    <label class="font-bold text-xs text-700 uppercase mb-2 block">Confirmar Contraseña</label>
                    <Password 
                        v-model="form.password_confirmation" 
                        :feedback="false" 
                        toggleMask 
                        placeholder="••••••••" 
                        :invalid="!!errors.password_confirmation"
                        inputClass="w-full border-round-xl text-sm py-2"
                        class="w-full"
                    />
                    <small class="text-red-500 font-semibold mt-1 block" v-if="errors.password_confirmation">{{ errors.password_confirmation }}</small>
                </div>

                <Button 
                    type="submit" 
                    label="Actualizar Contraseña" 
                    icon="pi pi-check-circle" 
                    class="w-full border-round-3xl py-2 shadow-1" 
                    style="background-color: #2D62A3; border-color: #2D62A3; font-weight: bold;" 
                    :loading="isSubmitting" 
                />
            </form>
        </div>
    </div>
</template>