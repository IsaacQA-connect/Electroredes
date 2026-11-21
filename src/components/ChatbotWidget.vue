<template>
  <div class="chatbot-container">
    <!-- Ventana del Chat con animación -->
    <Transition name="chat-pop">
      <div v-if="isOpen" class="chat-window" role="dialog" aria-label="Asistente Virtual ElectriBOT">
        <!-- Encabezado -->
        <div class="chat-header">
          <div class="header-left">
            <div class="bot-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span class="status-dot" title="En línea"></span>
            </div>
            <div class="header-info">
              <h4>ElectriBOT AI</h4>
              <small>ELECTRO REDES • En línea</small>
            </div>
          </div>

          <div class="header-actions">
            <button
              type="button"
              class="icon-btn"
              title="Reiniciar conversación"
              @click="resetChat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button
              type="button"
              class="icon-btn"
              title="Minimizar chat"
              @click="toggleChat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Cuerpo del Chat / Mensajes -->
        <div class="chat-body" ref="chatBody">
          <div class="chat-date-badge">Hoy</div>

          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="['message-row', msg.sender]"
          >
            <div v-if="msg.sender === 'bot'" class="msg-mini-avatar">⚡</div>

            <div class="message-bubble">
              <div class="message-text" v-html="formatMessage(msg.text)"></div>

              <!-- Lista compacta de productos encontrados -->
              <div v-if="msg.products && msg.products.length > 0" class="bot-products-list">
                <div
                  v-for="prod in msg.products"
                  :key="prod.id"
                  class="bot-product-card"
                >
                  <div class="prod-info">
                    <span class="prod-name">{{ prod.name }}</span>
                    <span class="prod-meta">
                      S/ {{ Number(prod.sale_price).toFixed(2) }} • Stock: {{ prod.stock }}
                    </span>
                  </div>
                  <button
                    v-if="prod.stock > 0"
                    type="button"
                    class="prod-add-btn"
                    title="Agregar al carrito"
                    @click="handleAddProductToCart(prod)"
                  >
                    + Carrito
                  </button>
                </div>
              </div>

              <!-- Contenedor de Botones de Acción (PDF y WhatsApp) -->
              <div v-if="msg.quotePdfUrl || msg.needsHuman || msg.whatsappUrl" class="action-buttons-group">
                <!-- Botón Descargar Cotización PDF -->
                <a
                  v-if="msg.quotePdfUrl"
                  :href="msg.quotePdfUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="pdf-btn"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <polyline points="9 15 12 18 15 15" />
                  </svg>
                  Descargar Cotización PDF
                </a>

                <!-- Botón de derivación / cierre por WhatsApp -->
                <a
                  v-if="msg.needsHuman || msg.whatsappUrl"
                  :href="msg.whatsappUrl || buildFallbackWhatsappUrl(msg.lastUserQuery)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="whatsapp-btn"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824z"/>
                  </svg>
                  {{ msg.quotePdfUrl ? 'Cerrar cotización por WhatsApp' : 'Hablar con un asesor' }}
                </a>
              </div>

              <span class="message-time">{{ msg.time }}</span>
            </div>
          </div>

          <!-- Sugerencias rápidas al iniciar -->
          <div v-if="messages.length === 1 && !loading" class="quick-replies">
            <button
              v-for="(suggestion, idx) in quickSuggestions"
              :key="idx"
              type="button"
              class="chip-btn"
              @click="sendQuickReply(suggestion)"
            >
              {{ suggestion }}
            </button>
          </div>

          <!-- Indicador animado de escritura -->
          <div v-if="loading" class="message-row bot">
            <div class="msg-mini-avatar">⚡</div>
            <div class="message-bubble typing-bubble">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </div>

        <!-- Pie / Entrada de Texto -->
        <form class="chat-footer" @submit.prevent="sendMessage">
          <input
            ref="messageInput"
            v-model="inputMessage"
            type="text"
            placeholder="Consulta stock, precios o cotizaciones..."
            autocomplete="off"
          />
          <button
            type="submit"
            class="send-btn"
            :disabled="loading || !inputMessage.trim()"
            title="Enviar mensaje"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </Transition>

    <!-- Botón Flotante (Abajo a la Derecha) -->
    <button
      type="button"
      class="chat-toggle-btn"
      :class="{ 'is-open': isOpen }"
      @click="toggleChat"
    >
      <template v-if="!isOpen">
        <span class="btn-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <span>Asistente IA</span>
      </template>
      <template v-else>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </template>
    </button>
  </div>
</template>

<script setup>
import axios from 'axios';
import { nextTick, ref } from 'vue';
// Importa tu store del carrito si usas Pinia (ajusta la ruta según tu proyecto):
// import { useCartStore } from '@/stores/cart';

