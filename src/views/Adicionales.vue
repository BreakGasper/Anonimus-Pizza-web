<script setup>
import { ADICIONALES, money } from '../data/menu.js'
import { agregar } from '../store/cart.js'
import { avisar } from '../store/toast.js'

const secciones = [
  { titulo: 'Calzones', lista: ADICIONALES.calzones },
  { titulo: 'Bebidas', lista: ADICIONALES.bebidas },
]

function pedir(a) {
  const ok = agregar({ clave: `ad-${a.id}`, nombre: a.nombre, detalle: '', precio: a.precio })
  avisar(ok ? `${a.nombre} agregado` : 'El carrito está lleno')
}
</script>

<template>
  <h1 class="titulo">Adicionales</h1>
  <p class="sub">Completa tu pedido.</p>
  <template v-for="s in secciones" :key="s.titulo">
    <h2 style="margin:14px 0 8px">{{ s.titulo }}</h2>
    <article v-for="a in s.lista" :key="a.id" class="tarjeta">
      <div class="fila">
        <div class="em-gr" aria-hidden="true">{{ a.emoji }}</div>
        <div class="grow">
          <h3>{{ a.nombre }}</h3>
          <p class="desc">{{ a.desc }}</p>
        </div>
        <div style="text-align:right">
          <div class="precio">{{ money(a.precio) }}</div>
          <button class="btn chico" style="margin-top:6px" @click="pedir(a)">Agregar</button>
        </div>
      </div>
    </article>
  </template>
</template>
