<script setup>
import api from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';

const toast = useToast();
const loading = ref(true);
const orders = ref([]);
const searchQuery = ref('');
const statusFilter = ref('ALL');
const channelFilter = ref('ALL');

const detailDialog = ref(false);
const statusDialog = ref(false);
const selectedOrder = ref(null);
const newStatus = ref('');
const isUpdating = ref(false);
const isPrinting = ref(false);

const statusOptions = [
    { label: 'Pendiente', value: 'PENDING' },
    { label: 'Completado', value: 'COMPLETED' },
    { label: 'Cancelado', value: 'CANCELLED' }
];

const filterStatusOptions = [
    { label: 'Todos los estados', value: 'ALL' },
    { label: 'Pendientes', value: 'PENDING' },
    { label: 'Completados', value: 'COMPLETED' },
    { label: 'Cancelados', value: 'CANCELLED' }
];

const filterChannelOptions = [
    { label: 'Todos los canales', value: 'ALL' },
    { label: 'Tienda Web', value: 'WEB' },
    { label: 'Punto de Venta (POS)', value: 'POS' }
];

// Helpers de extracción según estructura de /orders
const getCustomerName = (order) => {
    if (!order) return '';
    return (
        order.customer?.name ||
        order.business_name ||
        (order.channel === 'POS' ? 'Cliente POS' : 'Cliente Web')
    );
};

const getCustomerDoc = (order) => {
    if (!order) return '';
    return (
        order.customer?.document_number ||
        order.customer?.document ||
        order.document_number ||
        ''
    );
};

const formatPaymentMethod = (payment) => {
    const raw = payment?.method_label || payment?.method || 'Efectivo';
    if (raw.trim().toLowerCase() === 'yape/plin') {
        return 'Yape';
    }
    return raw;
};

const getPaymentSummary = (order) => {
    const payments = order?.payments || [];
    if (payments.length === 0) {
        const fallback = order?.payment_method || 'Sin pago registrado';
        return fallback.trim().toLowerCase() === 'yape/plin' ? 'Yape' : fallback;
    }
    if (payments.length === 1) {
        return formatPaymentMethod(payments[0]);
    }
    return payments.map(p => formatPaymentMethod(p)).join(' + ');
};

const getInvoiceCorrelative = (order) => {
    return order?.invoice_number || order?.invoice?.number || order?.invoice?.correlative || null;
};

// Cargar pedidos desde la API
const fetchOrders = async () => {
    loading.value = true;
    try {
        const response = await api.get('/orders');
        const rawOrders = response.data.data || response.data || [];

        orders.value = rawOrders.sort((a, b) => {
            const dateA = new Date(a.order_date || a.created_at?.replace(' ', 'T'));
            const dateB = new Date(b.order_date || b.created_at?.replace(' ', 'T'));
            return dateB - dateA || b.id - a.id;
        });
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron obtener los pedidos.', life: 4000 });
    } finally {
        loading.value = false;
    }
};

// Métricas Dinámicas para la Cabecera (excluye cancelados del monto acumulado)
const pendingCount = computed(() =>
    orders.value.filter(o => ['PENDING', 'PENDIENTE'].includes(o.status?.toUpperCase())).length
);
const completedCount = computed(() =>
    orders.value.filter(o => ['COMPLETED', 'COMPLETADO'].includes(o.status?.toUpperCase())).length
);
const totalSalesAmount = computed(() =>
    orders.value
        .filter(o => !['CANCELLED', 'CANCELADO'].includes(o.status?.toUpperCase()))
        .reduce((acc, o) => acc + (Number(o.total) || 0), 0)
);

// Filtrado Reactivo por Búsqueda, Estado y Canal
const filteredOrders = computed(() => {
    return orders.value.filter(o => {
        const matchesStatus = statusFilter.value === 'ALL' || o.status?.toUpperCase() === statusFilter.value;
        const matchesChannel = channelFilter.value === 'ALL' || (o.channel || 'WEB').toUpperCase() === channelFilter.value;

        if (!matchesStatus || !matchesChannel) return false;
        if (!searchQuery.value.trim()) return true;

        const query = searchQuery.value.toLowerCase().trim();
        const customerName = getCustomerName(o).toLowerCase();
        const customerDoc = getCustomerDoc(o).toLowerCase();
        const invoiceNum = (getInvoiceCorrelative(o) || '').toLowerCase();

        return (
            String(o.id).includes(query) ||
            (o.code && o.code.toLowerCase().includes(query)) ||
            customerName.includes(query) ||
            customerDoc.includes(query) ||
            invoiceNum.includes(query) ||
            getStatusLabel(o.status).toLowerCase().includes(query)
        );
    });
});

