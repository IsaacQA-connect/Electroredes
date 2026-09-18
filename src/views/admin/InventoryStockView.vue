<script setup>
import api from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';

import InventoryAdjustmentModal from './InventoryAdjustmentModal.vue';
import ProductKardexModal from './ProductKardexModal.vue';

const toast = useToast();
const loading = ref(true);
const products = ref([]);
const searchQuery = ref('');
const valuation = ref({ total_value: 0, products_count: 0 });

// Modales
const showAdjustmentModal = ref(false);
const adjustmentType = ref('ENTRY'); // 'INITIAL', 'ENTRY', 'EXIT'

const showKardexModal = ref(false);
const selectedProductId = ref(null);

const fetchStock = async () => {
    loading.value = true;
    try {
        const response = await api.get('/inventory/stock', {
            params: { search: searchQuery.value }
        });
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

        <!-- TARJETAS DE VALORACIÓN -->
        <div class="grid mb-4">
            <div class="col-12 md:col-6 lg:col-4">
                <div class="surface-card p-3 border-round-xl shadow-1 flex align-items-center justify-content-between">
                    <div>
                        <span class="text-500 text-sm font-semibold">Valor Total Inventario</span>
                        <div class="text-2xl font-bold text-900 mt-1">S/ {{ Number(valuation.total_value || 0).toFixed(2) }}</div>
                    </div>
                    <div class="border-round-circle bg-blue-100 p-3 flex align-items-center justify-content-center">
                        <i class="pi pi-dollar text-blue-600 text-xl"></i>
                    </div>
                </div>
            </div>
            <div class="col-12 md:col-6 lg:col-4">
                <div class="surface-card p-3 border-round-xl shadow-1 flex align-items-center justify-content-between">
                    <div>
                        <span class="text-500 text-sm font-semibold">Productos Registrados</span>
                        <div class="text-2xl font-bold text-900 mt-1">{{ valuation.products_count || 0 }}</div>
                    </div>
                    <div class="border-round-circle bg-green-100 p-3 flex align-items-center justify-content-center">
                        <i class="pi pi-tags text-green-600 text-xl"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- TABLA DE STOCK DE PRODUCTOS -->
        <div class="surface-card p-4 border-round-xl shadow-1">
            <div class="flex justify-content-between align-items-center mb-3">
                <IconField iconPosition="left">
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="searchQuery" placeholder="Buscar por nombre, código o SKU..." class="p-inputtext-sm" @keyup.enter="fetchStock" />
                </IconField>
                <Button icon="pi pi-refresh" text border-circle severity="secondary" @click="fetchStock" />
            </div>

            <DataTable :value="products" :loading="loading" paginator :rows="10" responsiveLayout="scroll" class="p-datatable-sm">
                <Column field="code" header="Código/SKU">
                    <template #body="slotProps">
                        <span class="font-mono text-bold">{{ slotProps.data.code || slotProps.data.barcode || 'N/A' }}</span>
                    </template>
                </Column>

                <Column field="name" header="Producto" sortable>
                    <template #body="slotProps">
                        <span class="font-bold text-900">{{ slotProps.data.name }}</span>
                    </template>
                </Column>

                <Column field="category.name" header="Categoría">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.category?.name || 'Sin Categoría'" severity="info" />
                    </template>
                </Column>

                <Column field="cost" header="Costo Unit.">
                    <template #body="slotProps">
                        <span>S/ {{ Number(slotProps.data.cost || 0).toFixed(2) }}</span>
                    </template>
                </Column>

                <Column field="stock" header="Stock Actual" sortable>
                    <template #body="slotProps">
                        <Tag 
                            :value="slotProps.data.stock" 
                            :severity="slotProps.data.stock <= (slotProps.data.minimum_stock || 0) ? 'danger' : 'success'" 
                        />
                    </template>
                </Column>

                <Column header="Valor Subtotal">
                    <template #body="slotProps">
                        <span class="font-semibold text-700">
                            S/ {{ (Number(slotProps.data.stock) * Number(slotProps.data.cost || 0)).toFixed(2) }}
                        </span>
                    </template>
                </Column>

                <Column header="Acciones" style="width: 100px">
                    <template #body="slotProps">
                        <Button icon="pi pi-history" text border-circle severity="help" v-tooltip.top="'Ver Kardex'" @click="openKardex(slotProps.data.id)" />
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- MODALES Hijos -->
        <InventoryAdjustmentModal v-model:visible="showAdjustmentModal" :type="adjustmentType" :productsList="products" @saved="handleSaved" />
        <ProductKardexModal v-model:visible="showKardexModal" :productId="selectedProductId" />
    </div>
</template>