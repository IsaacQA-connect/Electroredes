<script setup>
import api from '@/service/api';
import { useAuthStore } from '@/stores/auth';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const loading = ref(false);

const docTypes = [
    { label: 'DNI (8 dígitos)', value: 'DNI' },
    { label: 'RUC (11 dígitos)', value: 'RUC' },
    { label: 'Carnet de Extranjería', value: 'CE' },
    { label: 'Pasaporte', value: 'PASAPORTE' }
];

const form = reactive({
    name: '',
    email: '',
    phone: '',
    document_type: 'DNI',
    document_number: '',
    address: ''
});

// Cargar datos actuales del usuario/cliente
const loadUserData = () => {
    const user = authStore.user;
    const customer = user?.customer || user;

    if (user) {
        form.name = user.name || '';
        form.email = user.email || '';
    }

    if (customer) {
        form.phone = customer.phone || '';
        form.document_type = customer.document_type || 'DNI';
        form.document_number = customer.document_number || '';
        form.address = customer.address || '';
    }
};

onMounted(async () => {
    // Si aún no tenemos los datos completos, refrescamos desde /auth/me
    if (!authStore.user) {
        await authStore.fetchUser();
    }
    loadUserData();
});

const saveProfile = async () => {
    // Validaciones
    if (!form.name.trim()) {
        toast.add({ severity: 'warn', summary: 'Campo Requerido', detail: 'El nombre completo es obligatorio.', life: 3500 });
        return;
    }

    const docNum = form.document_number.trim();

    if (form.document_type === 'DNI' && docNum) {
        if (!/^\d{8}$/.test(docNum)) {
            toast.add({ severity: 'warn', summary: 'DNI Inválido', detail: 'El DNI debe tener exactamente 8 dígitos numéricos.', life: 4000 });
            return;
        }
    }

    if (form.document_type === 'RUC' && docNum) {
        if (!/^\d{11}$/.test(docNum)) {
            toast.add({ severity: 'warn', summary: 'RUC Inválido', detail: 'El RUC debe tener exactamente 11 dígitos numéricos.', life: 4000 });
            return;
        }
    }

    loading.value = true;

    try {
        const payload = {
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            document_type: form.document_type,
            document_number: docNum || null,
            address: form.address.trim() || null
        };

        // Enviar actualización al Backend
        await api.put('/auth/me', payload);

        // Refrescar el estado global de Pinia para que el Navbar y Checkout tengan los datos actualizados
        await authStore.fetchUser();

        toast.add({ 
            severity: 'success', 
            summary: 'Perfil Actualizado', 
            detail: 'Tus datos se guardaron correctamente.', 
            life: 4000 
        });

    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        const detail = error.response?.data?.message || 'No se pudieron actualizar tus datos.';
        toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 });
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="min-h-screen surface-ground py-5 px-4">
        <Toast />
        <div class="mx-auto" style="max-width: 750px;">

            <!-- Header Panel -->
            <div class="flex align-items-center gap-3 mb-4">
                <Button icon="pi pi-arrow-left" text rounded severity="secondary" @click="router.push('/catalog')" />
                <div>
                    <h2 class="text-3xl font-bold text-900 m-0">Mi Perfil</h2>
                    <small class="text-600">Administra tu información personal y datos de facturación</small>
                </div>
            </div>

            <!-- Alerta para usuarios registados con Google sin DNI -->
            <Message 
                v-if="!form.document_number" 
                severity="info" 
                class="mb-4" 
                :closable="false"
            >
                <div class="flex align-items-center gap-2">
                    <i class="pi pi-exclamation-circle text-xl"></i>
                    <span>Completa tu tipo y número de documento (DNI/RUC) para agilizar la emisión de tus comprobantes de pago en tus compras.</span>
                </div>
            </Message>

            <!-- Card de Edición -->
            <div class="surface-card p-5 border-round-2xl shadow-2">
                
                <h3 class="text-xl font-bold text-900 mb-4 border-bottom-1 surface-border pb-2">
                    <i class="pi pi-user mr-2" style="color: #2D62A3;"></i>
                    Información General
                </h3>

                <div class="grid">
                    <!-- Nombre Completo -->
                    <div class="col-12 md:col-6 field mb-3">
                        <label class="font-bold text-700 block mb-2">Nombre Completo *</label>
                        <InputText v-model="form.name" class="w-full" placeholder="Ingresa tu nombre completo" />
                    </div>

                    <!-- Correo Electrónico (Readonly) -->
                    <div class="col-12 md:col-6 field mb-3">
                        <label class="font-bold text-700 block mb-2">Correo Electrónico</label>
                        <InputText v-model="form.email" class="w-full surface-200 cursor-not-allowed" disabled />
                        <small class="text-500">El correo está vinculado a tu cuenta y no se puede editar.</small>
                    </div>

                    <!-- Tipo de Documento -->
                    <div class="col-12 md:col-6 field mb-3">
                        <label class="font-bold text-700 block mb-2">Tipo de Documento</label>
                        <Select 
                            v-model="form.document_type" 
                            :options="docTypes" 
                            optionLabel="label" 
                            optionValue="value" 
                            class="w-full"
                        />
                    </div>

                    <!-- Número de Documento -->
                    <div class="col-12 md:col-6 field mb-3">
                        <label class="font-bold text-700 block mb-2">Número de Documento (DNI/RUC)</label>
                        <InputText 
                            v-model="form.document_number" 
                            class="w-full" 
                            :maxlength="form.document_type === 'DNI' ? 8 : (form.document_type === 'RUC' ? 11 : 20)"
                            placeholder="Ej: 71234567" 
                        />
                    </div>

                    <!-- Teléfono / Celular -->
                    <div class="col-12 md:col-6 field mb-3">
                        <label class="font-bold text-700 block mb-2">Teléfono / Celular</label>
                        <InputText v-model="form.phone" class="w-full" placeholder="Ej: 987654321" maxlength="9" />
                    </div>

                    <!-- Dirección Principal -->
                    <div class="col-12 field mb-3">
                        <label class="font-bold text-700 block mb-2">Dirección Principal de Entrega</label>
                        <InputText v-model="form.address" class="w-full" placeholder="Ej: Av. Principal 456, Int. 201, Lima" />
                    </div>
                </div>

                <!-- Botón de Acción -->
                <div class="flex justify-content-end gap-3 mt-4 border-top-1 surface-border pt-4">
                    <Button 
                        label="Cancelar" 
                        severity="secondary" 
                        outlined 
                        class="border-round-3xl px-4" 
                        @click="router.push('/catalog')" 
                    />
                    <Button 
                        label="Guardar Cambios" 
                        icon="pi pi-save" 
                        :loading="loading"
                        class="border-round-3xl border-none px-5 font-bold" 
                        style="background-color: #2D62A3; color: #FFFFFF;"
                        @click="saveProfile" 
                    />
                </div>

            </div>

        </div>
    </div>
</template>