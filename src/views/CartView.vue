<template>
  <div class="min-h-screen surface-ground py-5 px-4">
    <div class="mx-auto" style="max-width: 1200px;">
      
      <!-- Título de la sección -->
      <div class="flex align-items-center justify-content-between mb-4">
        <h2 class="text-3xl font-bold text-900 m-0 flex align-items-center gap-2">
          <i class="pi pi-shopping-cart text-3xl" style="color: #2D62A3;"></i>
          Mi Carrito de Compras
        </h2>
        <Button 
          label="Seguir comprando" 
          icon="pi pi-arrow-left" 
          text 
          class="font-bold"
          style="color: #2D62A3;"
          @click="router.push('/catalog')" 
        />
      </div>

      <!-- Carrito Vacío -->
      <div v-if="cart.items.length === 0" class="surface-card p-5 text-center border-round-xl shadow-1">
        <i class="pi pi-shopping-bag text-6xl text-400 mb-3 block" />
        <p class="text-xl text-700 font-medium mb-4">Tu carrito de compras está vacío.</p>
        <Button 
          label="Explorar Catálogo" 
          icon="pi pi-compass" 
          class="border-round-3xl border-none px-4 py-2"
          style="background-color: #2D62A3;"
          @click="router.push('/catalog')" 
        />
      </div>

      <!-- Contenido del Carrito (Lista + Resumen) -->
      <div v-else class="grid">
        
        <!-- Tabla / Lista de Productos (Izquierda) -->
        <div class="col-12 lg:col-8">
          <div class="surface-card p-4 border-round-xl shadow-1">
            <DataTable :value="cart.items" responsiveLayout="scroll" class="p-datatable-sm">
              <Column header="Producto">
                <template #body="{ data }">
                  <div class="flex align-items-center gap-3">
                    <img 
                      :src="data.image || '/demo/images/product/placeholder.png'" 
                      :alt="data.name" 
                      class="w-4rem h-4rem border-round object-contain surface-100 p-1" 
                    />
                    <div>
                      <span class="font-bold text-900 block">{{ data.name }}</span>
                      <small class="text-500">Stock disponible: {{ data.stock }}</small>
                    </div>
                  </div>
                </template>
              </Column>

              <Column header="Precio Unitario" style="width: 15%;">
                <template #body="{ data }">
                  <span class="font-medium text-700">
                    S/ {{ Number(data.sale_price || data.price).toFixed(2) }}
                  </span>
                </template>
              </Column>

              <Column header="Cantidad" style="width: 20%;">
                <template #body="{ data }">
                  <InputNumber 
                    v-model="data.quantity" 
                    showButtons 
                    buttonLayout="horizontal" 
                    :min="1" 
                    :max="data.stock"
                    inputClass="w-3rem text-center p-inputtext-sm"
                    incrementButtonClass="p-button-secondary text-xs"
                    decrementButtonClass="p-button-secondary text-xs"
                    @onInput="(e) => cart.updateQuantity(data.id, e.value)"
                  />
                </template>
              </Column>

              <Column header="Subtotal" style="width: 15%;">
                <template #body="{ data }">
                  <span class="font-bold text-900" style="color: #2D62A3;">
                    S/ {{ (Number(data.sale_price || data.price) * data.quantity).toFixed(2) }}
                  </span>
                </template>
              </Column>

              <Column header="" style="width: 10%; text-align: center;">
                <template #body="{ data }">
                  <Button 
                    icon="pi pi-trash" 
                    severity="danger" 
                    text 
                    rounded 
                    @click="cart.removeFromCart(data.id)" 
                  />
                </template>
              </Column>
            </DataTable>

            <div class="flex justify-content-between align-items-center mt-4 pt-3 border-top-1 surface-border">
              <Button 
                label="Vaciar Carrito" 
                icon="pi pi-trash" 
                severity="secondary" 
                text 
                class="p-button-sm"
                @click="cart.clearCart()" 
              />
            </div>
          </div>
        </div>

        <!-- Resumen de Pedido (Derecha) -->
        <div class="col-12 lg:col-4">
          <div class="surface-card p-4 border-round-xl shadow-1">
            <h3 class="text-xl font-bold text-900 mb-3 border-bottom-1 surface-border pb-3">Resumen de Compra</h3>

            <div class="flex justify-content-between mb-2">
              <span class="text-600">Subtotal</span>
              <span class="font-semibold text-900">S/ {{ cartSubtotal.toFixed(2) }}</span>
            </div>

            <div class="flex justify-content-between mb-2">
              <span class="text-600">IGV (18%)</span>
              <span class="font-semibold text-900">S/ {{ cartTax.toFixed(2) }}</span>
            </div>

            <div class="border-top-1 surface-border my-3 pt-3 flex justify-content-between align-items-center">
              <span class="text-xl font-bold text-900">Total</span>
              <span class="text-2xl font-bold" style="color: #2D62A3;">
                S/ {{ cartTotal.toFixed(2) }}
              </span>
            </div>

            <Button 
              label="Procesar Compra" 
              icon="pi pi-check-circle" 
              class="w-full border-round-3xl border-none py-3 mt-3 font-bold text-lg"
              style="background-color: #D8AC67; color: #1A1D20;"
              @click="goToCheckout" 
            />
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import InputNumber from 'primevue/inputnumber';

const router = useRouter();
const cart = useCartStore();
const auth = useAuthStore();

// Cálculos del Carrito
const cartTotal = computed(() => Number(cart.totalPrice || 0));
const cartSubtotal = computed(() => cartTotal.value / 1.18);
const cartTax = computed(() => cartTotal.value - cartSubtotal.value);

const goToCheckout = () => {
  if (!auth.token) {
    router.push('/auth/login?redirect=checkout');
  } else {
    router.push('/checkout');
  }
};
</script>