<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ARMA, TAMANOS, precioPorTamano, money } from '../data/menu.js'
import { agregar } from '../store/cart.js'
import { avisar } from '../store/toast.js'
import Tamanos from '../components/Tamanos.vue'
import PizzaPreview from '../components/PizzaPreview.vue'
import { imgIcono } from '../data/imagenes.js'

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

/* ---------- Arrastrar ingredientes hacia la pizza ---------- */
const zona = ref(null)
const arrastre = ref(null) // { nombre, x, y } mientras se arrastra
const sobrePizza = ref(false)
let gesto = null
let ignorarClic = false
const PRESION_MS = 260 // en pantalla táctil, se mantiene presionado para arrastrar (así el dedo aún puede desplazar la página)

const dentro = (e) => {
  const r = zona.value?.getBoundingClientRect()
  return !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
}

function limpiar() {
  clearTimeout(gesto?.timer)
  gesto = null
  arrastre.value = null
  sobrePizza.value = false
  window.removeEventListener('pointermove', mover)
  window.removeEventListener('pointerup', soltar)
  window.removeEventListener('pointercancel', cancelar)
  window.removeEventListener('touchmove', evitarScroll)
}

function activar() {
  if (!gesto) return
  gesto.activo = true
  arrastre.value = { nombre: gesto.nombre, x: gesto.x, y: gesto.y }
  navigator.vibrate?.(12)
}

function empezar(e, ing) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  limpiar()
  gesto = { nombre: ing, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, tipo: e.pointerType, activo: false, timer: null }
  if (e.pointerType !== 'mouse') gesto.timer = setTimeout(activar, PRESION_MS)
  window.addEventListener('pointermove', mover)
  window.addEventListener('pointerup', soltar)
  window.addEventListener('pointercancel', cancelar)
  window.addEventListener('touchmove', evitarScroll, { passive: false })
}

function mover(e) {
  if (!gesto) return
  gesto.x = e.clientX; gesto.y = e.clientY
  const dist = Math.hypot(e.clientX - gesto.x0, e.clientY - gesto.y0)
  if (!gesto.activo) {
    if (gesto.tipo === 'mouse' && dist > 6) activar()
    else if (gesto.tipo !== 'mouse' && dist > 10) limpiar() // el usuario está desplazando la página
    return
  }
  arrastre.value = { nombre: gesto.nombre, x: e.clientX, y: e.clientY }
  sobrePizza.value = dentro(e)
  if (e.clientY > window.innerHeight - 80) window.scrollBy(0, 14) // acerca la pizza si está abajo
}

function soltar(e) {
  if (gesto?.activo) {
    ignorarClic = true
    setTimeout(() => (ignorarClic = false), 0)
    if (dentro(e)) {
      if (elegidos.value.includes(gesto.nombre)) avisar(`${gesto.nombre} ya está en tu pizza`)
      else elegidos.value.push(gesto.nombre)
    }
  }
  limpiar()
}
const cancelar = () => limpiar()
function evitarScroll(e) { if (gesto?.activo && e.cancelable) e.preventDefault() }

