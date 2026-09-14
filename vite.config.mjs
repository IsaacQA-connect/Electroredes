import { fileURLToPath, URL } from 'node:url';

import { PrimeVueResolver } from '@primevue/auto-import-resolver';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    optimizeDeps: {
        noDiscovery: true
    },
    plugins: [
        vue(),
        tailwindcss(),
        Components({
            resolvers: [PrimeVueResolver()]
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler'
            }
        }
    },
    // ➡️ ESTA ES LA SECCIÓN QUE LE FALTA PARA HOSTINGER:
    preview: {
        // Lee el puerto dinámico que Hostinger te asigne en producción
        port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
        host: true,         // Permite conexiones externas hacia el contenedor
        allowedHosts: true  // Evita el error "Invalid Host Header" en la nube
    }
});
