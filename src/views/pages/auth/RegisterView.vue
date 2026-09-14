<template>
  <div class="surface-ground flex align-items-center justify-content-center min-screen-height p-3">
    <!-- Componente Toast para alertas flotantes globales -->
    <Toast />

    <div class="surface-card p-4 md:p-5 shadow-2 border-round-xl w-full max-w-30rem">
      <div class="text-center mb-4">
        <div class="text-900 text-2xl font-bold mb-2">Crear Cuenta Cliente</div>
        <span class="text-600 font-medium text-sm">¿Ya tienes cuenta en Electroredes?</span>
        <router-link :to="{ name: 'login' }" class="font-bold no-underline ml-2 text-primary">
          Inicia sesión
        </router-link>
      </div>

      <!-- Advertencia general si hay errores de validación -->
      <Message v-if="hasFormErrors" severity="warn" :closable="false" class="mb-4">
        Por favor, corrige los campos señalados antes de continuar.
      </Message>

      <form @submit.prevent="handleRegister">
        <!-- Nombre Completo -->
        <div class="mb-3">
          <label for="name" class="block text-900 font-semibold mb-2 text-sm">
            Nombre Completo <span class="text-red-500">*</span>
          </label>
          <InputText 
            id="name" 
            v-model="form.name" 
            type="text" 
            placeholder="Ej. Juan Pérez" 
            class="w-full"
            :class="{ 'p-invalid': errors.name }"
            @input="validateField('name')"
          />
          <small v-if="errors.name" class="p-error block mt-1 text-xs">{{ errors.name[0] }}</small>
        </div>

        <!-- Documento: Tipo y Número -->
        <div class="formgrid grid mb-3">
          <div class="col-12 md:col-5 mb-3 md:mb-0">
            <label for="document_type" class="block text-900 font-semibold mb-2 text-sm">
              Tipo Doc. <span class="text-red-500">*</span>
            </label>
            <Dropdown 
              id="document_type" 
              v-model="form.document_type" 
              :options="documentTypes" 
              optionLabel="label" 
              optionValue="value" 
              class="w-full"
              @change="handleDocumentTypeChange"
            />
          </div>

          <div class="col-12 md:col-7">
            <label for="document_number" class="block text-900 font-semibold mb-2 text-sm">
              N° Documento <span class="text-red-500">*</span>
            </label>
            <InputText 
              id="document_number" 
              v-model="form.document_number" 
              type="text" 
              :placeholder="documentPlaceholder" 
              :maxlength="maxDocumentLength"
              class="w-full"
              :class="{ 'p-invalid': errors.document_number }"
              @input="onDocumentNumberInput"
            />
            <small v-if="errors.document_number" class="p-error block mt-1 text-xs">
              {{ errors.document_number[0] }}
            </small>
          </div>
        </div>

        <!-- Correo Electrónico y Teléfono -->
        <div class="formgrid grid mb-3">
          <div class="col-12 md:col-7 mb-3 md:mb-0">
            <label for="email" class="block text-900 font-semibold mb-2 text-sm">
              Correo Electrónico <span class="text-red-500">*</span>
            </label>
            <InputText 
              id="email" 
              v-model="form.email" 
              type="email" 
              placeholder="correo@ejemplo.com" 
              class="w-full"
              :class="{ 'p-invalid': errors.email }"
              @input="validateEmail"
              autocomplete="username"
            />
            <small v-if="errors.email" class="p-error block mt-1 text-xs">{{ errors.email[0] }}</small>
          </div>

          <div class="col-12 md:col-5">
            <label for="phone" class="block text-900 font-semibold mb-2 text-sm">
              Celular <span class="text-red-500">*</span>
            </label>
            <InputText 
              id="phone" 
              v-model="form.phone" 
              type="text" 
              placeholder="987654321" 
              maxlength="9"
              class="w-full"
              :class="{ 'p-invalid': errors.phone }"
              @input="onPhoneInput"
            />
            <small v-if="errors.phone" class="p-error block mt-1 text-xs">{{ errors.phone[0] }}</small>
          </div>
        </div>

        <!-- Dirección de Entrega -->
        <div class="mb-3">
          <label for="address" class="block text-900 font-semibold mb-2 text-sm">
            Dirección de Entrega <span class="text-red-500">*</span>
          </label>
          <InputText 
            id="address" 
            v-model="form.address" 
            type="text" 
            placeholder="Av. Las Flores 123, Urb. Centro" 
            class="w-full"
            :class="{ 'p-invalid': errors.address }"
            @input="validateField('address')"
          />
          <small v-if="errors.address" class="p-error block mt-1 text-xs">{{ errors.address[0] }}</small>
        </div>

        <!-- Contraseñas -->
        <div class="formgrid grid mb-4">
          <div class="col-12 md:col-6 mb-3 md:mb-0">
            <label for="password" class="block text-900 font-semibold mb-2 text-sm">
              Contraseña <span class="text-red-500">*</span>
            </label>
            <Password 
              id="password" 
              v-model="form.password" 
              :toggleMask="true" 
              placeholder="••••••••" 
              inputClass="w-full"
              class="w-full"
              :class="{ 'p-invalid': errors.password }"
              @input="validatePasswords"
            />
            <small v-if="errors.password" class="p-error block mt-1 text-xs">{{ errors.password[0] }}</small>
          </div>

          <div class="col-12 md:col-6">
            <label for="password_confirmation" class="block text-900 font-semibold mb-2 text-sm">
              Confirmar <span class="text-red-500">*</span>
            </label>
            <Password 
              id="password_confirmation" 
              v-model="form.password_confirmation" 
              :feedback="false" 
              :toggleMask="true" 
              placeholder="••••••••" 
              inputClass="w-full"
              class="w-full"
              :class="{ 'p-invalid': errors.password_confirmation }"
              @input="validatePasswords"
            />
            <small v-if="errors.password_confirmation" class="p-error block mt-1 text-xs">
              {{ errors.password_confirmation[0] }}
            </small>
          </div>
        </div>

        <!-- Botón de Registro -->
        <Button 
          type="submit" 
          label="Crear Cuenta" 
          icon="pi pi-user-plus" 
          class="w-full font-bold" 
          :loading="loading" 
        />
      </form>
    </div>
  </div>
