<script setup>
import api from '@/service/api';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import Chart from 'primevue/chart';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';

const router = useRouter();
const loading = ref(true);

// Estado de Filtros por Fecha
const selectedPeriod = ref('7days');
const startDate = ref('');
const endDate = ref('');

const periodOptions = [
    { label: 'Hoy', value: 'today' },
    { label: 'Últimos 7 días', value: '7days' },
    { label: 'Últimos 30 días', value: '30days' },
    { label: 'Este mes', value: 'this_month' },
    { label: 'Mes anterior', value: 'last_month' },
    { label: 'Personalizado', value: 'custom' }
];

// Estado de KPIs Generales y Financieros
const stats = ref({
    totalSales: 0,
    grossProfit: 0,
    profitMargin: 0,
    pendingOrders: 0,
    lowStock: 0,
    inventoryValue: 0,
    totalProducts: 0
});

// Listas para Tablas
const recentOrders = ref([]);
const topProducts = ref([]);

// Configuración de Gráficos (Chart.js via PrimeVue)
const channelChartData = ref({});
const channelChartOptions = ref({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'bottom' }
    }
});

const trendChartData = ref({});
const trendChartOptions = ref({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false }
    },
    scales: {
        y: { 
            beginAtZero: true,
            ticks: {
                callback: (value) => 'S/ ' + value.toLocaleString('es-PE')
            }
        }
    }
});

// Formateador oficial de Moneda Peruana (S/)
const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2
    }).format(Number(val) || 0);
};

// Severidad dinámica para el badge del Margen de Ganancia
const marginSeverity = computed(() => {
    const margin = stats.value.profitMargin;
    if (margin >= 25) return 'success';
    if (margin >= 10) return 'warn';
    return 'danger';
});

const fetchDashboardData = async () => {
    loading.value = true;
    try {
        // Construir parámetros de filtro para la API analítica
        const metricsParams = { period: selectedPeriod.value };
        if (selectedPeriod.value === 'custom' && startDate.value && endDate.value) {
            metricsParams.start_date = startDate.value;
            metricsParams.end_date = endDate.value;
        }

        // Carga simultánea del controlador analítico y servicios existentes
        const [metricsRes, ordersRes, stockRes, valuationRes] = await Promise.all([
            api.get('/dashboard/metrics', { params: metricsParams }),
            api.get('/orders'),
            api.get('/inventory/low-stock'),
            api.get('/inventory/valuation')
        ]);

        // 1. Cargar Métricas Analíticas
        const metrics = metricsRes.data || {};
        stats.value.totalSales = Number(metrics.kpis?.total_sales || 0);
        stats.value.grossProfit = Number(metrics.kpis?.gross_profit || 0);
        stats.value.profitMargin = Number(metrics.kpis?.profit_margin_percentage || 0);
        topProducts.value = metrics.top_products || [];

        // Gráfico de Ventas por Canal
        const channels = (metrics.sales_by_channel || []).map(c => c.channel || 'VENTA DIRECTA');
        const channelTotals = (metrics.sales_by_channel || []).map(c => Number(c.total_amount || 0));
        
        channelChartData.value = {
            labels: channels.length ? channels : ['Sin ventas'],
            datasets: [{
                data: channelTotals.length ? channelTotals : [0],
                backgroundColor: ['#2D62A3', '#D8AC67', '#10B981', '#6366F1', '#EC4899'],
                hoverBackgroundColor: ['#1E4575', '#B88F4C', '#059669', '#4F46E5', '#DB2777']
            }]
        };

        // Gráfico de Tendencia de Ventas (Filtrado por periodo)
        const dates = (metrics.sales_trend || []).map(t => formatDateShort(t.date));
        const totals = (metrics.sales_trend || []).map(t => Number(t.daily_total || 0));
        
        trendChartData.value = {
            labels: dates,
            datasets: [{
                label: 'Ventas (S/)',
                data: totals,
                fill: true,
                borderColor: '#2D62A3',
                backgroundColor: 'rgba(45, 98, 163, 0.12)',
                tension: 0.35,
                pointRadius: 4,
                pointBackgroundColor: '#2D62A3'
            }]
        };

        // 2. Pedidos Recientes y Pendientes
        const ordersData = ordersRes.data.data || ordersRes.data || [];
        recentOrders.value = ordersData.slice(0, 5);
        stats.value.pendingOrders = ordersData.filter(o => ['PENDIENTE', 'PENDING'].includes(o.status?.toUpperCase())).length;

        // 3. Stock Crítico
        const lowStockData = stockRes.data.data || stockRes.data || [];
        stats.value.lowStock = lowStockData.length;

        // 4. Valorización de Inventario
        const valData = valuationRes.data || {};
        stats.value.inventoryValue = Number(valData.total_value || 0);
        stats.value.totalProducts = valData.products_count || metrics.kpis?.total_products || 0;

    } catch (error) {
        console.error('Error al cargar métricas del dashboard:', error);
    } finally {
        loading.value = false;
    }
};