// Ver Detalle Completo de la Orden
const viewOrderDetails = async (order) => {
    selectedOrder.value = order;
    detailDialog.value = true;
    try {
        const res = await api.get(`/orders/${order.id}`);
        selectedOrder.value = res.data.data || res.data || order;
    } catch (err) {
        // Mantiene la orden cargada de la tabla si falla el detalle individual
    }
};

// Abrir Modal de Cambio de Estado
const openStatusDialog = (order) => {
    selectedOrder.value = order;
    newStatus.value = order.status?.toUpperCase() || 'PENDING';
    statusDialog.value = true;
};

// Actualizar Estado en BD
const updateOrderStatus = async () => {
    if (!selectedOrder.value) return;
    isUpdating.value = true;
    try {
        await api.put(`/orders/${selectedOrder.value.id}`, {
            status: newStatus.value
        });
        toast.add({ severity: 'success', summary: 'Actualizado', detail: 'Estado del pedido modificado correctamente.', life: 3000 });
        statusDialog.value = false;
        fetchOrders();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el estado.', life: 4000 });
    } finally {
        isUpdating.value = false;
    }
};

// Imprimir / Descargar comprobante electrónico o ticket
// Extrae "/invoices/44/pdf" sin importar si el JSON trae dominio, /api o /api/v1
const getPdfUrl = (order) => {
    return order?.pdf_url || order?.invoice?.pdf_url || null;
};

const getXmlUrl = (order) => {
    return order?.xml_url || order?.invoice?.xml_url || null;
};

const normalizeInvoicePath = (rawUrl) => {
    if (!rawUrl) return null;
    const match = rawUrl.match(/(\/invoices\/.+)$/);
    return match ? match[1] : rawUrl;
};

