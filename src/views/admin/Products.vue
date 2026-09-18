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

// Manejo de archivo e imagen
const fileInput = ref(null);
const selectedFile = ref(null);
const imagePreview = ref(null);

const form = reactive({
    id: null,
    name: '',
    code: '',
    barcode: '',
    category_id: null,
    unit: 'UND',
    cost: 0,
    sale_price: 0,
    stock: 0,
    minimum_stock: 5,
    description: '',
    image_path: null
});

const errors = reactive({});

const resetForm = () => {
    Object.assign(form, {
        id: null,
        name: '',
        code: '',
        barcode: '',
        category_id: null,
        unit: 'UND',
        cost: 0,
        sale_price: 0,
        stock: 0,
        minimum_stock: 5,
        description: '',
        image_path: null
    });
    selectedFile.value = null;
    imagePreview.value = null;
    clearErrors();
};

const clearErrors = () => {
    Object.keys(errors).forEach(k => delete errors[k]);
};

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
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los datos iniciales.', life: 4000 });
    } finally {
        loading.value = false;
    }
};

const openNew = () => {
    resetForm();
    productDialog.value = true;
};

const editProduct = (prod) => {
    resetForm();
    Object.assign(form, {
        id: prod.id,
        name: prod.name,
        code: prod.code || '',
        barcode: prod.barcode || '',
        category_id: prod.category_id || prod.category?.id,
        unit: prod.unit || 'UND',
        cost: Number(prod.cost) || 0,
        sale_price: Number(prod.sale_price) || 0,
        stock: Number(prod.stock) || 0,
        minimum_stock: Number(prod.minimum_stock) || 5,
        description: prod.description || '',
        image_path: prod.image_path || null
    });
    imagePreview.value = prod.image_path || null;
    productDialog.value = true;
};

const onFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) {
            toast.add({ severity: 'warn', summary: 'Archivo pesado', detail: 'La imagen debe pesar menos de 2MB.', life: 3000 });
            return;
        }
        selectedFile.value = file;
        imagePreview.value = URL.createObjectURL(file);
    }
};

const triggerFileInput = () => {
    fileInput.value.click();
};

const validateFrontend = () => {
    clearErrors();
    let valid = true;
    if (!form.name.trim()) { errors.name = 'El nombre es obligatorio'; valid = false; }
    if (!form.code.trim()) { errors.code = 'El código SKU es obligatorio'; valid = false; }
    if (!form.category_id) { errors.category_id = 'Selecciona una categoría'; valid = false; }
    if (form.sale_price <= 0) { errors.sale_price = 'El precio debe ser mayor a 0'; valid = false; }
    return valid;
};

