<script setup>
import { PAQUETES, money } from '../data/menu.js'
import { agregar } from '../store/cart.js'
import { avisar } from '../store/toast.js'

function pedir(p) {
  const ok = agregar({ clave: `paq-${p.id}`, nombre: p.nombre, detalle: p.desc, precio: p.precio })
  avisar(ok ? `${p.nombre} agregado` : 'El carrito está lleno')
}
</script>

<template>
  <h1 class="titulo">Paquetes y promos</h1>
  <p class="sub">¡Busca la mejor promo para ti!</p>
  <article v-for="p in PAQUETES" :key="p.id" class="tarjeta">
    <div class="fila">
      <div class="em-gr" aria-hidden="true">{{ p.emoji }}</div>
      <div class="grow">
        <h3>{{ p.nombre }}</h3>
        <p class="desc">{{ p.desc }}</p>
      </div>
      <div style="text-align:right">
        <div class="precio">{{ money(p.precio) }}</div>
        <button class="btn chico" style="margin-top:6px" @click="pedir(p)">Agregar</button>
      </div>
    </div>
  </article>
</template>
