<script setup>
import { useAuthStore } from '@/stores/auth';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const auth = useAuthStore();

const isSidebarOpen = ref(true);
const isDarkMode = ref(false);

const toggleSidebar = () => {
    isSidebarOpen.value = !isSidebarOpen.value;
};

// Alterna la clase .app-dark en el HTML para PrimeVue 4 y Tailwind
const toggleDarkMode = () => {
    isDarkMode.value = !isDarkMode.value;
    if (isDarkMode.value) {
        document.documentElement.classList.add('app-dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.remove('app-dark');
        localStorage.setItem('theme', 'light');
    }
};

// Mantiene la preferencia guardada del usuario al recargar
onMounted(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        isDarkMode.value = true;
        document.documentElement.classList.add('app-dark');
    }
});

const handleLogout = () => {
    auth.logout();
    router.push('/login');
};
</script>

<template>
    <!-- CONTENEDOR PRINCIPAL: Gris suave en Claro (#F8FAFC) | Slate Oscuro en Dark (#0F172A) -->
    <div class="min-h-screen flex flex-column text-slate-800 dark:text-slate-100 transition-colors duration-200" :class="isDarkMode ? 'bg-slate-900' : 'bg-slate-50'">
        
        <!-- NAVBAR INSTITUCIONAL AZUL -->
        <header 
            class="h-3rem px-4 flex align-items-center justify-content-between fixed top-0 left-0 right-0 z-5 shadow-2 transition-colors duration-200"
            :style="{ backgroundColor: isDarkMode ? '#1E293B' : '#1E40AF' }" 
        >
            <!-- LADO IZQUIERDO: MENU Y LOGO -->
            <div class="flex align-items-center gap-3">
                <Button 
                    icon="pi pi-bars" 
                    text 
                    rounded 
                    class="text-white hover:bg-white/10" 
                    @click="toggleSidebar" 
                />
                <div class="flex align-items-center gap-2 cursor-pointer" @click="router.push('/')">
                    <div class="border-circle bg-white flex align-items-center justify-content-center shadow-1" style="width: 28px; height: 28px;">
                        <i class="pi pi-bolt text-blue-700 font-bold text-sm"></i>
                    </div>
                    <span class="font-black text-lg tracking-wide text-white">ELECTROREDES</span>
                </div>
            </div>

            <!-- LADO DERECHO: ACCIONES Y USUARIO -->
            <div class="flex align-items-center gap-2">
                <!-- SWITCH MODO OSCURO / CLARO -->
                <Button 
                    :icon="isDarkMode ? 'pi pi-sun text-yellow-300' : 'pi pi-moon text-white'" 
                    text 
                    rounded 
                    class="hover:bg-white/10" 
                    @click="toggleDarkMode"
                    :title="isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
                />
                <Button icon="pi pi-bell" text rounded class="text-white hover:bg-white/10" />
                <Button icon="pi pi-envelope" text rounded class="text-white hover:bg-white/10" />
                
                <div class="border-left-1 border-white/20 h-1rem mx-2"></div>
                
                <div class="flex align-items-center gap-2">
                    <Avatar icon="pi pi-user" shape="circle" class="bg-blue-100 text-blue-900 font-bold" />
                    <span class="font-bold text-sm text-white hidden md:inline">{{ auth.user?.name || 'Administrador' }}</span>
                    <Button icon="pi pi-sign-out" text rounded class="text-white hover:bg-red-500/80" @click="handleLogout" title="Cerrar sesión" />
                </div>
            </div>
        </header>

        <!-- CUERPO PRINCIPAL -->
        <div class="flex flex-1 relative" style="margin-top: 3rem;">
            
            <!-- SIDEBAR ADAPTATIVO -->
            <aside 
                class="fixed bottom-0 left-0 z-3 transition-all duration-300 overflow-y-auto border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800"
                style="top: 3rem;"
                :class="isSidebarOpen ? 'w-16rem opacity-100' : 'w-0 opacity-0 p-0 pointer-events-none'"
            >
                <div class="p-3" v-show="isSidebarOpen">
                    <div class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-3">Inicio</div>
                    <ul class="list-none p-0 m-0 mb-4">
                        <li>
                            <router-link 
                                to="/admin/dashboard" 
                                class="flex align-items-center gap-3 px-3 py-2 border-round text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors no-underline"
                                active-class="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
                            >
                                <i class="pi pi-home text-lg"></i>
                                <span>Dashboard</span>
                            </router-link>
                        </li>
                    </ul>

                    <div class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-3">Módulos del Sistema</div>
                    <ul class="list-none p-0 m-0 space-y-1">
                        <li>
                            <router-link 
                                to="/admin/products" 
                                class="flex align-items-center gap-3 px-3 py-2 border-round text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors no-underline"
                                active-class="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
                            >
                                <i class="pi pi-box text-lg"></i>
                                <span>Productos</span>
                            </router-link>
                        </li>
                        <li>
                            <router-link 
                                to="/admin/category" 
                                class="flex align-items-center gap-3 px-3 py-2 border-round text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors no-underline"
                                active-class="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
                            >
                                <i class="pi pi-tags text-lg"></i>
                                <span>Categorías</span>
                            </router-link>
                        </li>
                        <li>
                            <router-link 
                                to="/admin/orders" 
                                class="flex align-items-center gap-3 px-3 py-2 border-round text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors no-underline"
                                active-class="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
                            >
                                <i class="pi pi-shopping-cart text-lg"></i>
                                <span>Ventas / Pedidos</span>
                            </router-link>
                        </li>
                        <li>
                            <router-link 
                                to="/admin/inventory-stock" 
                                class="flex align-items-center gap-3 px-3 py-2 border-round text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors no-underline"
                                active-class="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
                            >
                                <i class="pi pi-shopping-cart text-lg"></i>
                                <span>Control de inventario</span>
                            </router-link>
                        </li>
                        <li>
                            <router-link 
                                to="/admin/cash-register" 
                                class="flex align-items-center gap-3 px-3 py-2 border-round text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors no-underline"
                                active-class="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50"
                            >
                                <i class="pi pi-shopping-cart text-lg"></i>
                                <span>Registro de Caja</span>
                            </router-link>
                        </li>
                    </ul>
                </div>
            </aside>

            <!-- VISTA DEL DASHBOARD -->
            <main 
                class="flex-1 p-4 transition-all duration-300 w-full"
                :style="{ marginLeft: isSidebarOpen ? '16rem' : '0rem' }"
            >
                <router-view />
            </main>
        </div>
    </div>
</template>