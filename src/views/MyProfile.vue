<script setup>
import api from '@/service/api';
import { useAuthStore } from '@/stores/auth';
import { computed, onMounted, reactive, ref } from 'vue';
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
const searchingDoc = ref(false);
const sunatStatus = ref(null);
const lastFetchedDoc = ref('');
const autoFilledAddress = ref(false);

const docTypes = [
    { label: 'DNI (8 dígitos)', value: 'DNI' },
    { label: 'RUC (11 dígitos)', value: 'RUC' },
    //{ label: 'Carnet de Extranjería', value: 'CE' },
    //{ label: 'Pasaporte', value: 'PASAPORTE' }
];

//Bloquea cualquier tecla que no sea número (0-9) al escribir
const onlyNumbers = (event) => {
  if (event.ctrlKey || event.metaKey) return; // Permite Ctrl+C, Ctrl+V, Ctrl+A
  if (!/^\d$/.test(event.key)) {
    event.preventDefault();
  }
};

const form = reactive({
    name: '',
    email: '',
    phone: '',
    document_type: 'DNI',
    document_number: '',
    address: ''
});

// Propiedades computadas para validación y UI dinámica
const maxDocumentLength = computed(() => {
    if (form.document_type === 'DNI') return 8;
    if (form.document_type === 'RUC') return 11;
    return 20;
});

const documentPlaceholder = computed(() => {
    if (form.document_type === 'DNI') return 'Ej: 71234567';
    if (form.document_type === 'RUC') return 'Ej: 20601234567';
    return 'Ingresa tu documento';
});

const canLookupDocument = computed(() => {
    const clean = form.document_number.trim();
    if (form.document_type === 'DNI') return /^\d{8}$/.test(clean);
    if (form.document_type === 'RUC') return /^\d{11}$/.test(clean);
    return false;
});

const clearPreviousLookup = () => {
  if (lastFetchedDoc.value) {
    form.name = '';
    if (autoFilledAddress.value) {
      form.address = '';
      autoFilledAddress.value = false;
    }
    lastFetchedDoc.value = '';
  }
  sunatStatus.value = null;
};

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
    if (!authStore.user) {
        await authStore.fetchUser();
    }
    loadUserData();
});

// Consulta DNI / RUC al backend (APIsPERU)
const lookupDocument = async () => {
  if (!canLookupDocument.value || searchingDoc.value) return;

  // Limpiar siempre antes de iniciar una nueva consulta
  clearPreviousLookup();
  searchingDoc.value = true;

  const docNum = form.document_number.trim();
  const endpoint = form.document_type === 'DNI'
    ? `/lookup/dni/${docNum}`
    : `/lookup/ruc/${docNum}`;

  try {
    const response = await api.get(endpoint);
    const resData = response.data;
    const raw = resData.raw || resData.data || resData;

    let fullName = resData.name || '';
    let fiscalAddress = resData.address || '';

    if (!fullName) {
      if (form.document_type === 'DNI') {
        fullName = [raw.nombres, raw.apellidoPaterno, raw.apellidoMaterno]
          .filter(Boolean)
          .join(' ')
          .trim();
      } else if (form.document_type === 'RUC') {
        fullName = raw.razonSocial || '';
        fiscalAddress = raw.direccion || '';
      }
    }

    if (fullName) {
      form.name = fullName;
      lastFetchedDoc.value = docNum; // Marca este documento como autocompletado
      if (typeof errors !== 'undefined' && errors.value) delete errors.value.name;
    }

    if (form.document_type === 'RUC') {
      if (fiscalAddress && fiscalAddress !== '-') {
        form.address = fiscalAddress;
        autoFilledAddress.value = true; // Permite limpiarla si luego cambia a DNI
        if (typeof errors !== 'undefined' && errors.value) delete errors.value.address;
      }
      if (raw.estado || raw.condicion || resData.state || resData.condition) {
        sunatStatus.value = {
          estado: resData.state || raw.estado || '',
          condicion: resData.condition || raw.condicion || ''
        };
      }
    }

    toast.add({
      severity: 'success',
      summary: `${form.document_type} Encontrado`,
      detail: fullName || 'Datos cargados correctamente.',
      life: 2500
    });
  } catch (error) {
    toast.add({
      severity: 'warn',
      summary: 'Sin resultados',
      detail: error.response?.data?.message || `No se encontraron datos para el ${form.document_type}.`,
      life: 3500
    });
  } finally {
    searchingDoc.value = false;
  }
};

// Sanitizar entrada numérica y disparar consulta al completar 8 u 11 dígitos
const onDocumentNumberInput = () => {
  if (['DNI', 'RUC'].includes(form.document_type)) {
    form.document_number = form.document_number.replace(/\D/g, '');
  }

  // Si el usuario empieza a borrar o cambiar el número ya consultado, limpia los datos anteriores
  if (lastFetchedDoc.value && form.document_number !== lastFetchedDoc.value) {
    clearPreviousLookup();
  }

  if (typeof validateDocumentNumber === 'function') {
    validateDocumentNumber();
  }

  if (canLookupDocument.value) {
    lookupDocument();
  }
};

