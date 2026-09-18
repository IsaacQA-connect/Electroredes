<script setup>
import api from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { computed, reactive, ref, watch } from 'vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';

const props = defineProps({
    visible: Boolean,
    type: { type: String, default: 'ENTRY' }, // 'INITIAL', 'ENTRY', 'EXIT'
    productsList: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();

const isSaving = ref(false);
const backendErrors = ref({});

const form = reactive({
    movement_date: new Date().toISOString().split('T')[0],
    notes: '',
    details: []
});

const dialogTitle = computed(() => {
    switch (props.type) {
        case 'INITIAL': return 'Cargar Inventario Inicial';
        case 'EXIT': return 'Registrar Ajuste de Salida';
        default: return 'Registrar Ajuste de Entrada';
    }
});

const showUnitCost = computed(() => props.type !== 'EXIT');

const resetForm = () => {
    form.movement_date = new Date().toISOString().split('T')[0];
    form.notes = '';
    form.details = [
        { product_id: null, quantity: 1, unit_cost: 0 }
    ];
    backendErrors.value = {};
};

watch(() => props.visible, (newVal) => {
    if (newVal) resetForm();
});

const addRow = () => {
    form.details.push({ product_id: null, quantity: 1, unit_cost: 0 });
};

const removeRow = (index) => {
    if (form.details.length > 1) {
        form.details.splice(index, 1);
    }
};

const onProductSelect = (index, productId) => {
    const selectedProd = props.productsList.find(p => p.id === productId);
    if (selectedProd) {
        form.details[index].unit_cost = Number(selectedProd.cost) || 0;
    }
};

const validateFrontend = () => {
    backendErrors.value = {};
    if (!form.movement_date) {
        toast.add({ severity: 'warn', summary: 'Validación', detail: 'La fecha es obligatoria.', life: 3000 });
        return false;
    }
    
    // Validar productos vacíos o duplicados
    const productIds = form.details.map(d => d.product_id);
    if (productIds.some(id => !id)) {
        toast.add({ severity: 'warn', summary: 'Validación', detail: 'Selecciona un producto en cada fila.', life: 3000 });
        return false;
    }

    const hasDuplicates = new Set(productIds).size !== productIds.length;
    if (hasDuplicates) {
        toast.add({ severity: 'warn', summary: 'Validación', detail: 'No puedes duplicar el mismo producto en el detalle.', life: 3000 });
        return false;
    }

    return true;
};

const submitForm = async () => {
    if (!validateFrontend()) return;
    isSaving.value = true;

    let url = '/inventory/adjustments/entry';
    if (props.type === 'INITIAL') url = '/inventory/initial-stock';
    if (props.type === 'EXIT') url = '/inventory/adjustments/exit';

    try {
        await api.post(url, form);
        toast.add({ severity: 'success', summary: 'Éxito', detail: 'Movimiento registrado correctamente.', life: 3000 });
        emit('saved');
        emit('update:visible', false);
    } catch (err) {
        if (err.response && err.response.status === 422) {
            backendErrors.value = err.response.data.errors || {};
            toast.add({ severity: 'warn', summary: 'Error de Validación', detail: err.response.data.message || 'Revisa los campos.', life: 4000 });
        } else {
            toast.add({ severity: 'error', summary: 'Error', detail: 'Error al procesar la solicitud.', life: 4000 });
        }
    } finally {
        isSaving.value = false;
    }
};
</script>

<template>
    <Dialog :visible="visible" :header="dialogTitle" modal class="p-fluid":style="{ width: '90vw', maxWidth: '700px' }" @update:visible="emit('update:visible', $event)">
        <div class="grid mb-3">
            <div class="col-12 md:col-6">
                <label class="font-bold text-xs text-700 uppercase">Fecha de Movimiento *</label>
                <InputText type="date" v-model="form.movement_date" />
            </div>
            <div class="col-12 md:col-6">
                <label class="font-bold text-xs text-700 uppercase">Observaciones</label>
                <Textarea v-model="form.notes" rows="1" placeholder="Ej. Ajuste por toma de inventario físico" />
            </div>
        </div>

        <!-- TABLA DINÁMICA DE DETALLES -->
        <div class="mb-3">
            <div class="flex justify-content-between align-items-center mb-2">
                <span class="font-bold text-sm text-800">Detalle de Productos</span>
                <Button label="Agregar Fila" icon="pi pi-plus" text class="p-button-sm" @click="addRow" />
            </div>

            <DataTable :value="form.details" responsiveLayout="scroll" class="p-datatable-sm border-1 border-300 border-round">
                <Column header="Producto">
                    <template #body="slotProps">
                        <Dropdown 
                            v-model="slotProps.data.product_id" 
                            :options="productsList" 
                            optionLabel="name" 
                            optionValue="id" 
                            placeholder="Selecciona producto"
                            filter
                            class="p-inputtext-sm"
                            @change="onProductSelect(slotProps.index, slotProps.data.product_id)"
                        />
                    </template>
                </Column>

                <Column header="Cantidad" style="width: 130px">
                    <template #body="slotProps">
                        <InputNumber v-model="slotProps.data.quantity" :min="0.01" :fractionDigits="2" class="p-inputtext-sm" />
                    </template>
                </Column>

                <Column v-if="showUnitCost" header="Costo Unit. (S/)" style="width: 140px">
                    <template #body="slotProps">
                        <InputNumber v-model="slotProps.data.unit_cost" :min="0" :fractionDigits="2" class="p-inputtext-sm" />
                    </template>
                </Column>

                <Column header="" style="width: 50px">
                    <template #body="slotProps">
                        <Button icon="pi pi-trash" text severity="danger" border-circle @click="removeRow(slotProps.index)" :disabled="form.details.length === 1" />
                    </template>
                </Column>
            </DataTable>
        </div>

        <template #footer>
            <Button label="Cancelar" text severity="secondary" @click="emit('update:visible', false)" />
            <Button label="Guardar Movimiento" icon="pi pi-check" :loading="isSaving" style="background-color: #2D62A3; border-color: #2D62A3;" @click="submitForm" />
        </template>
    </Dialog>
</template>