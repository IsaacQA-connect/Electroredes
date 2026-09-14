<script setup>
import api from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

const toast = useToast();
const currentRegister = ref(null);
const loading = ref(true);

// Modales
const movementDialog = ref(false);
const closeDialog = ref(false);

// Formularios
const movement = ref({ type: 'OUTFLOW', amount: 0, description: '' });
const closeData = ref({ closing_balance: 0, notes: '' });

const fetchCurrentRegister = async () => {
    loading.value = true;
    try {
        const response = await api.get('/cash-registers/current');
        currentRegister.value = response.data.data;
    } catch (error) {
        currentRegister.value = null;
    } finally {
        loading.value = false;
    }
};

const openMovementModal = () => {
    movement.value = { type: 'OUTFLOW', amount: 0, description: '' };
    movementDialog.value = true;
};

const registerMovement = async () => {
    if (movement.value.amount <= 0 || !movement.value.description) {
        toast.add({ severity: 'warn', summary: 'Atención', detail: 'Completa el monto y la descripción', life: 3000 });
        return;
    }

    try {
        await api.post(`/cash-registers/${currentRegister.value.id}/movements`, movement.value);
        toast.add({ severity: 'success', summary: 'Éxito', detail: 'Movimiento registrado correctamente', life: 3000 });
        movementDialog.value = false;
        fetchCurrentRegister();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Error al registrar', life: 3000 });
    }
};

const openCloseModal = () => {
    closeData.value = { closing_balance: 0, notes: '' };
    closeDialog.value = true;
};

const closeCashRegister = async () => {
    try {
        await api.post(`/cash-registers/${currentRegister.value.id}/close`, closeData.value);
        toast.add({ severity: 'success', summary: 'Caja Cerrada', detail: 'El turno de caja se ha cerrado exitosamente', life: 4000 });
        closeDialog.value = false;
        fetchCurrentRegister();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Error al cerrar caja', life: 3000 });
    }
};

onMounted(() => {
    fetchCurrentRegister();
});
</script>

<template>
    <div class="grid">
        <Toast />
        <div class="col-12" v-if="currentRegister">
            <div class="card p-4">
                <div class="flex justify-content-between align-items-center mb-4">
                    <div>
                        <h4 class="m-0">Arqueo y Cierre de Caja Chica</h4>
                        <span class="text-500">Cajero asignado: {{ currentRegister.user?.name }}</span>
                    </div>
                    <div>
                        <Button label="Registrar Egreso/Ingreso" icon="pi pi-plus" severity="warning" class="mr-2" @click="openMovementModal" />
                        <Button label="Cerrar Caja" icon="pi pi-lock" severity="danger" @click="openCloseModal" />
                    </div>
                </div>

                <!-- Resumen de Saldos -->
                <div class="grid mb-4">
                    <div class="col-12 md:col-4">
                        <div class="surface-100 p-3 border-round text-center">
                            <span class="text-500 font-medium">Monto Inicial</span>
                            <div class="text-2xl font-bold text-900 mt-2">S/ {{ currentRegister.opening_balance }}</div>
                        </div>
                    </div>
                    <div class="col-12 md:col-4">
                        <div class="surface-100 p-3 border-round text-center">
                            <span class="text-500 font-medium">Total Inflows (Ingresos)</span>
                            <div class="text-2xl font-bold text-green-600 mt-2">
                                S/ {{ currentRegister.movements?.filter(m => m.type === 'INFLOW').reduce((a, b) => a + Number(b.amount), 0).toFixed(2) }}
                            </div>
                        </div>
                    </div>
                    <div class="col-12 md:col-4">
                        <div class="surface-100 p-3 border-round text-center">
                            <span class="text-500 font-medium">Total Outflows (Egresos)</span>
                            <div class="text-2xl font-bold text-red-600 mt-2">
                                S/ {{ currentRegister.movements?.filter(m => m.type === 'OUTFLOW').reduce((a, b) => a + Number(b.amount), 0).toFixed(2) }}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Historial de Movimientos -->
                <h5>Movimientos Registrados</h5>
                <DataTable :value="currentRegister.movements" responsiveLayout="scroll" :paginator="true" :rows="10">
                    <Column field="id" header="ID"></Column>
                    <Column field="type" header="Tipo">
                        <template #body="slotProps">
                            <Tag :value="slotProps.data.type" :severity="slotProps.data.type === 'INFLOW' ? 'success' : 'danger'" />
                        </template>
                    </Column>
                    <Column field="amount" header="Monto">
                        <template #body="slotProps">S/ {{ slotProps.data.amount }}</template>
                    </Column>
                    <Column field="description" header="Descripción"></Column>
                    <Column field="created_at" header="Fecha/Hora"></Column>
                </DataTable>
            </div>
        </div>

        <div class="col-12 text-center py-8" v-else-if="!loading">
            <i class="pi pi-inbox text-6xl text-400 mb-3 block"></i>
            <h3>No hay una caja abierta actualmente</h3>
            <p class="text-500">Abre un nuevo turno desde la API o el módulo de apertura.</p>
        </div>
    </div>

    <!-- Modal Registrar Movimiento -->
    <Dialog v-model:visible="movementDialog" header="Nuevo Movimiento de Caja" :modal="true" style="width: 400px">
        <div class="p-fluid">
            <div class="field mb-3">
                <label>Tipo de Movimiento</label>
                <Dropdown v-model="movement.type" :options="[{label:'Egreso (Salida)', value:'OUTFLOW'}, {label:'Ingreso (Entrada)', value:'INFLOW'}]" optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <div class="field mb-3">
                <label>Monto (S/)</label>
                <InputNumber v-model="movement.amount" mode="currency" currency="PEN" locale="es-PE" class="w-full" />
            </div>
            <div class="field mb-3">
                <label>Descripción / Justificación</label>
                <InputText v-model="movement.description" placeholder="Ej. Pago de movilidad o insumos" class="w-full" />
            </div>
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="movementDialog = false" />
            <Button label="Registrar" icon="pi pi-check" @click="registerMovement" />
        </template>
    </Dialog>

    <!-- Modal Cierre de Caja -->
    <Dialog v-model:visible="closeDialog" header="Confirmar Cierre de Caja" :modal="true" style="width: 400px">
        <div class="p-fluid">
            <div class="field mb-3">
                <label class="font-bold">Saldo Físico Declarado (S/)</label>
                <InputNumber v-model="closeData.closing_balance" mode="currency" currency="PEN" locale="es-PE" class="w-full" />
            </div>
            <div class="field mb-3">
                <label>Notas de Cierre</label>
                <InputText v-model="closeData.notes" placeholder="Observaciones del arqueo" class="w-full" />
            </div>
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="closeDialog = false" />
            <Button label="Cerrar Caja" icon="pi pi-lock" severity="danger" @click="closeCashRegister" />
        </template>
    </Dialog>
</template>