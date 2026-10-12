<script setup>
import api from '@/service/api';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const cart = useCartStore();
const auth = useAuthStore();
const toast = useToast();

const loading = ref(false);

// Formulario de Envío
const shippingAddress = ref('');
const deliveryNotes = ref('');

// Formulario de Facturación / SUNAT
const invoiceType = ref('BOLETA'); // 'BOLETA' o 'FACTURA'
const documentNumber = ref('');
const businessName = ref('');

const invoiceOptions = [
    { label: 'Boleta de Venta', value: 'BOLETA' },
    { label: 'Factura Electrónica', value: 'FACTURA' }
];

// Formulario de Pago
const paymentMethod = ref('ONLINE_PAYMENT');
const transactionCode = ref('');

const paymentOptions = [
    { label: 'Pago en Línea / Tarjeta (Pasarela)', value: 'ONLINE_PAYMENT' },
    { label: 'Transferencia Bancaria / CCI', value: 'BANK_TRANSFER' },
    { label: 'Yape / Plin', value: 'Yape/Plin' },
    { label: 'Pago en Efectivo', value: 'CASH' }
];

// Totales
const total = computed(() => cart.totalPrice || 0);

// Precargar datos del usuario logueado
onMounted(() => {
    const customer = auth.user?.customer || auth.user;
    if (customer) {
        if (customer.address) shippingAddress.value = customer.address;
        if (customer.document_number) documentNumber.value = customer.document_number;
    }
});

// Limpiar o ajustar campos al alternar Boleta / Factura
watch(invoiceType, (newType) => {
    if (newType === 'BOLETA') {
        businessName.value = '';
    }
});

