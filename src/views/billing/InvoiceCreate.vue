<script setup>
import api from '@/service/api';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import SelectButton from 'primevue/selectbutton';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';

const toast = useToast();

// --------------------------------------------------------------------------
// ESTADO FORMULARIO
// --------------------------------------------------------------------------
const invoice = ref({
    document_type: '03', // '03' = Boleta, '01' = Factura, 'NV' = Nota de Venta
    series: 'B001',
    client_doc_type: '1', // '1' = DNI, '6' = RUC, '0' = Varios
    client_doc_number: '',
    client_name: '',
    client_address: ''
});

const items = ref([]); // Lista dinámica de productos agregados
const availableProducts = ref([]); // Catálogo cargado de la API
const selectedProduct = ref(null);

// Formulario temporal para agregar un producto a la lista
const currentItem = ref({
    product_id: null,
    product_name: '',
    quantity: 1,
    unit_price: 0,
    tax_type: 'TAXED' // 'TAXED' (Gravado 18%), 'EXONERATED'
});

const loadingLookup = ref(false);
const submitting = ref(false);

// --------------------------------------------------------------------------
// PROPIEDADES COMPUTADAS (CÁLCULOS TRIBUTARIOS Y TOTALES)
// --------------------------------------------------------------------------
// Cambiar serie según el tipo de documento seleccionado
watch(() => invoice.value.document_type, (newType) => {
    if (newType === '01') {
        invoice.value.series = 'F001';
        invoice.value.client_doc_type = '6';
    } else if (newType === '03') {
        invoice.value.series = 'B001';
        invoice.value.client_doc_type = '1';
    } else {
        invoice.value.series = 'NV01';
        invoice.value.client_doc_type = '0';
        invoice.value.client_doc_number = '00000000';
        invoice.value.client_name = 'CLIENTE VARIOS';
        invoice.value.client_address = 'SIN DIRECCION';
    }
});

// Al seleccionar un producto del selector, autocompletar nombre y precio
watch(selectedProduct, (product) => {
    if (product) {
        currentItem.value.product_id = product.id;
        currentItem.value.product_name = product.name;
        currentItem.value.unit_price = Number(product.price || 0);
    }
});

// Cálculos globales
const opTaxed = computed(() => {
    return items.value
        .filter(i => i.tax_type === 'TAXED')
        .reduce((sum, i) => sum + ((i.quantity * i.unit_price) / 1.18), 0);
});

const totalIgv = computed(() => opTaxed.value * 0.18);

const totalGeneral = computed(() => {
    return items.value.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
});

// --------------------------------------------------------------------------
// MÉTODOS Y ACCIONES
// --------------------------------------------------------------------------
const fetchProducts = async () => {
    try {
        const response = await api.get('/products');
        availableProducts.value = response.data.data || response.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el catálogo de productos', life: 3000 });
    }
};

const searchCustomer = async () => {
    const doc = invoice.value.client_doc_number.trim();
    const type = invoice.value.client_doc_type === '6' ? 'ruc' : 'dni';

    if (invoice.value.document_type === 'NV' && !doc) return;

    if ((type === 'dni' && doc.length !== 8) || (type === 'ruc' && doc.length !== 11)) {
        toast.add({ severity: 'warn', summary: 'Atención', detail: `El ${type.toUpperCase()} debe tener ${type === 'dni' ? 8 : 11} dígitos`, life: 3000 });
        return;
    }

    loadingLookup.value = true;
    try {
        const response = await api.get(`/lookup/${type}/${doc}`);
        if (response.data.success) {
            invoice.value.client_name = response.data.name;
            invoice.value.client_address = response.data.address || '';
            toast.add({ severity: 'success', summary: 'Encontrado', detail: 'Datos del cliente cargados', life: 2000 });
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: 'No Encontrado', detail: 'No se obtuvieron datos para el documento', life: 3000 });
    } finally {
        loadingLookup.value = false;
    }
};

