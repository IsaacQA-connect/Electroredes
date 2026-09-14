<script setup>
import api from '@/service/api';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Tag from 'primevue/tag';

const router = useRouter();
const loading = ref(true);

const stats = ref({
    totalSales: 0,
    pendingOrders: 0,
    totalProducts: 0,
    lowStock: 0
});
const recentOrders = ref([]);

const fetchDashboardData = async () => {
    loading.value = true;
    try {
        const [ordersRes, stockRes] = await Promise.all([
            api.get('/orders'),
            api.get('/inventory/low-stock')
        ]);
        
        const ordersData = ordersRes.data.data || ordersRes.data || [];
        recentOrders.value = ordersData.slice(0, 5);

        stats.value.pendingOrders = ordersData.filter(o => o.status === 'PENDIENTE').length;
        stats.value.totalSales = ordersData
            .filter(o => o.status === 'COMPLETADO')
            .reduce((acc, curr) => acc + Number(curr.total || 0), 0);
        
        const lowStockData = stockRes.data.data || stockRes.data || [];
        stats.value.lowStock = lowStockData.length;
    } catch (error) {
        console.error('Error al cargar métricas del dashboard:', error);
    } finally {
        loading.value = false;
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
    fetchDashboardData();
});
</script>

<template>
    <div class="surface-ground p-4 border-round-xl">
        
        <!-- ENCABEZADO CON BOTONES DE ACCIÓN RÁPIDA -->
        <div class="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3">
            <div>
                <h2 class="text-3xl font-black text-900 m-0">Panel General</h2>
                <p class="text-500 text-sm m-0">Resumen operativo de ElectroRedes</p>
            </div>

            <!-- BOTONES DE NAVEGACIÓN DIRECTA -->
            <div class="flex flex-wrap gap-2">
                <Button 
                    label="Gestionar Productos" 
                    icon="pi pi-box" 
                    class="p-button-sm border-round-3xl" 
                    style="background-color: #2D62A3; border-color: #2D62A3;" 
                    @click="router.push('/auth/products')" 
                />
                <Button 
                    label="Ver Pedidos" 
                    icon="pi pi-shopping-bag" 
                    class="p-button-sm border-round-3xl" 
                    severity="secondary"
                    @click="router.push('/auth/orders')" 
                />
                <Button 
                    label="Control de Caja" 
                    icon="pi pi-wallet" 
                    class="p-button-sm border-round-3xl" 
                    severity="help"
                    @click="router.push('/auth/cash-register')" 
                />
                <Button 
                    icon="pi pi-refresh" 
                    text 
                    rounded 
                    severity="secondary" 
                    v-tooltip="'Actualizar datos'"
                    @click="fetchDashboardData" 
                />
            </div>
        </div>

        <!-- TARJETAS DE MÉTRICAS -->
        <div class="grid mb-4">
            <div class="col-12 md:col-6 lg:col-3">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Ventas Totales</span>
                        <span class="text-2xl font-black text-900">S/ {{ stats.totalSales.toFixed(2) }}</span>
                    </div>
                    <div class="border-round p-3 flex align-items-center justify-content-center bg-blue-100 text-blue-700">
                        <i class="pi pi-dollar text-xl"></i>
                    </div>
                </div>
            </div>

            <div class="col-12 md:col-6 lg:col-3">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Pedidos Pendientes</span>
                        <span class="text-2xl font-black text-900">{{ stats.pendingOrders }}</span>
                    </div>
                    <div class="border-round p-3 flex align-items-center justify-content-center bg-orange-100 text-orange-700">
                        <i class="pi pi-clock text-xl"></i>
                    </div>
                </div>
            </div>

            <div class="col-12 md:col-6 lg:col-3">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Stock Crítico</span>
                        <span class="text-2xl font-black text-900">{{ stats.lowStock }}</span>
                    </div>
                    <div class="border-round p-3 flex align-items-center justify-content-center bg-red-100 text-red-700">
                        <i class="pi pi-exclamation-triangle text-xl"></i>
                    </div>
                </div>
            </div>

            <div class="col-12 md:col-6 lg:col-3">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Acceso Rápido</span>
                        <a href="/" target="_blank" class="text-sm font-bold text-primary hover:underline flex align-items-center gap-1">
                            Ver Tienda <i class="pi pi-external-link text-xs"></i>
                        </a>
                    </div>
                    <div class="border-round p-3 flex align-items-center justify-content-center bg-teal-100 text-teal-700">
                        <i class="pi pi-globe text-xl"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- TABLA DE PEDIDOS RECIENTES -->
        <div class="surface-card p-4 border-round-xl shadow-1">
            <div class="flex justify-content-between align-items-center mb-3">
                <h3 class="text-lg font-bold text-900 m-0">Últimos Pedidos Registrados</h3>
                <Button label="Ver Todos" text size="small" @click="router.push('/auth/orders')" />
            </div>

            <DataTable :value="recentOrders" :loading="loading" class="p-datatable-sm" responsiveLayout="scroll">
                <Column field="id" header="N° Orden">
                    <template #body="slotProps">
                        <span class="font-mono text-xs font-bold">#{{ String(slotProps.data.id).padStart(5, '0') }}</span>
                    </template>
                </Column>
                <Column field="customer.name" header="Cliente">
                    <template #body="slotProps">
                        <span>{{ slotProps.data.customer?.name || 'Cliente Mostrador' }}</span>
                    </template>
                </Column>
                <Column field="total" header="Total">
                    <template #body="slotProps">
                        <span class="font-bold">S/ {{ Number(slotProps.data.total || 0).toFixed(2) }}</span>
                    </template>
                </Column>
                <Column field="status" header="Estado">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.status || 'PENDIENTE'" :severity="getStatusSeverity(slotProps.data.status)" />
                    </template>
                </Column>
            </DataTable>
        </div>

    </div>
</template>