const printInvoice = async (order) => {
    if (!order) return;

    const rawPdfUrl = getPdfUrl(order);
    const normalizedPdfPath = normalizeInvoicePath(rawPdfUrl);
    const invoiceId = order.invoice?.id || rawPdfUrl?.match(/\/invoices\/(\d+)/)?.[1];

    // Prueba primero la ruta del JSON (/invoices/44/pdf) y si falla, stream-pdf o ticket
    const endpoints = [
        normalizedPdfPath,
        invoiceId ? `/invoices/${invoiceId}/stream-pdf` : null,
        invoiceId ? `/invoices/${invoiceId}/ticket` : null
    ].filter(Boolean);

    if (endpoints.length === 0) {
        toast.add({
            severity: 'warn',
            summary: 'Sin comprobante',
            detail: 'Esta orden aún no tiene un comprobante electrónico emitido.',
            life: 3500
        });
        return;
    }

    isPrinting.value = true;
    try {
        let blobData = null;

        for (const path of endpoints) {
            try {
                const response = await api.get(path, { responseType: 'blob' });
                blobData = response.data;
                break;
            } catch {
                // Si /pdf falla en APIsPeru, intenta con /stream-pdf o /ticket
            }
        }

        if (!blobData) {
            throw new Error('No se pudo obtener el PDF');
        }

        const blob = new Blob([blobData], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch {
        toast.add({
            severity: 'warn',
            summary: 'Comprobante no disponible',
            detail: 'No se pudo cargar el PDF del comprobante.',
            life: 3500
        });
    } finally {
        isPrinting.value = false;
    }
};

const downloadXmlFile = async (order) => {
    const normalizedXmlPath = normalizeInvoicePath(getXmlUrl(order));
    if (!normalizedXmlPath) return;

    try {
        const response = await api.get(normalizedXmlPath, { responseType: 'blob' });
        const blob = new Blob([response.data], { type: 'application/xml' });
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${getInvoiceCorrelative(order) || 'comprobante-' + order.id}.xml`;
        link.click();
        window.URL.revokeObjectURL(blobUrl);
    } catch {
        toast.add({
            severity: 'warn',
            summary: 'XML no disponible',
            detail: 'No se pudo descargar el archivo XML.',
            life: 3500
        });
    }
};

const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2
    }).format(Number(val) || 0);
};

const getStatusSeverity = (status) => {
    switch (status?.toUpperCase()) {
        case 'COMPLETED':
        case 'COMPLETADO':
            return 'success';
        case 'PENDING':
        case 'PENDIENTE':
            return 'warn';
        case 'CANCELLED':
        case 'CANCELADO':
            return 'danger';
        default:
            return 'info';
    }
};

const getStatusLabel = (status) => {
    const labels = {
        'PENDING': 'Pendiente',
        'PENDIENTE': 'Pendiente',
        'COMPLETED': 'Completado',
        'COMPLETADO': 'Completado',
        'CANCELLED': 'Cancelado',
        'CANCELADO': 'Cancelado'
    };
    return labels[status?.toUpperCase()] || status || 'Pendiente';
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const normalized = typeof dateString === 'string' ? dateString.replace(' ', 'T') : dateString;
    return new Date(normalized).toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

onMounted(() => {
    fetchOrders();
});
</script>

<template>
    <div class="surface-ground p-4 border-round-xl">
        <!-- CABECERA PRINCIPAL -->
        <div class="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3">
            <div>
                <h2 class="text-3xl font-black text-900 m-0">Gestión de Pedidos</h2>
                <p class="text-500 text-sm m-0">Administra, filtra y gestiona las ventas de Tienda Web y Punto de Venta (POS)</p>
            </div>
            <Button 
                icon="pi pi-refresh" 
                label="Actualizar Listado" 
                text 
                severity="secondary" 
                :loading="loading" 
                @click="fetchOrders" 
            />
        </div>

        <!-- TARJETAS DE RESUMEN DE PEDIDOS -->
        <div class="grid mb-4">
            <div class="col-12 sm:col-6 md:col-3">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Total Pedidos</span>
                        <span class="text-2xl font-black text-900">{{ orders.length }}</span>
                    </div>
                    <div class="border-round p-3 bg-blue-100 text-blue-700">
                        <i class="pi pi-shopping-bag text-xl"></i>
                    </div>
                </div>
            </div>

            <div class="col-12 sm:col-6 md:col-3">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Pendientes</span>
                        <span class="text-2xl font-black text-orange-600">{{ pendingCount }}</span>
                    </div>
                    <div class="border-round p-3 bg-orange-100 text-orange-700">
                        <i class="pi pi-clock text-xl"></i>
                    </div>
                </div>
            </div>

            <div class="col-12 sm:col-6 md:col-3">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Completados</span>
                        <span class="text-2xl font-black text-emerald-600">{{ completedCount }}</span>
                    </div>
                    <div class="border-round p-3 bg-emerald-100 text-emerald-700">
                        <i class="pi pi-check-circle text-xl"></i>
                    </div>
                </div>
            </div>

            <div class="col-12 sm:col-6 md:col-3">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Ventas Válidas</span>
                        <span class="text-2xl font-black text-900">{{ formatCurrency(totalSalesAmount) }}</span>
                    </div>
                    <div class="border-round p-3 bg-green-100 text-green-700">
                        <i class="pi pi-wallet text-xl"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- TABLA Y FILTROS -->
        <div class="surface-card p-4 border-round-xl shadow-1">
            <div class="flex flex-column lg:flex-row justify-content-between align-items-stretch lg:align-items-center gap-3 mb-4">
                <!-- Buscador de Texto -->
                <IconField iconPosition="left" class="w-full lg:w-22rem">
                    <InputIcon class="pi pi-search" />
                    <InputText 
                        v-model="searchQuery" 
                        placeholder="Buscar N° orden, comprobante, cliente o DNI/RUC..." 
                        class="p-inputtext-sm w-full" 
                    />
                </IconField>

                <!-- Filtros por Canal y Estado -->
                <div class="flex flex-wrap align-items-center gap-3">
                    <div class="flex align-items-center gap-2">
                        <span class="text-xs font-bold text-600 uppercase">Canal:</span>
                        <Select 
                            v-model="channelFilter" 
                            :options="filterChannelOptions" 
                            optionLabel="label" 
                            optionValue="value" 
                            class="p-inputtext-sm w-12rem" 
                        />
                    </div>

                    <div class="flex align-items-center gap-2">
                        <span class="text-xs font-bold text-600 uppercase">Estado:</span>
                        <Select 
                            v-model="statusFilter" 
                            :options="filterStatusOptions" 
                            optionLabel="label" 
                            optionValue="value" 
                            class="p-inputtext-sm w-12rem" 
                        />
                    </div>
                </div>
            </div>

            <!-- TABLA DE PEDIDOS -->
            <DataTable 
                :value="filteredOrders" 
                :loading="loading" 
                paginator 
                :rows="10" 
                responsiveLayout="scroll" 
                class="p-datatable-sm"
            >
                <template #empty>
                    <div class="text-center p-4 text-500">
                        <i class="pi pi-inbox text-3xl mb-2 block"></i>
                        No se encontraron pedidos registrados con los criterios seleccionados.
                    </div>
                </template>

                <Column field="id" header="N° Orden" sortable>
                    <template #body="slotProps">
                        <span class="font-mono text-xs font-bold text-800">
                            {{ slotProps.data.code || `#${String(slotProps.data.id).padStart(5, '0')}` }}
                        </span>
                    </template>
                </Column>

                <Column field="customer.name" header="Cliente / Canal" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-column gap-1">
                            <div class="flex align-items-center gap-2">
                                <span class="font-bold text-900">
                                    {{ getCustomerName(slotProps.data) }}
                                </span>
                                <span
                                    class="text-xs font-semibold px-2 py-0 border-round"
                                    :class="slotProps.data.channel === 'POS' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'"
                                >
                                    {{ slotProps.data.channel || 'WEB' }}
                                </span>
                            </div>
                            <span class="text-xs text-500" v-if="getCustomerDoc(slotProps.data)">
                                Doc: {{ getCustomerDoc(slotProps.data) }}
                            </span>
                        </div>
                    </template>
                </Column>

                <Column field="invoice_type" header="Comprobante">
                    <template #body="slotProps">
                        <div class="flex flex-column">
                            <span class="text-xs font-bold text-800">
                                {{ slotProps.data.invoice_type || 'BOLETA' }}
                            </span>
                            <span class="font-mono text-xs text-600" v-if="getInvoiceCorrelative(slotProps.data)">
                                {{ getInvoiceCorrelative(slotProps.data) }}
                            </span>
                            <span class="text-xs text-400" v-else>
                                Sin correlativo
                            </span>
                        </div>
                    </template>
                </Column>

                <Column field="order_date" header="Fecha y Hora" sortable>
                    <template #body="slotProps">
                        <span class="text-xs text-600">
                            {{ formatDate(slotProps.data.order_date || slotProps.data.created_at) }}
                        </span>
                    </template>
                </Column>

                <Column header="Método Pago">
                    <template #body="slotProps">
                        <span class="text-xs font-semibold uppercase px-2 py-1 surface-100 border-round text-700">
                            {{ getPaymentSummary(slotProps.data) }}
                        </span>
                    </template>
                </Column>

                <Column field="total" header="Total" sortable>
                    <template #body="slotProps">
                        <span class="font-bold text-900">{{ formatCurrency(slotProps.data.total) }}</span>
                    </template>
                </Column>

                <Column field="status" header="Estado">
                    <template #body="slotProps">
                        <Tag 
                            :value="getStatusLabel(slotProps.data.status)" 
                            :severity="getStatusSeverity(slotProps.data.status)" 
                        />
                    </template>
                </Column>

                <Column header="Acciones" style="width: 130px">
                    <template #body="slotProps">
                        <div class="flex gap-1">
                            <Button 
                                icon="pi pi-eye" 
                                text 
                                rounded 
                                severity="secondary" 
                                v-tooltip.top="'Ver Detalle'" 
                                @click="viewOrderDetails(slotProps.data)" 
                            />
                            <Button 
                                icon="pi pi-pencil" 
                                text 
                                rounded 
                                severity="primary" 
                                v-tooltip.top="'Cambiar Estado'" 
                                @click="openStatusDialog(slotProps.data)" 
                            />
                            <Button 
                                icon="pi pi-print" 
                                text 
                                rounded 
                                severity="help" 
                                v-tooltip.top="'Imprimir Comprobante'" 
                                @click="printInvoice(slotProps.data)" 
                            />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- MODAL VER DETALLE DE PEDIDO -->
        <Dialog 
            v-model:visible="detailDialog" 
            header="Detalle del Pedido" 
            modal 
            class="p-fluid"
            :style="{ width: '90vw', maxWidth: '640px' }"
        >
            <div v-if="selectedOrder" class="flex flex-column gap-3">
                
                <!-- Encabezado de la Orden -->
                <div class="surface-100 p-3 border-round-lg flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 uppercase font-bold block">Código de Orden</span>
                        <div class="flex align-items-center gap-2">
                            <span class="font-mono font-bold text-xl text-900">
                                {{ selectedOrder.code || `#${String(selectedOrder.id).padStart(5, '0')}` }}
                            </span>
                            <span
                                class="text-xs font-semibold px-2 py-1 border-round"
                                :class="selectedOrder.channel === 'POS' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'"
                            >
                                {{ selectedOrder.channel || 'WEB' }}
                            </span>
                        </div>
                    </div>
                    <div class="text-right">
                        <Tag 
                            :value="getStatusLabel(selectedOrder.status)" 
                            :severity="getStatusSeverity(selectedOrder.status)" 
                            class="mb-1" 
                        />
                        <span class="text-xs text-500 block">
                            {{ formatDate(selectedOrder.order_date || selectedOrder.created_at) }}
                        </span>
                    </div>
                </div>

                <!-- Datos del Cliente y Comprobante -->
                <div class="grid surface-border border-bottom-1 pb-2">
                    <div class="col-12 sm:col-6">
                        <span class="text-xs text-500 uppercase font-bold block mb-1">Cliente</span>
                        <span class="text-sm font-bold text-800 block">
                            {{ getCustomerName(selectedOrder) }}
                        </span>
                        <span class="text-xs text-600 block" v-if="getCustomerDoc(selectedOrder)">
                            Doc: {{ getCustomerDoc(selectedOrder) }}
                        </span>
                    </div>
                    <div class="col-12 sm:col-6">
                        <span class="text-xs text-500 uppercase font-bold block mb-1">Comprobante Electrónico</span>
                        <span class="text-sm font-semibold text-800 block">
                            {{ selectedOrder.invoice_type || 'BOLETA' }}
                            <span v-if="getInvoiceCorrelative(selectedOrder)" class="font-mono text-primary ml-1">
                                ({{ getInvoiceCorrelative(selectedOrder) }})
                            </span>
                        </span>
                        <div class="flex gap-3 mt-1" v-if="getPdfUrl(selectedOrder) || getXmlUrl(selectedOrder)">
                            <a 
                                v-if="getPdfUrl(selectedOrder)" 
                                href="#" 
                                class="text-xs font-semibold text-red-600 no-underline"
                                @click.prevent="printInvoice(selectedOrder)"
                            >
                                <i class="pi pi-file-pdf mr-1"></i>Ver PDF
                            </a>
                            <a 
                                v-if="getXmlUrl(selectedOrder)" 
                                href="#" 
                                class="text-xs font-semibold text-blue-600 no-underline"
                                @click.prevent="downloadXmlFile(selectedOrder)"
                            >
                                <i class="pi pi-code mr-1"></i>Ver XML
                            </a>
                        </div>
                        <span v-else class="text-xs text-400 block mt-1">Sin archivos SUNAT adjuntos</span>
                    </div>
                </div>

                <!-- Notas / Dirección de Entrega (para pedidos WEB) -->
                <div v-if="selectedOrder.notes" class="p-3 border-round bg-blue-50 text-blue-900 text-sm">
                    <span class="text-xs font-bold uppercase block mb-1">
                        <i class="pi pi-map-marker mr-1"></i>Datos de Entrega / Notas
                    </span>
                    <span>{{ selectedOrder.notes }}</span>
                </div>

                <!-- Lista de Productos Comprados -->
                <div>
                    <span class="text-xs text-500 uppercase font-bold block mb-2">Productos en la Orden</span>
                    <div class="border-1 surface-border border-round p-2 max-h-14rem overflow-y-auto">
                        <ul class="list-none p-0 m-0 flex flex-column gap-2">
                            <li 
                                v-for="item in (selectedOrder.details || selectedOrder.items || [])" 
                                :key="item.id" 
                                class="flex justify-content-between align-items-center text-sm py-2 border-bottom-1 surface-border last:border-none"
                            >
                                <div class="flex flex-column">
                                    <span class="font-bold text-800">
                                        {{ item.product?.name || item.name || 'Producto' }}
                                    </span>
                                    <span class="text-xs text-500">
                                        <span v-if="item.product?.code" class="font-mono mr-2">[{{ item.product.code }}]</span>
                                        Cant: {{ Number(item.quantity) }} x {{ formatCurrency(item.unit_price || item.price) }}
                                    </span>
                                </div>
                                <span class="font-bold text-900">
                                    {{ formatCurrency(item.subtotal || (Number(item.quantity) * Number(item.unit_price || item.price || 0))) }}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- Desglose de Pagos Registrados -->
                <div v-if="selectedOrder.payments && selectedOrder.payments.length > 0">
                    <span class="text-xs text-500 uppercase font-bold block mb-2">Pagos Registrados</span>
                    <div class="flex flex-column gap-2">
                        <div 
                            v-for="pay in selectedOrder.payments" 
                            :key="pay.id"
                            class="surface-100 px-3 py-2 border-round flex justify-content-between align-items-center text-sm"
                        >
                            <div>
                                <span class="font-bold text-800">{{ formatPaymentMethod(pay) }}</span>
                                <span v-if="pay.transaction_code" class="text-xs text-600 ml-2 font-mono">
                                    (Op: {{ pay.transaction_code }})
                                </span>
                                <span class="block text-xs text-500">{{ pay.status_label || pay.status }}</span>
                            </div>
                            <span class="font-bold text-900">{{ formatCurrency(pay.amount) }}</span>
                        </div>
                    </div>
                </div>

                <!-- Resumen de Totales e IGV -->
                <div class="surface-50 p-3 border-round-lg flex flex-column gap-1">
                    <div v-if="Number(selectedOrder.discount) > 0" class="flex justify-content-between text-sm text-orange-600">
                        <span>Descuento aplicado:</span>
                        <span>- {{ formatCurrency(selectedOrder.discount) }}</span>
                    </div>
                    <div class="flex justify-content-between text-sm text-600">
                        <span>Op. Gravada (Subtotal):</span>
                        <span>{{ formatCurrency((Number(selectedOrder.total) || 0) / 1.18) }}</span>
                    </div>
                    <div class="flex justify-content-between text-sm text-600">
                        <span>IGV (18%):</span>
                        <span>{{ formatCurrency((Number(selectedOrder.total) || 0) - ((Number(selectedOrder.total) || 0) / 1.18)) }}</span>
                    </div>
                    <div class="flex justify-content-between align-items-center text-xl font-black pt-2 border-top-1 surface-border text-900">
                        <span>Total General:</span>
                        <span class="text-blue-600">{{ formatCurrency(selectedOrder.total) }}</span>
                    </div>
                </div>

            </div>

            <template #footer>
                <div class="flex justify-content-between w-full">
                    <Button 
                        label="Imprimir" 
                        icon="pi pi-print" 
                        severity="help" 
                        outlined 
                        :loading="isPrinting"
                        @click="printInvoice(selectedOrder)" 
                    />
                    <Button 
                        label="Cerrar" 
                        text 
                        severity="secondary" 
                        @click="detailDialog = false" 
                    />
                </div>
            </template>
        </Dialog>

        <!-- MODAL ACTUALIZAR ESTADO -->
        <Dialog 
            v-model:visible="statusDialog" 
            header="Actualizar Estado de Orden" 
            modal 
            class="p-fluid"
            :style="{ width: '90vw', maxWidth: '400px' }"
        >
            <div class="field my-3">
                <label class="font-bold text-xs text-700 uppercase mb-2 block">Estado de la Orden</label>
                <Select 
                    v-model="newStatus" 
                    :options="statusOptions" 
                    optionLabel="label" 
                    optionValue="value" 
                    class="w-full" 
                />
            </div>

            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="statusDialog = false" />
                <Button 
                    label="Guardar Cambio" 
                    icon="pi pi-check" 
                    :loading="isUpdating" 
                    style="background-color: #2D62A3; border-color: #2D62A3;" 
                    @click="updateOrderStatus" 
                />
            </template>
        </Dialog>
    </div>
</template>