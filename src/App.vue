<!-- App.vue -->
<script setup>
import Navbar from '@/components/Navbar.vue';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// Oculta el Navbar si la ruta actual o alguna ruta padre tiene hideNavbar: true
const shouldShowNavbar = computed(() => {
    return !route.matched.some(record => record.meta.hideNavbar);
});
</script>

<template>
  <div class="min-h-screen flex flex-column surface-ground">
    <!-- Renderizado condicional del Navbar -->
    <Navbar v-if="shouldShowNavbar" />

    <!-- Vistas del Router -->
    <main class="flex-1">
      <router-view />
    </main>
  </div>
</template>