const saveProduct = async () => {
    if (!validateFrontend()) return;
    isSaving.value = true;

    try {
        let productId = form.id;
        const payload = { ...form };

        if (form.id) {
            const res = await api.put(`/products/${form.id}`, payload);
            productId = res.data.data.id;
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Producto actualizado.', life: 3000 });
        } else {
            const res = await api.post('/products', payload);
            productId = res.data.data.id;
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Producto registrado.', life: 3000 });
        }

        // Subida independiente de imagen a S3 si fue seleccionada
        if (selectedFile.value && productId) {
            const formData = new FormData();
            formData.append('image', selectedFile.value);
            
            await api.post(`/products/${productId}/image`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        }

        productDialog.value = false;
        fetchProducts();
    } catch (err) {
        if (err.response && err.response.status === 422) {
            const backendErrors = err.response.data.errors || {};
            Object.keys(backendErrors).forEach(key => {
                errors[key] = backendErrors[key][0];
            });
            toast.add({ severity: 'warn', summary: 'Validación', detail: 'Revisa los campos con errores.', life: 4000 });
        } else {
            toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo procesar la solicitud.', life: 4000 });
        }
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
        await api.patch(`/products/${selectedProduct.value.id}/status`);
        toast.add({ severity: 'success', summary: 'Éxito', detail: 'Estado actualizado correctamente.', life: 3000 });
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
        <!-- HEADER -->
        <div class="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3">
            <div>
                <h2 class="text-3xl font-black text-900 m-0">Gestión de Productos</h2>
                <p class="text-500 text-sm m-0">Catálogo, precios e inventario en tiempo real</p>
            </div>
            <Button label="Nuevo Producto" icon="pi pi-plus" class="border-round-3xl" style="background-color: #2D62A3; border-color: #2D62A3;" @click="openNew" />
        </div>

        <!-- TABLA -->
        <div class="surface-card p-4 border-round-xl shadow-1">
            <div class="flex justify-content-between align-items-center mb-3">
                <IconField iconPosition="left">
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="searchQuery" placeholder="Buscar producto o SKU..." class="p-inputtext-sm" />
                </IconField>
            </div>

            <DataTable :value="products" :loading="loading" paginator :rows="10" responsiveLayout="scroll" class="p-datatable-sm">
                <Column header="Imagen" style="width: 80px">
                    <template #body="slotProps">
                        <div class="w-3rem h-3rem border-round surface-100 flex align-items-center justify-content-center overflow-hidden border-1 surface-border">
                            <img v-if="slotProps.data.image_path" :src="slotProps.data.image_path" alt="Prod" class="w-full h-full object-cover" />
                            <i v-else class="pi pi-image text-400 text-xl"></i>
                        </div>
                    </template>
                </Column>

                <Column field="code" header="SKU / Código">
                    <template #body="slotProps">
                        <span class="font-mono text-xs font-bold text-700">{{ slotProps.data.code || 'N/A' }}</span>
                    </template>
                </Column>

                <Column field="name" header="Producto">
                    <template #body="slotProps">
                        <span class="font-bold text-900 display-block">{{ slotProps.data.name }}</span>
                        <small class="text-500" v-if="slotProps.data.barcode">Barra: {{ slotProps.data.barcode }}</small>
                    </template>
                </Column>

                <Column field="category.name" header="Categoría">
                    <template #body="slotProps">
                        <span>{{ slotProps.data.category?.name || 'Sin categoría' }}</span>
                    </template>
                </Column>

                <Column field="sale_price" header="Precio Venta">
                    <template #body="slotProps">
                        <span class="font-bold text-900">S/ {{ Number(slotProps.data.sale_price).toFixed(2) }}</span>
                    </template>
                </Column>

                <Column field="stock" header="Stock">
                    <template #body="slotProps">
                        <Tag 
                            :value="`${slotProps.data.stock} ${slotProps.data.unit || ''}`" 
                            :severity="Number(slotProps.data.stock) <= Number(slotProps.data.minimum_stock) ? 'danger' : 'success'" 
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
            
            <!-- Selector de Imagen S3 -->
            <div class="field mb-4 flex flex-column align-items-center">
                <div class="w-8rem h-8rem border-round surface-100 flex align-items-center justify-content-center overflow-hidden border-2 border-dashed surface-border relative">
                    <img v-if="imagePreview" :src="imagePreview" class="w-full h-full object-cover" />
                    <i v-else class="pi pi-cloud-upload text-400 text-3xl"></i>
                </div>
                <input type="file" ref="fileInput" class="hidden" accept="image/jpeg,image/png,image/webp" @change="onFileSelect" />
                <Button label="Seleccionar Imagen" icon="pi pi-camera" text size="small" class="mt-2" @click="triggerFileInput" />
                <small class="text-red-500" v-if="errors.image">{{ errors.image }}</small>
            </div>

            <div class="field mb-3">
                <label class="font-bold text-xs text-700 uppercase">Nombre *</label>
                <InputText v-model="form.name" :invalid="!!errors.name" />
                <small class="text-red-500" v-if="errors.name">{{ errors.name }}</small>
            </div>

            <div class="grid">
                <div class="col-6 field mb-3">
                    <label class="font-bold text-xs text-700 uppercase">SKU / Código *</label>
                    <InputText v-model="form.code" :invalid="!!errors.code" />
                    <small class="text-red-500" v-if="errors.code">{{ errors.code }}</small>
                </div>
                <div class="col-6 field mb-3">
                    <label class="font-bold text-xs text-700 uppercase">Código Barras</label>
                    <InputText v-model="form.barcode" />
                </div>
            </div>

            <div class="grid">
                <div class="col-8 field mb-3">
                    <label class="font-bold text-xs text-700 uppercase">Categoría *</label>
                    <Select v-model="form.category_id" :options="categories" optionLabel="name" optionValue="id" placeholder="Seleccionar" :invalid="!!errors.category_id" />
                    <small class="text-red-500" v-if="errors.category_id">{{ errors.category_id }}</small>
                </div>
                <div class="col-4 field mb-3">
                    <label class="font-bold text-xs text-700 uppercase">Unidad</label>
                    <InputText v-model="form.unit" placeholder="UND, MTR..." />
                </div>
            </div>

            <div class="grid">
                <div class="col-6 field mb-3">
                    <label class="font-bold text-xs text-700 uppercase">Costo (S/)</label>
                    <InputNumber v-model="form.cost" mode="currency" currency="PEN" locale="es-PE" />
                </div>
                <div class="col-6 field mb-3">
                    <label class="font-bold text-xs text-700 uppercase">Precio Venta (S/) *</label>
                    <InputNumber v-model="form.sale_price" mode="currency" currency="PEN" locale="es-PE" :invalid="!!errors.sale_price" />
                    <small class="text-red-500" v-if="errors.sale_price">{{ errors.sale_price }}</small>
                </div>
            </div>

            <div class="grid">
                <div class="col-6 field mb-3">
                    <label class="font-bold text-xs text-700 uppercase">Stock Inicial</label>
                    <InputNumber v-model="form.stock" :min="0" />
                </div>
                <div class="col-6 field mb-3">
                    <label class="font-bold text-xs text-700 uppercase">Stock Mínimo</label>
                    <InputNumber v-model="form.minimum_stock" :min="0" />
                </div>
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