const handlePeriodChange = () => {
    if (selectedPeriod.value !== 'custom') {
        fetchDashboardData();
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

const formatDateShort = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}`;
};

onMounted(() => {
    fetchDashboardData();
});
</script>

<template>
    <div class="surface-ground p-4 border-round-xl">
        
        <!-- ENCABEZADO Y FILTROS POR FECHA -->
        <div class="flex flex-column lg:flex-row justify-content-between align-items-start lg:align-items-center mb-4 gap-3">
            <div>
                <h2 class="text-3xl font-black text-900 m-0">Panel General</h2>
                <p class="text-500 text-sm m-0">Resumen operativo y métricas financieras de ElectroRedes</p>
            </div>

            <!-- FILTRO DE FECHAS Y ACCIONES -->
            <div class="flex flex-wrap align-items-center gap-2 w-full lg:w-auto">
                
                <!-- Selector de Periodo -->
                <div class="flex align-items-center gap-2 bg-white border-1 surface-border border-round-3xl px-3 py-1 shadow-1">
                    <i class="pi pi-calendar text-500"></i>
                    <select 
                        v-model="selectedPeriod" 
                        @change="handlePeriodChange"
                        class="border-none bg-transparent text-sm font-semibold text-700 outline-none cursor-pointer py-1"
                    >
                        <option v-for="opt in periodOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                        </option>
                    </select>
                </div>

                <!-- Entradas de Rango Personalizado -->
                <div v-if="selectedPeriod === 'custom'" class="flex align-items-center gap-2 bg-white p-1 border-1 surface-border border-round-3xl shadow-1">
                    <input 
                        type="date" 
                        v-model="startDate" 
                        class="border-none text-xs text-700 outline-none px-2 py-1"
                    />
                    <span class="text-400 text-xs">-</span>
                    <input 
                        type="date" 
                        v-model="endDate" 
                        class="border-none text-xs text-700 outline-none px-2 py-1"
                    />
                    <Button 
                        icon="pi pi-search" 
                        class="p-button-sm p-button-rounded p-button-text"
                        @click="fetchDashboardData"
                    />
                </div>

                <!-- Botón de Refrescar -->
                <Button 
                    icon="pi pi-refresh" 
                    text 
                    rounded 
                    severity="secondary" 
                    v-tooltip.top="'Actualizar datos'"
                    :loading="loading"
                    @click="fetchDashboardData" 
                />

                <!-- Accesos Rápidos Modulares -->
                <Button 
                    label="Inventario" 
                    icon="pi pi-box" 
                    class="p-button-sm border-round-3xl" 
                    style="background-color: #2D62A3; border-color: #2D62A3;" 
                    @click="router.push('/admin/inventory-stock')" 
                />
                <Button 
                    label="Pedidos" 
                    icon="pi pi-shopping-bag" 
                    class="p-button-sm border-round-3xl" 
                    severity="secondary"
                    @click="router.push('/admin/orders')" 
                />
                <Button 
                    label="Caja" 
                    icon="pi pi-wallet" 
                    class="p-button-sm border-round-3xl" 
                    severity="help"
                    @click="router.push('/admin/cash-register')" 
                />
            </div>
        </div>

        <!-- TARJETAS DE MÉTRICAS / KPIS (5 Métricas Financieras y Operativas) -->
        <div class="grid mb-4">
            <!-- Ventas Totales -->
            <div class="col-12 sm:col-6 md:col-4 xl:col">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center h-full">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Ventas Totales</span>
                        <Skeleton v-if="loading" width="6rem" height="1.8rem" />
                        <span v-else class="text-2xl font-black text-900">{{ formatCurrency(stats.totalSales) }}</span>
                    </div>
                    <div class="border-round p-3 flex align-items-center justify-content-center bg-blue-100 text-blue-700">
                        <i class="pi pi-dollar text-xl"></i>
                    </div>
                </div>
            </div>

            <!-- Ganancia Bruta y Margen % -->
            <div class="col-12 sm:col-6 md:col-4 xl:col">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center h-full">
                    <div>
                        <div class="flex align-items-center gap-2 mb-1">
                            <span class="text-xs text-500 font-bold uppercase">Ganancia Bruta</span>
                            <Tag v-if="!loading" :value="`${stats.profitMargin}%`" :severity="marginSeverity" class="text-xs p-1" />
                        </div>
                        <Skeleton v-if="loading" width="6rem" height="1.8rem" />
                        <span v-else class="text-2xl font-black text-emerald-600">{{ formatCurrency(stats.grossProfit) }}</span>
                    </div>
                    <div class="border-round p-3 flex align-items-center justify-content-center bg-emerald-100 text-emerald-700">
                        <i class="pi pi-chart-line text-xl"></i>
                    </div>
                </div>
            </div>

            <!-- Pedidos Pendientes -->
            <div class="col-12 sm:col-6 md:col-4 xl:col">
                <div 
                    class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center h-full cursor-pointer hover:shadow-2 transition-duration-150"
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
            <div class="col-12 sm:col-6 md:col-4 xl:col">
                <div 
                    class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center h-full cursor-pointer hover:shadow-2 transition-duration-150"
                    @click="router.push('/admin/inventory-stock')"
                >
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Stock Crítico</span>
                        <Skeleton v-if="loading" width="4rem" height="1.8rem" />
                        <span v-else class="text-2xl font-black" :class="stats.lowStock > 0 ? 'text-red-500' : 'text-900'">
                            {{ stats.lowStock }}
                        </span>
                    </div>
                    <div class="border-round p-3 flex align-items-center justify-content-center bg-red-100 text-red-700">
                        <i class="pi pi-exclamation-triangle text-xl"></i>
                    </div>
                </div>
            </div>

            <!-- Valorización de Inventario -->
            <div class="col-12 sm:col-6 md:col-4 xl:col">
                <div 
                    class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center h-full cursor-pointer hover:shadow-2 transition-duration-150"
                    @click="router.push('/admin/inventory-stock')"
                >
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Valor de Inventario</span>
                        <Skeleton v-if="loading" width="6rem" height="1.8rem" />
                        <span v-else class="text-2xl font-black text-900">{{ formatCurrency(stats.inventoryValue) }}</span>
                    </div>
                    <div class="border-round p-3 flex align-items-center justify-content-center bg-green-100 text-green-700">
                        <i class="pi pi-box text-xl"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- GRÁFICOS ANALÍTICOS -->
        <div class="grid mb-4">
            <!-- Tendencia de Ventas -->
            <div class="col-12 lg:col-8">
                <div class="surface-card p-4 border-round-xl shadow-1">
                    <div class="flex justify-content-between align-items-center mb-3">
                        <h3 class="text-lg font-bold text-900 m-0">Tendencia de Ventas</h3>
                        <span class="text-xs text-500 font-medium">Comportamiento temporal de ingresos</span>
                    </div>
                    <div style="height: 280px;">
                        <Chart type="line" :data="trendChartData" :options="trendChartOptions" class="h-full" />
                    </div>
                </div>
            </div>

            <!-- Ventas por Canal -->
            <div class="col-12 lg:col-4">
                <div class="surface-card p-4 border-round-xl shadow-1">
                    <div class="flex justify-content-between align-items-center mb-3">
                        <h3 class="text-lg font-bold text-900 m-0">Canales de Venta</h3>
                        <span class="text-xs text-500 font-medium">Distribución por origen</span>
                    </div>
                    <div style="height: 280px;">
                        <Chart type="doughnut" :data="channelChartData" :options="channelChartOptions" class="h-full" />
                    </div>
                </div>
            </div>
        </div>

        <!-- TABLAS EN PARALELO: TOP PRODUCTOS Y PEDIDOS RECIENTES -->
        <div class="grid">
            <!-- TOP PRODUCTOS Y MÁRGENES -->
            <div class="col-12 xl:col-6">
                <div class="surface-card p-4 border-round-xl shadow-1 h-full">
                    <div class="mb-3">
                        <h3 class="text-lg font-bold text-900 m-0">Top 5 Productos Vendidos</h3>
                        <span class="text-xs text-500">Volumen de ventas en el periodo seleccionado</span>
                    </div>

                    <DataTable :value="topProducts" :loading="loading" class="p-datatable-sm" responsiveLayout="scroll">
                        <template #empty>
                            <div class="text-center p-3 text-500">Sin datos de productos en este rango de fechas.</div>
                        </template>

                        <Column field="name" header="Producto"></Column>
                        <Column field="total_qty" header="Cant." sortable class="text-center"></Column>
                        <Column field="total_revenue" header="Ingresos">
                            <template #body="slotProps">
                                <span class="font-bold text-900">{{ formatCurrency(slotProps.data.total_revenue) }}</span>
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </div>

            <!-- ÚLTIMOS PEDIDOS REGISTRADOS -->
            <div class="col-12 xl:col-6">
                <div class="surface-card p-4 border-round-xl shadow-1 h-full">
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
                                <span class="font-bold text-900">{{ formatCurrency(slotProps.data.total) }}</span>
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
        </div>

    </div>
</template>