<script setup>
import api from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';

const toast = useToast();
const currentRegister = ref(null);
const loading = ref(true);
const submitting = ref(false);

// Modales
const movementDialog = ref(false);
const closeDialog = ref(false);
const openDialog = ref(false);

// Formularios
const movement = ref({ type: 'OUTFLOW', amount: 0, description: '' });
const closeData = ref({ actual_balance: 0, notes: '' });
const openData = ref({ opening_balance: 0, notes: '' });

// --------------------------------------------------------------------------
// PROPIEDADES COMPUTADAS
// --------------------------------------------------------------------------
const totalInflows = computed(() => {
    if (!currentRegister.value?.movements) return 0;
    return currentRegister.value.movements
        .filter((m) => m.type === 'INFLOW')
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);
});

const totalOutflows = computed(() => {
    if (!currentRegister.value?.movements) return 0;
    return currentRegister.value.movements
        .filter((m) => m.type === 'OUTFLOW')
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);
});

const expectedBalance = computed(() => {
    if (!currentRegister.value) return 0;
    const initial = Number(currentRegister.value.opening_balance || 0);
    return initial + totalInflows.value - totalOutflows.value;
});

const closingDifference = computed(() => {
    return Number(closeData.value.actual_balance || 0) - expectedBalance.value;
});

// Formateador de Fecha
const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('es-PE', {
        dateStyle: 'short',
        timeStyle: 'medium'
    });
};

// --------------------------------------------------------------------------
// MÉTODOS API
// --------------------------------------------------------------------------
const fetchCurrentRegister = async () => {
    loading.value = true;
    try {
        const response = await api.get('/cash-registers/current');
        
        // Desempaquetar la respuesta según la estructura de Laravel
        const registerData = response.data?.data || response.data;

        // Validar si el objeto obtenido tiene un ID
        if (registerData && registerData.id) {
            currentRegister.value = registerData;
        } else {
            currentRegister.value = null;
        }
    } catch (error) {
        currentRegister.value = null;
    } finally {
        loading.value = false;
    }
};

// Abrir Caja
const openNewModal = () => {
    openData.value = { opening_balance: 0, notes: '' };
    openDialog.value = true;
};

const openCashRegister = async () => {
    if (openData.value.opening_balance < 0) {
        toast.add({ severity: 'warn', summary: 'Atención', detail: 'El monto inicial no puede ser negativo', life: 3000 });
        return;
    }

    submitting.value = true;
    try {
        await api.post('/cash-registers/open', openData.value);
        toast.add({ severity: 'success', summary: 'Éxito', detail: 'Caja abierta exitosamente', life: 3000 });
        openDialog.value = false;
        fetchCurrentRegister();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message || 'Error al abrir la caja', life: 3000 });
    } finally {
        submitting.value = false;
    }
};

// Registrar Movimiento
const openMovementModal = () => {
    movement.value = { type: 'OUTFLOW', amount: 0, description: '' };
    movementDialog.value = true;
};

const registerMovement = async () => {
    if (!currentRegister.value?.id) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No hay un ID de caja válido', life: 3000 });
        return;
    }

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

// Cerrar Caja
const openCloseModal = () => {
    closeData.value = { actual_balance: expectedBalance.value, notes: '' };
    closeDialog.value = true;
};

const closeCashRegister = async () => {
    // 1. Obtener el ID de forma segura
    const registerId = currentRegister.value?.id;

    if (!registerId) {
        toast.add({ 
            severity: 'error', 
            summary: 'Error', 
            detail: 'No se encontró un turno de caja activo para cerrar. Recarga la página.', 
            life: 4000 
        });
        return;
    }

    submitting.value = true;
    try {
        // 2. Enviar la petición de cierre
        await api.post(`/cash-registers/${registerId}/close`, closeData.value);
        
        toast.add({ 
            severity: 'success', 
            summary: 'Caja Cerrada', 
            detail: 'El turno de caja se ha cerrado exitosamente.', 
            life: 4000 
        });
        
        closeDialog.value = false;
        
        // 3. Consultar estado actual (ahora devolverá null y mostrará "Caja cerrada")
        await fetchCurrentRegister();
    } catch (error) {
        toast.add({ 
            severity: 'error', 
            summary: 'Error al cerrar', 
            detail: error.response?.data?.message || 'Ocurrió un error al intentar cerrar la caja.', 
            life: 4000 
        });
    } finally {
        submitting.value = false;
    }
};

