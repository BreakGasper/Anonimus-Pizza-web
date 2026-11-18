<script setup>
import { paquetes, precioFinal, hayPromo, fotoDe } from '../store/menu.js'
import { agregar } from '../store/cart.js'
import { avisar } from '../store/toast.js'
import MenuTabs from '../components/MenuTabs.vue'
import ProductoCard from '../components/ProductoCard.vue'

function pedir(p) {
  const ok = agregar({ clave: `paq-${p.id}`, nombre: p.nombre, detalle: p.desc, precio: precioFinal(p), foto: p.foto || undefined, emoji: p.emoji })
  avisar(ok ? `${p.nombre} agregado` : 'El carrito está lleno')
}
</script>

<template>
  <h1 class="titulo">Paquetes y <em>promos</em></h1>
  <MenuTabs />
  <p class="sub">¡Busca la mejor promo para ti!</p>
  <p v-if="!paquetes.length" class="sub">Por ahora no hay paquetes disponibles.</p>
  <div class="grilla">
    <ProductoCard v-for="p in paquetes" :key="p.id" :nombre="p.nombre" :desc="p.desc" :precio="precioFinal(p)" :precio-original="hayPromo(p) ? p.precio : undefined"
      :foto="fotoDe(p)" :emoji="p.emoji" etiqueta="Promo" @agregar="pedir(p)" />
  </div>
</template>
