<script setup>
import { secciones, precioFinal, hayPromo, fotoDe } from '../store/menu.js'
import { TITULOS_CATEGORIA } from '../data/menu.js'
import { agregar } from '../store/cart.js'
import { avisar } from '../store/toast.js'
import MenuTabs from '../components/MenuTabs.vue'
import ProductoCard from '../components/ProductoCard.vue'

function pedir(a) {
  const ok = agregar({ clave: `ad-${a.id}`, nombre: a.nombre, detalle: '', precio: precioFinal(a), foto: fotoDe(a) || undefined, emoji: a.emoji })
  avisar(ok ? `${a.nombre} agregado` : 'El carrito está lleno')
}
</script>

<template>
  <h1 class="titulo"><em>Adicionales</em></h1>
  <MenuTabs />
  <p class="sub">Completa tu pedido.</p>
  <p v-if="!secciones.length" class="sub">Por ahora no hay adicionales disponibles.</p>
  <template v-for="s in secciones" :key="s.categoria">
    <h2 style="margin:18px 0 10px">{{ TITULOS_CATEGORIA[s.categoria] }}</h2>
    <div class="grilla">
      <ProductoCard v-for="a in s.lista" :key="a.id" :nombre="a.nombre" :desc="a.desc" :precio="precioFinal(a)" :precio-original="hayPromo(a) ? a.precio : undefined"
        :etiqueta="hayPromo(a) ? 'Promo' : undefined" :foto="fotoDe(a)" :emoji="a.emoji" @agregar="pedir(a)" />
    </div>
  </template>
</template>
