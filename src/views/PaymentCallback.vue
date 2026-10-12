<script setup>
import api from '@/service/api';
import { useCartStore } from '@/stores/cart';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';

const route = useRoute();
const router = useRouter();
const cart = useCartStore();

const loading = ref(true);
const success = ref(false);
const orderId = ref(null);
const errorMessage = ref('');

onMounted(async () => {
    // Parámetros retornados por Mercado Pago en la URL
    const paymentId = route.query.payment_id || route.query.collection_id;
    const status = route.query.status || route.query.collection_status;
    const externalRef = route.query.external_reference;

    orderId.value = externalRef;

    if (!paymentId || !externalRef) {
        loading.value = false;
        errorMessage.value = 'No se encontraron datos de transacción en la llamada.';
        return;
    }

    try {
        // Confirmar el pago en el Backend
        await api.post('/payments/confirm', {
            order_id: externalRef,
            payment_id: paymentId,
            status: status
        });

        // Limpiar el carrito de compras
        cart.clearCart();

        if (status === 'approved' || status === 'success') {
            success.value = true;
        } else {
            errorMessage.value = 'El pago se encuentra pendiente o fue rechazado.';
        }
    } catch (error) {
        console.error('Error al confirmar pago:', error);
        errorMessage.value = 'Hubo un inconveniente al verificar tu pago. Sin embargo, procesaremos la notificación en segundo plano.';
    } finally {
        loading.value = false;
    }
});
</script>

<template>
    <div class="min-h-screen surface-ground flex align-items-center justify-content-center p-4">
        <div class="surface-card p-5 border-round-2xl shadow-2 text-center max-w-28rem w-full">
            
            <!-- Carga -->
            <div v-if="loading" class="py-4">
                <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
                <h3 class="text-xl font-bold text-900 mt-3 mb-1">Verificando tu Pago</h3>
                <p class="text-600 text-sm m-0">Estamos procesando tu comprobante con Mercado Pago y SUNAT...</p>
            </div>

            <!-- Éxito -->
            <div v-else-if="success" class="py-2">
                <div class="w-4rem h-4rem border-circle bg-green-100 inline-flex align-items-center justify-content-center mb-3">
                    <i class="pi pi-check-circle text-4xl text-green-600"></i>
                </div>
                <h3 class="text-2xl font-bold text-900 mb-2">¡Pago Confirmado!</h3>
                <p class="text-600 text-sm mb-4">
                    Tu orden <strong>#{{ orderId }}</strong> ha sido pagada con éxito y tu comprobante electrónico ha sido generado.
                </p>
                <div class="flex flex-column gap-2">
                    <Button 
                        label="Ver mis Compras y Comprobantes" 
                        icon="pi pi-box" 
                        class="border-round-3xl border-none font-bold py-3"
                        style="background-color: #2D62A3;"
                        @click="router.push('/my-orders')" 
                    />
                    <Button 
                        label="Volver al Catálogo" 
                        text 
                        class="border-round-3xl"
                        @click="router.push('/catalog')" 
                    />
                </div>
            </div>

            <!-- Error / Pendiente -->
            <div v-else class="py-2">
                <div class="w-4rem h-4rem border-circle bg-orange-100 inline-flex align-items-center justify-content-center mb-3">
                    <i class="pi pi-exclamation-triangle text-4xl text-orange-600"></i>
                </div>
                <h3 class="text-2xl font-bold text-900 mb-2">Estado de la Transacción</h3>
                <p class="text-600 text-sm mb-4">{{ errorMessage }}</p>
                <div class="flex flex-column gap-2">
                    <Button 
                        label="Ir a Mis Compras" 
                        icon="pi pi-box" 
                        class="border-round-3xl font-bold py-3"
                        severity="secondary"
                        @click="router.push('/my-orders')" 
                    />
                    <Button 
                        label="Reintentar Pago" 
                        icon="pi pi-refresh"
                        outlined
                        class="border-round-3xl"
                        @click="router.push('/cart')" 
                    />
                </div>
            </div>

        </div>
    </div>
</template>