<script setup>
// Íconos de línea sencillos (24x24).
defineProps({ nombre: { type: String, required: true }, tam: { type: Number, default: 24 } })
const RUTAS = {
  inicio: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  carta: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 8h6M9 12h6M9 16h4',
  pizza: 'M12 3 4 19c5.3 3 10.7 3 16 0L12 3zM10 12h.01M14.5 15h.01M12 8h.01M9 16h.01',
  promo: 'M20 12v8H4v-8M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  carrito: 'M3 4h2l2.4 11h10.2L20 7H6M9.5 20.5h.01M17 20.5h.01',
  mas: 'M12 5v14M5 12h14',
  usuario: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  menos: 'M5 12h14',
  basura: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3',
  flecha: 'M12 5v14M6 13l6 6 6-6',
}
</script>

<template>
  <svg :width="tam" :height="tam" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="RUTAS[nombre]" />
  </svg>
</template>
