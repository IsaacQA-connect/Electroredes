import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

import Aura from '@primeuix/themes/aura';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';

// Importación de CSS (Importante para PrimeIcons y Sakai)
import './assets/styles.scss';

// Componentes de PrimeVue
import 'primeflex/primeflex.css';
import Avatar from 'primevue/avatar';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import Toolbar from 'primevue/toolbar';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// Configuración limpia de PrimeVue 4
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
            darkModeSelector: '.app-dark'
        }
    }
});

app.use(ToastService);
app.use(ConfirmationService);

// Registro global de componentes
app.component('Toast', Toast);
app.component('Toolbar', Toolbar);
app.component('Dialog', Dialog);
app.component('InputNumber', InputNumber);
app.component('InputText', InputText);
app.component('Button', Button);
app.component('DataTable', DataTable);
app.component('Column', Column);
app.component('Tag', Tag);
app.component('Select', Select);
app.component('Dropdown', Dropdown);
app.component('Badge', Badge);
app.component('Avatar', Avatar);

app.mount('#app');