<script setup>
import axios from 'axios';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const loading = ref(true);
const success = ref(false);
const message = ref('Verificando tu correo electrónico...');

onMounted(async () => {
    const verifyUrl = route.query.url;

    if (!verifyUrl) {
        loading.value = false;
        message.value = 'Enlace de verificación no válido o ausente.';
        return;
    }

    try {
        const response = await axios.get(verifyUrl);
        success.value = true;
        message.value = response.data.message || '¡Correo verificado con éxito!';

        toast.add({
            severity: 'success',
            summary: 'Verificación Completada',
            detail: message.value,
            life: 4000
        });

        setTimeout(() => {
            router.push('/auth/login');
        }, 2500);
    } catch (err) {
        success.value = false;
        message.value = err.response?.data?.message || 'El enlace ha expirado o no es válido.';

        toast.add({
            severity: 'error',
            summary: 'Error de Verificación',
            detail: message.value,
            life: 4000
        });
    } finally {
        loading.value = false;
    }
});
</script>

<template>
    <div class="min-h-screen flex align-items-center justify-content-center p-4 surface-ground">
        <div class="surface-card p-5 border-round-2xl shadow-3 w-full max-w-28rem text-center border-top-3" style="border-top-color: #D8AC67;">
            
            <div v-if="loading" class="py-4">
                <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" fill="var(--surface-ground)" animationDuration=".8s" />
                <p class="text-700 font-semibold mt-3 text-sm">{{ message }}</p>
            </div>

            <div v-else class="py-2">
                <div class="inline-flex border-circle p-3 align-items-center justify-content-center mb-3" :class="success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'">
                    <i class="pi text-4xl" :class="success ? 'pi-check-circle' : 'pi-times-circle'"></i>
                </div>

                <h2 class="text-xl font-bold mb-2 text-900">
                    {{ success ? '¡Cuenta Verificada!' : 'Error de Verificación' }}
                </h2>
                <p class="text-600 text-sm mb-4">{{ message }}</p>

                <Button 
                    label="Ir al Inicio de Sesión" 
                    icon="pi pi-sign-in" 
                    class="w-full border-round-3xl py-2 shadow-1" 
                    style="background-color: #2D62A3; border-color: #2D62A3; font-weight: bold;" 
                    @click="router.push('/auth/login')" 
                />
            </div>
        </div>
    </div>
</template>