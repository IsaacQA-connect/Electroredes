import AppLayout from '@/layout/AppLayout.vue'; // Layout del Panel Admin
import { createRouter, createWebHistory } from 'vue-router';
// Importa tu layout público si tienes uno (ej. ShopLayout), si no, puedes cargarlo dinámicamente

const router = createRouter({
    history: createWebHistory(),
    routes: [
        /*
        |--------------------------------------------------------------------------
        | Rutas Públicas / E-Commerce
        |--------------------------------------------------------------------------
        */
        {
            path: '/',
            name: 'catalog',
            component: () => import('@/views/public/Catalog.vue')
        },
        {
            path: '/checkout',
            name: 'checkout',
            component: () => import('@/views/public/Checkout.vue'),
            meta: { requiresAuth: true } // El checkout requiere sesión iniciada
        },
        {
        path: '/cart',
        name: 'cart',
        component: () => import('@/views/CartView.vue')
        },
        {
        path: '/my-orders',
        name: 'my-orders',
        component: () => import('@/views/OrdersView.vue'),
        meta: { requiresAuth: true }
        },
        {
            path: '/facturacion/nueva',
            name: 'invoice-create',
            component: () => import('@/views/billing/InvoiceCreate.vue')
        },


        /*
        |--------------------------------------------------------------------------
        | Rutas de Autenticación
        |--------------------------------------------------------------------------
        */
        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue'),
            meta: { requiresGuest: true }
        },
        {
            path: '/auth/register',
            name: 'register',
            component: () => import('@/views/pages/auth/RegisterView.vue'),
            meta: { requiresGuest: true }
        },
        {
            path: '/auth/social-callback',
            name: 'social-callback',
            component: () => import('@/views/pages/auth/SocialCallback.vue')
        },
        {
            path: '/forgot-password',
            name: 'forgot-password',
            component: () => import('@/views/pages/auth/ForgotPassword.vue')
        },
        {
            path: '/reset-password',
            name: 'reset-password',
            component: () => import('@/views/pages/auth/ResetPassword.vue')
        },
        {
            path: '/verify-email',
            name: 'verify-email',
            component: () => import('@/views/pages/auth/VerifyEmail.vue')
        },
        /*
        |--------------------------------------------------------------------------
        | Rutas Protegidas (Panel Administrativo / POS)
        |--------------------------------------------------------------------------
        */
        {
            path: '/admin',
            component: AppLayout,
            meta: { 
                requiresAuth: true, 
                requiresRole: ['ADMIN', 'ADMINISTRADOR', 'VENDEDOR'],
                hideNavbar: true
            },
            children: [
                {
                    path: '',
                    redirect: { name: 'dashboard' }
                },
                {
                    path: 'dashboard',
                    name: 'dashboard',
                    component: () => import('@/views/Dashboard.vue')
                },
                {
                    path: 'products',
                    name: 'admin-products',
                    component: () => import('@/views/admin/Products.vue')
                },
                {
                    path: 'orders',
                    name: 'admin-orders',
                    component: () => import('@/views/admin/Orders.vue')
                },
                {
                    path: 'category',
                    name: 'category',
                    component: () => import('@/views/admin/Category.vue')
                },
                {
                    path: 'cash-register',
                    name: 'admin-cash-register',
                    component: () => import('@/views/admin/CashRegister.vue')
                },
                
                {
                    path: 'inventory-stock',
                    name: 'inventory-stock',
                    component: () => import('@/views/admin/InventoryStockView.vue')
                },

                {
                    path: 'users',
                    name: 'admin.users',
                    component: () => import('@/views/admin/UsersIndex.vue'),
                    meta: { title: 'Gestión de Usuarios - Admin' }
                }
            ]
        },

        /*
        |--------------------------------------------------------------------------
        | Redirección 404
        |--------------------------------------------------------------------------
        */
        {
            path: '/:pathMatch(.*)*',
            redirect: '/'
        }
    ]
});

/*
|--------------------------------------------------------------------------
| Guardián de Navegación (Middleware)
|--------------------------------------------------------------------------
*/
router.beforeEach((to, from, next) => {
    const token = localStorage.getItem('token');
    // Normalizamos a mayúsculas para evitar fallos por "admin" vs "ADMINISTRADOR"
    const userRole = (localStorage.getItem('user_role') || '').toUpperCase();

    // 1. Sin Token -> Al Login
    if (to.meta.requiresAuth && !token) {
        return next({ name: 'login' });
    }

    // 2. Usuario ya logueado en rutas de invitados (Login/Register)
    if (to.meta.requiresGuest && token) {
        return ['ADMINISTRADOR', 'VENDEDOR', 'ADMIN'].includes(userRole) 
            ? next({ name: 'dashboard' }) 
            : next({ name: 'catalog' });
    }

    // 3. Control de Roles para Admin
    if (to.meta.requiresRole) {
        const allowedRoles = to.meta.requiresRole.map(r => r.toUpperCase());
        // Permite la entrada si el rol coincide o si es 'ADMIN'
        const hasPermission = allowedRoles.includes(userRole) || userRole === 'ADMIN';

        if (!hasPermission) {
            console.warn(`Acceso denegado. Rol actual: "${userRole}", requeridos:`, allowedRoles);
            return next({ name: 'catalog' });
        }
    }

    next();
});

export default router;