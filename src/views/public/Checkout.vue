<script setup>
import api from '@/service/api';
import { useCartStore } from '@/stores/cart';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const cart = useCartStore();
const toast = useToast();

const loading = ref(false);

// Formulario local
const shippingAddress = ref('');
const deliveryNotes = ref('');
const paymentMethod = ref('BANK_TRANSFER');
const transactionCode = ref('');


// Métodos de Pago disponibles
const paymentOptions = [
    { label: 'Transferencia Bancaria / CCI', value: 'BANK_TRANSFER' },
    { label: 'Yape / Plin', value: 'Yape/Plin' },
    { label: 'Pago en Efectivo', value: 'CASH' },
    { label: 'Pago en Línea / Tarjeta', value: 'ONLINE_PAYMENT' }
];

// Totales
const total = computed(() => cart.totalPrice || 0);

const processOrder = async () => {
    if (!shippingAddress.value.trim()) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'Ingresa la dirección de entrega', life: 3000 });
        return;
    }

    if (cart.items.length === 0) {
        toast.add({ severity: 'error', summary: 'Carrito vacío', detail: 'No hay productos para procesar', life: 3000 });
        return;
    }

    loading.value = true;

    // 1. Construir payload estricto para StoreOrderRequest
    const payload = {
        channel: 'WEB',
        notes: `Dirección: ${shippingAddress.value.trim()}` + (deliveryNotes.value ? ` | Notas: ${deliveryNotes.value.trim()}` : ''),
        details: cart.items.map(item => ({
            product_id: item.id,
            quantity: Number(item.quantity)
        })),
        payments: [
            {
                method: paymentMethod.value,
                amount: Number(total.value.toFixed(2)),
                transaction_code: transactionCode.value.trim() || null
            }
        ]
    };

    try {
        const response = await api.post('/orders', payload);
        
        toast.add({ 
            severity: 'success', 
            summary: '¡Pedido Realizado!', 
            detail: response.data.message || 'Tu orden ha sido registrada con éxito.', 
            life: 4000 
        });

        // Vaciar carrito y redirigir
        cart.clearCart();
        
        setTimeout(() => {
            router.push('/catalog');
        }, 2000);

    } catch (err) {
        console.error('Error al procesar orden:', err);
        const errorMsg = err.response?.data?.message || 'Ocurrió un error al registrar el pedido.';
        toast.add({ severity: 'error', summary: 'Error de Procesamiento', detail: errorMsg, life: 4000 });
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="min-h-screen surface-ground py-5 px-4">
        <Toast />
        <div class="mx-auto" style="max-width: 1000px;">
            
            <div class="flex align-items-center gap-2 mb-4">
                <Button icon="pi pi-arrow-left" text rounded severity="secondary" @click="router.push('/cart')" />
                <h2 class="text-3xl font-bold text-900 m-0">Finalizar Compra</h2>
            </div>

            <div class="grid">
                <!-- Formulario de Envío y Pago -->
                <div class="col-12 md:col-7">
                    <div class="surface-card p-4 border-round-xl shadow-1 mb-4">
                        <h3 class="text-xl font-bold text-900 mb-3 border-bottom-1 surface-border pb-2">
                            <i class="pi pi-map-marker mr-2" style="color: #2D62A3;"></i>
                            Datos de Entrega
                        </h3>

                        <div class="field mb-3">
                            <label class="font-bold text-700 block mb-2">Dirección de Envío *</label>
                            <InputText 
                                v-model="shippingAddress" 
                                placeholder="Ej: Av. Las Flores 123, Dpto 402, San Isidro" 
                                class="w-full"
                            />
                        </div>

                        <div class="field mb-3">
                            <label class="font-bold text-700 block mb-2">Notas de Entrega (Opcional)</label>
                            <Textarea 
                                v-model="deliveryNotes" 
                                rows="2" 
                                autoResize 
                                placeholder="Referencia de la vivienda o instrucciones de recepción..." 
                                class="w-full"
                            />
                        </div>
                    </div>

                    <div class="surface-card p-4 border-round-xl shadow-1">
                        <h3 class="text-xl font-bold text-900 mb-3 border-bottom-1 surface-border pb-2">
                            <i class="pi pi-wallet mr-2" style="color: #2D62A3;"></i>
                            Método de Pago
                        </h3>

                        <div class="field mb-3">
                            <label class="font-bold text-700 block mb-2">Forma de Pago</label>
                            <Select 
                                v-model="paymentMethod" 
                                :options="paymentOptions" 
                                optionLabel="label" 
                                optionValue="value" 
                                class="w-full" 
                            />
                        </div>

                        <div class="field mb-3">
                            <label class="font-bold text-700 block mb-2">N° de Operación / Transacción</label>
                            <InputText 
                                v-model="transactionCode" 
                                placeholder="Ej: 987654321" 
                                class="w-full"
                            />
                            <small class="text-500 block mt-1">Si ya realizaste la transferencia o pago móvil, ingresa el código del comprobante.</small>
                        </div>
                    </div>
                </div>

                <!-- Resumen de Pedido -->
                <div class="col-12 md:col-5">
                    <div class="surface-card p-4 border-round-xl shadow-1 sticky top-2">
                        <h3 class="text-xl font-bold text-900 mb-3 border-bottom-1 surface-border pb-2">Resumen</h3>

                        <!-- Items resumidos -->
                        <div class="max-h-15rem overflow-y-auto mb-3">
                            <div v-for="item in cart.items" :key="item.id" class="flex justify-content-between align-items-center mb-2 pb-2 border-bottom-1 surface-border">
                                <div>
                                    <span class="font-bold text-900 block text-sm">{{ item.name }}</span>
                                    <small class="text-600">Cant: {{ item.quantity }}</small>
                                </div>
                                <span class="font-semibold text-900 text-sm">
                                    S/ {{ (Number(item.sale_price || item.price) * item.quantity).toFixed(2) }}
                                </span>
                            </div>
                        </div>

                        <div class="border-top-1 surface-border pt-3">
                            <div class="flex justify-content-between mb-2">
                                <span class="text-600">Total a pagar</span>
                                <span class="text-2xl font-bold" style="color: #2D62A3;">
                                    S/ {{ total.toFixed(2) }}
                                </span>
                            </div>
                        </div>

                        <Button 
                            label="Confirmar y Pagar" 
                            icon="pi pi-check" 
                            :loading="loading"
                            class="w-full border-round-3xl border-none py-3 mt-4 font-bold text-lg shadow-2"
                            style="background-color: #D8AC67; color: #1A1D20;"
                            @click="processOrder" 
                        />
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>