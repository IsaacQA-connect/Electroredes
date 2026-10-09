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

// Cargar pedidos desde la API
const fetchOrders = async () => {
    loading.value = true;
    try {
        const response = await api.get('/orders');
        const rawOrders = response.data.data || response.data || [];
        
        orders.value = rawOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron obtener los pedidos.', life: 4000 });
    } finally {
        loading.value = false;
    }
};

// Métricas Dinámicas para la Cabecera
const pendingCount = computed(() => orders.value.filter(o => ['PENDING', 'PENDIENTE'].includes(o.status?.toUpperCase())).length);
const completedCount = computed(() => orders.value.filter(o => ['COMPLETED', 'COMPLETADO'].includes(o.status?.toUpperCase())).length);
const totalSalesAmount = computed(() => orders.value.reduce((acc, o) => acc + (Number(o.total) || 0), 0));

// Filtrado Reactivo por Búsqueda Texto y Estado
const filteredOrders = computed(() => {
    return orders.value.filter(o => {
        // Filtro por Estado
        const matchesStatus = statusFilter.value === 'ALL' || o.status?.toUpperCase() === statusFilter.value;

        // Filtro por Búsqueda Texto
        if (!searchQuery.value.trim()) return matchesStatus;

        const query = searchQuery.value.toLowerCase();
        const matchesText = 
            String(o.id).includes(query) ||
            (o.code && o.code.toLowerCase().includes(query)) ||
            (o.customer?.name && o.customer.name.toLowerCase().includes(query)) ||
            (o.customer?.document && o.customer.document.includes(query)) ||
            getStatusLabel(o.status).toLowerCase().includes(query);

        return matchesStatus && matchesText;
    });
});

// Ver Detalle Completo de la Orden
const viewOrderDetails = async (order) => {
    try {
        const res = await api.get(`/orders/${order.id}`);
        selectedOrder.value = res.data.data || res.data || order;
    } catch (err) {
        selectedOrder.value = order;
    }
    detailDialog.value = true;
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

// Función para imprimir / descargar comprobante de compra
const printInvoice = async (order) => {
    isPrinting.value = true;
    try {
        // Intento de obtener PDF o abrir ventana de impresión estándar
        const response = await api.get(`/orders/${order.id}/pdf`, { responseType: 'blob' });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
    } catch (err) {
        // Fallback: Disparar la vista de impresión del navegador si no hay endpoint PDF
        window.print();
    } finally {
        isPrinting.value = false;
    }
};

// Formateador oficial de Moneda Peruana (S/)
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
    return new Date(dateString).toLocaleString('es-PE', {
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
                <p class="text-500 text-sm m-0">Administra, filtra y gestiona los estados de las órdenes de compra</p>
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
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Monto Acumulado</span>
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
            <div class="flex flex-column sm:flex-row justify-content-between align-items-stretch sm:align-items-center gap-3 mb-4">
                <!-- Buscador de Texto -->
                <IconField iconPosition="left" class="w-full sm:w-20rem">
                    <InputIcon class="pi pi-search" />
                    <InputText 
                        v-model="searchQuery" 
                        placeholder="Buscar por N° orden, cliente o DNI/RUC..." 
                        class="p-inputtext-sm w-full" 
                    />
                </IconField>

                <!-- Filtro por Estado -->
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

                <Column field="customer.name" header="Cliente" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-column">
                            <span class="font-bold text-900">{{ slotProps.data.customer?.name || 'Cliente Web' }}</span>
                            <span class="text-xs text-500" v-if="slotProps.data.customer?.document">
                                Doc: {{ slotProps.data.customer.document }}
                            </span>
                        </div>
                    </template>
                </Column>

                <Column field="created_at" header="Fecha y Hora" sortable>
                    <template #body="slotProps">
                        <span class="text-xs text-600">{{ formatDate(slotProps.data.created_at) }}</span>
                    </template>
                </Column>

                <Column field="payment_method" header="Método Pago">
                    <template #body="slotProps">
                        <span class="text-xs font-semibold uppercase px-2 py-1 surface-100 border-round text-700">
                            {{ slotProps.data.payment_method || 'Efectivo / Transferencia' }}
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
            :style="{ width: '90vw', maxWidth: '600px' }"
        >
            <div v-if="selectedOrder" class="flex flex-column gap-3">
                
                <!-- Encabezado de la Orden -->
                <div class="surface-100 p-3 border-round-lg flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 uppercase font-bold block">Código de Orden</span>
                        <span class="font-mono font-bold text-xl text-900">
                            {{ selectedOrder.code || `#${String(selectedOrder.id).padStart(5, '0')}` }}
                        </span>
                    </div>
                    <div class="text-right">
                        <Tag 
                            :value="getStatusLabel(selectedOrder.status)" 
                            :severity="getStatusSeverity(selectedOrder.status)" 
                            class="mb-1" 
                        />
                        <span class="text-xs text-500 block">{{ formatDate(selectedOrder.created_at) }}</span>
                    </div>
                </div>

                <!-- Datos del Cliente y Pago -->
                <div class="grid surface-border border-bottom-1 pb-2">
                    <div class="col-12 sm:col-6">
                        <span class="text-xs text-500 uppercase font-bold block mb-1">Cliente</span>
                        <span class="text-sm font-bold text-800 block">{{ selectedOrder.customer?.name || 'Cliente Web' }}</span>
                        <span class="text-xs text-600 block" v-if="selectedOrder.customer?.document">
                            Doc: {{ selectedOrder.customer.document }}
                        </span>
                    </div>
                    <div class="col-12 sm:col-6">
                        <span class="text-xs text-500 uppercase font-bold block mb-1">Comprobante / Pago</span>
                        <span class="text-sm font-semibold text-800 block">
                            {{ selectedOrder.invoice_type || 'Boleta de Venta' }}
                        </span>
                        <span class="text-xs text-600 block">
                            Método: {{ selectedOrder.payment_method || 'Efectivo / Transferencia' }}
                        </span>
                    </div>
                </div>

                <!-- Lista de Productos Comprados -->
                <div>
                    <span class="text-xs text-500 uppercase font-bold block mb-2">Productos en la Orden</span>
                    <div class="border-1 surface-border border-round p-2 max-h-14rem overflow-y-auto">
                        <ul class="list-none p-0 m-0 flex flex-column gap-2">
                            <li 
                                v-for="item in (selectedOrder.items || selectedOrder.details || [])" 
                                :key="item.id" 
                                class="flex justify-content-between align-items-center text-sm py-2 border-bottom-1 surface-border last:border-none"
                            >
                                <div class="flex flex-column">
                                    <span class="font-bold text-800">{{ item.product?.name || item.name || 'Producto' }}</span>
                                    <span class="text-xs text-500">
                                        Cant: {{ item.quantity }} x {{ formatCurrency(item.price || item.unit_price) }}
                                    </span>
                                </div>
                                <span class="font-bold text-900">
                                    {{ formatCurrency(Number(item.quantity) * Number(item.price || item.unit_price || 0)) }}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- Resumen de Totales e IGV -->
                <div class="surface-50 p-3 border-round-lg flex flex-column gap-1">
                    <div class="flex justify-content-between text-sm text-600">
                        <span>Subtotal:</span>
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