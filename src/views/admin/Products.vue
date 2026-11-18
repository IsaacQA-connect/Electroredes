<script setup>
import api from '@/service/api';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';

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
const quickCategoryDialog = ref(false);
const quickBrandDialog = ref(false);
const quickUnitDialog = ref(false);

const isSaving = ref(false);
const isSavingCategory = ref(false);
const isSavingBrand = ref(false);
const isLookingUpBarcode = ref(false);
const isGeneratingSku = ref(false);
const selectedProduct = ref(null);

// Control de edición manual para no pisar cambios del usuario
const isSkuManuallyEdited = ref(false);
const isMinStockManuallyEdited = ref(false);
const targetMargin = ref(30); // Margen % sugerido sobre el costo

// Referencias de enfoque rápido
const nameInputRef = ref(null);

// Formularios secundarios rápidos
const newCategoryName = ref('');
const newBrandName = ref('');
const newUnitObj = reactive({ label: '', code: '' });

// Manejo de archivo e imagen
const fileInput = ref(null);
const selectedFile = ref(null);
const externalImageUrl = ref(null);
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

// Cálculo del Margen de Ganancia real sobre venta (%)
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

// =========================================================================
// AUTOMATIZACIONES DE REGISTRO
// =========================================================================

// 1. Generar código de barras EAN-13 interno válido (prefijo 200)
const generateInternalBarcode = () => {
    const base12 = '200' + String(Date.now()).slice(-9);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(base12[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    form.barcode = base12 + checkDigit;
};

// 2. Consultar código de barras comercial en el backend (UPCitemdb / OpenFoodFacts)
const searchByBarcode = async () => {
    const rawCode = (form.barcode || '').replace(/\D/g, '');
    if (!rawCode || rawCode.length < 8) return;
    form.barcode = rawCode;

    // Verificar primero en los productos ya cargados en memoria
    const localMatch = products.value.find(p => p.barcode === rawCode && p.id !== form.id);
    if (localMatch) {
        toast.add({
            severity: 'warn',
            summary: 'Código ya registrado',
            detail: `Este código pertenece a "${localMatch.name}" (${localMatch.code}).`,
            life: 4500
        });
        return;
    }

    isLookingUpBarcode.value = true;
    try {
        const { data } = await api.get(`/products/barcode-lookup/${rawCode}`);

        if (data.already_exists) {
            toast.add({
                severity: 'warn',
                summary: 'Producto ya registrado',
                detail: data.message,
                life: 4500
            });
            return;
        }

        if (!data.found) {
            toast.add({
                severity: 'info',
                summary: 'Código no hallado en bases públicas',
                detail: 'Puedes ingresar el nombre manualmente.',
                life: 2800
            });
            return;
        }

        if (!form.name && data.name) {
            form.name = data.name;
        }
        if (!form.description && data.description) {
            form.description = data.description;
        }

        // Coincidencia automática de Marca
        if (data.brand && brands.value.length) {
            const brandLower = data.brand.toLowerCase();
            const matchedBrand = brands.value.find(
                b => b.name.toLowerCase() === brandLower || brandLower.includes(b.name.toLowerCase())
            );
            if (matchedBrand) {
                form.brand_id = matchedBrand.id;
            }
        }

        // Vista previa de imagen externa
        if (data.image_url && !selectedFile.value) {
            externalImageUrl.value = data.image_url;
            imagePreview.value = data.image_url;
        }

        toast.add({
            severity: 'success',
            summary: 'Datos autocompletados',
            detail: `Información obtenida desde ${data.source}.`,
            life: 2500
        });
    } catch {
        // Silencioso para no bloquear flujo offline
    } finally {
        isLookingUpBarcode.value = false;
    }
};

// 3. Generar SKU correlativo desde backend (con respaldo local)
const fetchNextSku = async (force = false) => {
    if (form.id && !force) return;
    if (isSkuManuallyEdited.value && !force) return;

    isGeneratingSku.value = true;
    try {
        const { data } = await api.get('/products/next-sku', {
            params: {
                category_id: form.category_id || undefined,
                brand_id: form.brand_id || undefined
            }
        });
        if (data?.code) {
            form.code = data.code;
            isSkuManuallyEdited.value = false;
        }
    } catch {
        // Respaldo local si no hay conexión
        const cat = categories.value.find(c => c.id === form.category_id);
        const brand = brands.value.find(b => b.id === form.brand_id);
        const cPref = (cat?.name || 'PRD').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'PRD';
        const bPref = brand?.name ? '-' + brand.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) : '';
        const nextNum = String(products.value.length + 1).padStart(3, '0');
        form.code = `${cPref}${bPref}-${nextNum}`;
    } finally {
        isGeneratingSku.value = false;
    }
};

// 4. Autodetectar Marca, Categoría y Unidad al escribir el Nombre
watch(() => form.name, (newName) => {
    if (form.id || !newName || newName.trim().length < 3) return;
    const text = newName.toLowerCase();

    // Detectar Marca si aún no está seleccionada
    if (!form.brand_id && brands.value.length) {
        const foundBrand = brands.value.find(b => {
            const bName = b.name.toLowerCase().trim();
            return bName.length >= 2 && new RegExp(`\\b${bName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
        });
        if (foundBrand) {
            form.brand_id = foundBrand.id;
        }
    }

    // Detectar Categoría si aún no está seleccionada
    if (!form.category_id && categories.value.length) {
        const foundCat = categories.value.find(c => {
            const cName = c.name.toLowerCase().trim();
            // Coincidencia exacta o singular (ej. "Monitores" -> "monitor")
            const singular = cName.endsWith('es') ? cName.slice(0, -2) : (cName.endsWith('s') ? cName.slice(0, -1) : cName);
            return text.includes(cName) || (singular.length >= 4 && text.includes(singular));
        });
        if (foundCat) {
            form.category_id = foundCat.id;
        }
    }

    // Ajustar Unidad según palabras clave del nombre
    if (/\b(cable|utp|fibra|manguera|alambre)\b/i.test(text)) {
        form.unit = 'MTR';
    } else if (/\b(caja|pack x)\b/i.test(text)) {
        form.unit = 'CJ';
    } else if (/\b(servicio|instalacion|instalación|mantenimiento|soporte)\b/i.test(text)) {
        form.unit = 'SER';
    }
});

// Actualizar SKU y sugerir Unidad cuando cambia la Categoría o Marca
watch([() => form.category_id, () => form.brand_id], ([newCatId]) => {
    if (form.id) return;

    if (newCatId) {
        const cat = categories.value.find(c => c.id === newCatId);
        const catName = (cat?.name || '').toLowerCase();
        if (catName.includes('cable')) form.unit = 'MTR';
        else if (catName.includes('servicio')) form.unit = 'SER';
    }

    fetchNextSku(false);
});

// 5. Cálculo bidireccional Costo <-> Margen % <-> Precio Venta + Stock Mínimo
const onCostChange = (val) => {
    const cost = Number(val) || 0;
    form.cost = cost;

    if (cost > 0 && targetMargin.value >= 0) {
        const calculated = cost * (1 + Number(targetMargin.value) / 100);
        form.sale_price = Number(calculated.toFixed(2));
    }

    // Regla automática de Stock Mínimo en productos nuevos
    if (!form.id && !isMinStockManuallyEdited.value) {
        if (cost >= 300) form.minimum_stock = 2;
        else if (cost > 0 && cost < 20) form.minimum_stock = 10;
        else form.minimum_stock = 5;
    }
};

const onMarginChange = (val) => {
    const margin = Number(val) || 0;
    targetMargin.value = margin;
    const cost = Number(form.cost) || 0;
    if (cost > 0) {
        form.sale_price = Number((cost * (1 + margin / 100)).toFixed(2));
    }
};

const onSalePriceChange = (val) => {
    const sale = Number(val) || 0;
    form.sale_price = sale;
    const cost = Number(form.cost) || 0;
    if (cost > 0 && sale > 0) {
        targetMargin.value = Number((((sale - cost) / cost) * 100).toFixed(1));
    }
};

// 6. Pegar imagen con Ctrl+V o Drag & Drop
const applyImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
        toast.add({ severity: 'warn', summary: 'Archivo pesado', detail: 'La imagen debe pesar menos de 2MB.', life: 3000 });
        return;
    }
    selectedFile.value = file;
    externalImageUrl.value = null;
    imagePreview.value = URL.createObjectURL(file);
};

const handlePasteImage = (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
                applyImageFile(file);
                toast.add({ severity: 'info', summary: 'Imagen pegada', detail: 'Imagen capturada desde el portapapeles.', life: 2000 });
            }
            break;
        }
    }
};

const handleDropImage = (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) applyImageFile(file);
};

// =========================================================================
// GESTIÓN DE FORMULARIO Y CRUD
// =========================================================================

const resetForm = (preserveClassification = false) => {
    const keptCategory = preserveClassification ? form.category_id : null;
    const keptBrand = preserveClassification ? form.brand_id : null;
    const keptUnit = preserveClassification ? form.unit : 'UND';

    Object.assign(form, {
        id: null,
        name: '',
        code: '',
        barcode: '',
        category_id: keptCategory,
        brand_id: keptBrand,
        unit: keptUnit,
        cost: 0,
        sale_price: 0,
        stock: 0,
        minimum_stock: 5,
        description: '',
        image_path: null
    });

    selectedFile.value = null;
    externalImageUrl.value = null;
    imagePreview.value = null;
    isSkuManuallyEdited.value = false;
    isMinStockManuallyEdited.value = false;
    if (!preserveClassification) targetMargin.value = 30;
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
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los datos.', life: 4000 });
    } finally {
        loading.value = false;
    }
};

const openNew = () => {
    resetForm(false);
    productDialog.value = true;
    fetchNextSku(true);
    nextTick(() => nameInputRef.value?.$el?.focus());
};

const editProduct = (prod) => {
    resetForm(false);
    const cost = Number(prod.cost) || 0;
    const sale = Number(prod.sale_price) || 0;

    Object.assign(form, {
        id: prod.id,
        name: prod.name,
        code: prod.code || '',
        barcode: prod.barcode || '',
        category_id: prod.category_id || prod.category?.id,
        brand_id: prod.brand_id || prod.brand?.id || null,
        unit: prod.unit || 'UND',
        cost,
        sale_price: sale,
        stock: Number(prod.stock) || 0,
        minimum_stock: Number(prod.minimum_stock) || 5,
        description: prod.description || '',
        image_path: prod.image_path || null
    });

    targetMargin.value = cost > 0 && sale > 0 ? Number((((sale - cost) / cost) * 100).toFixed(1)) : 30;
    imagePreview.value = prod.image_path || null;
    productDialog.value = true;
};

const onFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) applyImageFile(file);
};

const removeImage = () => {
    selectedFile.value = null;
    externalImageUrl.value = null;
    imagePreview.value = null;
    form.image_path = null;
    if (fileInput.value) fileInput.value.value = '';
};

const triggerFileInput = () => {
    fileInput.value.click();
};

const saveQuickCategory = async () => {
    if (!newCategoryName.value.trim()) return;
    isSavingCategory.value = true;
    try {
        const res = await api.post('/categories', { name: newCategoryName.value.trim() });
        const createdCat = res.data.data || res.data;
        categories.value.push(createdCat);
        form.category_id = createdCat.id;
        toast.add({ severity: 'success', summary: 'Categoría Creada', detail: `Categoría ${createdCat.name} registrada.`, life: 3000 });
        newCategoryName.value = '';
        quickCategoryDialog.value = false;
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo registrar la categoría.', life: 3000 });
    } finally {
        isSavingCategory.value = false;
    }
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
    } catch {
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
    if (!form.category_id) { errors.category_id = 'Selecciona una categoría'; valid = false; }
    if (form.sale_price <= 0) { errors.sale_price = 'El precio debe ser mayor a 0'; valid = false; }
    return valid;
};

const saveProduct = async (keepOpen = false) => {
    if (!validateFrontend()) return;
    isSaving.value = true;

    try {
        if (form.id) {
            // Actualización de producto existente
            const payload = { ...form };
            const res = await api.put(`/products/${form.id}`, payload);
            const productId = res.data.data?.id || form.id;

            if (selectedFile.value && productId) {
                const imgData = new FormData();
                imgData.append('image', selectedFile.value);
                await api.post(`/products/${productId}/image`, imgData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Producto actualizado.', life: 3000 });
            productDialog.value = false;
        } else {
            // Creación en una sola petición (incluye archivo o image_url externa)
            const formData = new FormData();
            formData.append('name', form.name.trim());
            if (form.code?.trim()) formData.append('code', form.code.trim());
            if (form.barcode?.trim()) formData.append('barcode', form.barcode.trim());
            formData.append('category_id', form.category_id);
            if (form.brand_id) formData.append('brand_id', form.brand_id);
            formData.append('unit', form.unit || 'UND');
            formData.append('cost', Number(form.cost) || 0);
            formData.append('sale_price', Number(form.sale_price) || 0);
            formData.append('stock', Number(form.stock) || 0);
            formData.append('minimum_stock', Number(form.minimum_stock) || 0);
            if (form.description?.trim()) formData.append('description', form.description.trim());

            if (selectedFile.value) {
                formData.append('image', selectedFile.value);
            } else if (externalImageUrl.value) {
                formData.append('image_url', externalImageUrl.value);
            }

            await api.post('/products', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Producto registrado.', life: 2500 });

            if (keepOpen) {
                await fetchProducts();
                resetForm(true);
                await fetchNextSku(true);
                nextTick(() => nameInputRef.value?.$el?.focus());
                return;
            }

            productDialog.value = false;
        }

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
    } catch {
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

        <!-- MODAL INTELIGENTE DE PRODUCTO -->
        <Dialog
            v-model:visible="productDialog"
            :header="form.id ? 'Editar Producto' : 'Nuevo Producto'"
            modal
            class="p-fluid"
            :style="{ width: '92vw', maxWidth: '660px' }"
        >
            <div class="grid pt-2" @paste="handlePasteImage">
                <!-- SECCIÓN IZQUIERDA: IMAGEN (SUBIR, ARRASTRAR O CTRL+V) -->
                <div
                    class="col-12 sm:col-4 flex flex-column align-items-center justify-content-start border-bottom-1 sm:border-bottom-none sm:border-right-1 surface-border pr-0 sm:pr-3 mb-2 sm:mb-0"
                    @dragover.prevent
                    @drop.prevent="handleDropImage"
                >
                    <label class="font-bold text-xs text-700 uppercase mb-2 align-self-start">Imagen</label>
                    <div
                        class="w-7rem h-7rem border-round surface-100 flex align-items-center justify-content-center overflow-hidden border-1 border-dashed border-400 relative shadow-1 cursor-pointer"
                        title="Haz clic para subir, arrastra una imagen o pega con Ctrl+V"
                        @click="triggerFileInput"
                    >
                        <img v-if="imagePreview" :src="imagePreview" class="w-full h-full object-cover" />
                        <div v-else class="text-center p-1">
                            <i class="pi pi-image text-400 text-2xl block mb-1"></i>
                            <span class="text-400" style="font-size: 10px;">Ctrl+V o clic</span>
                        </div>
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
                    <small class="text-500 text-center mt-1" style="font-size: 10px;">
                        Pega con <b>Ctrl+V</b> o escanea código
                    </small>
                    <small class="text-red-500 mt-1 text-xs" v-if="errors.image">{{ errors.image }}</small>
                </div>

                <!-- SECCIÓN DERECHA: CAMPOS PRINCIPALES -->
                <div class="col-12 sm:col-8 pl-0 sm:pl-3">
                    <!-- Código de Barras (Primero o accesible para pistola escáner) -->
                    <div class="field mb-2">
                        <div class="flex justify-content-between align-items-center mb-1">
                            <label class="font-bold text-xs text-700 uppercase">Código Barras (Escáner / EAN-13)</label>
                            <Button
                                label="Generar interno"
                                icon="pi pi-barcode"
                                text
                                size="small"
                                class="p-0 text-xs font-semibold"
                                @click="generateInternalBarcode"
                            />
                        </div>
                        <div class="flex gap-1">
                            <InputText
                                v-model="form.barcode"
                                size="small"
                                class="w-full font-mono"
                                placeholder="Escanea o escribe código..."
                                @keydown.enter.prevent="searchByBarcode"
                            />
                            <Button
                                icon="pi pi-search"
                                size="small"
                                severity="secondary"
                                outlined
                                :loading="isLookingUpBarcode"
                                v-tooltip.top="'Buscar datos del código'"
                                @click="searchByBarcode"
                            />
                        </div>
                    </div>

                    <!-- Nombre -->
                    <div class="field mb-2">
                        <label class="font-bold text-xs text-700 uppercase">Nombre del Producto *</label>
                        <InputText
                            ref="nameInputRef"
                            v-model="form.name"
                            size="small"
                            :invalid="!!errors.name"
                            placeholder="Ej: Monitor Gamer LG 27''"
                        />
                        <small class="text-red-500 text-xs" v-if="errors.name">{{ errors.name }}</small>
                    </div>

                    <!-- Categoría y Marca con Acción Rápida -->
                    <div class="grid">
                        <div class="col-6 field mb-2">
                            <div class="flex justify-content-between align-items-center mb-1">
                                <label class="font-bold text-xs text-700 uppercase">Categoría *</label>
                                <Button label="+ Crear" text size="small" class="p-0 text-xs font-semibold" @click="quickCategoryDialog = true" />
                            </div>
                            <Select
                                v-model="form.category_id"
                                :options="categories"
                                optionLabel="name"
                                optionValue="id"
                                size="small"
                                filter
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
                                filter
                                placeholder="Seleccionar"
                                showClear
                            />
                        </div>
                    </div>

                    <!-- SKU Automático y Unidad -->
                    <div class="grid">
                        <div class="col-6 field mb-2">
                            <div class="flex justify-content-between align-items-center mb-1">
                                <label class="font-bold text-xs text-700 uppercase">SKU / Código *</label>
                                <Button
                                    icon="pi pi-sync"
                                    text
                                    size="small"
                                    class="p-0 text-xs"
                                    :loading="isGeneratingSku"
                                    v-tooltip.top="'Regenerar SKU'"
                                    @click="fetchNextSku(true)"
                                />
                            </div>
                            <InputText
                                v-model="form.code"
                                size="small"
                                class="font-mono"
                                :invalid="!!errors.code"
                                placeholder="Auto: PRD-001"
                                @input="isSkuManuallyEdited = true"
                            />
                            <small class="text-red-500 text-xs" v-if="errors.code">{{ errors.code }}</small>
                        </div>

                        <div class="col-6 field mb-2">
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
                    </div>
                </div>
            </div>

            <hr class="border-top-1 surface-border my-2" />

            <!-- PRECIOS CON CÁLCULO DE MARGEN BIDIRECCIONAL -->
            <div class="grid" @paste="handlePasteImage">
                <div class="col-12 sm:col-4 field mb-2">
                    <label class="font-bold text-xs text-700 uppercase">Costo (S/)</label>
                    <InputNumber
                        :modelValue="form.cost"
                        size="small"
                        mode="currency"
                        currency="PEN"
                        locale="es-PE"
                        :min="0"
                        @update:modelValue="onCostChange"
                    />
                </div>

                <div class="col-5 sm:col-3 field mb-2">
                    <label class="font-bold text-xs text-700 uppercase">Margen (%)</label>
                    <InputNumber
                        :modelValue="targetMargin"
                        size="small"
                        suffix="%"
                        :min="0"
                        :max="999"
                        :maxFractionDigits="1"
                        @update:modelValue="onMarginChange"
                    />
                </div>

                <div class="col-7 sm:col-5 field mb-2">
                    <label class="font-bold text-xs text-700 uppercase">Precio Venta (S/) *</label>
                    <InputNumber
                        :modelValue="form.sale_price"
                        size="small"
                        mode="currency"
                        currency="PEN"
                        locale="es-PE"
                        :min="0"
                        :invalid="!!errors.sale_price"
                        @update:modelValue="onSalePriceChange"
                    />
                    <small class="text-red-500 text-xs" v-if="errors.sale_price">{{ errors.sale_price }}</small>
                </div>
            </div>

            <!-- MARGEN NETO INDICADOR -->
            <div class="surface-100 p-2 border-round mb-2 flex justify-content-between align-items-center" v-if="profitMargin > 0">
                <span class="text-xs text-600 font-bold uppercase">Utilidad sobre Venta:</span>
                <span class="text-xs font-black text-emerald-600 bg-emerald-100 px-2 py-1 border-round">
                    +{{ profitMargin }}% ({{ formatCurrency(form.sale_price - form.cost) }})
                </span>
            </div>

            <!-- STOCKS INICIAL Y MÍNIMO -->
            <div class="grid">
                <div class="col-6 field mb-2">
                    <label class="font-bold text-xs text-700 uppercase">Stock Inicial</label>
                    <InputNumber v-model="form.stock" size="small" :min="0" />
                </div>
                <div class="col-6 field mb-2">
                    <label class="font-bold text-xs text-700 uppercase">Stock Mínimo (Auto)</label>
                    <InputNumber
                        v-model="form.minimum_stock"
                        size="small"
                        :min="0"
                        @update:modelValue="isMinStockManuallyEdited = true"
                    />
                </div>
            </div>

            <!-- DESCRIPCIÓN -->
            <div class="field mb-1">
                <label class="font-bold text-xs text-700 uppercase">Descripción</label>
                <Textarea v-model="form.description" size="small" rows="2" placeholder="Detalles breves del producto..." />
            </div>

            <template #footer>
                <div class="flex justify-content-between align-items-center w-full gap-2">
                    <Button label="Cancelar" text severity="secondary" size="small" @click="productDialog = false" />
                    <div class="flex gap-2">
                        <Button
                            v-if="!form.id"
                            label="Guardar y nuevo"
                            icon="pi pi-plus"
                            outlined
                            size="small"
                            :loading="isSaving"
                            @click="saveProduct(true)"
                        />
                        <Button
                            label="Guardar Producto"
                            icon="pi pi-check"
                            size="small"
                            :loading="isSaving"
                            style="background-color: #2D62A3; border-color: #2D62A3;"
                            @click="saveProduct(false)"
                        />
                    </div>
                </div>
            </template>
        </Dialog>

        <!-- SUB-MODAL 0: NUEVA CATEGORÍA RÁPIDA -->
        <Dialog v-model:visible="quickCategoryDialog" header="Nueva Categoría" modal :style="{ width: '90vw', maxWidth: '360px' }">
            <div class="field mb-3 pt-2">
                <label class="font-bold text-xs text-700 uppercase">Nombre de Categoría</label>
                <InputText v-model="newCategoryName" size="small" placeholder="Ej: Monitores, Redes, Cables" class="w-full" @keyup.enter="saveQuickCategory" />
            </div>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" size="small" @click="quickCategoryDialog = false" />
                <Button label="Guardar" icon="pi pi-check" size="small" :loading="isSavingCategory" severity="primary" @click="saveQuickCategory" />
            </template>
        </Dialog>

        <!-- SUB-MODAL 1: NUEVA MARCA RÁPIDA -->
        <Dialog v-model:visible="quickBrandDialog" header="Nueva Marca" modal :style="{ width: '90vw', maxWidth: '360px' }">
            <div class="field mb-3 pt-2">
                <label class="font-bold text-xs text-700 uppercase">Nombre de Marca</label>
                <InputText v-model="newBrandName" size="small" placeholder="Ej: Samsung, TP-Link, Logitech" class="w-full" @keyup.enter="saveQuickBrand" />
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
        <Dialog v-model:visible="statusDialog" header="Confirmar Cambio de Estado" modal :style="{ width: '90vw', maxWidth: '380px' }">
            <p class="m-0 text-sm text-700">
                ¿Deseas {{ selectedProduct?.status ? 'desactivar' : 'activar' }} el producto
                <b>{{ selectedProduct?.name }}</b>?
            </p>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" size="small" @click="statusDialog = false" />
                <Button label="Confirmar" icon="pi pi-check" size="small" severity="warn" @click="toggleStatus" />
            </template>
        </Dialog>
    </div>
</template>