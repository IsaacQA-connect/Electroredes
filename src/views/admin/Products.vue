<script setup>
import api from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref } from 'vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';

const toast = useToast();
const loading = ref(true);
const products = ref([]);
const categories = ref([]);
const searchQuery = ref('');

const productDialog = ref(false);
const statusDialog = ref(false);
const isSaving = ref(false);
const selectedProduct = ref(null);

const form = reactive({
    id: null,
    name: '',
    code: '',
    category_id: null,
    price: 0,
    stock: 0,
    description: '',
    image_url: ''
});

const errors = reactive({});

const fetchProducts = async () => {
    loading.value = true;
    try {
        const [prodRes, catRes] = await Promise.all([
            api.get('/products'),
            api.get('/categories')
        ]);
        products.value = prodRes.data.data || prodRes.data || [];
        categories.value = catRes.data.data || catRes.data || [];
    } catch (error) {
        console.error('Error al cargar datos:', error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los productos.', life: 4000 });
    } finally {
        loading.value = false;
    }
};

const openNew = () => {
    Object.assign(form, { id: null, name: '', code: '', category_id: null, price: 0, stock: 0, description: '', image_url: '' });
    Object.keys(errors).forEach(k => errors[k] = '');
    productDialog.value = true;
};

const editProduct = (prod) => {
    Object.assign(form, {
        id: prod.id,
        name: prod.name,
        code: prod.code || '',
        category_id: prod.category_id || prod.category?.id,
        price: Number(prod.price),
        stock: prod.stock || 0,
        description: prod.description || '',
        image_url: prod.image_url || ''
    });
    Object.keys(errors).forEach(k => errors[k] = '');
    productDialog.value = true;
};

const validate = () => {
    Object.keys(errors).forEach(k => errors[k] = '');
    let valid = true;
    if (!form.name.trim()) { errors.name = 'El nombre es obligatorio'; valid = false; }
    if (!form.category_id) { errors.category_id = 'Selecciona una categoría'; valid = false; }
    if (form.price <= 0) { errors.price = 'El precio debe ser mayor a 0'; valid = false; }
    return valid;
};

const saveProduct = async () => {
    if (!validate()) return;
    isSaving.value = true;
    try {
        if (form.id) {
            await api.put(`/v1/products/${form.id}`, form);
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Producto actualizado.', life: 3000 });
        } else {
            await api.post('/v1/products', form);
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Producto registrado.', life: 3000 });
        }
        productDialog.value = false;
        fetchProducts();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el registro.', life: 4000 });
    } finally {
        isSaving.value = false;
    }
};

const confirmToggleStatus = (prod) => {
    selectedProduct.value = prod;
    statusDialog.value = true;
};

const toggleStatus = async () => {
    try {
        await api.patch(`/v1/products/${selectedProduct.value.id}/status`);
        toast.add({ severity: 'success', summary: 'Éxito', detail: 'Estado del producto actualizado.', life: 3000 });
        statusDialog.value = false;
        fetchProducts();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cambiar el estado.', life: 4000 });
    }
};

onMounted(() => {
    fetchProducts();
});
</script>

<template>
    <div class="surface-ground p-4 border-round-xl">
        <div class="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3">
            <div>
                <h2 class="text-3xl font-black text-900 m-0">Gestión de Productos</h2>
                <p class="text-500 text-sm m-0">Administra el inventario y catálogo general</p>
            </div>
            <Button label="Nuevo Producto" icon="pi pi-plus" class="border-round-3xl" style="background-color: #2D62A3; border-color: #2D62A3;" @click="openNew" />
        </div>

        <div class="surface-card p-4 border-round-xl shadow-1">
            <div class="flex justify-content-between align-items-center mb-3">
                <IconField iconPosition="left">
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="searchQuery" placeholder="Buscar producto..." class="p-inputtext-sm" />
                </IconField>
            </div>

            <DataTable :value="products" :loading="loading" paginator :rows="10" responsiveLayout="scroll" class="p-datatable-sm">
                <Column field="code" header="SKU / Código">
                    <template #body="slotProps">
                        <span class="font-mono text-xs font-bold text-700">{{ slotProps.data.code || 'N/A' }}</span>
                    </template>
                </Column>

                <Column field="name" header="Producto">
                    <template #body="slotProps">
                        <span class="font-bold text-900">{{ slotProps.data.name }}</span>
                    </template>
                </Column>

                <Column field="category.name" header="Categoría">
                    <template #body="slotProps">
                        <span>{{ slotProps.data.category?.name || 'Sin categoría' }}</span>
                    </template>
                </Column>

                <Column field="price" header="Precio">
                    <template #body="slotProps">
                        <span class="font-bold text-900">S/ {{ Number(slotProps.data.price).toFixed(2) }}</span>
                    </template>
                </Column>

                <Column field="stock" header="Stock">
                    <template #body="slotProps">
                        <Tag 
                            :value="slotProps.data.stock" 
                            :severity="slotProps.data.stock <= 5 ? 'danger' : (slotProps.data.stock <= 20 ? 'warn' : 'success')" 
                        />
                    </template>
                </Column>

                <Column field="status" header="Estado">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.status ? 'Activo' : 'Inactivo'" :severity="slotProps.data.status ? 'success' : 'secondary'" />
                    </template>
                </Column>

                <Column header="Acciones">
                    <template #body="slotProps">
                        <div class="flex gap-1">
                            <Button icon="pi pi-pencil" text border-circle severity="secondary" @click="editProduct(slotProps.data)" />
                            <Button :icon="slotProps.data.status ? 'pi pi-eye-slash' : 'pi pi-eye'" text border-circle :severity="slotProps.data.status ? 'warn' : 'success'" @click="confirmToggleStatus(slotProps.data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- MODAL FORMULARIO -->
        <Dialog v-model:visible="productDialog" :header="form.id ? 'Editar Producto' : 'Nuevo Producto'" modal class="p-fluid w-full max-w-30rem">
            <div class="field mb-3">
                <label class="font-bold text-xs text-700 uppercase">Nombre</label>
                <InputText v-model="form.name" :invalid="!!errors.name" />
                <small class="text-red-500" v-if="errors.name">{{ errors.name }}</small>
            </div>

            <div class="grid">
                <div class="col-6 field mb-3">
                    <label class="font-bold text-xs text-700 uppercase">SKU</label>
                    <InputText v-model="form.code" />
                </div>
                <div class="col-6 field mb-3">
                    <label class="font-bold text-xs text-700 uppercase">Categoría</label>
                    <Dropdown v-model="form.category_id" :options="categories" optionLabel="name" optionValue="id" placeholder="Seleccionar" :invalid="!!errors.category_id" />
                </div>
            </div>

            <div class="grid">
                <div class="col-6 field mb-3">
                    <label class="font-bold text-xs text-700 uppercase">Precio (S/)</label>
                    <InputNumber v-model="form.price" mode="currency" currency="PEN" locale="es-PE" :invalid="!!errors.price" />
                </div>
                <div class="col-6 field mb-3">
                    <label class="font-bold text-xs text-700 uppercase">Stock</label>
                    <InputNumber v-model="form.stock" :min="0" />
                </div>
            </div>

            <div class="field mb-3">
                <label class="font-bold text-xs text-700 uppercase">URL Imagen</label>
                <InputText v-model="form.image_url" />
            </div>

            <div class="field mb-3">
                <label class="font-bold text-xs text-700 uppercase">Descripción</label>
                <Textarea v-model="form.description" rows="3" />
            </div>

            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="productDialog = false" />
                <Button label="Guardar" :loading="isSaving" style="background-color: #2D62A3; border-color: #2D62A3;" @click="saveProduct" />
            </template>
        </Dialog>

        <!-- MODAL CAMBIO ESTADO -->
        <Dialog v-model:visible="statusDialog" header="Cambiar Estado" modal class="w-full max-w-25rem">
            <p>¿Deseas cambiar el estado del producto <strong>{{ selectedProduct?.name }}</strong>?</p>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="statusDialog = false" />
                <Button label="Confirmar" severity="primary" @click="toggleStatus" />
            </template>
        </Dialog>
    </div>
</template>