</template>

<script setup>
//import api from '@/api/axios';
import api from '@/service/api';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();

const loading = ref(false);
const errors = ref({});

const documentTypes = [
  { label: 'DNI', value: 'DNI' },
  { label: 'RUC', value: 'RUC' },
  { label: 'Carnet Ext.', value: 'CE' }
];

const form = reactive({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  document_type: 'DNI',
  document_number: '',
  phone: '',
  address: ''
});

// Configuración dinámica por tipo de documento
const maxDocumentLength = computed(() => {
  if (form.document_type === 'DNI') return 8;
  if (form.document_type === 'RUC') return 11;
  return 12; // CE
});

const documentPlaceholder = computed(() => {
  if (form.document_type === 'DNI') return '8 dígitos';
  if (form.document_type === 'RUC') return '11 dígitos';
  return 'N° de Carnet';
});

const hasFormErrors = computed(() => Object.keys(errors.value).length > 0);

// Restricción de entrada solo números
const sanitizeNumericInput = (val) => val.replace(/\D/g, '');

const onDocumentNumberInput = () => {
  if (['DNI', 'RUC'].includes(form.document_type)) {
    form.document_number = sanitizeNumericInput(form.document_number);
  }
  validateDocumentNumber();
};

const onPhoneInput = () => {
  form.phone = sanitizeNumericInput(form.phone);
  if (form.phone.length > 0 && !form.phone.startsWith('9')) {
    errors.value.phone = ['El número celular debe empezar con 9.'];
  } else if (form.phone.length > 0 && form.phone.length < 9) {
    errors.value.phone = ['El celular debe tener 9 dígitos.'];
  } else {
    delete errors.value.phone;
  }
};

const handleDocumentTypeChange = () => {
  form.document_number = '';
  delete errors.value.document_number;
};

// Validaciones locales rápidas
const validateDocumentNumber = () => {
  if (form.document_type === 'DNI' && form.document_number.length !== 8) {
    errors.value.document_number = ['El DNI debe contener exactamente 8 dígitos.'];
  } else if (form.document_type === 'RUC' && form.document_number.length !== 11) {
    errors.value.document_number = ['El RUC debe contener exactamente 11 dígitos.'];
  } else {
    delete errors.value.document_number;
  }
};

const validateEmail = () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(form.email)) {
    errors.value.email = ['Ingresa un correo electrónico válido.'];
  } else {
    delete errors.value.email;
  }
};

const validatePasswords = () => {
  if (form.password.length < 8) {
    errors.value.password = ['La contraseña debe tener al menos 8 caracteres.'];
  } else {
    delete errors.value.password;
  }

  if (form.password_confirmation && form.password !== form.password_confirmation) {
    errors.value.password_confirmation = ['Las contraseñas no coinciden.'];
  } else {
    delete errors.value.password_confirmation;
  }
};

const validateField = (field) => {
  if (form[field].trim() !== '') {
    delete errors.value[field];
  }
};

// Envió del Formulario al Backend
const handleRegister = async () => {
  // Ejecutar validaciones locales finales
  console.log('1. Iniciando proceso de registro...');
  validateDocumentNumber();
  validateEmail();
  validatePasswords();
console.log('2. Errores de validación actuales:', errors.value);
  if (hasFormErrors.value) {
    toast.add({
      severity: 'warn',
      summary: 'Campos Inválidos',
      detail: 'Revisa los errores resaltados antes de enviar.',
      life: 4000
    });
    console.log('4. Enviando datos al backend:', form);
    return;
  }

  loading.value = true;
  errors.value = {};

  try {
    const response = await api.post('/auth/register', form);
    console.log('4. Enviando datos al backend:', form);
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user_role', user.role.name);
    console.log('4. Enviando datos al backend:', form);
    toast.add({
      severity: 'success',
      summary: '¡Registro Exitoso!',
      detail: `Bienvenido/a, ${user.name}`,
      life: 3000
    });
    console.log('4. Enviando datos al backend:', form);

    setTimeout(() => {
      router.push({ name: 'catalog' });
    }, 1200);

  } catch (error) {
    if (error.response && error.response.status === 422) {
      errors.value = error.response.data.errors;
      toast.add({
        severity: 'error',
        summary: 'Error de Validación',
        detail: 'Corrige los datos indicados por el sistema.',
        life: 5000
      });
      console.log('4. Enviando datos al backend:', form);
    } else {
      toast.add({
        severity: 'error',
        summary: 'Error del Servidor',
        detail: error.response?.data?.message || 'No se pudo completar el registro.',
        life: 5000
      });
      console.log('4. Enviando datos al backend:', form);
    }
  } finally {
    loading.value = false;
    console.log('4. Enviando datos al backend:', form);
  }
};
</script>

<style scoped>
.min-screen-height {
  min-height: 90vh;
}
.max-w-30rem {
  max-width: 32rem;
}
</style>