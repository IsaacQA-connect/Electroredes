<script setup>
import axios from 'axios';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref } from 'vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Select from 'primevue/select';
import Tag from 'primevue/tag';

const toast = useToast();
const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://electroredes-api.test/api/v1';

// Estados
const users = ref([]);
const roles = ref([]);
const loading = ref(false);
const search = ref('');
const dialogVisible = ref(false);
const isEditing = ref(false);
const isSubmitting = ref(false);
const currentUserId = ref(null);

const form = reactive({
    name: '',
    email: '',
    password: '',
    role_id: null
});

const errors = reactive({});

// Cargar Usuarios y Roles
const loadUsers = async (page = 1) => {
    loading.value = true;
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/admin/users?page=${page}&search=${search.value}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        users.value = response.data.data;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los usuarios.', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const loadRoles = async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/admin/users/roles`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        roles.value = response.data;
    } catch (err) {
        console.error('Error cargando roles', err);
    }
};

onMounted(() => {
    loadUsers();
    loadRoles();
});

// Modal Actions
const openNewModal = () => {
    isEditing.value = false;
    currentUserId.value = null;
    form.name = '';
    form.email = '';
    form.password = '';
    form.role_id = null;
    Object.keys(errors).forEach(key => delete errors[key]);
    dialogVisible.value = true;
};

const openEditModal = (user) => {
    isEditing.value = true;
    currentUserId.value = user.id;
    form.name = user.name;
    form.email = user.email;
    form.password = '';
    form.role_id = user.role_id;
    Object.keys(errors).forEach(key => delete errors[key]);
    dialogVisible.value = true;
};