const API_URL = 'https://apielectroredes.soportecenter.com/api/v1/chatbot/query';
const WHATSAPP_PHONE = '51933437116';

// const cartStore = useCartStore();
const emit = defineEmits(['add-to-cart']);

const isOpen = ref(false);
const loading = ref(false);
const inputMessage = ref('');
const chatBody = ref(null);
const messageInput = ref(null);

const quickSuggestions = [
  '¿Qué productos tienen en stock?',
  'Quiero cotizar materiales',
  'Horario y dirección de tienda',
];

const getCurrentTime = () => {
  return new Date().toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const createInitialGreeting = () => ({
  sender: 'bot',
  text: '¡Hola! Soy **ElectriBOT**, tu asistente virtual de **ELECTRO REDES**.\n¿En qué producto, stock o cotización puedo ayudarte hoy?',
  needsHuman: false,
  whatsappUrl: null,
  quotePdfUrl: null,
  products: [],
  time: getCurrentTime()
});

const messages = ref([createInitialGreeting()]);

const focusInput = () => {
  nextTick(() => {
    messageInput.value?.focus();
  });
};

const scrollToBottom = () => {
  nextTick(() => {
    if (chatBody.value) {
      chatBody.value.scrollTop = chatBody.value.scrollHeight;
    }
  });
};

const toggleChat = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    scrollToBottom();
    focusInput();
  }
};

const resetChat = () => {
  messages.value = [createInitialGreeting()];
  inputMessage.value = '';
  focusInput();
};

const formatMessage = (rawText) => {
  if (!rawText) return '';
  const escaped = String(rawText)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
};

const sendQuickReply = (text) => {
  inputMessage.value = text;
  sendMessage();
};

// Sincroniza producto con Pinia (cartStore) o emite evento al padre
const handleAddProductToCart = (product, quantity = 1) => {
  // Si usas Pinia, descomenta la línea correspondiente a tu método:
  // cartStore.addItem({ id: product.product_id || product.id, name: product.name, sale_price: product.sale_price, image_path: product.image_path }, quantity);
  emit('add-to-cart', { product, quantity });
};

const sendMessage = async () => {
  const text = inputMessage.value.trim();
  if (!text || loading.value) {
    focusInput();
    return;
  }

  messages.value.push({
    sender: 'user',
    text,
    time: getCurrentTime()
  });

  inputMessage.value = '';
  loading.value = true;
  scrollToBottom();
  focusInput();

  // Obtener token Sanctum si el usuario está logueado
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token');

  try {
    const response = await axios.post(
      API_URL,
      { message: text },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      }
    );

    const data = response.data;

    // 1. Si el bot ejecutó agregar_al_carrito, sincronizar automáticamente
    if (data.cart_action && data.cart_action.type === 'ADD_TO_CART' && Array.isArray(data.cart_action.items)) {
      data.cart_action.items.forEach((item) => {
        handleAddProductToCart(item, item.quantity);
      });
    }

    // 2. Renderizar respuesta con tarjetas, PDF y botón de WhatsApp
    messages.value.push({
      sender: 'bot',
      text: data.reply,
      products: data.products || [],
      quotePdfUrl: data.quote_pdf_url || null,
      whatsappUrl: data.whatsapp_url || null,
      needsHuman: Boolean(data.needs_human),
      lastUserQuery: text,
      time: getCurrentTime()
    });
  } catch (error) {
    messages.value.push({
      sender: 'bot',
      text: 'Lo siento, tuve un inconveniente al consultar en este momento. Puedes escribirnos directamente por WhatsApp para atenderte al instante.',
      products: [],
      quotePdfUrl: null,
      whatsappUrl: null,
      needsHuman: true,
      lastUserQuery: text,
      time: getCurrentTime()
    });
  } finally {
    loading.value = false;
    scrollToBottom();
    focusInput();
  }
};

