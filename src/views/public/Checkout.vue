<script setup>
import api from '@/service/api';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const cart = useCartStore();
const auth = useAuthStore();
const toast = useToast();

const loading = ref(false);
const searchingDoc = ref(false);
const lastFetchedDoc = ref('');
const sunatStatus = ref(null);

// Respaldo de datos guardados en Mi Perfil para alternar entre Boleta y Factura sin perderlos
const profileBackup = ref({
    dni: '',
    dniName: '',
    ruc: '',
    rucName: '',
    address: '',
    phone: ''
});

// Formulario de Envío
const shippingAddress = ref('');
const contactPhone = ref('');
const deliveryNotes = ref('');

// Formulario de Facturación / SUNAT
const invoiceType = ref('BOLETA'); // 'BOLETA' o 'FACTURA'
const documentNumber = ref('');
const customerName = ref(''); // Nombre titular DNI (referencial para Boleta)
const businessName = ref(''); // Razón Social (obligatorio para Factura)

const invoiceOptions = [
    { label: 'Boleta de Venta', value: 'BOLETA' },
    { label: 'Factura Electrónica', value: 'FACTURA' }
];

// Formulario de Pago
const paymentMethod = ref('ONLINE_PAYMENT');
const transactionCode = ref('');

const paymentOptions = [
    { label: 'Pago en Línea / Tarjeta (Pasarela)', value: 'ONLINE_PAYMENT' },
    //{ label: 'Transferencia Bancaria / CCI', value: 'BANK_TRANSFER' },
    //{ label: 'Yape / Plin', value: 'Yape/Plin' },
    //{ label: 'Pago en Efectivo', value: 'CASH' }
];

// Totales y Reglas SUNAT
const total = computed(() => Number(cart.totalPrice || 0));
const requiresDniBySunat = computed(() => invoiceType.value === 'BOLETA' && total.value > 700);

const maxDocumentLength = computed(() => (invoiceType.value === 'FACTURA' ? 11 : 8));

const canLookupDocument = computed(() => {
    const clean = documentNumber.value.trim();
    if (invoiceType.value === 'BOLETA') return /^\d{8}$/.test(clean);
    if (invoiceType.value === 'FACTURA') return /^\d{11}$/.test(clean);
    return false;
});

// Precargar datos registrados en Mi Perfil
const autoFilledAddress = ref(false);

const loadProfileData = () => {
    const rawUser = auth.user;
    const user = rawUser?.user || rawUser;
    const customer = user?.customer;
    if (!user) return;

    // 1. Datos de Entrega desde BD
    if (customer?.address) {
        shippingAddress.value = customer.address;
        profileBackup.value.address = customer.address;
        autoFilledAddress.value = false;
    }
    if (customer?.phone) {
        contactPhone.value = customer.phone.replace(/\D/g, '').slice(0, 9);
        profileBackup.value.phone = contactPhone.value;
    }

    // 2. Datos de Comprobante (DNI o RUC registrado en Mi Perfil)
    const docType = (customer?.document_type || '').toUpperCase();
    const docNum = (customer?.document_number || '').replace(/\D/g, '');
    const fullName = user.name || customer?.name || '';

    if (docType === 'DNI' && /^\d{8}$/.test(docNum)) {
        profileBackup.value.dni = docNum;
        profileBackup.value.dniName = fullName;
        invoiceType.value = 'BOLETA';
        documentNumber.value = docNum;
        customerName.value = fullName;
        lastFetchedDoc.value = docNum; // Permite limpiar el nombre si edita el DNI
    } else if (docType === 'RUC' && /^\d{11}$/.test(docNum)) {
        profileBackup.value.ruc = docNum;
        profileBackup.value.rucName = fullName;
        invoiceType.value = 'FACTURA';
        documentNumber.value = docNum;
        businessName.value = fullName;
        lastFetchedDoc.value = docNum; // Permite limpiar la razón social si edita el RUC
    }
};

onMounted(async () => {
    loadProfileData();       // Carga inmediata desde caché si existe
    await auth.fetchUser();  // Trae los datos frescos de GET /auth/me (users + customer)
    loadProfileData();       // Actualiza los campos con lo último guardado en BD
});

// Alternar entre Boleta y Factura restaurando el documento del perfil si existe
watch(invoiceType, (newType) => {
    lastFetchedDoc.value = '';
    sunatStatus.value = null;

    if (newType === 'BOLETA') {
        businessName.value = '';
        documentNumber.value = profileBackup.value.dni || '';
        customerName.value = profileBackup.value.dniName || '';
    } else if (newType === 'FACTURA') {
        customerName.value = '';
        documentNumber.value = profileBackup.value.ruc || '';
        businessName.value = profileBackup.value.rucName || '';
    }
});

// Bloquear teclas que no sean números (0-9)
const onlyNumbers = (event) => {
    if (event.ctrlKey || event.metaKey) return;
    if (!/^\d$/.test(event.key)) {
        event.preventDefault();
    }
};