onMounted(() => {
    fetchCurrentRegister();
});
</script>

<template>
    <div class="grid">
        <Toast />

        <!-- CONTENIDO CAJA ABIERTA -->
        <div class="col-12" v-if="currentRegister">
            <div class="card p-4 surface-card border-round shadow-1">
                <div class="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3">
                    <div>
                        <h3 class="m-0 font-bold text-900">Arqueo y Cierre de Caja Chica</h3>
                        <span class="text-500 text-sm">
                            Cajero asignado: <strong class="text-700">{{ currentRegister.user?.name || 'Usuario en sesión' }}</strong>
                        </span>
                    </div>
                    <div class="flex gap-2">
                        <Button label="Movimiento" icon="pi pi-plus" severity="warning" @click="openMovementModal" />
                        <Button label="Cerrar Caja" icon="pi pi-lock" severity="danger" @click="openCloseModal" />
                    </div>
                </div>

                <!-- RESUMEN DE SALDOS -->
                <div class="grid mb-4">
                    <div class="col-12 md:col-3">
                        <div class="surface-100 p-3 border-round text-center">
                            <span class="text-500 font-medium text-xs">Monto Inicial</span>
                            <div class="text-xl font-bold text-900 mt-1">S/ {{ Number(currentRegister.opening_balance || 0).toFixed(2) }}</div>
                        </div>
                    </div>
                    <div class="col-12 md:col-3">
                        <div class="surface-100 p-3 border-round text-center">
                            <span class="text-500 font-medium text-xs">Ingresos Totales</span>
                            <div class="text-xl font-bold text-green-600 mt-1">S/ {{ totalInflows.toFixed(2) }}</div>
                        </div>
                    </div>
                    <div class="col-12 md:col-3">
                        <div class="surface-100 p-3 border-round text-center">
                            <span class="text-500 font-medium text-xs">Egresos Totales</span>
                            <div class="text-xl font-bold text-red-600 mt-1">S/ {{ totalOutflows.toFixed(2) }}</div>
                        </div>
                    </div>
                    <div class="col-12 md:col-3">
                        <div class="surface-blue-50 p-3 border-round text-center border-1 surface-border">
                            <span class="text-blue-700 font-bold text-xs">Saldo Teórico Esperado</span>
                            <div class="text-2xl font-black text-blue-900 mt-1">S/ {{ expectedBalance.toFixed(2) }}</div>
                        </div>
                    </div>
                </div>

                <!-- HISTORIAL DE MOVIMIENTOS -->
                <h5 class="mb-3 font-bold text-800">Movimientos Registrados</h5>
                <DataTable :value="currentRegister.movements" responsiveLayout="scroll" :paginator="true" :rows="8" class="p-datatable-sm">
                    <Column field="id" header="ID" style="width: 70px"></Column>
                    <Column field="type" header="Tipo">
                        <template #body="slotProps">
                            <Tag 
                                :value="slotProps.data.type === 'INFLOW' ? 'INGRESO' : 'EGRESO'" 
                                :severity="slotProps.data.type === 'INFLOW' ? 'success' : 'danger'" 
                            />
                        </template>
                    </Column>
                    <Column field="amount" header="Monto">
                        <template #body="slotProps">
                            <span class="font-semibold">S/ {{ Number(slotProps.data.amount).toFixed(2) }}</span>
                        </template>
                    </Column>
                    <Column field="description" header="Descripción / Justificación"></Column>
                    <Column field="created_at" header="Fecha/Hora">
                        <template #body="slotProps">
                            {{ formatDate(slotProps.data.created_at) }}
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- ESTADO CAJA CERRADA -->
        <div class="col-12 text-center py-8" v-else-if="!loading">
            <div class="surface-card p-5 border-round shadow-1 max-w-28rem mx-auto">
                <i class="pi pi-inbox text-6xl text-400 mb-3 block"></i>
                <h3 class="m-0 font-bold text-900">No hay una caja abierta</h3>
                <p class="text-500 text-sm mt-2 mb-4">Abre un nuevo turno de caja para comenzar a registrar ventas e ingresos.</p>
                <Button label="Abrir Nuevo Turno de Caja" icon="pi pi-key" severity="success" @click="openNewModal" />
            </div>
        </div>
    </div>

    <!-- MODAL ABRIR CAJA -->
    <Dialog v-model:visible="openDialog" header="Apertura de Caja Chica" :modal="true" style="width: 400px">
        <div class="p-fluid">
            <div class="field mb-3">
                <label class="font-semibold">Monto Inicial en Efectivo (S/)</label>
                <InputNumber v-model="openData.opening_balance" mode="currency" currency="PEN" locale="es-PE" class="w-full" :min="0" />
            </div>
            <div class="field mb-3">
                <label class="font-semibold">Observaciones / Notas</label>
                <InputText v-model="openData.notes" placeholder="Ej. Billetes y monedas de inicio" class="w-full" />
            </div>
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="openDialog = false" />
            <Button label="Abrir Caja" icon="pi pi-check" severity="success" :loading="submitting" @click="openCashRegister" />
        </template>
    </Dialog>

    <!-- MODAL REGISTRAR MOVIMIENTO -->
    <Dialog v-model:visible="movementDialog" header="Nuevo Movimiento de Caja" :modal="true" style="width: 400px">
        <div class="p-fluid">
            <div class="field mb-3">
                <label class="font-semibold">Tipo de Movimiento</label>
                <Dropdown 
                    v-model="movement.type" 
                    :options="[{label:'Egreso (Salida)', value:'OUTFLOW'}, {label:'Ingreso (Entrada)', value:'INFLOW'}]" 
                    optionLabel="label" 
                    optionValue="value" 
                    class="w-full" 
                />
            </div>
            <div class="field mb-3">
                <label class="font-semibold">Monto (S/)</label>
                <InputNumber v-model="movement.amount" mode="currency" currency="PEN" locale="es-PE" class="w-full" :min="0.1" />
            </div>
            <div class="field mb-3">
                <label class="font-semibold">Descripción / Justificación</label>
                <InputText v-model="movement.description" placeholder="Ej. Pago de movilidad o insumos" class="w-full" />
            </div>
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="movementDialog = false" />
            <Button label="Registrar" icon="pi pi-check" :loading="submitting" @click="registerMovement" />
        </template>
    </Dialog>

    <!-- MODAL CIERRE DE CAJA -->
    <Dialog v-model:visible="closeDialog" header="Confirmar Cierre de Caja" :modal="true" style="width: 420px">
        <div class="p-fluid">
            <div class="surface-100 p-3 border-round mb-3">
                <div class="flex justify-content-between text-sm mb-1">
                    <span>Saldo Teórico Esperado:</span>
                    <strong>S/ {{ expectedBalance.toFixed(2) }}</strong>
                </div>
                <div class="flex justify-content-between text-sm font-bold" :class="closingDifference < 0 ? 'text-red-600' : closingDifference > 0 ? 'text-blue-600' : 'text-green-600'">
                    <span>Diferencia (Arqueo):</span>
                    <span>
                        S/ {{ closingDifference.toFixed(2) }}
                        <small v-if="closingDifference < 0"> (Faltante)</small>
                        <small v-else-if="closingDifference > 0"> (Sobrante)</small>
                        <small v-else> (Exacto)</small>
                    </span>
                </div>
            </div>

            <div class="field mb-3">
                <label class="font-bold">Efectivo Físico Contado (S/)</label>
                <InputNumber v-model="closeData.actual_balance" mode="currency" currency="PEN" locale="es-PE" class="w-full" />
            </div>
            <div class="field mb-3">
                <label class="font-semibold">Notas de Cierre</label>
                <InputText v-model="closeData.notes" placeholder="Observaciones del arqueo" class="w-full" />
            </div>
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="closeDialog = false" />
            <Button label="Cerrar Caja" icon="pi pi-lock" severity="danger" :loading="submitting" @click="closeCashRegister" />
        </template>
    </Dialog>
</template>