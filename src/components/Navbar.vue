<script setup>
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import Badge from 'primevue/badge';
import Button from 'primevue/button';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Menu from 'primevue/menu';

const router = useRouter();
const auth = useAuthStore();
const cart = useCartStore();

const searchQuery = ref('');
const userMenu = ref();

const userMenuItems = ref([
    {
        label: 'Mi Cuenta',
        items: [
            {
                label: 'Mis Compras',
                icon: 'pi pi-box',
                command: () => router.push('/my-orders')
            },
            {
                separator: true
            },
            {
                label: 'Cerrar Sesión',
                icon: 'pi pi-sign-out',
                command: () => auth.logout()
            }
        ]
    }
]);

const toggleUserMenu = (event) => {
    userMenu.value.toggle(event);
};

const handleSearch = () => {
    if (searchQuery.value.trim()) {
        router.push({ path: '/catalog', query: { search: searchQuery.value.trim() } });
    } else {
        router.push('/catalog');
    }
};
</script>

<template>
    <header class="surface-overlay shadow-1 sticky top-0 z-5">
        <!-- Topbar corporativo superior -->
        <div class="px-4 py-2 text-xs flex justify-content-between align-items-center text-white" style="background-color: #1A1D20;">
            <div class="flex align-items-center gap-3">
                <span><i class="pi pi-phone text-xs mr-1" style="color: #D8AC67;"></i> Ventas: +51 987 654 321</span>
                <span class="hidden sm:inline"><i class="pi pi-envelope text-xs mr-1" style="color: #D8AC67;"></i> ventas@electroredes.pe</span>
            </div>
            <div>
                <span class="font-semibold" style="color: #D8AC67;">ELECTROREDES - Soluciones Eléctricas y Telecomunicaciones</span>
            </div>
        </div>

        <!-- Navbar Principal -->
        <div class="px-4 py-3 flex align-items-center justify-content-between gap-3 border-bottom-1 surface-border">
            
            <!-- Logo -->
            <div class="flex align-items-center cursor-pointer" @click="router.push('/catalog')">
                <div class="flex align-items-center gap-2">
                    <div class="border-round p-2 flex align-items-center justify-content-center" style="background-color: #2D62A3;">
                        <i class="pi pi-bolt text-2xl text-white"></i>
                    </div>
                    <div class="flex flex-column">
                        <span class="text-2xl font-black tracking-wider leading-tight" style="color: #2D62A3;">ELECTRO<span style="color: #D8AC67;">REDES</span></span>
                        <small class="text-500 font-bold tracking-widest text-xs" style="margin-top: -3px;">E-COMMERCE</small>
                    </div>
                </div>
            </div>

            <!-- Buscador Corrección PrimeVue 4 (IconField + InputIcon) -->
            <div class="flex-1 max-w-30rem hidden md:block">
                <IconField iconPosition="right" class="w-full">
                    <InputText 
                        v-model="searchQuery" 
                        placeholder="Buscar cables, llaves térmicas, conectores..." 
                        class="w-full border-round-3xl surface-100 border-1 border-300 text-sm px-3 py-2 shadow-none"
                        @keyup.enter="handleSearch"
                    />
                    <InputIcon class="pi pi-search cursor-pointer text-600" @click="handleSearch" />
                </IconField>
            </div>

            <!-- Acciones Derecha -->
            <div class="flex align-items-center gap-3">
                
                <!-- Botón Carrito Limpio (Sin fondo oscuro deformado) -->
                <div class="relative cursor-pointer p-2 border-circle hover:surface-200 flex align-items-center justify-content-center transition-duration-150" @click="router.push('/cart')">
                    <i class="pi pi-shopping-cart text-2xl" style="color: #2D62A3;"></i>
                    <Badge 
                        v-if="cart.count > 0" 
                        :value="cart.count" 
                        class="absolute -top-1 -right-1 font-bold" 
                        style="background-color: #D8AC67; color: #1A1D20; min-width: 1.25rem; height: 1.25rem; font-size: 0.75rem;"
                    />
                </div>

                <div class="h-2rem border-left-1 surface-border"></div>

                <!-- Menú Usuario / Sesión -->
                <template v-if="auth.token">
                    <Button 
                        icon="pi pi-user" 
                        :label="auth.user?.name || 'Mi Cuenta'" 
                        text 
                        severity="secondary"
                        class="font-semibold text-sm border-round-3xl"
                        @click="toggleUserMenu"
                    />
                    <Menu ref="userMenu" :model="userMenuItems" :popup="true" />
                </template>

                <template v-else>
                    <Button 
                        label="Iniciar Sesión" 
                        icon="pi pi-sign-in" 
                        outlined 
                        class="border-round-3xl text-sm font-bold"
                        style="color: #2D62A3; border-color: #2D62A3;"
                        @click="router.push('/auth/login')" 
                    />
                </template>

            </div>
        </div>
    </header>
</template>