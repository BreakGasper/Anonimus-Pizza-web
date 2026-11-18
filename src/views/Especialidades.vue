<script setup>
import { ref } from 'vue'
import { TAMANOS, precioPorTamano } from '../data/menu.js'
import { especialidades, precioFinal, hayPromo, fotoDe } from '../store/menu.js'
import { agregar } from '../store/cart.js'
import { avisar } from '../store/toast.js'
import Tamanos from '../components/Tamanos.vue'
import MenuTabs from '../components/MenuTabs.vue'
import ProductoCard from '../components/ProductoCard.vue'

const tamano = ref('med')
const t = () => TAMANOS.find((x) => x.id === tamano.value)

function pedir(e) {
  const tam = t()
  const ok = agregar({ clave: `esp-${e.id}-${tam.id}`, nombre: `Pizza ${e.nombre}`, detalle: `${tam.nombre} (${tam.cm})`, precio: precioPorTamano(precioFinal(e), tam), foto: e.foto || undefined, icono: e.icono })
  avisar(ok ? `${e.nombre} agregada` : 'El carrito está lleno')
}
</script>

<template>
  <h1 class="titulo">Nuestro <em>menú</em></h1>
  <MenuTabs />
  <p class="sub">Elige el tamaño y agrega tu favorita. El precio cambia según el tamaño.</p>
  <Tamanos v-model="tamano" />
  <div style="height:16px"></div>
  <p v-if="!especialidades.length" class="sub">Por ahora no hay especialidades disponibles.</p>
  <div class="grilla">
    <ProductoCard v-for="e in especialidades" :key="e.id" :nombre="e.nombre" :desc="e.desc" :precio="precioPorTamano(precioFinal(e), t())"
      :precio-original="hayPromo(e) ? precioPorTamano(e.precio, t()) : undefined" :etiqueta="hayPromo(e) ? 'Promo' : undefined" :foto="fotoDe(e)" :icono="e.icono" @agregar="pedir(e)" />
  </div>
</template>
