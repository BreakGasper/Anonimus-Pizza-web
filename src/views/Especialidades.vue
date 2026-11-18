<script setup>
import { ref } from 'vue'
import { ESPECIALIDADES, TAMANOS, precioPorTamano } from '../data/menu.js'
import { agregar } from '../store/cart.js'
import { avisar } from '../store/toast.js'
import Tamanos from '../components/Tamanos.vue'
import MenuTabs from '../components/MenuTabs.vue'
import ProductoCard from '../components/ProductoCard.vue'
import { imgEspecialidad } from '../data/imagenes.js'

const tamano = ref('med')
const t = () => TAMANOS.find((x) => x.id === tamano.value)

function pedir(e) {
  const tam = t()
  const ok = agregar({ clave: `esp-${e.id}-${tam.id}`, nombre: `Pizza ${e.nombre}`, detalle: `${tam.nombre} (${tam.cm})`, precio: precioPorTamano(e.precio, tam) })
  avisar(ok ? `${e.nombre} agregada` : 'El carrito está lleno')
}
</script>

<template>
  <h1 class="titulo">Nuestro <em>menú</em></h1>
  <MenuTabs />
  <p class="sub">Elige el tamaño y agrega tu favorita. El precio cambia según el tamaño.</p>
  <Tamanos v-model="tamano" />
  <div style="height:16px"></div>
  <div class="grilla">
    <ProductoCard v-for="e in ESPECIALIDADES" :key="e.id" :nombre="e.nombre" :desc="e.desc" :precio="precioPorTamano(e.precio, t())" :foto="imgEspecialidad(e.id)" @agregar="pedir(e)" />
  </div>
</template>