// Agregar ítem a la tabla dinámica
const addItem = () => {
    if (!currentItem.value.product_name) {
        toast.add({ severity: 'warn', summary: 'Atención', detail: 'Selecciona o ingresa un producto', life: 3000 });
        return;
    }
    if (currentItem.value.quantity <= 0 || currentItem.value.unit_price <= 0) {
        toast.add({ severity: 'warn', summary: 'Atención', detail: 'Cantidad y Precio deben ser mayores a 0', life: 3000 });
        return;
    }

    items.value.push({
        ...currentItem.value,
        total: currentItem.value.quantity * currentItem.value.unit_price
    });

    // Limpiar formulario temporal
    selectedProduct.value = null;
    currentItem.value = {
        product_id: null,
        product_name: '',
        quantity: 1,
        unit_price: 0,
        tax_type: 'TAXED'
    };
};

// Quitar ítem de la tabla
const removeItem = (index) => {
    items.value.splice(index, 1);
};

// Guardar/Emitir la Venta o Comprobante
const emitDocument = async () => {
    if (items.value.length === 0) {
        toast.add({ severity: 'warn', summary: 'Atención', detail: 'Debe agregar al menos un producto', life: 3000 });
        return;
    }

    if (!invoice.value.client_name) {
        toast.add({ severity: 'warn', summary: 'Atención', detail: 'Complete los datos del cliente', life: 3000 });
        return;
    }

    submitting.value = true;
    const payload = {
        ...invoice.value,
        items: items.value,
        op_taxed: opTaxed.value.toFixed(2),
        igv: totalIgv.value.toFixed(2),
        total: totalGeneral.value.toFixed(2)
    };

    try {
        const response = await api.post('/invoices', payload);
        toast.add({ severity: 'success', summary: 'Éxito', detail: 'Comprobante procesado correctamente', life: 4000 });
        
        // Limpiar pantalla
        items.value = [];
        invoice.value.client_doc_number = '';
        invoice.value.client_name = '';
        invoice.value.client_address = '';
    } catch (error) {
        toast.add({ 
            severity: 'error', 
            summary: 'Error en Emisión', 
            detail: error.response?.data?.error || error.response?.data?.message || 'Error al procesar comprobante', 
            life: 4000 
        });
    } finally {
        submitting.value = false;
    }
};

onMounted(() => {
    fetchProducts();
});
</script>

