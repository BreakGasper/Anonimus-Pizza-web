<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ultimoPedido } from '../store/cart.js'
import TicketPedido from '../components/TicketPedido.vue'

const router = useRouter()
onMounted(() => { if (!ultimoPedido.value) router.replace('/') })
</script>

<template>
  <template v-if="ultimoPedido">
    <h1 class="titulo">¡Pedido <em>recibido!</em></h1>
    <p class="sub">Gracias, {{ ultimoPedido.nombre }}. Te llevamos tu pedido en breve. Guarda este ticket.</p>

    <TicketPedido :pedido="ultimoPedido" />

    <router-link to="/perfil" class="btn block claro" style="margin-top:16px;max-width:460px;margin-inline:auto">Ver mis pedidos</router-link>
    <router-link to="/" class="btn block" style="margin-top:10px;max-width:460px;margin-inline:auto">Volver al inicio</router-link>
  </template>
</template>
