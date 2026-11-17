<script setup>
import { ref } from 'vue'
import { ESPECIALIDADES, TAMANOS, precioPorTamano, money } from '../data/menu.js'
import { agregar } from '../store/cart.js'
import { avisar } from '../store/toast.js'
import Tamanos from '../components/Tamanos.vue'

const tamano = ref('med')
const t = () => TAMANOS.find((x) => x.id === tamano.value)

function pedir(e) {
  const tam = t()
  const ok = agregar({
    clave: `esp-${e.id}-${tam.id}`,
    nombre: `Pizza ${e.nombre}`,
    detalle: `${tam.nombre} (${tam.cm})`,
    precio: precioPorTamano(e.precio, tam),
  })
  avisar(ok ? `${e.nombre} agregada` : 'El carrito está lleno')
}
</script>

<template>
  <h1 class="titulo">Especialidades</h1>
  <p class="sub">¡Elige la tuya! Los precios cambian según el tamaño.</p>
  <Tamanos v-model="tamano" />
  <div style="height:14px"></div>

  <article v-for="e in ESPECIALIDADES" :key="e.id" class="tarjeta">
    <div class="fila">
      <div class="em-gr" aria-hidden="true">{{ e.emoji }}</div>
      <div class="grow">
        <h3>{{ e.nombre }}</h3>
        <p class="desc">{{ e.desc }}</p>
      </div>
      <div style="text-align:right">
        <div class="precio">{{ money(precioPorTamano(e.precio, t())) }}</div>
        <button class="btn chico" style="margin-top:6px" @click="pedir(e)">Agregar</button>
      </div>
    </div>
  </article>
</template>
