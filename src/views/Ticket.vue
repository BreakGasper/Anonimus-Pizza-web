<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ultimoPedido } from '../store/cart.js'
import { money } from '../data/menu.js'

const router = useRouter()
onMounted(() => { if (!ultimoPedido.value) router.replace('/') })
const fecha = (iso) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <template v-if="ultimoPedido">
    <h1 class="titulo">¡Pedido <em>recibido!</em></h1>
    <p class="sub">Gracias, {{ ultimoPedido.nombre }}. Te llevamos tu pedido en breve. Guarda este ticket.</p>

    <div class="ticket">
      <h2>ANONIMUS PIZZA</h2>
      <div style="text-align:center">Folio {{ ultimoPedido.id.slice(0, 6).toUpperCase() }} · {{ fecha(ultimoPedido.fecha) }}</div>
      <hr />
      <div v-for="(i, n) in ultimoPedido.items" :key="n" style="margin-bottom:6px">
        <div class="ln"><span>{{ i.cantidad }} × {{ i.nombre }}</span><span>{{ money(i.precio * i.cantidad) }}</span></div>
        <div v-if="i.detalle" style="color:#777;font-size:.8rem">{{ i.detalle }}</div>
      </div>
      <hr />
      <div class="ln"><b>TOTAL</b><b>{{ money(ultimoPedido.total) }}</b></div>
      <hr />
      <div>Entrega: {{ ultimoPedido.direccion }}</div>
      <div>Tel: {{ ultimoPedido.telefono }}</div>
      <div v-if="ultimoPedido.notas">Notas: {{ ultimoPedido.notas }}</div>
      <div style="margin-top:8px">Pago en efectivo al recibir.</div>
    </div>

    <router-link to="/" class="btn block" style="margin-top:16px">Volver al inicio</router-link>
  </template>
</template>
