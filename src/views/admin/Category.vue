<script setup>
import api from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref } from 'vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';

const toast = useToast();
const loading = ref(true);
const categories = ref([]);
const searchQuery = ref('');

const categoryDialog = ref(false);
const statusDialog = ref(false);
const isSaving = ref(false);
const selectedCategory = ref(null);

const form = reactive({
    id: null,
    name: '',
    description: ''
});

const errors = reactive({});

const resetForm = () => {
    Object.assign(form, { id: null, name: '', description: '' });
    clearErrors();
};

const clearErrors = () => {
    Object.keys(errors).forEach(k => delete errors[k]);
};

const fetchCategories = async () => {
    loading.value = true;
    try {
        const response = await api.get('/categories');
        categories.value = response.data.data || response.data || [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las categorías.', life: 4000 });
    } finally {
        loading.value = false;
    }
};

const openNew = () => {
    resetForm();
    categoryDialog.value = true;
};

const editCategory = (cat) => {
    resetForm();
    Object.assign(form, {
        id: cat.id,
        name: cat.name,
        description: cat.description || ''
    });
    categoryDialog.value = true;
};

// Validación Frontend (incluye restricción de nombre único en memoria)
const validateFrontend = () => {
    clearErrors();
    let valid = true;

    if (!form.name.trim()) {
        errors.name = 'El nombre de la categoría es obligatorio.';
        valid = false;
    } else {
        const isDuplicate = categories.value.some(cat => 
            cat.name.trim().toLowerCase() === form.name.trim().toLowerCase() && cat.id !== form.id
        );
        if (isDuplicate) {
            errors.name = 'Esta categoría ya existe.';
            valid = false;
        }
    }

    return valid;
};

const saveCategory = async () => {
    if (!validateFrontend()) return;
    isSaving.value = true;

    try {
        if (form.id) {
            await api.put(`/categories/${form.id}`, form);
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Categoría actualizada.', life: 3000 });
        } else {
            await api.post('/categories', form);
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Categoría registrada.', life: 3000 });
        }

        categoryDialog.value = false;
        fetchCategories();
    } catch (err) {
        if (err.response && err.response.status === 422) {
            const backendErrors = err.response.data.errors || {};
            Object.keys(backendErrors).forEach(key => {
                errors[key] = backendErrors[key][0];
            });
            toast.add({ severity: 'warn', summary: 'Validación', detail: 'Revisa los campos del formulario.', life: 4000 });
        } else {
            toast.add({ severity: 'error', summary: 'Error', detail: 'Ocurrió un error al procesar la solicitud.', life: 4000 });
        }
    } finally {
        isSaving.value = false;
    }
};

const confirmToggleStatus = (cat) => {
    selectedCategory.value = cat;
    statusDialog.value = true;
};

const toggleStatus = async () => {
    try {
        await api.patch(`/categories/${selectedCategory.value.id}/status`);
        toast.add({ severity: 'success', summary: 'Éxito', detail: 'Estado actualizado correctamente.', life: 3000 });
        statusDialog.value = false;
        fetchCategories();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cambiar el estado.', life: 4000 });
    }
};

onMounted(() => {
    fetchCategories();
});
</script>

<template>
    <div class="surface-ground p-4 border-round-xl">
        <!-- HEADER -->
        <div class="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3">
            <div>
                <h2 class="text-3xl font-black text-900 m-0">Gestión de Categorías</h2>
                <p class="text-500 text-sm m-0">Clasificación y agrupación de productos del catálogo</p>
            </div>
            <Button label="Nueva Categoría" icon="pi pi-plus" class="border-round-3xl" style="background-color: #2D62A3; border-color: #2D62A3;" @click="openNew" />
        </div>

        <!-- TABLA -->
        <div class="surface-card p-4 border-round-xl shadow-1">
            <div class="flex justify-content-between align-items-center mb-3">
                <IconField iconPosition="left">
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="searchQuery" placeholder="Buscar categoría..." class="p-inputtext-sm" />
                </IconField>
            </div>

            <DataTable :value="categories" :loading="loading" paginator :rows="10" responsiveLayout="scroll" class="p-datatable-sm">
                <Column field="name" header="Nombre" sortable>
                    <template #body="slotProps">
                        <span class="font-bold text-900">{{ slotProps.data.name }}</span>
                    </template>
                </Column>

                <Column field="description" header="Descripción">
                    <template #body="slotProps">
                        <span class="text-600">{{ slotProps.data.description || 'Sin descripción' }}</span>
                    </template>
                </Column>

                <Column field="status" header="Estado">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.status ? 'Activo' : 'Inactivo'" :severity="slotProps.data.status ? 'success' : 'secondary'" />
                    </template>
                </Column>

                <Column header="Acciones" style="width: 120px">
                    <template #body="slotProps">
                        <div class="flex gap-1">
                            <Button icon="pi pi-pencil" text border-circle severity="secondary" @click="editCategory(slotProps.data)" />
                            <Button :icon="slotProps.data.status ? 'pi pi-eye-slash' : 'pi pi-eye'" text border-circle :severity="slotProps.data.status ? 'warn' : 'success'" @click="confirmToggleStatus(slotProps.data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- MODAL CREAR / EDITAR -->
        <Dialog v-model:visible="categoryDialog" :header="form.id ? 'Editar Categoría' : 'Nueva Categoría'" modal class="p-fluid w-full max-w-28rem">
            <div class="field mb-3">
                <label class="font-bold text-xs text-700 uppercase">Nombre *</label>
                <InputText v-model="form.name" :invalid="!!errors.name" placeholder="Ej. Materiales Eléctricos" />
                <small class="text-red-500" v-if="errors.name">{{ errors.name }}</small>
            </div>

            <div class="field mb-3">
                <label class="font-bold text-xs text-700 uppercase">Descripción</label>
                <Textarea v-model="form.description" rows="3" placeholder="Detalles o alcance de la categoría..." />
            </div>

            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="categoryDialog = false" />
                <Button label="Guardar" :loading="isSaving" style="background-color: #2D62A3; border-color: #2D62A3;" @click="saveCategory" />
            </template>
        </Dialog>

        <!-- MODAL ESTADO -->
        <Dialog v-model:visible="statusDialog" header="Cambiar Estado" modal class="w-full max-w-25rem">
            <p>¿Deseas cambiar el estado de la categoría <strong>{{ selectedCategory?.name }}</strong>?</p>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="statusDialog = false" />
                <Button label="Confirmar" severity="primary" @click="toggleStatus" />
            </template>
        </Dialog>
    </div>
</template>