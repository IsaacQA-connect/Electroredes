<script setup>
import api from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

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
        orders.value = response.data.data || response.data || [];
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron obtener los pedidos.', life: 4000 });
    } finally {
        loading.value = false;
    }
};

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
        case 'COMPLETADO': return 'success';
        case 'PENDIENTE': return 'warn';
        case 'CANCELADO': return 'danger';
        default: return 'info';
    }
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
                <p class="text-500 text-sm m-0">Monitorea y atiende las órdenes de venta registradas</p>
            </div>
            <Button icon="pi pi-refresh" label="Actualizar Listado" text severity="secondary" @click="fetchOrders" />
        </div>

        <!-- TABLA -->
        <div class="surface-card p-4 border-round-xl shadow-1">
            <div class="flex justify-content-between align-items-center mb-3">
                <IconField iconPosition="left">
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="searchQuery" placeholder="Buscar por código o cliente..." class="p-inputtext-sm" />
                </IconField>
            </div>

            <DataTable :value="orders" :loading="loading" paginator :rows="10" responsiveLayout="scroll" class="p-datatable-sm">
                <Column field="id" header="N° Orden">
                    <template #body="slotProps">
                        <span class="font-mono text-xs font-bold text-700">#{{ String(slotProps.data.id).padStart(5, '0') }}</span>
                    </template>
                </Column>

                <Column field="customer.name" header="Cliente">
                    <template #body="slotProps">
                        <span class="font-bold text-900">{{ slotProps.data.customer?.name || 'Cliente web' }}</span>
                    </template>
                </Column>

                <Column field="created_at" header="Fecha">
                    <template #body="slotProps">
                        <span class="text-sm text-600">{{ new Date(slotProps.data.created_at || Date.now()).toLocaleDateString('es-PE') }}</span>
                    </template>
                </Column>

                <Column field="total" header="Total">
                    <template #body="slotProps">
                        <span class="font-bold text-900">S/ {{ Number(slotProps.data.total || 0).toFixed(2) }}</span>
                    </template>
                </Column>

                <Column field="status" header="Estado">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.status || 'PENDIENTE'" :severity="getStatusSeverity(slotProps.data.status)" />
                    </template>
                </Column>

                <Column header="Acciones">
                    <template #body="slotProps">
                        <div class="flex gap-1">
                            <Button icon="pi pi-eye" text border-circle severity="secondary" v-tooltip="'Ver Detalle'" @click="viewOrderDetails(slotProps.data)" />
                            <Button icon="pi pi-file-edit" text border-circle severity="primary" v-tooltip="'Cambiar Estado'" @click="openStatusDialog(slotProps.data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- MODAL VER DETALLE DE PEDIDO -->
        <Dialog v-model:visible="detailDialog" header="Detalle de la Orden" modal class="w-full max-w-30rem">
            <div v-if="selectedOrder" class="flex flex-column gap-3">
                <div class="surface-100 p-3 border-round-lg flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 uppercase font-bold block">Orden</span>
                        <span class="font-mono font-bold text-lg">#{{ String(selectedOrder.id).padStart(5, '0') }}</span>
                    </div>
                    <Tag :value="selectedOrder.status || 'PENDIENTE'" :severity="getStatusSeverity(selectedOrder.status)" />
                </div>

                <div class="border-bottom-1 surface-border pb-2">
                    <span class="text-xs text-500 uppercase font-bold block mb-1">Cliente</span>
                    <span class="text-sm font-semibold text-800">{{ selectedOrder.customer?.name || 'Cliente General' }}</span>
                </div>

                <div>
                    <span class="text-xs text-500 uppercase font-bold block mb-2">Productos Comprados</span>
                    <ul class="list-none p-0 m-0 flex flex-column gap-2">
                        <li v-for="item in (selectedOrder.items || selectedOrder.details || [])" :key="item.id" class="flex justify-content-between text-sm py-1 border-bottom-1 surface-border">
                            <span>{{ item.quantity }}x {{ item.product?.name || item.name }}</span>
                            <span class="font-bold">S/ {{ Number(item.price * item.quantity).toFixed(2) }}</span>
                        </li>
                    </ul>
                </div>

                <div class="flex justify-content-between align-items-center text-lg font-black pt-2">
                    <span>Total Pagado:</span>
                    <span class="text-primary">S/ {{ Number(selectedOrder.total || 0).toFixed(2) }}</span>
                </div>
            </div>
            <template #footer>
                <Button label="Cerrar" text severity="secondary" @click="detailDialog = false" />
            </template>
        </Dialog>

        <!-- MODAL ACTUALIZAR ESTADO -->
        <Dialog v-model:visible="statusDialog" header="Actualizar Estado del Pedido" modal class="w-full max-w-25rem">
            <div class="field my-3">
                <label class="font-bold text-xs text-700 uppercase mb-2 block">Estado de la Orden</label>
                <Dropdown v-model="newStatus" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="statusDialog = false" />
                <Button label="Guardar" :loading="isUpdating" style="background-color: #2D62A3; border-color: #2D62A3;" @click="updateOrderStatus" />
            </template>
        </Dialog>
    </div>
</template>