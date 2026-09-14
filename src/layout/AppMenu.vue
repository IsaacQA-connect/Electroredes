<script setup>
import { ref } from 'vue';
import AppMenuItem from './AppMenuItem.vue';

// Aquí definimos únicamente tus rutas reales mapeadas en index.js
const model = ref([
    {
        label: 'Inicio',
        items: [
            {
                label: 'Dashboard',
                icon: 'pi pi-fw pi-home',
                to: '/admin/dashboard' // Apunta a tu ruta real en index.js
            }
        ]
    },
    {
        label: 'Módulos del Sistema',
        items: [
            {
                label: 'Productos',
                icon: 'pi pi-fw pi-shopping-bag',
                to: '/admin/products' // Apunta a tu ruta real en index.js
            }
        ]
    }
]);
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item.label">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style scoped>
/* Removido lang="scss" ya que estamos usando CSS/Tailwind puro */
</style>
