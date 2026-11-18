<script setup>
import { PAQUETES } from '../data/menu.js'
import { agregar } from '../store/cart.js'
import { avisar } from '../store/toast.js'
import MenuTabs from '../components/MenuTabs.vue'
import ProductoCard from '../components/ProductoCard.vue'
import { imgEspecialidad } from '../data/imagenes.js'

function pedir(p) {
  const ok = agregar({ clave: `paq-${p.id}`, nombre: p.nombre, detalle: p.desc, precio: p.precio, foto: imgEspecialidad(p.fotoEsp), emoji: p.emoji })
  avisar(ok ? `${p.nombre} agregado` : 'El carrito está lleno')
}
</script>

<template>
  <h1 class="titulo">Paquetes y <em>promos</em></h1>
  <MenuTabs />
  <p class="sub">¡Busca la mejor promo para ti!</p>
  <div class="grilla">
    <ProductoCard v-for="p in PAQUETES" :key="p.id" :nombre="p.nombre" :desc="p.desc" :precio="p.precio" :emoji="p.emoji" etiqueta="Promo" @agregar="pedir(p)" />
  </div>
</template>
