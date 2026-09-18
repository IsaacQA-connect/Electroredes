<script setup>
import api from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { ref, watch } from 'vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import ColumnGroup from 'primevue/columngroup';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Row from 'primevue/row';
import Tag from 'primevue/tag';

const props = defineProps({
    visible: Boolean,
    productId: Number
});

const emit = defineEmits(['update:visible']);
const toast = useToast();

const loading = ref(false);
const kardexData = ref(null);
const startDate = ref('');
const endDate = ref('');

const fetchKardex = async () => {
    if (!props.productId) return;
    loading.value = true;
    try {
        const response = await api.get(`/inventory/kardex/${props.productId}`, {
            params: { start_date: startDate.value, end_date: endDate.value }
        });
        kardexData.value = response.data.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo obtener el Kardex del producto.', life: 4000 });
    } finally {
        loading.value = false;
    }
};

watch(() => [props.visible, props.productId], ([newVisible, newId]) => {
    if (newVisible && newId) {
        startDate.value = '';
        endDate.value = '';
        fetchKardex();
    }
});
</script>

<template>
    <Dialog :visible="visible" header="Kardex Valorizado de Producto" modal class="p-fluid":style="{ width: '95vw', maxWidth: '1150px' }" @update:visible="emit('update:visible', $event)">
        <!-- CABECERA DE INFORMACIÓN DEL PRODUCTO -->
        <div v-if="kardexData?.product" class="surface-100 p-3 border-round-lg mb-3 flex flex-column md:flex-row justify-content-between gap-3">
            <div>
                <span class="text-xs font-bold text-500 uppercase">Producto</span>
                <div class="text-lg font-bold text-900">{{ kardexData.product.name }}</div>
                <span class="text-xs text-600">SKU: {{ kardexData.product.code || 'N/A' }}</span>
            </div>
            <div class="flex gap-4">
                <div>
                    <span class="text-xs font-bold text-500 uppercase">Stock Actual</span>
                    <div class="text-lg font-bold text-blue-600">{{ kardexData.product.stock }}</div>
                </div>
                <div>
                    <span class="text-xs font-bold text-500 uppercase">Costo Ponderado</span>
                    <div class="text-lg font-bold text-green-600">S/ {{ Number(kardexData.product.cost).toFixed(2) }}</div>
                </div>
            </div>
        </div>

        <!-- FILTROS DE FECHA -->
        <div class="flex flex-column sm:flex-row gap-3 mb-3 align-items-end">
            <div class="flex-1">
                <label class="text-xs font-bold text-600">Desde</label>
                <InputText type="date" v-model="startDate" class="p-inputtext-sm" />
            </div>
            <div class="flex-1">
                <label class="text-xs font-bold text-600">Hasta</label>
                <InputText type="date" v-model="endDate" class="p-inputtext-sm" />
            </div>
            <Button label="Filtrar" icon="pi pi-filter" class="p-button-sm" style="background-color: #2D62A3;" @click="fetchKardex" />
        </div>

        <!-- TABLA KARDEX MULTI-HEADER -->
        <DataTable :value="kardexData?.movements || []" :loading="loading" responsiveLayout="scroll" class="p-datatable-sm border-1 border-200">
            <ColumnGroup type="header">
                <Row>
                    <Column header="Fecha" :rowspan="2" />
                    <Column header="Tipo / Detalle" :rowspan="2" />
                    <Column header="ENTRADAS" :colspan="3" class="text-center bg-blue-50" />
                    <Column header="SALIDAS" :colspan="3" class="text-center bg-orange-50" />
                    <Column header="SALDOS (Promedio Ponderado)" :colspan="3" class="text-center bg-green-50" />
                </Row>
                <Row>
                    <Column header="Cant." class="bg-blue-50" />
                    <Column header="Costo U." class="bg-blue-50" />
                    <Column header="Total" class="bg-blue-50" />
                    <Column header="Cant." class="bg-orange-50" />
                    <Column header="Costo U." class="bg-orange-50" />
                    <Column header="Total" class="bg-orange-50" />
                    <Column header="Stock" class="bg-green-50" />
                    <Column header="Costo U." class="bg-green-50" />
                    <Column header="Total" class="bg-green-50" />
                </Row>
            </ColumnGroup>

            <Column field="date">
                <template #body="slotProps">
                    <span class="text-xs">{{ new Date(slotProps.data.date).toLocaleDateString() }}</span>
                </template>
            </Column>

            <Column field="type">
                <template #body="slotProps">
                    <div class="flex flex-column">
                        <Tag :value="slotProps.data.type" severity="secondary" style="font-size: 10px;" />
                        <span class="text-xs text-500 mt-1">{{ slotProps.data.notes }}</span>
                    </div>
                </template>
            </Column>

            <!-- ENTRADAS -->
            <Column field="entry.quantity"><template #body="s"><span class="text-xs">{{ s.data.entry.quantity || '-' }}</span></template></Column>
            <Column field="entry.unit_cost"><template #body="s"><span class="text-xs">{{ s.data.entry.unit_cost ? 'S/ ' + s.data.entry.unit_cost : '-' }}</span></template></Column>
            <Column field="entry.total_cost"><template #body="s"><span class="text-xs font-semibold">{{ s.data.entry.total_cost ? 'S/ ' + s.data.entry.total_cost : '-' }}</span></template></Column>

            <!-- SALIDAS -->
            <Column field="exit.quantity"><template #body="s"><span class="text-xs">{{ s.data.exit.quantity || '-' }}</span></template></Column>
            <Column field="exit.unit_cost"><template #body="s"><span class="text-xs">{{ s.data.exit.unit_cost ? 'S/ ' + s.data.exit.unit_cost : '-' }}</span></template></Column>
            <Column field="exit.total_cost"><template #body="s"><span class="text-xs font-semibold">{{ s.data.exit.total_cost ? 'S/ ' + s.data.exit.total_cost : '-' }}</span></template></Column>

            <!-- SALDOS -->
            <Column field="balance.stock"><template #body="s"><span class="text-xs font-bold text-blue-700">{{ s.data.balance.stock }}</span></template></Column>
            <Column field="balance.unit_cost"><template #body="s"><span class="text-xs">S/ {{ s.data.balance.unit_cost }}</span></template></Column>
            <Column field="balance.total_cost"><template #body="s"><span class="text-xs font-bold text-green-700">S/ {{ s.data.balance.total_cost }}</span></template></Column>
        </DataTable>

        <template #footer>
            <Button label="Cerrar" text severity="secondary" @click="emit('update:visible', false)" />
        </template>
    </Dialog>
</template>