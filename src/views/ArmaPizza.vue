<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ARMA, TAMANOS, precioPorTamano, money } from '../data/menu.js'
import { agregar } from '../store/cart.js'
import { avisar } from '../store/toast.js'
import Tamanos from '../components/Tamanos.vue'

const router = useRouter()
const tamano = ref('med')
const elegidos = ref([])
const extras = ref([])
const nombre = ref('')

const tam = computed(() => TAMANOS.find((x) => x.id === tamano.value))
const sobrantes = computed(() => Math.max(0, elegidos.value.length - ARMA.incluidos))
const precio = computed(() =>
  precioPorTamano(ARMA.precioMediana, tam.value) +
  sobrantes.value * ARMA.precioExtraIngrediente +
  ARMA.extras.filter((e) => extras.value.includes(e.id)).reduce((s, e) => s + e.precio, 0))

// En la plantilla las refs llegan desenvueltas, así que recibe el arreglo reactivo directamente.
function alternar(lista, valor) {
  const i = lista.indexOf(valor)
  if (i >= 0) lista.splice(i, 1)
  else lista.push(valor)
}

function pedir() {
  if (!elegidos.value.length) return
  const extrasTxt = ARMA.extras.filter((e) => extras.value.includes(e.id)).map((e) => e.nombre)
  const detalle = `${tam.value.nombre} · ${elegidos.value.join(', ')}` + (extrasTxt.length ? ` · ${extrasTxt.join(', ')}` : '')
  const ok = agregar({
    clave: `arma-${Date.now()}`,
    nombre: nombre.value.trim() ? `Pizza "${nombre.value.trim().slice(0, 30)}"` : 'Pizza armada',
    detalle,
    precio: precio.value,
  })
  if (!ok) return avisar('El carrito está lleno')
  avisar('Pizza agregada')
  router.push('/carrito')
}
</script>

<template>
  <h1 class="titulo">Arma tu pizza</h1>
  <p class="sub">{{ money(ARMA.precioMediana) }} la mediana con {{ ARMA.incluidos }} ingredientes. Cada ingrediente extra suma {{ money(ARMA.precioExtraIngrediente) }}.</p>

  <h3>Tamaño</h3>
  <Tamanos v-model="tamano" />

  <h3 style="margin-top:18px">Verduras</h3>
  <div class="chips">
    <button v-for="v in ARMA.verduras" :key="v" type="button" :class="['chip', { on: elegidos.includes(v) }]"
      :aria-pressed="elegidos.includes(v)" @click="alternar(elegidos, v)">{{ v }}</button>
  </div>

  <h3>Carnes</h3>
  <div class="chips">
    <button v-for="c in ARMA.carnes" :key="c" type="button" :class="['chip', { on: elegidos.includes(c) }]"
      :aria-pressed="elegidos.includes(c)" @click="alternar(elegidos, c)">{{ c }}</button>
  </div>

  <h3>Ingredientes extra</h3>
  <div class="chips">
    <button v-for="e in ARMA.extras" :key="e.id" type="button" :class="['chip', { on: extras.includes(e.id) }]"
      :aria-pressed="extras.includes(e.id)" @click="alternar(extras, e.id)">{{ e.nombre }} (+{{ money(e.precio) }})</button>
  </div>

  <label class="campo">¡Ponle un nombre! (opcional)
    <input v-model="nombre" maxlength="30" placeholder="Ej. La del jefe" />
  </label>

  <div class="tarjeta">
    <div class="fila">
      <div class="grow">
        <b>Tu pizza</b>
        <p class="desc">{{ elegidos.length ? elegidos.join(', ') : 'Elige al menos un ingrediente' }}</p>
        <p v-if="sobrantes" class="desc">{{ sobrantes }} ingrediente(s) extra: +{{ money(sobrantes * ARMA.precioExtraIngrediente) }}</p>
      </div>
      <div class="precio" style="font-size:1.3rem">{{ money(precio) }}</div>
    </div>
  </div>
  <button class="btn block" :disabled="!elegidos.length" @click="pedir">Agregar al carrito</button>
</template>
