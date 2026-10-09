<script setup>
import api from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';

const toast = useToast();
const loading = ref(true);
const products = ref([]);
const categories = ref([]);
const brands = ref([]);

// Lista base de Unidades de Medida
const units = ref([
    { label: 'Unidad (UND)', code: 'UND' },
    { label: 'Kilogramos (KG)', code: 'KG' },
    { label: 'Litros (LT)', code: 'LT' },
    { label: 'Metros (MTR)', code: 'MTR' },
    { label: 'Caja (CJ)', code: 'CJ' },
    { label: 'Paquete (PAQ)', code: 'PAQ' },
    { label: 'Docena (DOC)', code: 'DOC' },
    { label: 'Galones (GLN)', code: 'GLN' },
    { label: 'Servicio (SER)', code: 'SER' }
]);

// Filtros de tabla
const searchQuery = ref('');
const selectedCategoryFilter = ref('ALL');
const selectedBrandFilter = ref('ALL');

// Modales principales y secundarios
const productDialog = ref(false);
const statusDialog = ref(false);
const quickBrandDialog = ref(false);
const quickUnitDialog = ref(false);

const isSaving = ref(false);
const isSavingBrand = ref(false);
const selectedProduct = ref(null);

// Formularios secundarios rápidos
const newBrandName = ref('');
const newUnitObj = reactive({ label: '', code: '' });

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
    brand_id: null,
    unit: 'UND',
    cost: 0,
    sale_price: 0,
    stock: 0,
    minimum_stock: 5,
    description: '',
    image_path: null
});

const errors = reactive({});

// Opciones de filtro para la tabla
const categoryFilterOptions = computed(() => [
    { name: 'Todas las categorías', id: 'ALL' },
    ...categories.value
]);

const brandFilterOptions = computed(() => [
    { name: 'Todas las marcas', id: 'ALL' },
    ...brands.value
]);

// Cálculo del Margen de Ganancia en el Formulario (%)
const profitMargin = computed(() => {
    const sale = Number(form.sale_price) || 0;
    const cost = Number(form.cost) || 0;
    if (sale <= 0 || cost >= sale) return 0;
    return (((sale - cost) / sale) * 100).toFixed(1);
});

// Métricas de Cabecera
const totalLowStock = computed(() => products.value.filter(p => Number(p.stock) <= Number(p.minimum_stock)).length);
const totalInventoryValue = computed(() => products.value.reduce((acc, p) => acc + (Number(p.sale_price || 0) * Number(p.stock || 0)), 0));

// Filtrado Reactivo Multicriterio
const filteredProducts = computed(() => {
    return products.value.filter(p => {
        const matchesCategory = selectedCategoryFilter.value === 'ALL' || p.category_id === selectedCategoryFilter.value || p.category?.id === selectedCategoryFilter.value;
        const matchesBrand = selectedBrandFilter.value === 'ALL' || p.brand_id === selectedBrandFilter.value || p.brand?.id === selectedBrandFilter.value;

        if (!searchQuery.value.trim()) return matchesCategory && matchesBrand;

        const query = searchQuery.value.toLowerCase();
        const matchesQuery = 
            (p.name && p.name.toLowerCase().includes(query)) ||
            (p.code && p.code.toLowerCase().includes(query)) ||
            (p.barcode && p.barcode.toLowerCase().includes(query)) ||
            (p.brand?.name && p.brand.name.toLowerCase().includes(query)) ||
            (p.category?.name && p.category.name.toLowerCase().includes(query));

        return matchesCategory && matchesBrand && matchesQuery;
    });
});

