<script setup>
import api from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';

const toast = useToast();
const loading = ref(true);
const orders = ref([]);
const searchQuery = ref('');

const detailDialog = ref(false);
const statusDialog = ref(false);
const selectedOrder = ref(null);
const newStatus = ref('');
const isUpdating = ref(false);

const statusOptions = [
    { label: 'Pendiente', value: 'PENDIENTE' },
    { label: 'Completado', value: 'COMPLETADO' },
    { label: 'Cancelado', value: 'CANCELADO' }
];

const fetchOrders = async () => {
    loading.value = true;
    try {
        const response = await api.get('/orders');
        const rawOrders = response.data.data || response.data || [];
        
        // Ordenar siempre descendente por ID o Fecha más reciente
        orders.value = rawOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron obtener los pedidos.', life: 4000 });
    } finally {
        loading.value = false;
    }
};

// Búsqueda Reactiva
const filteredOrders = computed(() => {
    if (!searchQuery.value.trim()) return orders.value;
    const query = searchQuery.value.toLowerCase();
    
    return orders.value.filter(o => 
        String(o.id).includes(query) ||
        (o.customer?.name && o.customer.name.toLowerCase().includes(query)) ||
        (o.status && o.status.toLowerCase().includes(query))
    );
});

const viewOrderDetails = async (order) => {
    try {
        const res = await api.get(`/orders/${order.id}`);
        selectedOrder.value = res.data.data || res.data || order;
    } catch (err) {
        selectedOrder.value = order;
    }
    detailDialog.value = true;
};

const openStatusDialog = (order) => {
    selectedOrder.value = order;
    newStatus.value = order.status || 'PENDIENTE';
    statusDialog.value = true;
};

const updateOrderStatus = async () => {
    if (!selectedOrder.value) return;
    isUpdating.value = true;
    try {
        await api.put(`/orders/${selectedOrder.value.id}`, {
            status: newStatus.value
        });
        toast.add({ severity: 'success', summary: 'Actualizado', detail: 'Estado del pedido modificado.', life: 3000 });
        statusDialog.value = false;
        fetchOrders();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el estado.', life: 4000 });
    } finally {
        isUpdating.value = false;
    }
};

