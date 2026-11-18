<script setup>
import { ADICIONALES } from '../data/menu.js'
import { agregar } from '../store/cart.js'
import { avisar } from '../store/toast.js'
import MenuTabs from '../components/MenuTabs.vue'
import ProductoCard from '../components/ProductoCard.vue'
import { imgCalzone } from '../data/imagenes.js'

const secciones = [
  { titulo: 'Calzones', lista: ADICIONALES.calzones, foto: imgCalzone },
  { titulo: 'Bebidas', lista: ADICIONALES.bebidas },
]

function pedir(a, foto) {
  const ok = agregar({ clave: `ad-${a.id}`, nombre: a.nombre, detalle: '', precio: a.precio, foto, emoji: a.emoji })
  avisar(ok ? `${a.nombre} agregado` : 'El carrito está lleno')
}
</script>

<template>
  <h1 class="titulo"><em>Adicionales</em></h1>
  <MenuTabs />
  <p class="sub">Completa tu pedido.</p>
  <template v-for="s in secciones" :key="s.titulo">
    <h2 style="margin:18px 0 10px">{{ s.titulo }}</h2>
    <div class="grilla">
      <ProductoCard v-for="a in s.lista" :key="a.id" :nombre="a.nombre" :desc="a.desc" :precio="a.precio" :emoji="a.emoji" :foto="s.foto" @agregar="pedir(a, s.foto)" />
    </div>
  </template>
</template>