<template>
    <div class="grid">
        <Toast />

        <div class="col-12">
            <div class="card p-4 surface-card border-round shadow-1">
                <h3 class="font-bold text-900 mb-4">Emisión de Comprobantes de Venta</h3>

                <!-- 1. TIPO DE COMPROBANTE Y DATOS DEL CLIENTE -->
                <div class="p-fluid grid mb-4">
                    <div class="col-12 md:col-4 mb-3">
                        <label class="font-bold block mb-2">Tipo de Documento</label>
                        <SelectButton 
                            v-model="invoice.document_type" 
                            :options="[
                                {label: 'Boleta', value: '03'}, 
                                {label: 'Factura', value: '01'}, 
                                {label: 'Nota de Venta', value: 'NV'}
                            ]" 
                            optionLabel="label" 
                            optionValue="value" 
                        />
                    </div>

                    <div class="col-12 md:col-4 mb-3">
                        <label class="font-bold block mb-2">
                            Documento {{ invoice.client_doc_type === '6' ? 'RUC' : invoice.client_doc_type === '1' ? 'DNI' : 'Cliente' }}
                        </label>
                        <div class="p-inputgroup">
                            <InputText 
                                v-model="invoice.client_doc_number" 
                                placeholder="Ingrese número" 
                                :disabled="invoice.document_type === 'NV'"
                                @keyup.enter="searchCustomer" 
                            />
                            <Button 
                                icon="pi pi-search" 
                                :loading="loadingLookup" 
                                :disabled="invoice.document_type === 'NV'"
                                @click="searchCustomer" 
                            />
                        </div>
                    </div>

                    <div class="col-12 md:col-4 mb-3">
                        <label class="font-bold block mb-2">Nombre / Razón Social</label>
                        <InputText v-model="invoice.client_name" placeholder="Razón Social o Nombre" />
                    </div>

                    <div class="col-12 mb-2">
                        <label class="font-semibold block mb-1">Dirección Fiscal</label>
                        <InputText v-model="invoice.client_address" placeholder="Dirección del cliente (opcional para boletas)" />
                    </div>
                </div>

                <hr class="border-top-1 surface-border my-4" />

                <!-- 2. AGREGAR PRODUCTO (FORMULARIO TEMPORAL) -->
                <h5 class="font-bold text-800 mb-3">Agregar Productos / Servicios</h5>
                <div class="p-fluid grid align-items-end mb-4">
                    <div class="col-12 md:col-4">
                        <label class="font-semibold block mb-1">Buscar Producto</label>
                        <Dropdown 
                            v-model="selectedProduct" 
                            :options="availableProducts" 
                            optionLabel="name" 
                            placeholder="Selecciona un producto" 
                            filter 
                        />
                    </div>
                    <div class="col-12 md:col-3">
                        <label class="font-semibold block mb-1">Nombre / Descripción</label>
                        <InputText v-model="currentItem.product_name" placeholder="Descripción del Ítem" />
                    </div>
                    <div class="col-6 md:col-2">
                        <label class="font-semibold block mb-1">Cantidad</label>
                        <InputNumber v-model="currentItem.quantity" :min="1" />
                    </div>
                    <div class="col-6 md:col-2">
                        <label class="font-semibold block mb-1">Precio Unit. (S/)</label>
                        <InputNumber v-model="currentItem.unit_price" mode="currency" currency="PEN" locale="es-PE" />
                    </div>
                    <div class="col-12 md:col-1 mt-2 md:mt-0">
                        <Button icon="pi pi-plus" severity="success" class="w-full" @click="addItem" />
                    </div>
                </div>

                <!-- 3. TABLA DINÁMICA DE ÍTEMS / PRODUCTOS -->
                <DataTable :value="items" responsiveLayout="scroll" class="p-datatable-sm mb-4">
                    <template #empty>
                        <div class="text-center p-3 text-500">No hay productos agregados al comprobante.</div>
                    </template>
                    <Column field="product_name" header="Descripción"></Column>
                    <Column field="quantity" header="Cantidad" style="width: 100px; text-align: center"></Column>
                    <Column header="Precio Unitario" style="width: 150px">
                        <template #body="slotProps">
                            S/ {{ Number(slotProps.data.unit_price).toFixed(2) }}
                        </template>
                    </Column>
                    <Column header="Tipo IGV" style="width: 120px">
                        <template #body="slotProps">
                            <Tag 
                                :value="slotProps.data.tax_type === 'TAXED' ? '18% IGV' : 'Exonerado'" 
                                :severity="slotProps.data.tax_type === 'TAXED' ? 'info' : 'warning'" 
                            />
                        </template>
                    </Column>
                    <Column header="Subtotal" style="width: 150px">
                        <template #body="slotProps">
                            <span class="font-bold">
                                S/ {{ (slotProps.data.quantity * slotProps.data.unit_price).toFixed(2) }}
                            </span>
                        </template>
                    </Column>
                    <Column header="Acción" style="width: 80px; text-align: center">
                        <template #body="slotProps">
                            <Button 
                                icon="pi pi-trash" 
                                severity="danger" 
                                text 
                                rounded 
                                @click="removeItem(slotProps.index)" 
                            />
                        </template>
                    </Column>
                </DataTable>

                <!-- 4. RESUMEN DE TOTALES Y BOTÓN DE EMISIÓN -->
                <div class="grid justify-content-end">
                    <div class="col-12 md:col-5 lg:col-4">
                        <div class="surface-100 p-3 border-round">
                            <div class="flex justify-content-between text-sm mb-2">
                                <span>Op. Gravada:</span>
                                <strong>S/ {{ opTaxed.toFixed(2) }}</strong>
                            </div>
                            <div class="flex justify-content-between text-sm mb-2">
                                <span>IGV (18%):</span>
                                <strong>S/ {{ totalIgv.toFixed(2) }}</strong>
                            </div>
                            <hr class="border-top-1 surface-border my-2" />
                            <div class="flex justify-content-between text-xl font-bold text-900">
                                <span>Total General:</span>
                                <span class="text-blue-700">S/ {{ totalGeneral.toFixed(2) }}</span>
                            </div>
                        </div>

                        <Button 
                            :label="invoice.document_type === 'NV' ? 'Generar Nota de Venta' : 'Emitir Comprobante SUNAT'" 
                            icon="pi pi-check" 
                            severity="primary" 
                            class="w-full mt-3 p-3 font-bold" 
                            :loading="submitting" 
                            @click="emitDocument" 
                        />
                    </div>
                </div>

            </div>
        </div>
    </div>
</template> 