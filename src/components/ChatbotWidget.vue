<template>
  <div class="chatbot-container">
    <!-- Botón Flotante (Abajo a la Derecha) -->
    <button @click="toggleChat" class="chat-toggle-btn">
      <span v-if="!isOpen">💬 Asistente IA</span>
      <span v-else>✖ Cerrar</span>
    </button>

    <!-- Ventana del Chat -->
    <div v-if="isOpen" class="chat-window">
      <!-- Encabezado -->
      <div class="chat-header">
        <div class="avatar">⚡</div>
        <div>
          <h4>ElectriBOT AI</h4>
          <small>ELECTRO REDES • En línea</small>
        </div>
      </div>

      <!-- Cuerpo del Chat / Mensajes -->
      <div class="chat-body" ref="chatBody">
        <div 
          v-for="(msg, index) in messages" 
          :key="index" 
          :class="['message', msg.sender]"
        >
          <div class="message-content">
            <p>{{ msg.text }}</p>
            
            <!-- Botón de derivación a WhatsApp en caso de requerir asesor -->
            <a 
              v-if="msg.needsHuman" 
              :href="whatsappUrl(msg.lastUserQuery)" 
              target="_blank" 
              class="whatsapp-btn"
            >
              📲 Contactar Asesor por WhatsApp
            </a>
          </div>
        </div>

        <div v-if="loading" class="message bot loading">
          <p>Escribiendo...</p>
        </div>
      </div>

      <!-- Entrada de Texto -->
      <div class="chat-footer">
        <input 
          v-model="inputMessage" 
          @keyup.enter="sendMessage"
          type="text" 
          placeholder="Escribe tu consulta sobre stock o precios..."
          :disabled="loading"
        />
        <button @click="sendMessage" :disabled="loading || !inputMessage.trim()">
          Enviar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios';
import { nextTick, ref } from 'vue';

const isOpen = ref(false);
const loading = ref(false);
const inputMessage = ref('');
const chatBody = ref(null);
const lastQuery = ref('');

const messages = ref([
  {
    sender: 'bot',
    text: '¡Hola! Soy ElectriBOT, asistente de ELECTRO REDES. ¿En qué producto o cotización puedo ayudarte hoy?',
    needsHuman: false
  }
]);

const toggleChat = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) scrollToBottom();
};

const scrollToBottom = () => {
  nextTick(() => {
    if (chatBody.value) {
      chatBody.value.scrollTop = chatBody.value.scrollHeight;
    }
  });
};

const sendMessage = async () => {
  const text = inputMessage.value.trim();
  if (!text || loading.value) return;

  // Agregar mensaje del usuario
  messages.value.push({ sender: 'user', text });
  lastQuery.value = text;
  inputMessage.value = '';
  loading.value = true;
  scrollToBottom();

  try {
    // Consumir API de Laravel
    const response = await axios.post('https://apielectroredes.soportecenter.com/api/v1/chatbot/query',
        { message: text },
        {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        }
    );
    
    messages.value.push({
      sender: 'bot',
      text: response.data.reply,
      needsHuman: response.data.needs_human,
      lastUserQuery: text
    });
  } catch (error) {
    messages.value.push({
      sender: 'bot',
      text: 'Lo siento, no pude procesar la respuesta en este momento.',
      needsHuman: true,
      lastUserQuery: text
    });
  } finally {
    loading.value = false;
    scrollToBottom();
  }
};

const whatsappUrl = (query) => {
  const phone = "51900000000"; // Reemplazar por el número de ventas de la empresa
  const text = encodeURIComponent(`Hola ELECTRO REDES, requiero atención personalizada sobre: ${query}`);
  return `https://wa.me/${phone}?text=${text}`;
};
</script>

<style scoped>
.chatbot-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  font-family: Arial, sans-serif;
}

.chat-toggle-btn {
  background-color: #1D53A0;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 25px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.chat-window {
  position: absolute;
  bottom: 60px;
  right: 0;
  width: 340px;
  height: 460px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  background-color: #1D53A0;
  color: white;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-header h4 { margin: 0; font-size: 14px; }
.chat-header small { color: #C89B48; font-size: 11px; }

.chat-body {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  background-color: #F8FAFC;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message { display: flex; flex-direction: column; }
.message.user { align-items: flex-end; }
.message.bot { align-items: flex-start; }

.message-content {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.4;
}

.user .message-content {
  background-color: #1D53A0;
  color: white;
}

.bot .message-content {
  background-color: #E2E8F0;
  color: #0A0E1A;
}

.whatsapp-btn {
  display: inline-block;
  margin-top: 8px;
  padding: 6px 10px;
  background-color: #10B981;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: bold;
}

.chat-footer {
  padding: 10px;
  display: flex;
  gap: 6px;
  border-top: 1px solid #E2E8F0;
}

.chat-footer input {
  flex: 1;
  padding: 8px;
  border: 1px solid #CBD5E1;
  border-radius: 6px;
  font-size: 12px;
}

.chat-footer button {
  background-color: #1D53A0;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
}
</style>