const processOrder = async () => {
    // 1. Validar Dirección
    if (!shippingAddress.value.trim()) {
        toast.add({ severity: 'warn', summary: 'Campo Requerido', detail: 'Ingresa la dirección de entrega.', life: 3500 });
        return;
    }

    // 2. Validar Carrito
    if (cart.items.length === 0) {
        toast.add({ severity: 'error', summary: 'Carrito Vacío', detail: 'No hay productos para procesar.', life: 3500 });
        return;
    }

    // 3. Validaciones de Facturación (SUNAT)
    const docNum = documentNumber.value.trim();

    if (invoiceType.value === 'BOLETA') {
        // Exigir DNI si la compra supera los S/ 700 o si fue ingresado un documento
        if (total.value >= 700 || docNum.length > 0) {
            if (!/^\d{8}$/.test(docNum)) {
                toast.add({ severity: 'warn', summary: 'DNI Inválido', detail: 'El DNI para la Boleta debe contener exactamente 8 dígitos numéricos.', life: 4000 });
                return;
            }
        }
    } else if (invoiceType.value === 'FACTURA') {
        if (!/^\d{11}$/.test(docNum)) {
            toast.add({ severity: 'warn', summary: 'RUC Inválido', detail: 'El RUC para la Factura debe contener exactamente 11 dígitos numéricos.', life: 4000 });
            return;
        }
        if (!businessName.value.trim()) {
            toast.add({ severity: 'warn', summary: 'Campo Requerido', detail: 'Ingresa la Razón Social para la emisión de la Factura.', life: 4000 });
            return;
        }
    }

    loading.value = true;

    // 4. Construir Payload para la API
    const payload = {
        channel: 'WEB',
        invoice_type: invoiceType.value,
        document_type: invoiceType.value === 'FACTURA' ? 'RUC' : 'DNI',
        document_number: docNum || null,
        business_name: invoiceType.value === 'FACTURA' ? businessName.value.trim() : null,
        notes: `Dirección: ${shippingAddress.value.trim()}` + (deliveryNotes.value ? ` | Notas: ${deliveryNotes.value.trim()}` : ''),
        details: cart.items.map(item => ({
            product_id: item.id,
            quantity: Number(item.quantity),
            unit_price: Number(item.sale_price || item.price || 0)
        })),
        payments: [
            {
                method: paymentMethod.value,
                amount: Number(total.value.toFixed(2)),
                transaction_code: paymentMethod.value === 'ONLINE_PAYMENT' ? null : (transactionCode.value.trim() || null)
            }
        ]
    };

    try {
        const response = await api.post('/orders', payload);
        const createdOrder = response.data.order || response.data.data || response.data;
        const orderId = createdOrder.id;

        // Redirección a Mercado Pago
        if (paymentMethod.value === 'ONLINE_PAYMENT') {
            const prefResponse = await api.post('/payments/create-preference', { order_id: orderId });
            const checkoutUrl = prefResponse.data.init_point;

            cart.clearCart();

            if (checkoutUrl) {
                window.location.href = checkoutUrl;
                return;
            } else {
                throw new Error('No se obtuvo la URL de pago de Mercado Pago.');
            }
        }

        // Pagos manuales
        toast.add({ severity: 'success', summary: '¡Pedido Realizado!', detail: 'Tu orden fue registrada correctamente.', life: 4000 });
        cart.clearCart();
        setTimeout(() => router.push('/catalog'), 2000);

    } catch (err) {
        console.error('Error al procesar pedido:', err);
        const responseData = err.response?.data;
        let errorMsg = responseData?.message || err.message || 'Error al procesar el pedido.';

        if (responseData?.details) {
            const detailStr = typeof responseData.details === 'object' 
                ? JSON.stringify(responseData.details) 
                : responseData.details;
            errorMsg += ` - ${detailStr}`;
        }

        toast.add({ severity: 'error', summary: 'Error de Procesamiento', detail: errorMsg, life: 6000 });
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
                <!-- Columna Izquierda: Datos del Cliente, Entrega y Pago -->
                <div class="col-12 md:col-7">

                    <!-- Comprobante de Pago -->
                    <div class="surface-card p-4 border-round-xl shadow-1 mb-4">
                        <h3 class="text-xl font-bold text-900 mb-3 border-bottom-1 surface-border pb-2">
                            <i class="pi pi-file mr-2" style="color: #2D62A3;"></i>
                            Comprobante de Pago
                        </h3>

                        <div class="field mb-3">
                            <label class="font-bold text-700 block mb-2">Tipo de Comprobante *</label>
                            <Select 
                                v-model="invoiceType" 
                                :options="invoiceOptions" 
                                optionLabel="label" 
                                optionValue="value" 
                                class="w-full" 
                            />
                        </div>

                        <!-- Campos para BOLETA -->
                        <div v-if="invoiceType === 'BOLETA'" class="field mb-3">
                            <label class="font-bold text-700 block mb-2">
                                DNI {{ total >= 700 ? '*' : '(Opcional para compras < S/ 700)' }}
                            </label>
                            <InputText 
                                v-model="documentNumber" 
                                placeholder="8 dígitos numéricos" 
                                maxlength="8"
                                class="w-full"
                            />
                            <small v-if="total >= 700" class="text-orange-600 block mt-1">
                                SUNAT exige DNI obligatorio para boletas de venta mayores a S/ 700.00
                            </small>
                        </div>

                        <!-- Campos para FACTURA -->
                        <div v-if="invoiceType === 'FACTURA'">
                            <div class="field mb-3">
                                <label class="font-bold text-700 block mb-2">Número de RUC *</label>
                                <InputText 
                                    v-model="documentNumber" 
                                    placeholder="11 dígitos numéricos" 
                                    maxlength="11"
                                    class="w-full"
                                />
                            </div>
                            <div class="field mb-3">
                                <label class="font-bold text-700 block mb-2">Razón Social *</label>
                                <InputText 
                                    v-model="businessName" 
                                    placeholder="Nombre de la Empresa S.A.C." 
                                    class="w-full"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Datos de Entrega -->
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

                    <!-- Método de Pago -->
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

                        <div v-if="paymentMethod !== 'ONLINE_PAYMENT'" class="field mb-3">
                            <label class="font-bold text-700 block mb-2">N° de Operación / Transacción</label>
                            <InputText 
                                v-model="transactionCode" 
                                placeholder="Ej: 987654321" 
                                class="w-full"
                            />
                            <small class="text-500 block mt-1">Si ya realizaste la transferencia o pago móvil, ingresa el código del comprobante.</small>
                        </div>

                        <div v-else class="p-3 border-round bg-blue-50 text-blue-800 text-sm flex align-items-center gap-2 mb-3">
                            <i class="pi pi-credit-card text-lg"></i>
                            <span>Serás redirigido al formulario seguro de la pasarela para ingresar los datos de tu tarjeta.</span>
                        </div>
                    </div>
                </div>

                <!-- Columna Derecha: Resumen del Pedido -->
                <div class="col-12 md:col-5">
                    <div class="surface-card p-4 border-round-xl shadow-1 sticky top-2">
                        <h3 class="text-xl font-bold text-900 mb-3 border-bottom-1 surface-border pb-2">Resumen</h3>

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
                            :label="paymentMethod === 'ONLINE_PAYMENT' ? 'Ir a Pagar' : 'Confirmar Pedido'" 
                            :icon="paymentMethod === 'ONLINE_PAYMENT' ? 'pi pi-credit-card' : 'pi pi-check'" 
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