function clic(ing) {
  if (ignorarClic) return
  alternar(elegidos.value, ing)
}
onBeforeUnmount(limpiar)

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

  <h3 style="margin-top:18px">Ingredientes</h3>
  <p class="desc" style="margin-bottom:6px">Tócalos o <b>arrástralos</b> a la pizza <span class="solo-tactil">(mantén presionado y arrastra)</span>.</p>

  <div class="paleta" aria-label="Verduras">
    <button v-for="v in ARMA.verduras" :key="v" type="button" :class="['chip ing', { on: elegidos.includes(v) }]"
      :aria-pressed="elegidos.includes(v)" @pointerdown="empezar($event, v)" @click="clic(v)" @contextmenu.prevent>
      <img :src="imgIcono(v)" alt="" class="ico" width="26" height="26" draggable="false" />{{ v }}
    </button>
  </div>
  <div class="paleta" aria-label="Carnes">
    <button v-for="c in ARMA.carnes" :key="c" type="button" :class="['chip ing', { on: elegidos.includes(c) }]"
      :aria-pressed="elegidos.includes(c)" @pointerdown="empezar($event, c)" @click="clic(c)" @contextmenu.prevent>
      <img :src="imgIcono(c)" alt="" class="ico" width="26" height="26" draggable="false" />{{ c }}
    </button>
  </div>

  <h3>Extras</h3>
  <div class="chips">
    <button v-for="e in ARMA.extras" :key="e.id" type="button" :class="['chip', { on: extras.includes(e.id) }]"
      :aria-pressed="extras.includes(e.id)" @click="alternar(extras, e.id)">{{ e.nombre }} (+{{ money(e.precio) }})</button>
  </div>

  <h3>Así se verá tu pizza</h3>
  <div ref="zona" :class="['zona-pizza', { activa: sobrePizza, vacia: !elegidos.length }]">
    <PizzaPreview :ingredientes="elegidos" :extras="extras" :tamano="tamano" :activa="sobrePizza" />
    <p class="pie-pizza">{{ tam.nombre }} · {{ tam.cm }}</p>
    <p v-if="!elegidos.length" class="desc" style="text-align:center">Suelta aquí los ingredientes que quieras.</p>
    <div v-else class="lleva">
      <button v-for="ing in elegidos" :key="ing" type="button" class="quitar-ing" :aria-label="'Quitar ' + ing" @click="alternar(elegidos, ing)">{{ ing }} ✕</button>
    </div>
  </div>

  <label class="campo">¡Ponle un nombre! (opcional)
    <input v-model="nombre" maxlength="30" placeholder="Ej. La del jefe" />
  </label>

  <div class="tarjeta">
    <div class="fila">
      <div class="grow">
        <b>Tu pizza</b>
        <p class="desc">{{ elegidos.length ? elegidos.length + ' ingrediente(s)' : 'Elige al menos un ingrediente' }}</p>
        <p v-if="sobrantes" class="desc">{{ sobrantes }} extra(s): +{{ money(sobrantes * ARMA.precioExtraIngrediente) }}</p>
      </div>
      <div class="precio" style="font-size:1.3rem">{{ money(precio) }}</div>
    </div>
  </div>
  <button class="btn block" :disabled="!elegidos.length" @click="pedir">Agregar al carrito</button>

  <div v-if="arrastre" class="fantasma" :style="{ left: arrastre.x + 'px', top: arrastre.y + 'px' }" aria-hidden="true">
    <img :src="imgIcono(arrastre.nombre)" alt="" width="38" height="38" />
    <span>{{ arrastre.nombre }}</span>
  </div>
</template>

<style>
.paleta { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0 12px; }
.chip.ing { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px 5px 8px; cursor: grab; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; }
.chip.ing .ico { width: 26px; height: 26px; object-fit: contain; flex: none; pointer-events: none; }
.zona-pizza { background: linear-gradient(rgba(25,10,3,.18), rgba(25,10,3,.5)), url('/img/mesa.webp') center / cover; border: 2px solid #4a2110;
  border-radius: 18px; padding: 26px 12px 12px; margin-bottom: 14px; box-shadow: inset 0 0 40px #0008; transition: border-color .15s, box-shadow .15s; }
.zona-pizza.activa { border-color: #ff9800; box-shadow: inset 0 0 40px #0008, 0 0 0 3px #ff980066; }
.zona-pizza .desc { color: #f3dfc7; }
.pie-pizza { text-align: center; color: #f3dfc7; text-shadow: 0 1px 3px #000a; font-size: .85rem; margin: 6px 0 4px; }
.lleva { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 8px; }
.quitar-ing { border: 1px solid var(--linea); background: #fff; border-radius: 999px; padding: 4px 10px; font-size: .8rem; }
.fantasma { position: fixed; z-index: 50; transform: translate(-50%, -135%); pointer-events: none; display: flex; align-items: center; gap: 6px;
  background: #fff; border: 2px solid #ff9800; border-radius: 999px; padding: 4px 12px 4px 6px; box-shadow: 0 6px 18px #0004; font-weight: 600; font-size: .9rem; }
.solo-tactil { display: none; }
@media (pointer: coarse) { .solo-tactil { display: inline; } }
</style>
