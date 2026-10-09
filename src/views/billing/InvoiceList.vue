<script setup>
import api from '@/service/api';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref } from 'vue';

const toast = useToast();

const invoices = ref([]);
const loading = ref(false);
const totalRecords = ref(0);
const selectedInvoice = ref(null);
const displayDetailDialog = ref(false);

// Filtros de búsqueda
const filters = reactive({
    page: 1,
    per_page: 15,
    search: '',
    document_type: null,
    sunat_status: null
});

const documentTypeOptions = [
    { label: 'Todos', value: null },
    { label: 'Factura', value: '01' },
    { label: 'Boleta', value: '03' },
    { label: 'Nota de Venta', value: 'NV' }
];

const sunatStatusOptions = [
    { label: 'Todos', value: null },
    { label: 'Aceptado', value: 'ACCEPTED' },
    { label: 'Rechazado', value: 'REJECTED' },
    { label: 'Pendiente', value: 'PENDING' },
    { label: 'Interno', value: 'INTERNAL' }
];

// Cargamos la lista paginada desde el backend
const fetchInvoices = async () => {
    loading.value = true;
    try {
        const response = await api.get('/invoices', { params: filters });
        invoices.value = response.data.data;
        totalRecords.value = response.data.meta?.total || response.data.data.length;
    } catch (error) {
        toast.add({ 
            severity: 'error', 
            summary: 'Error', 
            detail: 'No se pudieron cargar los comprobantes', 
            life: 3000 
        });
    } finally {
        loading.value = false;
    }
};

const onPageChange = (event) => {
    filters.page = event.page + 1;
    filters.per_page = event.rows;
    fetchInvoices();
};

// Acciones de impresión y descarga
const openTicket = (url) => {
    window.open(url, '_blank', 'width=400,height=600');
};

const downloadPdf = (url) => {
    window.open(url, '_blank');
};

// Ver detalle en modal
const showDetails = (invoice) => {
    selectedInvoice.value = invoice;
    displayDetailDialog.value = true;
};

// Reintentar envío a SUNAT si quedó en PENDING o REJECTED
const resendToSunat = async (invoiceId) => {
    loading.value = true;
    try {
        const response = await api.post(`/invoices/${invoiceId}/resend-sunat`);
        toast.add({ 
            severity: 'success', 
            summary: 'Procesado', 
            detail: response.data.message, 
            life: 4000 
        });
        fetchInvoices();
    } catch (error) {
        toast.add({ 
            severity: 'error', 
            summary: 'Error de Reenvío', 
            detail: error.response?.data?.message || 'Error al conectar con SUNAT', 
            life: 4000 
        });
    } finally {
        loading.value = false;
    }
};

// Mapeo de estados SUNAT para visualización
const getStatusBadge = (status) => {
    switch (status) {
        case 'ACCEPTED': return { severity: 'success', value: 'Aceptado' };
        case 'REJECTED': return { severity: 'danger', value: 'Rechazado' };
        case 'PENDING':  return { severity: 'warning', value: 'Pendiente' };
        case 'INTERNAL': return { severity: 'info', value: 'Nota de Venta' };
        default:         return { severity: 'secondary', value: status };
    }
};

onMounted(() => {
    fetchInvoices();
});
</script>

