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
    totalProducts: 0,
    averageTicket: 0
});

// Listas para Tablas
const recentOrders = ref([]);
const topProducts = ref([]);

// Plugin ligero para dibujar el % directamente sobre cada porción del gráfico Doughnut
const doughnutPercentagePlugin = {
    id: 'doughnutPercentage',
    afterDatasetsDraw(chart) {
        const { ctx, data } = chart;
        const dataset = data.datasets?.[0];
        if (!dataset || !dataset.data?.length) return;

        const total = dataset.data.reduce((acc, val) => acc + (Number(val) || 0), 0);
        if (total <= 0) return;

        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        meta.data.forEach((element, index) => {
            const value = Number(dataset.data[index]) || 0;
            const pct = (value / total) * 100;
            if (pct >= 7) {
                const { x, y } = element.tooltipPosition();
                ctx.fillText(`${pct.toFixed(1)}%`, x, y);
            }
        });
        ctx.restore();
    }
};

// Configuración de Gráficos (Chart.js via PrimeVue)
const channelChartData = ref({});
const channelChartOptions = ref({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '58%',
    plugins: {
        legend: {
            position: 'bottom',
            labels: {
                usePointStyle: true,
                padding: 16,
                font: { size: 12, weight: '600' }
            }
        },
        tooltip: {
            callbacks: {
                label: (context) => {
                    const value = Number(context.raw) || 0;
                    const dataset = context.dataset.data || [];
                    const total = dataset.reduce((acc, v) => acc + (Number(v) || 0), 0);
                    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                    return ` ${formatCurrency(value)} (${pct}%)`;
                }
            }
        }
    }
});