const resetForm = () => {
    Object.assign(form, {
        id: null,
        name: '',
        code: '',
        barcode: '',
        category_id: null,
        brand_id: null,
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
        const [prodRes, catRes, brandRes] = await Promise.all([
            api.get('/products'),
            api.get('/categories'),
            api.get('/brands').catch(() => ({ data: [] }))
        ]);
        products.value = prodRes.data.data || prodRes.data || [];
        categories.value = catRes.data.data || catRes.data || [];
        brands.value = brandRes.data.data || brandRes.data || [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los datos.', life: 4000 });
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
        brand_id: prod.brand_id || prod.brand?.id || null,
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

const removeImage = () => {
    selectedFile.value = null;
    imagePreview.value = null;
    form.image_path = null;
    if (fileInput.value) fileInput.value.value = '';
};

const triggerFileInput = () => {
    fileInput.value.click();
};

const saveQuickBrand = async () => {
    if (!newBrandName.value.trim()) return;
    isSavingBrand.value = true;
    try {
        const res = await api.post('/brands', { name: newBrandName.value.trim() });
        const createdBrand = res.data.data || res.data;
        brands.value.push(createdBrand);
        form.brand_id = createdBrand.id;
        toast.add({ severity: 'success', summary: 'Marca Creada', detail: `Marca ${createdBrand.name} registrada.`, life: 3000 });
        newBrandName.value = '';
        quickBrandDialog.value = false;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo registrar la marca.', life: 3000 });
    } finally {
        isSavingBrand.value = false;
    }
};

const saveQuickUnit = () => {
    if (!newUnitObj.code.trim() || !newUnitObj.label.trim()) return;
    const codeUpper = newUnitObj.code.trim().toUpperCase();
    
    if (!units.value.some(u => u.code === codeUpper)) {
        units.value.push({ label: `${newUnitObj.label} (${codeUpper})`, code: codeUpper });
    }
    form.unit = codeUpper;
    toast.add({ severity: 'info', summary: 'Unidad Agregada', detail: `Unidad ${codeUpper} seleccionada.`, life: 3000 });
    newUnitObj.code = '';
    newUnitObj.label = '';
    quickUnitDialog.value = false;
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
            productId = res.data.data?.id || form.id;
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Producto actualizado.', life: 3000 });
        } else {
            const res = await api.post('/products', payload);
            productId = res.data.data?.id;
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Producto registrado.', life: 3000 });
        }

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
            toast.add({ severity: 'warn', summary: 'Validación', detail: 'Revisa los campos del formulario.', life: 4000 });
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

const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2
    }).format(Number(val) || 0);
};

onMounted(() => {
    fetchProducts();
});
</script>

<template>
    <div class="surface-ground p-4 border-round-xl">
        <!-- CABECERA PRINCIPAL -->
        <div class="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3">
            <div>
                <h2 class="text-3xl font-black text-900 m-0">Gestión de Productos</h2>
                <p class="text-500 text-sm m-0">Control de inventarios, marcas, precios y unidades de medida</p>
            </div>
            <div class="flex gap-2">
                <Button 
                    icon="pi pi-refresh" 
                    text 
                    severity="secondary" 
                    :loading="loading" 
                    @click="fetchProducts" 
                />
                <Button 
                    label="Nuevo Producto" 
                    icon="pi pi-plus" 
                    class="border-round-3xl" 
                    style="background-color: #2D62A3; border-color: #2D62A3;" 
                    @click="openNew" 
                />
            </div>
        </div>

        <!-- METRICAS / KPIS -->
        <div class="grid mb-4">
            <div class="col-12 sm:col-6 md:col-3">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Total Productos</span>
                        <span class="text-2xl font-black text-900">{{ products.length }}</span>
                    </div>
                    <div class="border-round p-3 bg-blue-100 text-blue-700">
                        <i class="pi pi-box text-xl"></i>
                    </div>
                </div>
            </div>

            <div class="col-12 sm:col-6 md:col-3">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Stock Bajo / Crítico</span>
                        <span class="text-2xl font-black text-red-600">{{ totalLowStock }}</span>
                    </div>
                    <div class="border-round p-3 bg-red-100 text-red-700">
                        <i class="pi pi-exclamation-triangle text-xl"></i>
                    </div>
                </div>
            </div>

            <div class="col-12 sm:col-6 md:col-3">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Marcas Activas</span>
                        <span class="text-2xl font-black text-purple-700">{{ brands.length }}</span>
                    </div>
                    <div class="border-round p-3 bg-purple-100 text-purple-700">
                        <i class="pi pi-bookmark text-xl"></i>
                    </div>
                </div>
            </div>

            <div class="col-12 sm:col-6 md:col-3">
                <div class="surface-card p-3 border-round-xl shadow-1 flex justify-content-between align-items-center">
                    <div>
                        <span class="text-xs text-500 font-bold uppercase block mb-1">Valorizado Stock</span>
                        <span class="text-2xl font-black text-emerald-600">{{ formatCurrency(totalInventoryValue) }}</span>
                    </div>
                    <div class="border-round p-3 bg-emerald-100 text-emerald-700">
                        <i class="pi pi-dollar text-xl"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- TABLA Y FILTROS -->
        <div class="surface-card p-4 border-round-xl shadow-1">
            <div class="flex flex-column lg:flex-row justify-content-between align-items-stretch lg:align-items-center gap-3 mb-4">
                <IconField iconPosition="left" class="w-full lg:w-22rem">
                    <InputIcon class="pi pi-search" />
                    <InputText 
                        v-model="searchQuery" 
                        size="small"
                        placeholder="Buscar por SKU, nombre, marca..." 
                        class="w-full" 
                    />
                </IconField>

                <div class="flex flex-column sm:flex-row align-items-center gap-2">
                    <Select 
                        v-model="selectedCategoryFilter" 
                        :options="categoryFilterOptions" 
                        optionLabel="name" 
                        optionValue="id" 
                        size="small"
                        placeholder="Categoría" 
                        class="w-full sm:w-12rem" 
                    />
                    <Select 
                        v-model="selectedBrandFilter" 
                        :options="brandFilterOptions" 
                        optionLabel="name" 
                        optionValue="id" 
                        size="small"
                        placeholder="Marca" 
                        class="w-full sm:w-12rem" 
                    />
                </div>
            </div>

            <!-- TABLA DE PRODUCTOS -->
            <DataTable 
                :value="filteredProducts" 
                :loading="loading" 
                paginator 
                :rows="10" 
                responsiveLayout="scroll" 
                class="p-datatable-sm"
            >
                <template #empty>
                    <div class="text-center p-4 text-500">
                        <i class="pi pi-filter-slash text-3xl mb-2 block"></i>
                        No se encontraron productos coincidentes.
                    </div>
                </template>

                <Column header="Imagen" style="width: 60px">
                    <template #body="slotProps">
                        <div class="w-2rem h-2rem border-round surface-100 flex align-items-center justify-content-center overflow-hidden border-1 surface-border">
                            <img v-if="slotProps.data.image_path" :src="slotProps.data.image_path" alt="Prod" class="w-full h-full object-cover" />
                            <i v-else class="pi pi-image text-400 text-xs"></i>
                        </div>
                    </template>
                </Column>

                <Column field="code" header="SKU / Código" sortable>
                    <template #body="slotProps">
                        <span class="font-mono text-xs font-bold text-700">{{ slotProps.data.code || 'N/A' }}</span>
                    </template>
                </Column>

                <Column field="name" header="Producto" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-column">
                            <span class="font-bold text-900 text-sm">{{ slotProps.data.name }}</span>
                            <small class="text-500 text-xs" v-if="slotProps.data.barcode">Barra: {{ slotProps.data.barcode }}</small>
                        </div>
                    </template>
                </Column>

                <Column field="brand.name" header="Marca" sortable>
                    <template #body="slotProps">
                        <span v-if="slotProps.data.brand?.name" class="surface-200 text-800 text-xs px-2 py-1 border-round font-semibold">
                            {{ slotProps.data.brand.name }}
                        </span>
                        <span v-else class="text-400 text-xs italic">Sin marca</span>
                    </template>
                </Column>

                <Column field="category.name" header="Categoría" sortable>
                    <template #body="slotProps">
                        <span class="text-xs text-700">{{ slotProps.data.category?.name || 'Sin categoría' }}</span>
                    </template>
                </Column>

                <Column field="sale_price" header="Precio Venta" sortable>
                    <template #body="slotProps">
                        <span class="font-bold text-900 text-sm">{{ formatCurrency(slotProps.data.sale_price) }}</span>
                    </template>
                </Column>

                <Column field="stock" header="Stock" sortable>
                    <template #body="slotProps">
                        <Tag 
                            :value="`${slotProps.data.stock} ${slotProps.data.unit || 'UND'}`" 
                            :severity="Number(slotProps.data.stock) <= Number(slotProps.data.minimum_stock) ? 'danger' : 'success'" 
                        />
                    </template>
                </Column>

                <Column field="status" header="Estado">
                    <template #body="slotProps">
                        <Tag 
                            :value="slotProps.data.status ? 'Activo' : 'Inactivo'" 
                            :severity="slotProps.data.status ? 'success' : 'secondary'" 
                        />
                    </template>
                </Column>

                <Column header="Acciones" style="width: 90px">
                    <template #body="slotProps">
                        <div class="flex gap-1">
                            <Button 
                                icon="pi pi-pencil" 
                                text 
                                rounded 
                                severity="secondary" 
                                size="small"
                                @click="editProduct(slotProps.data)" 
                            />
                            <Button 
                                :icon="slotProps.data.status ? 'pi pi-eye-slash' : 'pi pi-eye'" 
                                text 
                                rounded 
                                size="small"
                                :severity="slotProps.data.status ? 'warn' : 'success'" 
                                @click="confirmToggleStatus(slotProps.data)" 
                            />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- MODAL COMPACTO Y ESTETICO DE PRODUCTO -->
        <Dialog 
            v-model:visible="productDialog" 
            :header="form.id ? 'Editar Producto' : 'Nuevo Producto'" 
            modal 
            class="p-fluid"
            :style="{ width: '90vw', maxWidth: '620px' }"
        >
            <div class="grid pt-2">
                <!-- SECCIÓN IZQUIERDA: IMAGEN COMPACTA -->
                <div class="col-12 sm:col-4 flex flex-column align-items-center justify-content-start border-bottom-1 sm:border-bottom-none sm:border-right-1 surface-border pr-0 sm:pr-3 mb-2 sm:mb-0">
                    <label class="font-bold text-xs text-700 uppercase mb-2 align-self-start">Imagen</label>
                    <div class="w-7rem h-7rem border-round surface-100 flex align-items-center justify-content-center overflow-hidden border-1 border-300 relative shadow-1">
                        <img v-if="imagePreview" :src="imagePreview" class="w-full h-full object-cover" />
                        <i v-else class="pi pi-image text-400 text-3xl"></i>
                    </div>

                    <input type="file" ref="fileInput" class="hidden" accept="image/jpeg,image/png,image/webp" @change="onFileSelect" />
                    
                    <div class="flex gap-1 mt-2 w-full">
                        <Button 
                            label="Cargar" 
                            icon="pi pi-upload" 
                            outlined 
                            size="small" 
                            class="w-full text-xs p-1" 
                            @click="triggerFileInput" 
                        />
                        <Button 
                            v-if="imagePreview" 
                            icon="pi pi-trash" 
                            severity="danger" 
                            text 
                            size="small" 
                            class="p-1"
                            @click="removeImage" 
                        />
                    </div>
                    <small class="text-red-500 mt-1 text-xs" v-if="errors.image">{{ errors.image }}</small>
                </div>

                <!-- SECCIÓN DERECHA: CAMPOS PRINCIPALES -->
                <div class="col-12 sm:col-8 pl-0 sm:pl-3">
                    <!-- Nombre -->
                    <div class="field mb-2">
                        <label class="font-bold text-xs text-700 uppercase">Nombre del Producto *</label>
                        <InputText v-model="form.name" size="small" :invalid="!!errors.name" placeholder="Ej: Monitor Gamer 27''" />
                        <small class="text-red-500 text-xs" v-if="errors.name">{{ errors.name }}</small>
                    </div>

                    <!-- SKU y Código de Barras -->
                    <div class="grid">
                        <div class="col-6 field mb-2">
                            <label class="font-bold text-xs text-700 uppercase">SKU / Código *</label>
                            <InputText v-model="form.code" size="small" :invalid="!!errors.code" placeholder="PROD-001" />
                            <small class="text-red-500 text-xs" v-if="errors.code">{{ errors.code }}</small>
                        </div>
                        <div class="col-6 field mb-2">
                            <label class="font-bold text-xs text-700 uppercase">Código Barras</label>
                            <InputText v-model="form.barcode" size="small" placeholder="77500012345" />
                        </div>
                    </div>

                    <!-- Categoría y Marca con Acción Rápida -->
                    <div class="grid">
                        <div class="col-6 field mb-2">
                            <label class="font-bold text-xs text-700 uppercase">Categoría *</label>
                            <Select 
                                v-model="form.category_id" 
                                :options="categories" 
                                optionLabel="name" 
                                optionValue="id" 
                                size="small"
                                placeholder="Seleccionar" 
                                :invalid="!!errors.category_id" 
                            />
                            <small class="text-red-500 text-xs" v-if="errors.category_id">{{ errors.category_id }}</small>
                        </div>
                        
                        <div class="col-6 field mb-2">
                            <div class="flex justify-content-between align-items-center mb-1">
                                <label class="font-bold text-xs text-700 uppercase">Marca</label>
                                <Button label="+ Crear" text size="small" class="p-0 text-xs font-semibold" @click="quickBrandDialog = true" />
                            </div>
                            <Select 
                                v-model="form.brand_id" 
                                :options="brands" 
                                optionLabel="name" 
                                optionValue="id" 
                                size="small"
                                placeholder="Seleccionar" 
                                showClear
                            />
                        </div>
                    </div>
                </div>
            </div>

            <hr class="border-top-1 surface-border my-2" />

            <!-- PRECIOS Y UNIDAD DE MEDIDA -->
            <div class="grid">
                <div class="col-12 sm:col-4 field mb-2">
                    <div class="flex justify-content-between align-items-center mb-1">
                        <label class="font-bold text-xs text-700 uppercase">Unidad *</label>
                        <Button label="+ Crear" text size="small" class="p-0 text-xs font-semibold" @click="quickUnitDialog = true" />
                    </div>
                    <Select 
                        v-model="form.unit" 
                        :options="units" 
                        optionLabel="label" 
                        optionValue="code" 
                        size="small"
                        placeholder="Unidad" 
                    />
                </div>

                <div class="col-6 sm:col-4 field mb-2">
                    <label class="font-bold text-xs text-700 uppercase">Costo (S/)</label>
                    <InputNumber v-model="form.cost" size="small" mode="currency" currency="PEN" locale="es-PE" />
                </div>

                <div class="col-6 sm:col-4 field mb-2">
                    <label class="font-bold text-xs text-700 uppercase">Precio Venta (S/) *</label>
                    <InputNumber v-model="form.sale_price" size="small" mode="currency" currency="PEN" locale="es-PE" :invalid="!!errors.sale_price" />
                    <small class="text-red-500 text-xs" v-if="errors.sale_price">{{ errors.sale_price }}</small>
                </div>
            </div>

            <!-- MARGEN DE GANANCIA INDICADOR -->
            <div class="surface-100 p-2 border-round mb-2 flex justify-content-between align-items-center" v-if="profitMargin > 0">
                <span class="text-xs text-600 font-bold uppercase">Margen Est. Ganancia:</span>
                <span class="text-xs font-black text-emerald-600 bg-emerald-100 px-2 py-1 border-round">+{{ profitMargin }}%</span>
            </div>

            <!-- STOCKS INICIAL Y MÍNIMO -->
            <div class="grid">
                <div class="col-6 field mb-2">
                    <label class="font-bold text-xs text-700 uppercase">Stock Inicial</label>
                    <InputNumber v-model="form.stock" size="small" :min="0" />
                </div>
                <div class="col-6 field mb-2">
                    <label class="font-bold text-xs text-700 uppercase">Stock Mínimo</label>
                    <InputNumber v-model="form.minimum_stock" size="small" :min="0" />
                </div>
            </div>

            <!-- DESCRIPCIÓN -->
            <div class="field mb-1">
                <label class="font-bold text-xs text-700 uppercase">Descripción</label>
                <Textarea v-model="form.description" size="small" rows="2" placeholder="Detalles breves del producto..." />
            </div>

            <template #footer>
                <Button label="Cancelar" text severity="secondary" size="small" @click="productDialog = false" />
                <Button 
                    label="Guardar Producto" 
                    icon="pi pi-check" 
                    size="small"
                    :loading="isSaving" 
                    style="background-color: #2D62A3; border-color: #2D62A3;" 
                    @click="saveProduct" 
                />
            </template>
        </Dialog>

        <!-- SUB-MODAL 1: NUEVA MARCA RÁPIDA -->
        <Dialog v-model:visible="quickBrandDialog" header="Nueva Marca" modal :style="{ width: '90vw', maxWidth: '360px' }">
            <div class="field mb-3 pt-2">
                <label class="font-bold text-xs text-700 uppercase">Nombre de Marca</label>
                <InputText v-model="newBrandName" size="small" placeholder="Ej: Samsung, Nike, Logitech" class="w-full" @keyup.enter="saveQuickBrand" />
            </div>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" size="small" @click="quickBrandDialog = false" />
                <Button label="Guardar" icon="pi pi-check" size="small" :loading="isSavingBrand" severity="primary" @click="saveQuickBrand" />
            </template>
        </Dialog>

        <!-- SUB-MODAL 2: NUEVA UNIDAD RÁPIDA -->
        <Dialog v-model:visible="quickUnitDialog" header="Nueva Unidad de Medida" modal :style="{ width: '90vw', maxWidth: '380px' }">
            <div class="p-fluid pt-2">
                <div class="field mb-2">
                    <label class="font-bold text-xs text-700 uppercase">Abreviatura (Ej: M3, SET, GAL)</label>
                    <InputText v-model="newUnitObj.code" size="small" placeholder="M3" class="uppercase" />
                </div>
                <div class="field mb-3">
                    <label class="font-bold text-xs text-700 uppercase">Nombre Descriptor</label>
                    <InputText v-model="newUnitObj.label" size="small" placeholder="Metros Cúbicos" />
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" size="small" @click="quickUnitDialog = false" />
                <Button label="Agregar" icon="pi pi-check" size="small" severity="primary" @click="saveQuickUnit" />
            </template>
        </Dialog>

        <!-- MODAL CAMBIO DE ESTADO -->
        <Dialog v-model:visible="statusDialog" header="Confirmar Estado" modal :style="{ width: '90vw', maxWidth: '380px' }">
            <p class="m-0 text-700 text-sm">
                ¿Deseas {{ selectedProduct?.status ? 'desactivar' : 'activar' }} el producto 
                <strong>{{ selectedProduct?.name }}</strong>?
            </p>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" size="small" @click="statusDialog = false" />
                <Button label="Confirmar" severity="primary" size="small" @click="toggleStatus" />
            </template>
        </Dialog>
    </div>
</template>