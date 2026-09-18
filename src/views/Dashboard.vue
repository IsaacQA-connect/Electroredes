<script setup>
import api from '@/service/api';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';

const router = useRouter();
const loading = ref(true);

const stats = ref({
    totalSales: 0,
    pendingOrders: 0,
    lowStock: 0,
    inventoryValue: 0,
    totalProducts: 0
});
const recentOrders = ref([]);

const fetchDashboardData = async () => {
    loading.value = true;
    try {
        const [ordersRes, stockRes, valuationRes] = await Promise.all([
            api.get('/orders'),
            api.get('/inventory/low-stock'),
            api.get('/inventory/valuation')
        ]);
        
        // Pedidos
        const ordersData = ordersRes.data.data || ordersRes.data || [];
        recentOrders.value = ordersData.slice(0, 5);

        stats.value.pendingOrders = ordersData.filter(o => ['PENDIENTE', 'PENDING'].includes(o.status?.toUpperCase())).length;
        stats.value.totalSales = ordersData
            .filter(o => ['COMPLETADO', 'COMPLETED'].includes(o.status?.toUpperCase()))
            .reduce((acc, curr) => acc + Number(curr.total || 0), 0);
        
        // Stock Bajo
        const lowStockData = stockRes.data.data || stockRes.data || [];
        stats.value.lowStock = lowStockData.length;

        // Valorización de Inventario
        const valData = valuationRes.data || {};
        stats.value.inventoryValue = Number(valData.total_value || 0);
        stats.value.totalProducts = valData.products_count || 0;

    } catch (error) {
        console.error('Error al cargar métricas del dashboard:', error);
    } finally {
        loading.value = false;
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
    return new Date(dateString).toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

onMounted(() => {
    fetchDashboardData();
});
</script>

<template>
    <div class="surface-ground p-4 border-round-xl">
        
        <!-- ENCABEZADO Y ACCIONES RÁPIDAS -->
        <div class="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3">
            <div>
                <h2 class="text-3xl font-black text-900 m-0">Panel General</h2>
                <p class="text-500 text-sm m-0">Resumen operativo de ElectroRedes</p>
            </div>

            <div class="flex flex-wrap gap-2">
                <Button 
                    label="Inventario / Stock" 
                    icon="pi pi-box" 
                    class="p-button-sm border-round-3xl" 
                    style="background-color: #2D62A3; border-color: #2D62A3;" 
                    @click="router.push('/admin/inventory-stock')" 
                />
                <Button 
                    label="Ver Pedidos" 
                    icon="pi pi-shopping-bag" 
                    class="p-button-sm border-round-3xl" 
                    severity="secondary"
                    @click="router.push('/admin/orders')" 
                />
                <Button 
                    label="Control de Caja" 
                    icon="pi pi-wallet" 
                    class="p-button-sm border-round-3xl" 
                    severity="help"
                    @click="router.push('/admin/cash-register')" 
                />
                <Button 
                    icon="pi pi-refresh" 
                    text 
                    rounded 
                    severity="secondary" 
                    v-tooltip.top="'Actualizar datos'"
                    @click="fetchDashboardData" 
                />
            </div>
        </div>

        <!-- TARJETAS DE MÉTRICAS / KPIS -->
        <div class="grid mb-4">
            <!-- Ventas Totales -->
            <div class="col-12 sm:col-6 lg:col-3">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Ventas Totales</span>
                        <Skeleton v-if="loading" width="6rem" height="1.8rem" />
                        <span v-else class="text-2xl font-black text-900">S/ {{ stats.totalSales.toFixed(2) }}</span>
                    </div>
                    <div class="border-round p-3 flex align-items-center justify-content-center bg-blue-100 text-blue-700">
                        <i class="pi pi-dollar text-xl"></i>
                    </div>
                </div>
            </div>

            <!-- Pedidos Pendientes -->
            <div class="col-12 sm:col-6 lg:col-3">
                <div 
                    class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center cursor-pointer hover:shadow-2 transition-duration-150"
                    @click="router.push('/admin/orders')"
                >
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Pedidos Pendientes</span>
                        <Skeleton v-if="loading" width="4rem" height="1.8rem" />
                        <span v-else class="text-2xl font-black text-900">{{ stats.pendingOrders }}</span>
                    </div>
                    <div class="border-round p-3 flex align-items-center justify-content-center bg-orange-100 text-orange-700">
                        <i class="pi pi-clock text-xl"></i>
                    </div>
                </div>
            </div>

            <!-- Stock Crítico -->
            <div class="col-12 sm:col-6 lg:col-3">
                <div 
                    class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center cursor-pointer hover:shadow-2 transition-duration-150"
                    @click="router.push('/admin/inventory-stock')"
                >
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Stock Crítico</span>
                        <Skeleton v-if="loading" width="4rem" height="1.8rem" />
                        <span v-else class="text-2xl font-black text-900" :class="{ 'text-red-500': stats.lowStock > 0 }">
                            {{ stats.lowStock }}
                        </span>
                    </div>
                    <div class="border-round p-3 flex align-items-center justify-content-center bg-red-100 text-red-700">
                        <i class="pi pi-exclamation-triangle text-xl"></i>
                    </div>
                </div>
            </div>

            <!-- Valorización de Inventario -->
            <div class="col-12 sm:col-6 lg:col-3">
                <div 
                    class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center cursor-pointer hover:shadow-2 transition-duration-150"
                    @click="router.push('/inventario')"
                >
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Valor de Inventario</span>
                        <Skeleton v-if="loading" width="6rem" height="1.8rem" />
                        <span v-else class="text-2xl font-black text-900">S/ {{ stats.inventoryValue.toFixed(2) }}</span>
                    </div>
                    <div class="border-round p-3 flex align-items-center justify-content-center bg-green-100 text-green-700">
                        <i class="pi pi-box text-xl"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- TABLA DE PEDIDOS RECIENTES -->
        <div class="surface-card p-4 border-round-xl shadow-1">
            <div class="flex justify-content-between align-items-center mb-3">
                <div>
                    <h3 class="text-lg font-bold text-900 m-0">Últimos Pedidos Registrados</h3>
                    <span class="text-xs text-500">Muestra los 5 movimientos más recientes</span>
                </div>
                <Button label="Ver Todos" icon="pi pi-arrow-right" iconPos="right" text size="small" @click="router.push('/admin/orders')" />
            </div>

            <DataTable :value="recentOrders" :loading="loading" class="p-datatable-sm" responsiveLayout="scroll">
                <template #empty>
                    <div class="text-center p-3 text-500">No hay pedidos registrados recientemente.</div>
                </template>

                <Column field="id" header="N° Orden">
                    <template #body="slotProps">
                        <span class="font-mono text-xs font-bold text-900">
                            #{{ String(slotProps.data.id).padStart(5, '0') }}
                        </span>
                    </template>
                </Column>

                <Column field="created_at" header="Fecha">
                    <template #body="slotProps">
                        <span class="text-xs text-600">{{ formatDate(slotProps.data.created_at) }}</span>
                    </template>
                </Column>

                <Column field="customer.name" header="Cliente">
                    <template #body="slotProps">
                        <span class="font-medium text-800">{{ slotProps.data.customer?.name || 'Cliente Web' }}</span>
                    </template>
                </Column>

                <Column field="total" header="Total">
                    <template #body="slotProps">
                        <span class="font-bold text-900">S/ {{ Number(slotProps.data.total || 0).toFixed(2) }}</span>
                    </template>
                </Column>

                <Column field="status" header="Estado">
                    <template #body="slotProps">
                        <Tag 
                            :value="slotProps.data.status || 'PENDIENTE'" 
                            :severity="getStatusSeverity(slotProps.data.status)" 
                        />
                    </template>
                </Column>
            </DataTable>
        </div>

    </div>
</template>