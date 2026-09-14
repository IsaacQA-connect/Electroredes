<template>
  <div class="min-h-screen surface-ground py-5 px-4">
    <div class="mx-auto" style="max-width: 1100px;">
      
      <!-- Encabezado -->
      <div class="flex align-items-center justify-content-between mb-4">
        <div>
          <h2 class="text-3xl font-bold text-900 m-0 flex align-items-center gap-2">
            <i class="pi pi-box text-3xl" style="color: #2D62A3;"></i>
            Mis Compras
          </h2>
          <p class="text-600 m-0 mt-1">Consulta el historial y estado de tus pedidos en ELECTROREDES</p>
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
          class="border-round-3xl border-none px-4 py-2"
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

          <Column header="Canal" style="width: 10%;">
            <template #body="{ data }">
              <Tag :value="data.channel" severity="info" class="text-xs" />
            </template>
          </Column>

          <Column header="Monto Total" style="width: 15%;">
            <template #body="{ data }">
              <span class="font-bold" style="color: #2D62A3;">
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
                class="border-round-2xl"
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
        header="Detalle del Pedido" 
        :style="{ width: '90vw', maxWidth: '600px' }"
      >
        <div v-if="selectedOrder" class="pt-2">
          
          <div class="flex justify-content-between border-bottom-1 surface-border pb-3 mb-3">
            <div>
              <span class="text-500 block text-xs">CÓDIGO DE PEDIDO</span>
              <span class="font-bold text-xl text-900">#{{ selectedOrder.id }}</span>
            </div>
            <div class="text-right">
              <span class="text-500 block text-xs">FECHA</span>
              <span class="font-medium text-800">{{ formatDate(selectedOrder.created_at || selectedOrder.order_date) }}</span>
            </div>
          </div>

          <!-- Observaciones / Notas de Envío -->
          <div v-if="selectedOrder.notes" class="surface-100 p-3 border-round mb-3">
            <span class="font-bold text-700 text-sm block mb-1">Notas de Envío / Entrega:</span>
            <p class="m-0 text-600 text-sm">{{ selectedOrder.notes }}</p>
          </div>

          <!-- Productos comprados -->
          <h4 class="font-bold text-900 mb-2">Productos</h4>
          <div class="border-1 surface-border border-round mb-3 overflow-hidden">
            <div 
              v-for="detail in selectedOrder.details" 
              :key="detail.id"
              class="flex justify-content-between align-items-center p-3 border-bottom-1 surface-border last:border-bottom-none"
            >
              <div>
                <span class="font-bold text-900 block">{{ detail.product?.name || 'Producto #' + detail.product_id }}</span>
                <small class="text-500">Cantidad: {{ detail.quantity }}</small>
              </div>
              <span class="font-semibold text-900">
                S/ {{ (Number(detail.unit_price || detail.price || 0) * detail.quantity).toFixed(2) }}
              </span>
            </div>
          </div>

          <!-- Total -->
          <div class="flex justify-content-between align-items-center pt-2">
            <span class="text-lg font-bold text-900">Total Pagado:</span>
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

const router = useRouter();

const orders = ref([]);
const loading = ref(true);
const displayDetailModal = ref(false);
const selectedOrder = ref(null);

// Cargar Pedidos del usuario
const fetchOrders = async () => {
  loading.value = true;
  try {
    const response = await api.get('/orders');
    // Soporta API Resources y Colecciones simples
    orders.value = response.data.data || response.data || [];
  } catch (error) {
    console.error('Error al cargar órdenes:', error);
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
  }
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