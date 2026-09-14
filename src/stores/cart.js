import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useAuthStore } from './auth';

export const useCartStore = defineStore('cart', () => {
  const auth = useAuthStore();

  // 1. Helper para obtener la clave de LocalStorage reactivamente
  const getStorageKey = () => {
    return auth.user?.id ? `cart_items_user_${auth.user.id}` : 'cart_items_guest';
  };

  // 2. Estado inicial
  const items = ref([]);

  // 3. Función para cargar los ítems correspondientes al usuario actual
  const loadCart = () => {
    try {
      const key = getStorageKey();
      items.value = JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      items.value = [];
    }
  };

  // 4. Guardar en la clave exacta del usuario
  const saveToStorage = () => {
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify(items.value));
  };

  // ¡CLAVE DEL ÉXITO!
  // Observar cuando cambia auth.user (por Login, Logout o cambio de cuenta)
  watch(
    () => auth.user?.id,
    () => {
      loadCart(); // Recarga automáticamente el carrito asignado al nuevo usuario ID o al invitado
    },
    { immediate: true } // Ejecutar inmediatamente al montar el store
  );

  // --- Getters ---
  const count = computed(() => {
    return items.value.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
  });

  const totalPrice = computed(() => {
    return items.value.reduce((acc, item) => {
      const price = Number(item.sale_price ?? item.price ?? 0);
      const qty = Number(item.quantity || 0);
      return acc + (price * qty);
    }, 0);
  });

  // --- Acciones ---
  const addItem = (product, quantity = 1) => {
    const existingIndex = items.value.findIndex(i => i.id === product.id);

    if (existingIndex !== -1) {
      items.value[existingIndex].quantity += quantity;
    } else {
      items.value.push({
        id: product.id,
        name: product.name,
        price: Number(product.price || 0),
        sale_price: Number(product.sale_price || product.price || 0),
        image: product.image_url || null,
        stock: product.stock,
        quantity: quantity
      });
    }
    saveToStorage();
  };

  const updateQuantity = (productId, quantity) => {
    const item = items.value.find(i => i.id === productId);
    if (item && quantity > 0) {
      item.quantity = Number(quantity);
      saveToStorage();
    }
  };

  const removeFromCart = (productId) => {
    items.value = items.value.filter(i => i.id !== productId);
    saveToStorage();
  };

  const clearCart = () => {
    items.value = [];
    localStorage.removeItem(getStorageKey());
  };

  return {
    items,
    count,
    totalPrice,
    addItem,
    updateQuantity,
    removeFromCart,
    clearCart,
    loadCart
  };
});