<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ARMA, TAMANOS, precioPorTamano, money } from '../data/menu.js'
import { recetas, fotoDe } from '../store/menu.js'
import { agregar } from '../store/cart.js'
import { avisar } from '../store/toast.js'
import Icono from '../components/Icono.vue'
import { iconoProducto } from '../utils/iconos.js'
import Tamanos from '../components/Tamanos.vue'
import PizzaPreview from '../components/PizzaPreview.vue'
import { imgIcono } from '../data/imagenes.js'

const router = useRouter()
const tamano = ref('med')
const elegidos = ref([])
const extras = ref([])
const nombre = ref('')
// Cada pizza nueva (al abrir, con una especialidad o con Sorpréndeme) se arma distinta; después los ingredientes ya puestos no se mueven.
const nuevaSemilla = () => Math.floor(Math.random() * 2 ** 31)
const semilla = ref(nuevaSemilla())


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
const vista = ref(null)
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

function quitar(ing) {
  alternar(elegidos.value, ing)
}

/* ---------- Atajos: especialidad de arranque y "Sorpréndeme" ---------- */
const reducido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
function irAPizza() {
  setTimeout(() => zona.value?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'center' }), 60)
}
function aplicar(lista) {
  elegidos.value = [...lista]
  semilla.value = nuevaSemilla()
  irAPizza()
}
function sorprender() {
  const todos = [...ARMA.verduras, ...ARMA.carnes]
  for (let i = todos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [todos[i], todos[j]] = [todos[j], todos[i]] }
  aplicar(todos.slice(0, 3 + Math.floor(Math.random() * 3)))
}
const esReceta = (e) => e.ingredientes.length === elegidos.value.length && e.ingredientes.every((i) => elegidos.value.includes(i))

/* ---------- Barra de pedido: ¿se ve la pizza? ---------- */
const pizzaVisible = ref(true)
const esEscritorio = ref(typeof matchMedia === 'function' && matchMedia('(min-width: 960px)').matches)
let vigia, mq
const alCambiarMq = (e) => (esEscritorio.value = e.matches)
onMounted(() => {
  if (typeof matchMedia === 'function') { mq = matchMedia('(min-width: 960px)'); mq.addEventListener('change', alCambiarMq) }
  if (typeof IntersectionObserver !== 'function') return
  vigia = new IntersectionObserver(([e]) => (pizzaVisible.value = e.isIntersecting), { threshold: 0.35 })
  vigia.observe(zona.value)
})
onBeforeUnmount(() => { vigia?.disconnect(); mq?.removeEventListener('change', alCambiarMq) })
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
    foto: vista.value?.instantanea() || undefined, // tu pizza tal como la armaste
  })
  if (!ok) return avisar('El carrito está lleno')
  avisar('Pizza agregada')
  router.push('/carrito')
}
</script>

<template>
  <div class="arma">
    <div class="arma-col">
      <h1 class="titulo">Arma tu <em>pizza</em></h1>
      <p class="sub">{{ money(ARMA.precioMediana) }} la mediana con {{ ARMA.incluidos }} ingredientes. Cada ingrediente extra suma {{ money(ARMA.precioExtraIngrediente) }}.</p>

      <section class="bloque">
        <h3>Empieza rápido</h3>
        <p class="desc" style="margin-bottom:8px">Toca una especialidad y ajústala a tu gusto, o deja que te sorprendamos.</p>
        <div class="rapido">
          <button v-for="e in recetas" :key="e.id" type="button" :class="['chip esp', { on: esReceta(e) }]" :aria-pressed="esReceta(e)" @click="aplicar(e.ingredientes)">
            <img v-if="fotoDe(e)" :src="fotoDe(e)" alt="" width="30" height="30" /><span v-else class="mini-emoji" aria-hidden="true"><Icono :nombre="iconoProducto(e)" :tam="20" /></span>{{ e.nombre }}
          </button>
          <button type="button" class="chip sorpresa" @click="sorprender"><Icono nombre="dado" :tam="18" class="txt" />Sorpréndeme</button>
        </div>
      </section>

      <section class="bloque">
        <h3>Tamaño</h3>
        <Tamanos v-model="tamano" />
      </section>

      <section class="bloque">
        <h3>Ingredientes</h3>
        <p class="desc" style="margin-bottom:8px">Tócalos o <b>arrástralos</b> a la pizza<span class="solo-tactil"> (mantén presionado y arrastra)</span>.</p>
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
      </section>

      <section class="bloque">
        <h3>Extras</h3>
        <div class="chips">
          <button v-for="e in ARMA.extras" :key="e.id" type="button" :class="['chip', { on: extras.includes(e.id) }]"
            :aria-pressed="extras.includes(e.id)" @click="alternar(extras, e.id)">{{ e.nombre }} (+{{ money(e.precio) }})</button>
        </div>
      </section>
    </div>

    <aside class="arma-lado">
      <h3 class="titulo-lado">Así se verá tu pizza</h3>
      <div ref="zona" :class="['zona-pizza', { activa: sobrePizza, vacia: !elegidos.length }]">
        <PizzaPreview ref="vista" :ingredientes="elegidos" :extras="extras" :tamano="tamano" :activa="sobrePizza" :semilla="semilla" />
        <p class="pie-pizza">{{ tam.nombre }} · {{ tam.cm }}</p>
        <p v-if="!elegidos.length" class="desc" style="text-align:center">Suelta aquí los ingredientes que quieras.</p>
        <div v-else class="lleva">
          <button v-for="ing in elegidos" :key="ing" type="button" class="quitar-ing" :aria-label="'Quitar ' + ing" @click="quitar(ing)">{{ ing }}<Icono nombre="cerrar" :tam="14" class="fin" /></button>
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
          <div class="precio">{{ money(precio) }}</div>
        </div>
      </div>
      <button v-if="esEscritorio" class="btn block" :disabled="!elegidos.length" @click="pedir">Agregar al carrito</button>
    </aside>
  </div>

  <div v-if="!esEscritorio && elegidos.length" class="relleno-barra"></div>
  <div v-if="!esEscritorio && elegidos.length" class="barra-pedir" role="region" aria-label="Tu pizza">
    <div class="barra-in">
      <button v-if="!pizzaVisible" type="button" class="btn claro chico" @click="irAPizza">Ver pizza<Icono nombre="flecha" :tam="16" class="fin" /></button>
      <div class="grow"><b>{{ money(precio) }}</b></div>
      <button class="btn" @click="pedir">Agregar al carrito</button>
    </div>
  </div>

  <div v-if="arrastre" class="fantasma" :style="{ left: arrastre.x + 'px', top: arrastre.y + 'px' }" aria-hidden="true">
    <img :src="imgIcono(arrastre.nombre)" alt="" width="38" height="38" />
    <span>{{ arrastre.nombre }}</span>
  </div>
