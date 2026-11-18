<script setup>
import { computed } from 'vue'
import { money } from '../data/menu.js'

const props = defineProps({ pedido: { type: Object, required: true } })
const fecha = computed(() => {
  const f = props.pedido.fecha ? new Date(props.pedido.fecha) : null
  return f && !isNaN(f) ? f.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : ''
})
</script>

<template>
  <div class="ticket">
    <h2>ANONIMUS PIZZA</h2>
    <div style="text-align:center">Folio {{ pedido.id.slice(0, 6).toUpperCase() }}<template v-if="fecha"> · {{ fecha }}</template></div>
    <hr />
    <div v-for="(i, n) in pedido.items" :key="n" style="margin-bottom:6px">
      <div class="ln"><span>{{ i.cantidad }} × {{ i.nombre }}</span><span>{{ money(i.precio * i.cantidad) }}</span></div>
      <div v-if="i.detalle" style="color:#777;font-size:.8rem">{{ i.detalle }}</div>
    </div>
    <hr />
    <div class="ln"><b>TOTAL</b><b>{{ money(pedido.total) }}</b></div>
    <hr />
    <div>Entrega: {{ pedido.direccion }}</div>
    <div>Tel: {{ pedido.telefono }}</div>
    <div v-if="pedido.notas">Notas: {{ pedido.notas }}</div>
    <div style="margin-top:8px">Pago en efectivo al recibir.</div>
  </div>
</template>
