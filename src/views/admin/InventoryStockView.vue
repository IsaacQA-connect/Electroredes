<script setup>
import api from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';

import InventoryAdjustmentModal from './InventoryAdjustmentModal.vue';
import ProductKardexModal from './ProductKardexModal.vue';

const toast = useToast();
const loading = ref(true);
const products = ref([]);
const valuation = ref({ total_value: 0, products_count: 0 });

// Estados de Filtros
const searchQuery = ref('');
const selectedCategory = ref('ALL');
const selectedBrand = ref('ALL');
const selectedStockStatus = ref('ALL');

const stockStatusOptions = [
    { label: 'Todos los estados', value: 'ALL' },
    { label: 'Críticos y Agotados (≤ Mín.)', value: 'ALERT' },
    { label: 'Agotados (0)', value: 'OUT' },
    { label: 'Stock Crítico (≤ Mínimo)', value: 'CRITICAL' },
    { label: 'Por Agotar (Cerca al mín.)', value: 'WARNING' },
    { label: 'Stock Óptimo', value: 'OPTIMAL' }
];

// Modales
const showAdjustmentModal = ref(false);
const adjustmentType = ref('ENTRY'); // 'INITIAL', 'ENTRY', 'EXIT'
const showKardexModal = ref(false);
const selectedProductId = ref(null);

// Evaluador numérico del estado de stock frente a minimum_stock
const getStockStatus = (product) => {
    const stock = Number(product?.stock) || 0;
    const minStock = Number(product?.minimum_stock) || 0;

    if (stock <= 0) {
        return {
            code: 'OUT',
            label: 'Agotado',
            badgeClass: 'bg-red-600 text-white',
            icon: 'pi pi-times-circle'
        };
    }

    if (minStock > 0 && stock <= minStock) {
        return {
            code: 'CRITICAL',
            label: 'Crítico',
            badgeClass: 'bg-red-100 text-red-800 border-1 border-red-300',
            icon: 'pi pi-exclamation-triangle'
        };
    }

    if (minStock > 0 && stock <= Math.ceil(minStock * 1.5)) {
        return {
            code: 'WARNING',
            label: 'Por agotar',
            badgeClass: 'bg-orange-100 text-orange-800 border-1 border-orange-300',
            icon: 'pi pi-exclamation-circle'
        };
    }

    return {
        code: 'OPTIMAL',
        label: 'Óptimo',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-1 border-emerald-200',
        icon: 'pi pi-check-circle'
    };
};

// Opciones dinámicas de Categoría y Marca basadas en los productos cargados
const categoryOptions = computed(() => {
    const map = new Map();
    products.value.forEach((p) => {
        if (p.category?.id && p.category?.name) {
            map.set(p.category.id, p.category.name);
        }
    });
    return [
        { label: 'Todas las categorías', value: 'ALL' },
        ...Array.from(map, ([value, label]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label))
    ];
});

const brandOptions = computed(() => {
    const map = new Map();
    products.value.forEach((p) => {
        if (p.brand?.id && p.brand?.name) {
            map.set(p.brand.id, p.brand.name);
        }
    });
    return [
        { label: 'Todas las marcas', value: 'ALL' },
        ...Array.from(map, ([value, label]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label))
    ];
});

// Contadores rápidos para tarjetas
const alertStockCount = computed(() =>
    products.value.filter((p) => ['OUT', 'CRITICAL'].includes(getStockStatus(p).code)).length
);

const outOfStockCount = computed(() =>
    products.value.filter((p) => getStockStatus(p).code === 'OUT').length
);

// Filtrado Reactivo Combinado
const filteredProducts = computed(() => {
    return products.value.filter((product) => {
        // 1. Filtro por Categoría
        if (selectedCategory.value !== 'ALL' && product.category?.id !== selectedCategory.value) {
            return false;
        }

        // 2. Filtro por Marca
        if (selectedBrand.value !== 'ALL' && product.brand?.id !== selectedBrand.value) {
            return false;
        }

        // 3. Filtro por Estado de Stock
        if (selectedStockStatus.value !== 'ALL') {
            const statusCode = getStockStatus(product).code;
            if (selectedStockStatus.value === 'ALERT') {
                if (!['OUT', 'CRITICAL'].includes(statusCode)) return false;
            } else if (statusCode !== selectedStockStatus.value) {
                return false;
            }
        }

        // 4. Búsqueda instantánea por texto
        if (!searchQuery.value.trim()) return true;
        const q = searchQuery.value.toLowerCase().trim();

        return (
            (product.name && product.name.toLowerCase().includes(q)) ||
            (product.code && product.code.toLowerCase().includes(q)) ||
            (product.barcode && String(product.barcode).toLowerCase().includes(q)) ||
            (product.category?.name && product.category.name.toLowerCase().includes(q)) ||
            (product.brand?.name && product.brand.name.toLowerCase().includes(q))
        );
    });
});