</template>

<style>
.arma { display: block; }
.bloque { margin-bottom: 20px; }
.bloque h3 { margin-bottom: 8px; }
.titulo-lado { margin: 8px 0 10px; }
.paleta { margin: 0 0 10px; }
.chip.ing { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px 5px 8px; cursor: grab; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; }
.chip.ing .ico { width: 26px; height: 26px; object-fit: contain; flex: none; pointer-events: none; }
.chip.esp { display: inline-flex; align-items: center; gap: 6px; padding: 4px 14px 4px 5px; }
.chip.esp .mini-emoji { width: 30px; height: 30px; display: grid; place-items: center; font-size: 1.2rem; }
.chip.esp img { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
.chip.sorpresa { background: linear-gradient(135deg, #ff9800, #ff5722); border-color: #ff7a1a; color: #fff; font-weight: 700; }
.zona-pizza { background: linear-gradient(rgba(25,10,3,.2), rgba(25,10,3,.55)), url('/img/mesa.webp') center / cover; border: 2px solid #4a2110;
  border-radius: 20px; padding: 26px 12px 12px; margin-bottom: 14px; box-shadow: inset 0 0 40px #0008; transition: border-color .15s, box-shadow .15s; }
.zona-pizza.activa { border-color: #ff9800; box-shadow: inset 0 0 40px #0008, 0 0 0 3px #ff980066; }
.zona-pizza .desc { color: #f3dfc7; }
.pie-pizza { text-align: center; color: #f3dfc7; text-shadow: 0 1px 3px #000a; font-size: .85rem; margin: 6px 0 4px; }
.lleva { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 8px; }
.quitar-ing { border: 1px solid #ffffff55; background: #00000055; color: #fff; border-radius: 999px; padding: 6px 12px; font-size: .82rem; }
.fantasma { position: fixed; z-index: 50; transform: translate(-50%, -135%); pointer-events: none; display: flex; align-items: center; gap: 6px;
  background: #fff3e6; color: #2b1d14; border: 2px solid #ff9800; border-radius: 999px; padding: 4px 12px 4px 6px; box-shadow: 0 6px 18px #0006; font-weight: 700; font-size: .9rem; }
.relleno-barra { height: 70px; }
.barra-pedir { position: fixed; left: 0; right: 0; bottom: calc(var(--nav-h) + var(--seguro-abajo)); z-index: 25; background: rgba(28, 15, 10, .96); backdrop-filter: blur(10px);
  border-top: 1px solid var(--borde); padding: 10px 16px; box-shadow: 0 -6px 18px #0006; }
.barra-in { max-width: 760px; margin: 0 auto; display: flex; gap: 10px; align-items: center; }
.barra-in .btn { white-space: nowrap; }
.barra-in .grow b { font: 800 1.5rem var(--display); color: var(--ambar); }
.solo-tactil { display: none; }
@media (pointer: coarse) { .solo-tactil { display: inline; } }
@media (min-width: 960px) {
  .arma { display: grid; grid-template-columns: minmax(0, 1fr) 440px; gap: 36px; align-items: start; }
  .arma-lado { position: sticky; top: calc(var(--cab-h) + 16px); max-height: calc(100dvh - var(--cab-h) - 32px); overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; padding-right: 4px; }
  .zona-pizza { padding: 18px 12px 10px; margin-bottom: 10px; }
  .zona-pizza .pizza-caja { max-width: 255px; }
  .arma-lado .tarjeta { margin-bottom: 10px; padding: 12px 14px; }
  .arma-lado .campo { margin-bottom: 8px; }
}
</style>