<template>
    <div class="card p-4 surface-card border-round shadow-1">
        <Toast />

        <div class="flex flex-column md:flex-row justify-content-between md:align-items-center mb-4 gap-3">
            <h3 class="font-bold text-900 m-0">Historial de Comprobantes</h3>
            <Button 
                label="Nueva Venta" 
                icon="pi pi-plus" 
                severity="primary" 
                @click="$router.push('/facturacion/nueva')" 
            />
        </div>

        <!-- FILTROS -->
        <div class="grid p-fluid mb-3">
            <div class="col-12 md:col-4">
                <InputText 
                    v-model="filters.search" 
                    placeholder="Buscar por cliente o número (F001-00000001)..." 
                    @keyup.enter="fetchInvoices" 
                />
            </div>
            <div class="col-6 md:col-3">
                <Dropdown 
                    v-model="filters.document_type" 
                    :options="documentTypeOptions" 
                    optionLabel="label" 
                    optionValue="value" 
                    placeholder="Tipo Documento" 
                    @change="fetchInvoices" 
                />
            </div>
            <div class="col-6 md:col-3">
                <Dropdown 
                    v-model="filters.sunat_status" 
                    :options="sunatStatusOptions" 
                    optionLabel="label" 
                    optionValue="value" 
                    placeholder="Estado SUNAT" 
                    @change="fetchInvoices" 
                />
            </div>
            <div class="col-12 md:col-2">
                <Button icon="pi pi-search" label="Filtrar" severity="secondary" @click="fetchInvoices" />
            </div>
        </div>

        <!-- TABLA PRINCIPAL DE HISTORIAL -->
        <DataTable 
            :value="invoices" 
            :lazy="true" 
            :paginator="true" 
            :rows="filters.per_page" 
            :totalRecords="totalRecords" 
            :loading="loading" 
            @page="onPageChange"
            responsiveLayout="scroll" 
            class="p-datatable-sm"
        >
            <Column field="created_at" header="Fecha / Hora" style="width: 140px;"></Column>
            <Column field="full_number" header="Comprobante" style="width: 140px;">
                <template #body="slotProps">
                    <span class="font-bold text-blue-800">{{ slotProps.data.full_number }}</span>
                </template>
            </Column>
            <Column field="client.name" header="Cliente"></Column>
            <Column field="total" header="Total" style="width: 120px;">
                <template #body="slotProps">
                    <span class="font-bold">S/ {{ Number(slotProps.data.total).toFixed(2) }}</span>
                </template>
            </Column>
            <Column header="Estado SUNAT" style="width: 130px;">
                <template #body="slotProps">
                    <Tag 
                        :value="getStatusBadge(slotProps.data.sunat_status).value" 
                        :severity="getStatusBadge(slotProps.data.sunat_status).severity" 
                    />
                </template>
            </Column>
            <Column header="Acciones" style="width: 220px; text-align: center;">
                <template #body="slotProps">
                    <div class="flex gap-1 justify-content-center">
                        <Button 
                            icon="pi pi-eye" 
                            severity="info" 
                            text 
                            rounded 
                            v-tooltip.top="'Ver Detalle'" 
                            @click="showDetails(slotProps.data)" 
                        />
                        <Button 
                            icon="pi pi-print" 
                            severity="secondary" 
                            text 
                            rounded 
                            v-tooltip.top="'Imprimir Ticket 80mm'" 
                            @click="openTicket(slotProps.data.links.ticket)" 
                        />
                        <Button 
                            icon="pi pi-file-pdf" 
                            severity="danger" 
                            text 
                            rounded 
                            v-tooltip.top="'Descargar PDF A4'" 
                            @click="downloadPdf(slotProps.data.links.pdf)" 
                        />
                        <Button 
                            v-if="['PENDING', 'REJECTED'].includes(slotProps.data.sunat_status) && slotProps.data.document_type !== 'NV'"
                            icon="pi pi-refresh" 
                            severity="warning" 
                            text 
                            rounded 
                            v-tooltip.top="'Reintentar Envío SUNAT'" 
                            @click="resendToSunat(slotProps.data.id)" 
                        />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- DIÁLOGOS Y MODALES -->
        <Dialog 
            v-model:visible="displayDetailDialog" 
            header="Detalle del Comprobante" 
            :modal="true" 
            style="width: 600px;"
        >
            <div v-if="selectedInvoice" class="p-2">
                <div class="grid mb-3">
                    <div class="col-6">
                        <strong>Comprobante:</strong> {{ selectedInvoice.full_number }}<br>
                        <strong>Fecha:</strong> {{ selectedInvoice.created_at }}<br>
                        <strong>Medio Pago:</strong> {{ selectedInvoice.payment_method }}
                    </div>
                    <div class="col-6">
                        <strong>Cliente:</strong> {{ selectedInvoice.client.name }}<br>
                        <strong>Doc:</strong> {{ selectedInvoice.client.doc_number }}<br>
                        <strong>Estado SUNAT:</strong> {{ selectedInvoice.sunat_description || 'N/A' }}
                    </div>
                </div>

                <DataTable :value="selectedInvoice.details" class="p-datatable-sm">
                    <Column field="product_name" header="Producto"></Column>
                    <Column field="quantity" header="Cant" style="width: 60px;"></Column>
                    <Column header="P.Unit">
                        <template #body="s">S/ {{ Number(s.data.unit_price).toFixed(2) }}</template>
                    </Column>
                    <Column header="Total">
                        <template #body="s">S/ {{ Number(s.data.total).toFixed(2) }}</template>
                    </Column>
                </DataTable>
            </div>
        </Dialog>
    </div>
</template>