// Guardar / Actualizar
const saveUser = async () => {
    isSubmitting.value = true;
    Object.keys(errors).forEach(key => delete errors[key]);
    const token = localStorage.getItem('token');

    try {
        let response;
        if (isEditing.value) {
            response = await axios.put(`${API_URL}/admin/users/${currentUserId.value}`, form, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } else {
            response = await axios.post(`${API_URL}/admin/users`, form, {
                headers: { Authorization: `Bearer ${token}` }
            });
        }

        toast.add({ severity: 'success', summary: 'Éxito', detail: response.data.message, life: 3000 });
        dialogVisible.value = false;
        loadUsers();
    } catch (err) {
        if (err.response?.status === 422) {
            Object.assign(errors, err.response.data.errors);
        } else {
            toast.add({ severity: 'error', summary: 'Error', detail: 'Ocurrió un problema al guardar.', life: 3000 });
        }
    } finally {
        isSubmitting.value = false;
    }
};

const toggleVerification = async (user) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.patch(`${API_URL}/admin/users/${user.id}/toggle-verification`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        toast.add({ 
            severity: 'success', 
            summary: 'Actualizado', 
            detail: response.data.message, 
            life: 3000 
        });
        
        loadUsers(); // Recargar la tabla
    } catch (err) {
        toast.add({ 
            severity: 'error', 
            summary: 'Error', 
            detail: 'No se pudo cambiar el estado de verificación.', 
            life: 3000 
        });
    }
};
// Eliminar Usuario
const deleteUser = async (user) => {
    if (!confirm(`¿Estás seguro de eliminar a ${user.name}?`)) return;

    try {
        const token = localStorage.getItem('token');
        const response = await axios.delete(`${API_URL}/admin/users/${user.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        toast.add({ severity: 'success', summary: 'Eliminado', detail: response.data.message, life: 3000 });
        loadUsers();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el usuario.', life: 3000 });
    }
};
</script>

<template>
    <div class="p-4">
        <!-- Encabezado -->
        <div class="flex flex-column md:flex-row justify-content-between align-items-center mb-4 gap-3">
            <div>
                <h1 class="text-2xl font-bold m-0" style="color: #2D62A3;">Gestión de Usuarios</h1>
                <p class="text-500 text-sm mt-1">Administra los accesos y roles del sistema</p>
            </div>
            <Button label="Nuevo Usuario" icon="pi pi-plus" class="border-round-2xl" style="background-color: #2D62A3; border-color: #2D62A3;" @click="openNewModal" />
        </div>

        <!-- Tabla y Filtro -->
        <div class="surface-card p-4 border-round-2xl shadow-2">
            <div class="mb-3">
                <IconField iconPosition="left">
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="search" placeholder="Buscar por nombre o correo..." class="w-full md:w-20rem border-round-xl" @input="loadUsers(1)" />
                </IconField>
            </div>

            <DataTable :value="users" :loading="loading" responsiveLayout="scroll" class="p-datatable-sm">
                <Column field="id" header="ID" sortable></Column>
                <Column field="name" header="Nombre" sortable></Column>
                <Column field="email" header="Correo Electrónico"></Column>
                
                <Column header="Rol">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.role?.name || 'SIN ROL'" severity="info" class="border-round-md" />
                    </template>
                </Column>

                <Column header="Verificación">
                    <template #body="slotProps">
                        <Button 
                            :label="slotProps.data.email_verified_at ? 'Verificado' : 'Pendiente'" 
                            :severity="slotProps.data.email_verified_at ? 'success' : 'warn'" 
                            :icon="slotProps.data.email_verified_at ? 'pi pi-check-circle' : 'pi pi-clock'"
                            class="p-button-outlined p-button-sm border-round-xl text-xs"
                            @click="toggleVerification(slotProps.data)"
                            v-tooltip.top="'Haz clic para cambiar estado'"
                        />
                    </template>
                </Column>

                <Column header="Acciones" class="text-center">
                    <template #body="slotProps">
                        <Button icon="pi pi-pencil" class="p-button-rounded p-button-text p-button-warning mr-2" @click="openEditModal(slotProps.data)" />
                        <Button icon="pi pi-trash" class="p-button-rounded p-button-text p-button-danger" @click="deleteUser(slotProps.data)" />
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Modal Crear/Editar -->
        <Dialog v-model:visible="dialogVisible" :header="isEditing ? 'Editar Usuario' : 'Nuevo Usuario'" modal class="p-fluid w-full max-w-28rem border-round-2xl">
            <form @submit.prevent="saveUser" class="mt-2">
                <div class="field mb-3">
                    <label class="font-bold text-xs uppercase">Nombre Completo</label>
                    <InputText v-model="form.name" class="border-round-xl py-2" :invalid="!!errors.name" />
                    <small class="text-red-500" v-if="errors.name">{{ errors.name[0] }}</small>
                </div>

                <div class="field mb-3">
                    <label class="font-bold text-xs uppercase">Correo Electrónico</label>
                    <InputText v-model="form.email" type="email" class="border-round-xl py-2" :invalid="!!errors.email" />
                    <small class="text-red-500" v-if="errors.email">{{ errors.email[0] }}</small>
                </div>

                <div class="field mb-3">
                    <label class="font-bold text-xs uppercase">Rol asignado</label>
                    <Select v-model="form.role_id" :options="roles" optionLabel="name" optionValue="id" placeholder="Selecciona un rol" class="border-round-xl" :invalid="!!errors.role_id" />
                    <small class="text-red-500" v-if="errors.role_id">{{ errors.role_id[0] }}</small>
                </div>

                <div class="field mb-4">
                    <label class="font-bold text-xs uppercase">{{ isEditing ? 'Nueva Contraseña (Opcional)' : 'Contraseña' }}</label>
                    <Password v-model="form.password" :feedback="false" toggleMask class="w-full" inputClass="w-full border-round-xl py-2" :invalid="!!errors.password" />
                    <small class="text-red-500" v-if="errors.password">{{ errors.password[0] }}</small>
                </div>

                <div class="flex justify-content-end gap-2">
                    <Button label="Cancelar" icon="pi pi-times" class="p-button-text" @click="dialogVisible = false" />
                    <Button type="submit" :label="isEditing ? 'Actualizar' : 'Guardar'" icon="pi pi-check" style="background-color: #2D62A3; border-color: #2D62A3;" :loading="isSubmitting" />
                </div>
            </form>
        </Dialog>
    </div>
</template>