const hasActiveFilters = computed(() =>
    Boolean(searchQuery.value.trim()) ||
    selectedCategory.value !== 'ALL' ||
    selectedBrand.value !== 'ALL' ||
    selectedStockStatus.value !== 'ALL'
);

const clearFilters = () => {
    searchQuery.value = '';
    selectedCategory.value = 'ALL';
    selectedBrand.value = 'ALL';
    selectedStockStatus.value = 'ALL';
};

const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2
    }).format(Number(val) || 0);
};

const fetchStock = async () => {
    loading.value = true;
    try {
        const response = await api.get('/inventory/stock');
        products.value = response.data.data || response.data || [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el stock de productos.', life: 4000 });
    } finally {
        loading.value = false;
    }
};

const fetchValuation = async () => {
    try {
        const response = await api.get('/inventory/valuation');
        valuation.value = response.data;
    } catch (error) {
        console.error('Error al obtener valoración', error);
    }
};

const openAdjustment = (type) => {
    adjustmentType.value = type;
    showAdjustmentModal.value = true;
};

const openKardex = (productId) => {
    selectedProductId.value = productId;
    showKardexModal.value = true;
};

const handleSaved = () => {
    fetchStock();
    fetchValuation();
};

onMounted(() => {
    fetchStock();
    fetchValuation();
});
</script>

<template>
    <div class="surface-ground p-4 border-round-xl">
        <!-- HEADER -->
        <div class="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3">
            <div>
                <h2 class="text-3xl font-black text-900 m-0">Control de Inventario</h2>
                <p class="text-500 text-sm m-0">Monitoreo de stock, movimientos y valorización de mercancía</p>
            </div>
            <div class="flex gap-2 flex-wrap">
                <Button label="Stock Inicial" icon="pi pi-box" severity="secondary" outlined @click="openAdjustment('INITIAL')" />
                <Button label="Ajuste Salida" icon="pi pi-minus-circle" severity="danger" outlined @click="openAdjustment('EXIT')" />
                <Button label="Ajuste Entrada" icon="pi pi-plus-circle" style="background-color: #2D62A3; border-color: #2D62A3;" @click="openAdjustment('ENTRY')" />
            </div>
        </div>

        <!-- TARJETAS DE VALORACIÓN Y ALERTAS -->
        <div class="grid mb-4">
            <div class="col-12 md:col-4">
                <div class="surface-card p-3 border-round-xl shadow-1 flex align-items-center justify-content-between h-full">
                    <div>
                        <span class="text-500 text-xs font-bold uppercase block">Valor Total Inventario</span>
                        <div class="text-2xl font-black text-900 mt-1">{{ formatCurrency(valuation.total_value) }}</div>
                    </div>
                    <div class="border-round bg-blue-100 p-3 flex align-items-center justify-content-center">
                        <i class="pi pi-dollar text-blue-600 text-xl"></i>
                    </div>
                </div>
            </div>

            <div class="col-12 md:col-4">
                <div
                    class="surface-card p-3 border-round-xl shadow-1 flex align-items-center justify-content-between h-full cursor-pointer hover:shadow-2 transition-duration-150"
                    @click="clearFilters"
                >
                    <div>
                        <span class="text-500 text-xs font-bold uppercase block">Productos Registrados</span>
                        <div class="text-2xl font-black text-900 mt-1">{{ valuation.products_count || products.length }}</div>
                    </div>
                    <div class="border-round bg-green-100 p-3 flex align-items-center justify-content-center">
                        <i class="pi pi-tags text-green-600 text-xl"></i>
                    </div>
                </div>
            </div>

            <div class="col-12 md:col-4">
                <div
                    class="surface-card p-3 border-round-xl shadow-1 flex align-items-center justify-content-between h-full cursor-pointer hover:shadow-2 transition-duration-150"
                    :class="selectedStockStatus === 'ALERT' ? 'border-2 border-red-400' : ''"
                    @click="selectedStockStatus = selectedStockStatus === 'ALERT' ? 'ALL' : 'ALERT'"
                >
                    <div>
                        <span class="text-500 text-xs font-bold uppercase block">Críticos / Agotados</span>
                        <div class="flex align-items-baseline gap-2 mt-1">
                            <span class="text-2xl font-black" :class="alertStockCount > 0 ? 'text-red-600' : 'text-900'">
                                {{ alertStockCount }}
                            </span>
                            <span v-if="outOfStockCount > 0" class="text-xs font-semibold text-red-600">
                                ({{ outOfStockCount }} sin stock)
                            </span>
                        </div>
                    </div>
                    <div class="border-round bg-red-100 p-3 flex align-items-center justify-content-center">
                        <i class="pi pi-exclamation-triangle text-red-600 text-xl"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- TABLA DE STOCK DE PRODUCTOS -->
        <div class="surface-card p-4 border-round-xl shadow-1">
            <!-- BARRA DE FILTROS -->
            <div class="flex flex-column xl:flex-row justify-content-between align-items-stretch xl:align-items-center gap-3 mb-4">
                <IconField iconPosition="left" class="w-full xl:w-20rem">
                    <InputIcon class="pi pi-search" />
                    <InputText
                        v-model="searchQuery"
                        placeholder="Buscar producto, SKU o código barras..."
                        class="p-inputtext-sm w-full"
                    />
                </IconField>

                <div class="flex flex-wrap align-items-center gap-2">
                    <Select
                        v-model="selectedCategory"
                        :options="categoryOptions"
                        optionLabel="label"
                        optionValue="value"
                        class="p-inputtext-sm w-full sm:w-12rem"
                    />

                    <Select
                        v-model="selectedBrand"
                        :options="brandOptions"
                        optionLabel="label"
                        optionValue="value"
                        class="p-inputtext-sm w-full sm:w-12rem"
                    />

                    <Select
                        v-model="selectedStockStatus"
                        :options="stockStatusOptions"
                        optionLabel="label"
                        optionValue="value"
                        class="p-inputtext-sm w-full sm:w-14rem"
                    />

                    <Button
                        v-if="hasActiveFilters"
                        icon="pi pi-filter-slash"
                        label="Limpiar"
                        text
                        size="small"
                        severity="secondary"
                        @click="clearFilters"
                    />

                    <Button
                        icon="pi pi-refresh"
                        text
                        rounded
                        severity="secondary"
                        v-tooltip.top="'Actualizar inventario'"
                        :loading="loading"
                        @click="handleSaved"
                    />
                </div>
            </div>

            <DataTable
                :value="filteredProducts"
                :loading="loading"
                paginator
                :rows="10"
                :rowsPerPageOptions="[10, 25, 50]"
                responsiveLayout="scroll"
                class="p-datatable-sm"
            >
                <template #empty>
                    <div class="text-center p-4 text-500">
                        <i class="pi pi-inbox text-3xl mb-2 block"></i>
                        No se encontraron productos con los filtros seleccionados.
                    </div>
                </template>

                <Column field="code" header="Código / SKU" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-column">
                            <span class="font-mono text-xs font-bold text-900">
                                {{ slotProps.data.code || slotProps.data.barcode || 'N/A' }}
                            </span>
                            <span
                                v-if="slotProps.data.code && slotProps.data.barcode"
                                class="font-mono text-xs text-500"
                            >
                                {{ slotProps.data.barcode }}
                            </span>
                        </div>
                    </template>
                </Column>

                <Column field="name" header="Producto" sortable>
                    <template #body="slotProps">
                        <span class="font-bold text-900">{{ slotProps.data.name }}</span>
                    </template>
                </Column>

                <Column field="category.name" header="Categoría" sortable>
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.category?.name || 'Sin Categoría'" severity="info" />
                    </template>
                </Column>

                <Column field="brand.name" header="Marca" sortable>
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.brand?.name || 'Sin Marca'" severity="warn" />
                    </template>
                </Column>

                <Column field="cost" header="Costo Unit." sortable>
                    <template #body="slotProps">
                        <span>{{ formatCurrency(slotProps.data.cost) }}</span>
                    </template>
                </Column>

                <Column field="stock" header="Stock Actual" sortable>
                    <template #body="slotProps">
                        <div class="flex align-items-center gap-2">
                            <span
                                class="inline-flex align-items-center gap-1 px-2 py-1 border-round text-xs font-bold"
                                :class="getStockStatus(slotProps.data).badgeClass"
                            >
                                <i :class="getStockStatus(slotProps.data).icon" class="text-xs"></i>
                                {{ Number(slotProps.data.stock) }}
                                <span class="font-normal">({{ getStockStatus(slotProps.data).label }})</span>
                            </span>
                            <span
                                v-if="Number(slotProps.data.minimum_stock) > 0"
                                class="text-xs text-500"
                            >
                                Mín: {{ Number(slotProps.data.minimum_stock) }}
                            </span>
                        </div>
                    </template>
                </Column>

                <Column header="Valor Subtotal">
                    <template #body="slotProps">
                        <span class="font-semibold text-700">
                            {{ formatCurrency(Number(slotProps.data.stock) * Number(slotProps.data.cost || 0)) }}
                        </span>
                    </template>
                </Column>

                <Column header="Acciones" style="width: 90px">
                    <template #body="slotProps">
                        <Button
                            icon="pi pi-history"
                            text
                            rounded
                            severity="help"
                            v-tooltip.top="'Ver Kardex'"
                            @click="openKardex(slotProps.data.id)"
                        />
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- MODALES HIJOS (se pasa siempre `products` completo, no `filteredProducts`) -->
        <InventoryAdjustmentModal
            v-model:visible="showAdjustmentModal"
            :type="adjustmentType"
            :productsList="products"
            @saved="handleSaved"
        />
        <ProductKardexModal
            v-model:visible="showKardexModal"
            :productId="selectedProductId"
        />
    </div>
</template>