const getStatusSeverity = (status) => {
    switch (status?.toUpperCase()) {
        case 'COMPLETADO':
        case 'COMPLETED': 
            return 'success';
        case 'PENDIENTE':
        case 'PENDING': 
            return 'warn';
        case 'CANCELADO':
        case 'CANCELLED': 
            return 'danger';
        default: 
            return 'info';
    }
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
        <!-- CABECERA -->
        <div class="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3">
            <div>
                <h2 class="text-3xl font-black text-900 m-0">Gestión de Pedidos</h2>
                <p class="text-500 text-sm m-0">Monitorea y atiende las órdenes de venta ordenadas por antigüedad</p>
            </div>
            <Button icon="pi pi-refresh" label="Actualizar Listado" text severity="secondary" @click="fetchOrders" />
        </div>

        <!-- TABLA PRINCIPAL -->
        <div class="surface-card p-4 border-round-xl shadow-1">
            <div class="flex justify-content-between align-items-center mb-3">
                <IconField iconPosition="left">
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="searchQuery" placeholder="Buscar por N° orden, cliente o estado..." class="p-inputtext-sm w-15rem md:w-20rem" />
                </IconField>
            </div>

            <DataTable :value="filteredOrders" :loading="loading" paginator :rows="10" responsiveLayout="scroll" class="p-datatable-sm">
                <template #empty>
                    <div class="text-center p-3 text-500">No se encontraron pedidos registrados.</div>
                </template>

                <Column field="id" header="N° Orden" sortable>
                    <template #body="slotProps">
                        <span class="font-mono text-xs font-bold text-700">#{{ String(slotProps.data.id).padStart(5, '0') }}</span>
                    </template>
                </Column>

                <Column field="customer.name" header="Cliente" sortable>
                    <template #body="slotProps">
                        <span class="font-bold text-900">{{ slotProps.data.customer?.name || 'Cliente Web' }}</span>
                    </template>
                </Column>

                <Column field="created_at" header="Fecha y Hora" sortable>
                    <template #body="slotProps">
                        <span class="text-sm text-600">{{ formatDate(slotProps.data.created_at) }}</span>
                    </template>
                </Column>

                <Column field="total" header="Total" sortable>
                    <template #body="slotProps">
                        <span class="font-bold text-900">S/ {{ Number(slotProps.data.total || 0).toFixed(2) }}</span>
                    </template>
                </Column>

                <Column field="status" header="Estado">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.status || 'PENDIENTE'" :severity="getStatusSeverity(slotProps.data.status)" />
                    </template>
                </Column>

                <Column header="Acciones" style="width: 100px">
                    <template #body="slotProps">
                        <div class="flex gap-1">
                            <Button icon="pi pi-eye" text rounded severity="secondary" v-tooltip.top="'Ver Detalle'" @click="viewOrderDetails(slotProps.data)" />
                            <Button icon="pi pi-file-edit" text rounded severity="primary" v-tooltip.top="'Cambiar Estado'" @click="openStatusDialog(slotProps.data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- MODAL VER DETALLE DE PEDIDO -->
        <Dialog 
            v-model:visible="detailDialog" 
            header="Detalle de la Orden" 
            modal 
            class="p-fluid"
            :style="{ width: '90vw', maxWidth: '550px' }"
        >
            <div v-if="selectedOrder" class="flex flex-column gap-3">
                <div class="surface-100 p-3 border-round-lg flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 uppercase font-bold block">Orden</span>
                        <span class="font-mono font-bold text-xl text-900">#{{ String(selectedOrder.id).padStart(5, '0') }}</span>
                    </div>
                    <div class="text-right">
                        <Tag :value="selectedOrder.status || 'PENDIENTE'" :severity="getStatusSeverity(selectedOrder.status)" class="mb-1" />
                        <span class="text-xs text-500 block">{{ formatDate(selectedOrder.created_at) }}</span>
                    </div>
                </div>

                <div class="border-bottom-1 surface-border pb-2">
                    <span class="text-xs text-500 uppercase font-bold block mb-1">Cliente</span>
                    <span class="text-sm font-semibold text-800">{{ selectedOrder.customer?.name || 'Cliente Web' }}</span>
                </div>

                <div>
                    <span class="text-xs text-500 uppercase font-bold block mb-2">Productos Comprados</span>
                    <div class="border-1 surface-border border-round p-2 max-h-12rem overflow-y-auto">
                        <ul class="list-none p-0 m-0 flex flex-column gap-2">
                            <li 
                                v-for="item in (selectedOrder.items || selectedOrder.details || [])" 
                                :key="item.id" 
                                class="flex justify-content-between align-items-center text-sm py-1 border-bottom-1 surface-border last:border-none"
                            >
                                <div class="flex flex-column">
                                    <span class="font-bold text-800">{{ item.product?.name || item.name || 'Producto' }}</span>
                                    <span class="text-xs text-500">Cant: {{ item.quantity }} x S/ {{ Number(item.price || item.unit_price || 0).toFixed(2) }}</span>
                                </div>
                                <span class="font-bold text-900">
                                    S/ {{ (Number(item.quantity) * Number(item.price || item.unit_price || 0)).toFixed(2) }}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div class="flex justify-content-between align-items-center text-xl font-black pt-2 border-top-1 surface-border">
                    <span>Total General:</span>
                    <span class="text-blue-600">S/ {{ Number(selectedOrder.total || 0).toFixed(2) }}</span>
                </div>
            </div>

            <template #footer>
                <Button label="Cerrar" text severity="secondary" @click="detailDialog = false" />
            </template>
        </Dialog>

        <!-- MODAL ACTUALIZAR ESTADO -->
        <Dialog 
            v-model:visible="statusDialog" 
            header="Actualizar Estado del Pedido" 
            modal 
            class="p-fluid"
            :style="{ width: '90vw', maxWidth: '400px' }"
        >
            <div class="field my-3">
                <label class="font-bold text-xs text-700 uppercase mb-2 block">Estado de la Orden</label>
                <Dropdown v-model="newStatus" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="statusDialog = false" />
                <Button label="Guardar Cambio" icon="pi pi-check" :loading="isUpdating" style="background-color: #2D62A3; border-color: #2D62A3;" @click="updateOrderStatus" />
            </template>
        </Dialog>
    </div>
</template>