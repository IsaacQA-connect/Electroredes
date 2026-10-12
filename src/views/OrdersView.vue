<template>
  <div class="min-h-screen surface-ground py-5 px-4">
    <Toast />
    <div class="mx-auto" style="max-width: 1100px;">
      
      <!-- Encabezado -->
      <div class="flex flex-column sm:flex-row align-items-start sm:align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 class="text-3xl font-bold text-900 m-0 flex align-items-center gap-2">
            <i class="pi pi-box text-3xl" style="color: #2D62A3;"></i>
            Mis Compras
          </h2>
          <p class="text-600 m-0 mt-1">Consulta el historial, estado de tus pedidos y descarga tus comprobantes SUNAT</p>
        </div>
        <Button 
          label="Ir al Catálogo" 
          icon="pi pi-shopping-bag" 
          class="border-round-3xl border-none font-bold"
          style="background-color: #2D62A3;"
          @click="router.push('/catalog')" 
        />
      </div>

      <!-- Spinner de Carga -->
      <div v-if="loading" class="text-center py-6 surface-card border-round-xl shadow-1">
        <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
        <p class="text-600 mt-3 mb-0">Cargando tus pedidos...</p>
      </div>

      <!-- Sin Pedidos Registrados -->
      <div v-else-if="orders.length === 0" class="surface-card p-5 text-center border-round-xl shadow-1">
        <i class="pi pi-inbox text-6xl text-400 mb-3 block" />
        <p class="text-xl text-700 font-medium mb-3">Aún no has realizado ninguna compra.</p>
        <Button 
          label="Empezar a comprar" 
          icon="pi pi-arrow-right" 
          class="border-round-3xl border-none px-4 py-2 font-bold"
          style="background-color: #D8AC67; color: #1A1D20;"
          @click="router.push('/catalog')" 
        />
      </div>

      <!-- Tabla / Lista de Pedidos -->
      <div v-else class="surface-card p-4 border-round-xl shadow-1">
        <DataTable :value="orders" responsiveLayout="scroll" class="p-datatable-sm" paginator :rows="8">
          
          <Column field="id" header="N° Pedido" style="width: 10%;">
            <template #body="{ data }">
              <span class="font-bold text-900">#{{ data.id }}</span>
            </template>
          </Column>

          <Column header="Fecha" style="width: 15%;">
            <template #body="{ data }">
              <span class="text-700">{{ formatDate(data.created_at || data.order_date) }}</span>
            </template>
          </Column>

          <Column header="Comprobante" style="width: 15%;">
            <template #body="{ data }">
              <Tag 
                :value="data.invoice_type || 'BOLETA'" 
                severity="secondary" 
                class="text-xs font-bold"
              />
            </template>
          </Column>

          <Column header="Estado" style="width: 15%;">
            <template #body="{ data }">
              <Tag 
                :value="getStatusLabel(data.status)" 
                :severity="getStatusSeverity(data.status)" 
                class="text-xs px-2 py-1"
              />
            </template>
          </Column>

          <Column header="Monto Total" style="width: 15%;">
            <template #body="{ data }">
              <span class="font-bold text-base" style="color: #2D62A3;">
                S/ {{ Number(data.total || data.total_amount || 0).toFixed(2) }}
              </span>
            </template>
          </Column>

          <Column header="Acciones" style="width: 15%; text-align: center;">
            <template #body="{ data }">
              <Button 
                icon="pi pi-eye" 
                label="Ver Detalle"
                severity="secondary" 
                outlined 
                size="small"
                class="border-round-2xl font-semibold"
                @click="openOrderDetails(data.id)" 
              />
            </template>
          </Column>

        </DataTable>
      </div>

      <!-- Modal con Detalle del Pedido seleccionado -->
      <Dialog 
        v-model:visible="displayDetailModal" 
        modal 
        header="Detalle de la Compra" 
        :style="{ width: '92vw', maxWidth: '750px' }"
      >
        <div v-if="selectedOrder" class="pt-2">
          
          <!-- Encabezado de la Orden -->
          <div class="flex flex-wrap justify-content-between align-items-center border-bottom-1 surface-border pb-3 mb-3 gap-2">
            <div>
              <span class="text-500 block text-xs font-bold uppercase">Código de Pedido</span>
              <span class="font-bold text-2xl text-900">#{{ selectedOrder.id }}</span>
            </div>
            <div>
              <Tag 
                :value="getStatusLabel(selectedOrder.status)" 
                :severity="getStatusSeverity(selectedOrder.status)" 
                class="text-sm px-3 py-1 font-bold"
              />
            </div>
            <div class="text-right">
              <span class="text-500 block text-xs font-bold uppercase">Fecha de Emisión</span>
              <span class="font-medium text-800">{{ formatDate(selectedOrder.created_at || selectedOrder.order_date) }}</span>
            </div>
          </div>

          <!-- Información en 2 Columnas -->
          <div class="grid mb-3">
            <!-- Columna 1: Facturación SUNAT -->
            <div class="col-12 md:col-6">
              <div class="surface-100 p-3 border-round h-full">
                <span class="font-bold text-800 text-sm block mb-2">
                  <i class="pi pi-file mr-1 text-primary"></i> Comprobante SUNAT
                </span>
                <div class="text-sm text-700">
                  <p class="m-0 mb-1"><strong>Tipo:</strong> {{ selectedOrder.invoice_type || 'BOLETA' }}</p>
                  <p v-if="selectedOrder.document_number" class="m-0 mb-1">
                    <strong>{{ selectedOrder.invoice_type === 'FACTURA' ? 'RUC' : 'DNI' }}:</strong> {{ selectedOrder.document_number }}
                  </p>
                  <p v-if="selectedOrder.business_name" class="m-0 mb-1">
                    <strong>Razón Social:</strong> {{ selectedOrder.business_name }}
                  </p>
                  <p v-if="selectedOrder.invoice_number" class="m-0 mb-2">
                    <strong>N° Serie:</strong> {{ selectedOrder.invoice_number }}
                  </p>

                  <!-- Botones de Descarga PDF/XML -->
                  <div v-if="selectedOrder.pdf_url || selectedOrder.invoice_number" class="flex gap-2 mt-3">
                    <Button 
                      label="PDF" 
                      icon="pi pi-file-pdf" 
                      severity="danger" 
                      size="small" 
                      outlined 
                      class="border-round-2xl text-xs"
                      @click="downloadVoucher(selectedOrder.id, 'pdf')"
                    />
                    <Button 
                      label="XML" 
                      icon="pi pi-code" 
                      severity="secondary" 
                      size="small" 
                      outlined 
                      class="border-round-2xl text-xs"
                      @click="downloadVoucher(selectedOrder.id, 'xml')"
                    />
                  </div>
                  <span v-else class="text-xs text-500 italic block mt-2">
                    Comprobante electrónico en proceso de emisión.
                  </span>
                </div>
              </div>
            </div>

            <!-- Columna 2: Datos de Envío y Pago -->
            <div class="col-12 md:col-6">
              <div class="surface-100 p-3 border-round h-full">
                <span class="font-bold text-800 text-sm block mb-2">
                  <i class="pi pi-wallet mr-1 text-primary"></i> Pago y Entrega
                </span>
                <div class="text-sm text-700">
                  <p v-if="selectedOrder.payments && selectedOrder.payments.length" class="m-0 mb-1">
                    <strong>Método:</strong> {{ formatPaymentMethod(selectedOrder.payments[0].method) }}
                  </p>
                  <p v-if="selectedOrder.payments && selectedOrder.payments[0]?.transaction_code" class="m-0 mb-1">
                    <strong>N° Operación:</strong> {{ selectedOrder.payments[0].transaction_code }}
                  </p>
                  <p class="m-0 mt-2"><strong>Notas / Dirección:</strong></p>
                  <p class="m-0 text-600 text-xs">{{ selectedOrder.notes || 'Sin especificaciones de entrega' }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Productos comprados -->
          <h4 class="font-bold text-900 mb-2">Productos en esta orden</h4>
          <div class="border-1 surface-border border-round mb-3 overflow-hidden">
            <div 
              v-for="detail in selectedOrder.details" 
              :key="detail.id"
              class="flex justify-content-between align-items-center p-3 border-bottom-1 surface-border last:border-bottom-none"
            >
              <div>
                <span class="font-bold text-900 block text-sm">{{ detail.product?.name || 'Producto #' + detail.product_id }}</span>
                <small class="text-600">Precio unitario: S/ {{ Number(detail.unit_price || detail.price || 0).toFixed(2) }} | Cant: {{ detail.quantity }}</small>
              </div>
              <span class="font-bold text-900 text-sm">
                S/ {{ (Number(detail.unit_price || detail.price || 0) * detail.quantity).toFixed(2) }}
              </span>
            </div>
          </div>

          <!-- Resumen de Total -->
          <div class="flex justify-content-between align-items-center pt-2 border-top-1 surface-border">
            <span class="text-lg font-bold text-900">Monto Total:</span>
            <span class="text-2xl font-bold" style="color: #2D62A3;">
              S/ {{ Number(selectedOrder.total || selectedOrder.total_amount || 0).toFixed(2) }}
            </span>
          </div>

        </div>
      </Dialog>

    </div>
  </div>
</template>

<script setup>
import api from '@/service/api';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const toast = useToast();

const orders = ref([]);
const loading = ref(true);
const displayDetailModal = ref(false);
const selectedOrder = ref(null);

// Cargar Pedidos del usuario
const fetchOrders = async () => {
  loading.value = true;
  try {
    const response = await api.get('/orders');
    orders.value = response.data.data || response.data || [];
  } catch (error) {
    console.error('Error al cargar órdenes:', error);
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar tus compras.', life: 4000 });
  } finally {
    loading.value = false;
  }
};

// Cargar detalle completo de una orden específica
const openOrderDetails = async (orderId) => {
  try {
    const response = await api.get(`/orders/${orderId}`);
    selectedOrder.value = response.data.data || response.data;
    displayDetailModal.value = true;
  } catch (error) {
    console.error('Error al cargar detalle del pedido:', error);
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo obtener el detalle del pedido.', life: 4000 });
  }
};

// Descargar Comprobante PDF / XML
const downloadVoucher = async (orderId, format) => {
  try {
    const response = await api.get(`/orders/${orderId}/download-${format}`, {
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `comprobante-orden-${orderId}.${format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    toast.add({
      severity: 'warn',
      summary: 'Archivo no disponible',
      detail: `El archivo ${format.toUpperCase()} no está disponible para descarga aún.`,
      life: 4000
    });
  }
};

// Mapeador de colores de Badge según Estado
const getStatusSeverity = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'PAID':
    case 'PAGADO':
    case 'COMPLETED':
    case 'COMPLETADO':
      return 'success';
    case 'PENDING':
    case 'PENDIENTE':
      return 'warn';
    case 'PROCESSING':
    case 'PROCESANDO':
      return 'info';
    case 'CANCELLED':
    case 'CANCELADO':
    case 'REJECTED':
      return 'danger';
    default:
      return 'secondary';
  }
};

// Mapeador de Etiquetas
const getStatusLabel = (status) => {
  const upper = (status || '').toUpperCase();
  const labels = {
    'PENDING': 'Pendiente',
    'PENDIENTE': 'Pendiente',
    'PAID': 'Pagado',
    'PAGADO': 'Pagado',
    'COMPLETED': 'Completado',
    'COMPLETADO': 'Completado',
    'CANCELLED': 'Cancelado',
    'CANCELADO': 'Cancelado',
    'PROCESSING': 'En Proceso'
  };
  return labels[upper] || status || 'Pendiente';
};

// Mapeador de Métodos de Pago
const formatPaymentMethod = (method) => {
  const methods = {
    'ONLINE_PAYMENT': 'Pago en Línea / Mercado Pago',
    'BANK_TRANSFER': 'Transferencia Bancaria',
    'Yape/Plin': 'Yape / Plin',
    'CASH': 'Pago en Efectivo'
  };
  return methods[method] || method || 'No especificado';
};

// Formateador de Fecha
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

onMounted(() => {
  fetchOrders();
});
</script>