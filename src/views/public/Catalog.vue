<script setup>
import api from '@/service/api';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import Button from 'primevue/button';
import Select from 'primevue/select';

const route = useRoute();
const cart = useCartStore();
const auth = useAuthStore();

const products = ref([]);
const categories = ref([]);
const selectedCategory = ref(null);
const sortOrder = ref('name-asc');
const loading = ref(true);

const sortOptions = [
    { label: 'Nombre (A-Z)', value: 'name-asc' },
    { label: 'Nombre (Z-A)', value: 'name-desc' },
    { label: 'Precio: Menor a Mayor', value: 'price-asc' },
    { label: 'Precio: Mayor a Menor', value: 'price-desc' }
];

// Cargar catálogo contemplando la URL de búsqueda y la categoría
const fetchCatalogData = async () => {
    loading.value = true;
    try {
        const params = {};
        if (route.query.search) params.search = route.query.search;
        if (selectedCategory.value) params.category_id = selectedCategory.value;

        const [prodRes, catRes] = await Promise.all([
            api.get('/products', { params }),
            api.get('/categories')
        ]);
        
        const rawProducts = prodRes.data.data || prodRes.data;
        products.value = rawProducts.filter(p => p.status && p.stock > 0);
        categories.value = catRes.data.data || catRes.data || [];
    } catch (err) {
        console.error('Error al cargar catálogo:', err);
    } finally {
        loading.value = false;
    }
};

// Filtrar por categoría
const filterByCategory = (catId) => {
    selectedCategory.value = catId;
    fetchCatalogData();
};

// Reactividad: Si el usuario busca algo desde el Navbar corporativo
watch(() => route.query.search, () => {
    fetchCatalogData();
});

// Ordenamiento local
const filteredProducts = computed(() => {
    let list = [...products.value];

    if (sortOrder.value === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortOrder.value === 'name-desc') list.sort((a, b) => b.name.localeCompare(a.name));
    if (sortOrder.value === 'price-asc') {
        list.sort((a, b) => Number(a.sale_price || a.price) - Number(b.sale_price || b.price));
    }
    if (sortOrder.value === 'price-desc') {
        list.sort((a, b) => Number(b.sale_price || b.price) - Number(a.sale_price || a.price));
    }

    return list;
});

onMounted(() => {
    fetchCatalogData();
});
</script>

<template>
    <div class="min-h-screen surface-ground py-4">
        <div class="mx-auto px-4" style="max-width: 1200px;">
            <div class="grid">
                <!-- Sidebar Categorías -->
                <div class="col-12 md:col-3">
                    <div class="surface-card p-3 border-round shadow-1">
                        <h5 class="mb-3 font-bold text-900">Categorías</h5>
                        <ul class="list-none p-0 m-0">
                            <li 
                                class="py-2 px-3 border-round cursor-pointer hover:surface-hover mb-1 flex align-items-center" 
                                :style="selectedCategory === null ? 'background-color: #EBF2FA; color: #2D62A3; font-weight: bold;' : ''"
                                @click="filterByCategory(null)"
                            >
                                <i class="pi pi-th-large mr-2"></i> Todas
                            </li>

                            <li 
                                v-for="cat in categories" 
                                :key="cat.id" 
                                class="py-2 px-3 border-round cursor-pointer hover:surface-hover mb-1 flex align-items-center"
                                :style="selectedCategory === cat.id ? 'background-color: #EBF2FA; color: #2D62A3; font-weight: bold;' : ''"
                                @click="filterByCategory(cat.id)"
                            >
                                <i class="pi pi-tag mr-2"></i> {{ cat.name }}
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- Lista de Productos -->
                <div class="col-12 md:col-9">
                    <!-- Barra de Filtros y Conteo -->
                    <div class="surface-card p-3 border-round shadow-1 mb-4 flex justify-content-between align-items-center">
                        <div>
                            <span class="text-600 font-medium">{{ filteredProducts.length }} Productos encontrados</span>
                            <span v-if="route.query.search" class="text-sm text-500 block">
                                Filtrando por: <strong>"{{ route.query.search }}"</strong>
                            </span>
                        </div>
                        <div class="flex align-items-center gap-2">
                            <label class="text-sm font-bold text-600">Ordenar por:</label>
                            <Select v-model="sortOrder" :options="sortOptions" optionLabel="label" optionValue="value" class="p-inputtext-sm w-12rem" />
                        </div>
                    </div>

                    <!-- Cards en Grilla -->
                    <div class="grid">
                        <div v-for="prod in filteredProducts" :key="prod.id" class="col-12 sm:col-6 lg:col-4">
                            <div class="surface-card p-3 border-round shadow-1 h-full flex flex-column justify-content-between hover:shadow-3 transition-duration-200">
                                <div>
                                    <div class="w-full border-round surface-100 flex align-items-center justify-content-center overflow-hidden mb-3" style="height: 180px;">
                                        <img :src="prod.image_url || '/demo/images/product/placeholder.png'" :alt="prod.name" class="max-h-full max-w-full object-contain" />
                                    </div>
                                    <small class="text-400 font-bold uppercase">{{ prod.category?.name || 'GENERAL' }}</small>
                                    <div class="text-900 font-bold text-lg mb-1">{{ prod.name }}</div>
                                    <p class="text-500 text-sm mb-2 line-clamp-2">{{ prod.description || 'Sin descripción disponible.' }}</p>
                                    <div class="text-xs text-600 mb-2"><i class="pi pi-box mr-1"></i>Stock: {{ prod.stock }}</div>
                                </div>
                                <div>
                                    <div class="text-2xl font-bold mb-3" style="color: #2D62A3;">S/ {{ Number(prod.sale_price || prod.price).toFixed(2) }}</div>
                                    <Button label="Añadir al carrito" icon="pi pi-shopping-cart" class="w-full border-round-3xl" style="background-color: #2D62A3; border-color: #2D62A3;" @click="cart.addItem(prod)" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>