const trendChartData = ref({});
const trendChartOptions = ref({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            callbacks: {
                label: (context) => ` Ventas: ${formatCurrency(context.raw)}`
            }
        }
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

// Helpers de Cliente y Canal
const getCustomerName = (order) => {
    if (!order) return '';
    return (
        order.customer?.name ||
        order.business_name ||
        (order.channel === 'POS' ? 'Cliente POS' : 'Cliente Web')
    );
};

const formatChannelName = (channel) => {
    const normalized = (channel || '').toUpperCase();
    if (normalized === 'POS') return 'POS (Tienda Física)';
    if (normalized === 'WEB') return 'Tienda Web';
    return channel || 'Venta Directa';
};

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
        const metricsParams = { period: selectedPeriod.value };
        if (selectedPeriod.value === 'custom' && startDate.value && endDate.value) {
            metricsParams.start_date = startDate.value;
            metricsParams.end_date = endDate.value;
        }

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

        // Gráfico de Ventas por Canal con Porcentajes en Leyenda
        const rawChannels = metrics.sales_by_channel || [];
        const channelTotals = rawChannels.map(c => Number(c.total_amount || 0));
        const grandChannelTotal = channelTotals.reduce((acc, v) => acc + v, 0);

        const channelLabels = rawChannels.map((c, idx) => {
            const name = formatChannelName(c.channel);
            const pct = grandChannelTotal > 0
                ? ((channelTotals[idx] / grandChannelTotal) * 100).toFixed(1)
                : '0.0';
            return `${name} (${pct}%)`;
        });

        // Colores consistentes por canal (POS = Naranja/Dorado, WEB = Azul)
        const channelColors = rawChannels.map(c => {
            const ch = (c.channel || '').toUpperCase();
            if (ch === 'POS') return '#D8AC67';
            if (ch === 'WEB') return '#2D62A3';
            return '#10B981';
        });

        channelChartData.value = {
            labels: channelLabels.length ? channelLabels : ['Sin ventas (0%)'],
            datasets: [{
                data: channelTotals.length ? channelTotals : [0],
                backgroundColor: channelColors.length ? channelColors : ['#CBD5E1'],
                hoverBackgroundColor: rawChannels.map(c => {
                    const ch = (c.channel || '').toUpperCase();
                    if (ch === 'POS') return '#B88F4C';
                    if (ch === 'WEB') return '#1E4575';
                    return '#059669';
                })
            }]
        };

        // Gráfico de Tendencia de Ventas
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

        // 2. Pedidos Recientes (ordenados del más reciente al más antiguo)
        const ordersData = (ordersRes.data.data || ordersRes.data || []).sort((a, b) => {
            const dateA = new Date((a.order_date || a.created_at || '').replace(' ', 'T'));
            const dateB = new Date((b.order_date || b.created_at || '').replace(' ', 'T'));
            return dateB - dateA || b.id - a.id;
        });

        recentOrders.value = ordersData.slice(0, 5);
        stats.value.pendingOrders = ordersData.filter(o =>
            ['PENDIENTE', 'PENDING'].includes(o.status?.toUpperCase())
        ).length;

        // Ticket promedio de pedidos válidos
        const validOrders = ordersData.filter(o =>
            !['CANCELLED', 'CANCELADO'].includes(o.status?.toUpperCase())
        );
        const validSum = validOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
        stats.value.averageTicket = validOrders.length > 0 ? validSum / validOrders.length : 0;

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
    if (selectedPeriod.value === 'custom') {
        if (!endDate.value) {
            const today = new Date();
            const weekAgo = new Date();
            weekAgo.setDate(today.getDate() - 7);
            endDate.value = today.toISOString().split('T')[0];
            startDate.value = weekAgo.toISOString().split('T')[0];
        }
        return;
    }
    fetchDashboardData();
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

const getStatusLabel = (status) => {
    const labels = {
        PENDING: 'Pendiente',
        PENDIENTE: 'Pendiente',
        COMPLETED: 'Completado',
        COMPLETADO: 'Completado',
        CANCELLED: 'Cancelado',
        CANCELADO: 'Cancelado'
    };
    return labels[status?.toUpperCase()] || status || 'Pendiente';
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const normalized = typeof dateString === 'string' ? dateString.replace(' ', 'T') : dateString;
    return new Date(normalized).toLocaleDateString('es-PE', {
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
                        :disabled="!startDate || !endDate"
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

        <!-- ALERTAS OPERATIVAS RÁPIDAS -->
        <div
            v-if="!loading && (stats.lowStock > 0 || stats.pendingOrders > 0)"
            class="flex flex-wrap gap-2 mb-4"
        >
            <div
                v-if="stats.pendingOrders > 0"
                class="flex align-items-center gap-2 bg-orange-50 border-1 border-orange-200 text-orange-800 px-3 py-2 border-round-lg text-xs font-semibold cursor-pointer"
                @click="router.push('/admin/orders')"
            >
                <i class="pi pi-clock"></i>
                <span>Tienes {{ stats.pendingOrders }} pedido(s) pendiente(s) por atender.</span>
                <i class="pi pi-arrow-right text-xs"></i>
            </div>

            <div
                v-if="stats.lowStock > 0"
                class="flex align-items-center gap-2 bg-red-50 border-1 border-red-200 text-red-800 px-3 py-2 border-round-lg text-xs font-semibold cursor-pointer"
                @click="router.push('/admin/inventory-stock')"
            >
                <i class="pi pi-exclamation-triangle"></i>
                <span>{{ stats.lowStock }} producto(s) con stock crítico requieren reposición.</span>
                <i class="pi pi-arrow-right text-xs"></i>
            </div>
        </div>

        <!-- TARJETAS DE MÉTRICAS / KPIS -->
        <div class="grid mb-4">
            <!-- Ventas Totales -->
            <div class="col-12 sm:col-6 md:col-4 xl:col">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center h-full">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Ventas Totales</span>
                        <Skeleton v-if="loading" width="6rem" height="1.8rem" />
                        <template v-else>
                            <span class="text-2xl font-black text-900 block">{{ formatCurrency(stats.totalSales) }}</span>
                            <span class="text-xs text-500">Ticket prom: {{ formatCurrency(stats.averageTicket) }}</span>
                        </template>
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
                        <template v-else>
                            <span class="text-2xl font-black text-900 block">{{ formatCurrency(stats.inventoryValue) }}</span>
                            <span v-if="stats.totalProducts" class="text-xs text-500">{{ stats.totalProducts }} productos</span>
                        </template>
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
                        <span class="text-xs text-500 font-medium">Participación % por origen</span>
                    </div>
                    <div style="height: 280px;">
                        <Chart
                            type="doughnut"
                            :data="channelChartData"
                            :options="channelChartOptions"
                            :plugins="[doughnutPercentagePlugin]"
                            class="h-full"
                        />
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
                                    {{ slotProps.data.code || `#${String(slotProps.data.id).padStart(5, '0')}` }}
                                </span>
                            </template>
                        </Column>

                        <Column field="created_at" header="Fecha">
                            <template #body="slotProps">
                                <span class="text-xs text-600">{{ formatDate(slotProps.data.order_date || slotProps.data.created_at) }}</span>
                            </template>
                        </Column>

                        <Column field="customer.name" header="Cliente / Canal">
                            <template #body="slotProps">
                                <div class="flex align-items-center gap-2">
                                    <span class="font-medium text-800">{{ getCustomerName(slotProps.data) }}</span>
                                    <span
                                        class="text-xs font-semibold px-2 py-0 border-round"
                                        :class="slotProps.data.channel === 'POS' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'"
                                    >
                                        {{ slotProps.data.channel || 'WEB' }}
                                    </span>
                                </div>
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
                                    :value="getStatusLabel(slotProps.data.status)"
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