// Limpiar datos de búsquedas anteriores
const clearPreviousLookup = () => {
    if (lastFetchedDoc.value) {
        customerName.value = '';
        businessName.value = '';
        if (autoFilledAddress.value) {
            shippingAddress.value = profileBackup.value.address || '';
            autoFilledAddress.value = false;
        }
        lastFetchedDoc.value = '';
    }
    sunatStatus.value = null;
};

// Consulta DNI / RUC en RENIEC / SUNAT
const lookupDocument = async () => {
    if (!canLookupDocument.value || searchingDoc.value) return;

    clearPreviousLookup();
    searchingDoc.value = true;

    const docNum = documentNumber.value.trim();
    const isFactura = invoiceType.value === 'FACTURA';
    const endpoint = isFactura ? `/lookup/ruc/${docNum}` : `/lookup/dni/${docNum}`;

    try {
        const response = await api.get(endpoint);
        const resData = response.data;
        const raw = resData.raw || resData.data || resData;

        let resolvedName = resData.name || '';
        let fiscalAddress = resData.address || '';

        if (!resolvedName) {
            if (!isFactura) {
                resolvedName = [raw.nombres, raw.apellidoPaterno, raw.apellidoMaterno]
                    .filter(Boolean)
                    .join(' ')
                    .trim();
            } else {
                resolvedName = raw.razonSocial || '';
                fiscalAddress = raw.direccion || '';
            }
        }

        if (resolvedName) {
            lastFetchedDoc.value = docNum;
            if (isFactura) {
                businessName.value = resolvedName;
            } else {
                customerName.value = resolvedName;
            }
        }

        if (isFactura) {
            // Si el usuario no tiene dirección de entrega aún, autocompletar con la fiscal
            if (!shippingAddress.value.trim() && fiscalAddress && fiscalAddress !== '-') {
                shippingAddress.value = fiscalAddress;
                autoFilledAddress.value = true;
            }
            if (raw.estado || raw.condicion || resData.state || resData.condition) {
                sunatStatus.value = {
                    estado: resData.state || raw.estado || '',
                    condicion: resData.condition || raw.condicion || ''
                };
            }
        }

        toast.add({
            severity: 'success',
            summary: `${isFactura ? 'RUC' : 'DNI'} Encontrado`,
            detail: resolvedName || 'Datos cargados correctamente.',
            life: 2500
        });
    } catch (error) {
        toast.add({
            severity: 'warn',
            summary: 'Sin resultados',
            detail: error.response?.data?.message || `No se encontraron datos para el ${isFactura ? 'RUC' : 'DNI'}. Puedes ingresarlo manualmente.`,
            life: 3500
        });
    } finally {
        searchingDoc.value = false;
    }
};

const onDocumentNumberInput = () => {
    documentNumber.value = documentNumber.value.replace(/\D/g, '');

    if (lastFetchedDoc.value && documentNumber.value !== lastFetchedDoc.value) {
        clearPreviousLookup();
    }

    if (canLookupDocument.value) {
        lookupDocument();
    }
};

const onPhoneInput = () => {
    contactPhone.value = contactPhone.value.replace(/\D/g, '');
};

