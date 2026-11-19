<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import PizzaPreview from './PizzaPreview.vue'
import Icono from './Icono.vue'

// Ventana flotante con la pizza armándose, para verla mientras se eligen los ingredientes más abajo en la página.
// Se puede arrastrar, agrandar/reducir y ocultar; aparece cuando la pizza principal no está a la vista.
const props = defineProps({
  ingredientes: { type: Array, default: () => [] },
  extras: { type: Array, default: () => [] },
  semilla: { type: Number, default: 1 },
  visible: { type: Boolean, default: true }, // false = la pizza principal está a la vista (se esconde esta)
  activa: { type: Boolean, default: false }, // resalta mientras se arrastra un ingrediente encima
})
const emit = defineEmits(['ir'])

const modo = ref('mini') // mini | grande | oculta
const raiz = ref(null)
const ANCHO = { mini: 132, grande: 250 }
const pos = ref({ x: null, y: null })
const ancho = computed(() => ANCHO[modo.value] || 132)
const margen = 10
const ALTO_CAB = 76 // debajo de la cabecera de la tienda

function limitar(x, y) {
  const w = ancho.value, h = w + 34
  return { x: Math.min(Math.max(margen, x), Math.max(margen, innerWidth - w - margen)), y: Math.min(Math.max(ALTO_CAB - 30, y), Math.max(ALTO_CAB, innerHeight - h - 150)) }
}
function colocar() { pos.value = limitar(pos.value.x ?? innerWidth, pos.value.y ?? ALTO_CAB) }
onMounted(() => { colocar(); addEventListener('resize', colocar) })
onBeforeUnmount(() => removeEventListener('resize', colocar))

/* Arrastrar la ventana por su cabecera (no mueve la página). */
let g = null
function bajar(e) {
  if (e.target.closest('button')) return
  g = { dx: e.clientX - pos.value.x, dy: e.clientY - pos.value.y, mov: false }
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function mover(e) {
  if (!g) return
  g.mov = true
  pos.value = limitar(e.clientX - g.dx, e.clientY - g.dy)
}
function soltar() { g = null }

function alternarTam() { modo.value = modo.value === 'mini' ? 'grande' : 'mini'; colocar() }
function ocultar() { modo.value = 'oculta' }
function mostrar() { modo.value = 'mini'; colocar() }
defineExpose({ rect: () => (modo.value === 'oculta' || !props.visible ? null : raiz.value?.getBoundingClientRect() || null) })
</script>

<template>
  <div v-if="modo !== 'oculta'" ref="raiz" :class="['flota', modo, { oculta: !visible }]" :style="{ width: ancho + 'px', left: (pos.x ?? 0) + 'px', top: (pos.y ?? ALTO_CAB) + 'px' }" role="group" aria-label="Vista rápida de tu pizza" data-flotante>
    <div class="flota-cab" @pointerdown="bajar" @pointermove="mover" @pointerup="soltar" @pointercancel="soltar">
      <span class="flota-titulo"><Icono v-if="modo === 'mini'" nombre="pizza" :tam="16" /><template v-else>Tu pizza</template><b v-if="ingredientes.length" class="flota-n">{{ ingredientes.length }}</b></span>
      <button type="button" class="flota-b" :aria-label="modo === 'mini' ? 'Agrandar' : 'Reducir'" @click="alternarTam"><Icono :nombre="modo === 'mini' ? 'mas' : 'menos'" :tam="16" /></button>
      <button type="button" class="flota-b" aria-label="Ocultar la vista rápida" @click="ocultar"><Icono nombre="cerrar" :tam="16" /></button>
    </div>
    <div class="flota-pizza" aria-hidden="true">
      <PizzaPreview mini :pausado="!visible" :ingredientes="ingredientes" :extras="extras" tamano="fam" :semilla="semilla" :activa="activa" />
    </div>
    <button v-if="modo === 'grande'" type="button" class="flota-ir" @click="emit('ir')">Ver completa<Icono nombre="flecha" :tam="14" class="fin" /></button>
  </div>
  <button v-else-if="visible" type="button" class="flota-pildora" @click="mostrar"><Icono nombre="pizza" :tam="18" class="txt" />Ver mi pizza<b v-if="ingredientes.length" class="flota-n">{{ ingredientes.length }}</b></button>
</template>

<style>
.flota { position: fixed; z-index: 28; background: #1b0f0af5; border: 1.5px solid #ffc24788; border-radius: 18px; box-shadow: 0 8px 20px #000a; padding: 4px 6px 6px; overflow: hidden; box-sizing: border-box; will-change: transform;
  transition: opacity .2s, transform .2s, width .2s; touch-action: none; }
.flota.oculta { opacity: 0; transform: scale(.85); pointer-events: none; }
.flota-cab { display: flex; align-items: center; gap: 2px; min-width: 0; cursor: grab; user-select: none; -webkit-user-select: none; min-height: 32px; }
.flota-titulo { flex: 1 1 auto; min-width: 0; overflow: hidden; font: 800 .8rem var(--display); text-transform: uppercase; letter-spacing: .04em; color: var(--ambar); padding-left: 4px; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; }
.flota-n { background: var(--rojo); color: #fff; border-radius: 999px; min-width: 18px; height: 18px; padding: 0 5px; font: 700 .7rem var(--cuerpo); display: inline-grid; place-items: center; }
.flota-b { flex: none; width: 28px; height: 28px; border-radius: 50%; background: #ffffff14; border: 0; color: var(--texto); display: grid; place-items: center; }
.flota-pizza { padding: 2px 2px 0; }
.flota-ir { display: block; width: 100%; margin-top: 6px; background: var(--sup2); border: 1px solid var(--borde); color: var(--texto); border-radius: 12px; padding: 8px; font-weight: 700; font-size: .85rem; }
.flota-pildora { position: fixed; right: 12px; top: 76px; z-index: 28; display: inline-flex; align-items: center; gap: 6px; background: #1b0f0af5; border: 1.5px solid #ffc24788; color: var(--texto); border-radius: 999px; padding: 10px 14px; font-weight: 700; box-shadow: 0 6px 16px #0008; min-height: 44px; }
@media (min-width: 960px) { .flota, .flota-pildora { display: none; } }
@media (prefers-reduced-motion: reduce) { .flota { transition: none; } }
</style>