const handleDocumentTypeChange = () => {
  form.document_number = '';
  clearPreviousLookup();
  if (typeof errors !== 'undefined' && errors.value) {
    delete errors.value.document_number;
  }
};

const onPhoneInput = () => {
    form.phone = form.phone.replace(/\D/g, '');
};

const saveProfile = async () => {
    if (!form.name.trim()) {
        toast.add({ severity: 'warn', summary: 'Campo Requerido', detail: 'El nombre o razón social es obligatorio.', life: 3500 });
        return;
    }

    const docNum = form.document_number.trim();

    if (form.document_type === 'DNI' && docNum && !/^\d{8}$/.test(docNum)) {
        toast.add({ severity: 'warn', summary: 'DNI Inválido', detail: 'El DNI debe tener exactamente 8 dígitos numéricos.', life: 4000 });
        return;
    }

    if (form.document_type === 'RUC' && docNum && !/^\d{11}$/.test(docNum)) {
        toast.add({ severity: 'warn', summary: 'RUC Inválido', detail: 'El RUC debe tener exactamente 11 dígitos numéricos.', life: 4000 });
        return;
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

        await api.put('/auth/me', payload);
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

            <!-- Alerta para usuarios registrados con Google sin DNI -->
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
                    <!-- Tipo de Documento -->
                    <div class="col-12 md:col-6 field mb-3">
                        <label class="font-bold text-700 block mb-2">Tipo de Documento</label>
                        <Select 
                            v-model="form.document_type" 
                            :options="docTypes" 
                            optionLabel="label" 
                            optionValue="value" 
                            class="w-full"
                            @change="handleDocumentTypeChange"
                        />
                    </div>

                    <!-- Número de Documento + Botón de Búsqueda -->
                    <div class="col-12 md:col-6 field mb-3">
                        <label class="font-bold text-700 block mb-2">Número de Documento (DNI/RUC)</label>
                        <div class="flex gap-2">
                            <InputText 
                                v-model="form.document_number" 
                                inputmode="numeric"
                                class="w-full" 
                                :maxlength="maxDocumentLength"
                                :placeholder="documentPlaceholder"
                                :disabled="searchingDoc"
                                @keypress="['DNI', 'RUC'].includes(form.document_type) && onlyNumbers($event)"
                                @input="onDocumentNumberInput"
                                @keyup.enter.prevent="lookupDocument"
                            />
                            <Button
                                v-if="['DNI', 'RUC'].includes(form.document_type)"
                                type="button"
                                icon="pi pi-search"
                                :loading="searchingDoc"
                                :disabled="!canLookupDocument"
                                style="background-color: #2D62A3; border-color: #2D62A3;"
                                @click="lookupDocument"
                            />
                        </div>
                        <small v-if="['DNI', 'RUC'].includes(form.document_type)" class="text-500">
                            Se autocompletará al ingresar los {{ form.document_type === 'DNI' ? '8' : '11' }} dígitos.
                        </small>
                    </div>

                    <!-- Nombre Completo / Razón Social -->
                    <div class="col-12 md:col-6 field mb-3">
                        <label class="font-bold text-700 block mb-2">
                            {{ form.document_type === 'RUC' ? 'Razón Social *' : 'Nombre Completo *' }}
                        </label>
                        <InputText 
                            v-model="form.name" 
                            class="w-full" 
                            :placeholder="form.document_type === 'RUC' ? 'Ej: ELECTROREDES S.A.C.' : 'Ingresa tu nombre completo'" 
                        />
                        <!-- Etiquetas de estado SUNAT si se consultó un RUC -->
                        <div v-if="form.document_type === 'RUC' && sunatStatus" class="flex gap-2 mt-2">
                            <span 
                                class="text-xs font-semibold px-2 py-1 border-round"
                                :class="sunatStatus.estado === 'ACTIVO' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                            >
                                Estado: {{ sunatStatus.estado }}
                            </span>
                            <span 
                                class="text-xs font-semibold px-2 py-1 border-round"
                                :class="sunatStatus.condicion === 'HABIDO' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'"
                            >
                                Condición: {{ sunatStatus.condicion }}
                            </span>
                        </div>
                    </div>

                    <!-- Correo Electrónico (Readonly) -->
                    <div class="col-12 md:col-6 field mb-3">
                        <label class="font-bold text-700 block mb-2">Correo Electrónico</label>
                        <InputText v-model="form.email" class="w-full surface-200 cursor-not-allowed" disabled />
                        <small class="text-500">El correo está vinculado a tu cuenta y no se puede editar.</small>
                    </div>

                    <!-- Teléfono / Celular -->
                    <div class="col-12 md:col-6 field mb-3">
                        <label class="font-bold text-700 block mb-2">Teléfono / Celular</label>
                        <InputText 
                            v-model="form.phone" 
                            class="w-full" 
                            placeholder="Ej: 987654321" 
                            maxlength="9"
                            inputmode="numeric"
                            @keypress="onlyNumbers"
                            @input="onPhoneInput"
                        />
                    </div>

                    <!-- Dirección Principal -->
                    <div class="col-12 field mb-3">
                        <label class="font-bold text-700 block mb-2">
                            {{ form.document_type === 'RUC' ? 'Dirección Fiscal / de Entrega' : 'Dirección Principal de Entrega' }}
                        </label>
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