const processOrder = async () => {
    // 1. Validar Carrito
    if (cart.items.length === 0) {
        toast.add({ severity: 'error', summary: 'Carrito Vacío', detail: 'No hay productos para procesar.', life: 3500 });
        return;
    }

    // 2. Validaciones de Facturación según Normativa SUNAT
    const docNum = documentNumber.value.trim();

    if (invoiceType.value === 'BOLETA') {
        if (total.value > 700 && !/^\d{8}$/.test(docNum)) {
            toast.add({
                severity: 'warn',
                summary: 'DNI Obligatorio (Normativa SUNAT)',
                detail: 'Por normativa de SUNAT, las boletas de venta que superan los S/ 700.00 requieren registrar el DNI (8 dígitos) del cliente antes de pagar.',
                life: 5500
            });
            return;
        }
        if (docNum.length > 0 && !/^\d{8}$/.test(docNum)) {
            toast.add({
                severity: 'warn',
                summary: 'DNI Inválido',
                detail: 'Si deseas registrar un DNI en la Boleta, debe tener exactamente 8 dígitos numéricos.',
                life: 4000
            });
            return;
        }
    } else if (invoiceType.value === 'FACTURA') {
        if (!/^\d{11}$/.test(docNum)) {
            toast.add({
                severity: 'warn',
                summary: 'RUC Obligatorio (Normativa SUNAT)',
                detail: 'Para emitir Factura Electrónica se requiere obligatoriamente un RUC válido de 11 dígitos, sin importar el monto de compra.',
                life: 5000
            });
            return;
        }
        if (!businessName.value.trim()) {
            toast.add({
                severity: 'warn',
                summary: 'Razón Social Requerida',
                detail: 'Ingresa o consulta la Razón Social asociada al RUC antes de continuar.',
                life: 4000
            });
            return;
        }
    }

    // 3. Validar Dirección de Entrega
    if (!shippingAddress.value.trim()) {
        toast.add({ severity: 'warn', summary: 'Campo Requerido', detail: 'Ingresa la dirección de entrega.', life: 3500 });
        return;
    }

    loading.value = true;

    // 4. Construir Payload para la API
    const notesParts = [`Dirección: ${shippingAddress.value.trim()}`];
    if (contactPhone.value.trim()) notesParts.push(`Tel: ${contactPhone.value.trim()}`);
    if (deliveryNotes.value.trim()) notesParts.push(`Notas: ${deliveryNotes.value.trim()}`);

    const payload = {
        channel: 'WEB',
        invoice_type: invoiceType.value,
        document_type: invoiceType.value === 'FACTURA' ? 'RUC' : 'DNI',
        document_number: docNum || null,
        business_name: invoiceType.value === 'FACTURA'
            ? businessName.value.trim()
            : (customerName.value.trim() || null),
        notes: notesParts.join(' | '),
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
                <!-- Columna Izquierda: Comprobante, Entrega y Pago -->
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

                        <!-- Alerta Normativa SUNAT para Boleta > S/ 700 -->
                        <Message v-if="requiresDniBySunat" severity="warn" :closable="false" class="mb-3">
                            <div class="text-sm">
                                <strong>Normativa SUNAT:</strong> Al superar los <strong>S/ 700.00</strong>, es obligatorio registrar tu número de <strong>DNI</strong> para emitir la Boleta de Venta Electrónica.
                            </div>
                        </Message>

                        <!-- Campos para BOLETA -->
                        <div v-if="invoiceType === 'BOLETA'">
                            <div class="field mb-3">
                                <label class="font-bold text-700 block mb-2">
                                    DNI {{ requiresDniBySunat ? '*' : '(Opcional hasta S/ 700)' }}
                                </label>
                                <div class="flex gap-2">
                                    <InputText 
                                        v-model="documentNumber" 
                                        inputmode="numeric"
                                        placeholder="8 dígitos numéricos" 
                                        :maxlength="maxDocumentLength"
                                        :disabled="searchingDoc"
                                        class="w-full"
                                        @keypress="onlyNumbers"
                                        @input="onDocumentNumberInput"
                                        @keyup.enter.prevent="lookupDocument"
                                    />
                                    <Button 
                                        type="button"
                                        icon="pi pi-search"
                                        :loading="searchingDoc"
                                        :disabled="!canLookupDocument"
                                        style="background-color: #2D62A3; border-color: #2D62A3;"
                                        @click="lookupDocument"
                                    />
                                </div>
                                <small class="text-500 block mt-1">
                                    Ingresa los 8 dígitos para validar automáticamente en RENIEC.
                                </small>
                            </div>

                            <div v-if="customerName" class="field mb-2">
                                <label class="font-bold text-700 block mb-1 text-sm">Titular del DNI</label>
                                <InputText v-model="customerName" class="w-full surface-100" readonly />
                            </div>
                        </div>

                        <!-- Campos para FACTURA -->
                        <div v-if="invoiceType === 'FACTURA'">
                            <Message severity="info" :closable="false" class="mb-3">
                                <div class="text-sm">
                                    <strong>Normativa SUNAT:</strong> La emisión de Factura Electrónica requiere <strong>RUC (11 dígitos)</strong> y <strong>Razón Social</strong> de forma obligatoria para cualquier monto.
                                </div>
                            </Message>

                            <div class="field mb-3">
                                <label class="font-bold text-700 block mb-2">Número de RUC *</label>
                                <div class="flex gap-2">
                                    <InputText 
                                        v-model="documentNumber" 
                                        inputmode="numeric"
                                        placeholder="11 dígitos numéricos" 
                                        :maxlength="maxDocumentLength"
                                        :disabled="searchingDoc"
                                        class="w-full"
                                        @keypress="onlyNumbers"
                                        @input="onDocumentNumberInput"
                                        @keyup.enter.prevent="lookupDocument"
                                    />
                                    <Button 
                                        type="button"
                                        icon="pi pi-search"
                                        :loading="searchingDoc"
                                        :disabled="!canLookupDocument"
                                        style="background-color: #2D62A3; border-color: #2D62A3;"
                                        @click="lookupDocument"
                                    />
                                </div>
                            </div>

                            <div class="field mb-2">
                                <label class="font-bold text-700 block mb-2">Razón Social *</label>
                                <InputText 
                                    v-model="businessName" 
                                    placeholder="Nombre de la Empresa S.A.C." 
                                    class="w-full"
                                />
                                <div v-if="sunatStatus" class="flex gap-2 mt-2">
                                    <span 
                                        class="text-xs font-semibold px-2 py-1 border-round"
                                        :class="sunatStatus.estado === 'ACTIVO' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                                    >
                                        Estado: {{ sunatStatus.estado }}
                                    </span>
                                    <span 
                                        class="text-xs font-semibold px-2 py-1 border-round"
                                        :class="sunatStatus.condicion === 'HABIDO' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'"
                                    >
                                        Condición: {{ sunatStatus.condicion }}
                                    </span>
                                </div>
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
                            <label class="font-bold text-700 block mb-2">Teléfono de Contacto</label>
                            <InputText 
                                v-model="contactPhone" 
                                inputmode="numeric"
                                maxlength="9"
                                placeholder="Ej: 987654321" 
                                class="w-full"
                                @keypress="onlyNumbers"
                                @input="onPhoneInput"
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