const buildFallbackWhatsappUrl = (query) => {
  const encodedText = encodeURIComponent(
    `Hola ELECTRO REDES, requiero atención personalizada sobre: ${query || 'cotización'}`
  );
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodedText}`;
};
</script>

<style scoped>
.chatbot-container {
  position: fixed;
  bottom: 22px;
  right: 22px;
  z-index: 9999;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Botón Flotante */
.chat-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, #1D53A0 0%, #153E78 100%);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 13px 20px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(29, 83, 160, 0.35);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.chat-toggle-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(29, 83, 160, 0.45);
}

.chat-toggle-btn.is-open {
  padding: 13px;
  border-radius: 50%;
}

.btn-icon {
  display: flex;
  align-items: center;
  color: #E2B86B;
}

/* Ventana Principal */
.chat-window {
  position: absolute;
  bottom: 64px;
  right: 0;
  width: 375px;
  height: 520px;
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid #E2E8F0;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-pop-enter-active,
.chat-pop-leave-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: bottom right;
}

.chat-pop-enter-from,
.chat-pop-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(12px);
}

/* Encabezado */
.chat-header {
  background: linear-gradient(135deg, #163F7A 0%, #1D53A0 100%);
  color: #ffffff;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #C89B48;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 11px;
}

.bot-avatar {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.14);
  color: #F3C978;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  background-color: #10B981;
  border: 2px solid #163F7A;
  border-radius: 50%;
}

.header-info h4 {
  margin: 0;
  font-size: 14.5px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.header-info small {
  color: #E2C07D;
  font-size: 11px;
  font-weight: 500;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

/* Cuerpo de Mensajes */
.chat-body {
  flex: 1;
  padding: 14px;
  overflow-y: auto;
  background-color: #F4F7FB;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
}

.chat-date-badge {
  align-self: center;
  background: #E2E8F0;
  color: #64748B;
  font-size: 10.5px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
}

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.message-row.user {
  justify-content: flex-end;
}

.message-row.bot {
  justify-content: flex-start;
}

.msg-mini-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #E0E9F6;
  color: #1D53A0;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-bubble {
  max-width: 82%;
  padding: 10px 13px;
  font-size: 13px;
  line-height: 1.45;
  position: relative;
  word-wrap: break-word;
}

.user .message-bubble {
  background: linear-gradient(135deg, #1D53A0 0%, #184687 100%);
  color: #ffffff;
  border-radius: 16px 16px 4px 16px;
  box-shadow: 0 3px 10px rgba(29, 83, 160, 0.2);
}

.bot .message-bubble {
  background: #ffffff;
  color: #1E293B;
  border: 1px solid #E2E8F0;
  border-radius: 16px 16px 16px 4px;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
}

.message-time {
  display: block;
  font-size: 10px;
  margin-top: 5px;
  text-align: right;
  opacity: 0.7;
}

/* Tarjetas compactas de productos */
.bot-products-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #E2E8F0;
}

.bot-product-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 6px 8px;
}

.prod-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.prod-name {
  font-size: 11.5px;
  font-weight: 600;
  color: #0F172A;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.prod-meta {
  font-size: 10.5px;
  color: #475569;
}

.prod-add-btn {
  background: #1D53A0;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease;
}

.prod-add-btn:hover {
  background: #153E78;
}

/* Grupo de botones de acción (PDF y WhatsApp) */
.action-buttons-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 9px;
}

.pdf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 12px;
  background-color: #1D53A0;
  color: #ffffff;
  text-decoration: none;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 600;
  transition: background-color 0.15s ease;
}

.pdf-btn:hover {
  background-color: #163F7A;
}

.whatsapp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 12px;
  background-color: #10B981;
  color: #ffffff;
  text-decoration: none;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 600;
  transition: background-color 0.15s ease;
}

.whatsapp-btn:hover {
  background-color: #059669;
}

/* Sugerencias rápidas */
.quick-replies {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 34px;
}

.chip-btn {
  background: #ffffff;
  color: #1D53A0;
  border: 1px solid #BFDBFE;
  border-radius: 999px;
  padding: 6px 11px;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chip-btn:hover {
  background: #EFF6FF;
  border-color: #1D53A0;
}

/* Indicador de escritura animado */
.typing-bubble {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 15px;
}

.typing-bubble .dot {
  width: 6px;
  height: 6px;
  background-color: #64748B;
  border-radius: 50%;
  animation: bounce 1.3s infinite ease-in-out both;
}

.typing-bubble .dot:nth-child(1) { animation-delay: -0.32s; }
.typing-bubble .dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* Footer / Input */
.chat-footer {
  padding: 10px 12px;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid #E2E8F0;
}

.chat-footer input {
  flex: 1;
  padding: 10px 13px;
  background: #F8FAFC;
  border: 1px solid #CBD5E1;
  border-radius: 10px;
  font-size: 13px;
  color: #0F172A;
  outline: none;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.chat-footer input:focus {
  background: #ffffff;
  border-color: #1D53A0;
  box-shadow: 0 0 0 3px rgba(29, 83, 160, 0.12);
}

.send-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background-color: #1D53A0;
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.send-btn:hover:not(:disabled) {
  background-color: #163F7A;
}

.send-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.send-btn:disabled {
  background-color: #CBD5E1;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .chatbot-container {
    bottom: 14px;
    right: 14px;
  }

  .chat-window {
    width: calc(100vw - 28px);
    height: 72vh;
    max-height: 520px;
  }
}
</style>