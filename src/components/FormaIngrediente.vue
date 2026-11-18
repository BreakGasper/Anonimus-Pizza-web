<script setup>
// Dibuja un trozo de ingrediente centrado en (0,0), ~16 unidades de ancho.
defineProps({ nombre: { type: String, required: true } })
</script>

<template>
  <g v-if="nombre === 'Pepperoni'">
    <circle r="8" fill="#b3261e" stroke="#8e1b15" stroke-width="1" />
    <circle cx="-2.5" cy="-2" r="1.2" fill="#d9534a" /><circle cx="3" cy="2" r="1.2" fill="#d9534a" /><circle cx="1" cy="-4" r="1" fill="#d9534a" />
  </g>
  <g v-else-if="nombre === 'Jamón'">
    <rect x="-8" y="-6" width="16" height="12" rx="4" fill="#f4a6a0" stroke="#df7d75" stroke-width="1" />
  </g>
  <g v-else-if="nombre === 'Salchicha'">
    <circle r="6.5" fill="#9a5430" stroke="#6b341c" stroke-width="1.2" /><circle r="2" fill="#b86a40" />
  </g>
  <g v-else-if="nombre === 'Chorizo'">
    <circle r="6" fill="#c9501b" stroke="#8f3510" stroke-width="1" />
    <circle cx="-1.5" cy="-1.5" r="1" fill="#e9794a" /><circle cx="2" cy="2" r="1" fill="#e9794a" />
  </g>
  <g v-else-if="nombre === 'Tocino'">
    <rect x="-9" y="-3.5" width="18" height="7" rx="1.5" fill="#e58b82" />
    <rect x="-9" y="-1" width="18" height="2" fill="#f7cfc9" />
  </g>
  <g v-else-if="nombre === 'Carne molida'">
    <circle cx="-3" cy="-1" r="3" fill="#6e3d22" /><circle cx="3" cy="-2" r="2.6" fill="#7d4829" /><circle cx="0" cy="3.5" r="3" fill="#5f331b" />
  </g>
  <g v-else-if="nombre === 'Pollo'">
    <rect x="-7" y="-5" width="14" height="10" rx="3" fill="#f0dcb0" stroke="#d3b679" stroke-width="1" />
  </g>
  <g v-else-if="nombre === 'Champiñones'">
    <rect x="-2.5" y="0" width="5" height="7" rx="1.5" fill="#e8dcc6" />
    <path d="M-9 2 A9 8 0 0 1 9 2 Z" fill="#efe3d0" stroke="#cbb897" stroke-width="1" />
  </g>
  <g v-else-if="nombre === 'Pimiento'">
    <path d="M-9 4 Q0 -10 9 4" fill="none" stroke="#3e9d3e" stroke-width="3.4" stroke-linecap="round" />
  </g>
  <g v-else-if="nombre === 'Cebolla'">
    <circle r="6.5" fill="none" stroke="#c9a2dc" stroke-width="2.4" /><circle r="2.5" fill="none" stroke="#e6d3f0" stroke-width="1.6" />
  </g>
  <g v-else-if="nombre === 'Aceitunas'">
    <circle r="5.5" fill="#24262b" /><circle r="2.2" fill="#f3d36d" />
  </g>
  <g v-else-if="nombre === 'Elote'">
    <circle cx="-3" cy="-2" r="3.2" fill="#f5c60f" /><circle cx="3" cy="-1" r="3.2" fill="#f7d33a" /><circle cx="0" cy="3.5" r="3.2" fill="#f2bd00" />
  </g>
  <g v-else-if="nombre === 'Piña'">
    <path d="M-8 6 L0 -8 L8 6 Z" fill="#f9d648" stroke="#dcae22" stroke-width="1.2" stroke-linejoin="round" />
  </g>
  <g v-else-if="nombre === 'Jalapeño'">
    <circle r="5.5" fill="#bde08f" stroke="#2f8c2f" stroke-width="2.6" /><circle r="1.4" fill="#f3e9a8" />
  </g>
  <g v-else-if="nombre === 'Tomate'">
    <circle r="7" fill="#e53935" stroke="#b71c1c" stroke-width="1" /><circle r="3.2" fill="#f19393" />
  </g>
  <g v-else><circle r="5" fill="#999" /></g>
</template>
