<script setup>
import { computed } from 'vue'
import FormaIngrediente from './FormaIngrediente.vue'

const props = defineProps({
  ingredientes: { type: Array, default: () => [] },
  extras: { type: Array, default: () => [] }, // ids: 'salsa', 'queso'
  tamano: { type: String, default: 'med' },
  activa: { type: Boolean, default: false }, // resalta mientras se arrastra encima
})

const ESCALA = { ind: 0.68, med: 0.84, fam: 1 }

// Generador determinista: la misma pizza se ve igual en cada render.
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
function azar(semilla) { let a = semilla; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

const piezas = computed(() => {
  const n = props.ingredientes.length
  const cuantas = n <= 3 ? 10 : n <= 6 ? 8 : 6
  const out = []
  props.ingredientes.forEach((nombre) => {
    const r = azar(hash(nombre))
    const giro = r() * 6.28
    for (let k = 0; k < cuantas; k++) {
      const radio = 98 * Math.sqrt((k + 0.5) / cuantas) + (r() - 0.5) * 8
      const ang = k * 2.39996 + giro
      out.push({
        clave: `${nombre}-${k}`, nombre,
        x: 150 + radio * Math.cos(ang), y: 150 + radio * Math.sin(ang),
        giro: Math.round(r() * 360), esc: 0.9 + r() * 0.25,
      })
    }
  })
  return out
})

const manchas = computed(() => {
  const r = azar(7)
  return Array.from({ length: 14 }, (_, k) => {
    const rad = 96 * Math.sqrt((k + 0.5) / 14), a = k * 2.39996
    return { x: 150 + rad * Math.cos(a), y: 150 + rad * Math.sin(a), r: 9 + r() * 8 }
  })
})

const masQueso = computed(() => props.extras.includes('queso'))
const masSalsa = computed(() => props.extras.includes('salsa'))
</script>

<template>
  <div class="pizza-caja" :class="{ activa }" :style="{ width: ESCALA[tamano] * 100 + '%' }" data-pizza>
    <svg viewBox="0 0 300 300" role="img" :aria-label="ingredientes.length ? 'Tu pizza con ' + ingredientes.join(', ') : 'Tu pizza sin ingredientes'">
      <ellipse cx="152" cy="158" rx="142" ry="140" fill="#000" opacity=".12" />
      <circle cx="150" cy="150" r="142" fill="#d89b4f" />
      <circle cx="150" cy="150" r="134" fill="#e8b568" />
      <circle cx="150" cy="150" r="122" :fill="masSalsa ? '#a8180f' : '#c0392b'" />
      <path v-if="masSalsa" d="M60 150 Q150 90 240 150 M70 190 Q150 130 230 190 M95 105 Q150 160 205 105" fill="none" stroke="#7d0f08" stroke-width="3" opacity=".5" />
      <circle cx="150" cy="150" :r="masSalsa ? 108 : 116" :fill="masQueso ? '#ffe28a' : '#f7d77c'" />
      <g opacity=".55"><circle v-for="(m, i) in manchas" :key="i" :cx="m.x" :cy="m.y" :r="m.r" :fill="masQueso ? '#fff1b8' : '#fbe7a0'" /></g>
      <g v-if="masQueso" opacity=".7" fill="none" stroke="#fff6cf" stroke-width="2.4" stroke-linecap="round">
        <path d="M95 120 q20 -14 40 0 t40 0" /><path d="M100 170 q22 -14 44 0 t44 0" /><path d="M120 95 q16 12 0 28" />
      </g>
      <g v-for="p in piezas" :key="p.clave" :transform="`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`">
        <g class="pieza" :style="{ '--giro': p.giro + 'deg', '--esc': p.esc }"><FormaIngrediente :nombre="p.nombre" /></g>
      </g>
    </svg>
  </div>
</template>

<style>
.pizza-caja { margin: 0 auto; max-width: 300px; transition: width .3s ease, filter .2s; border-radius: 50%; }
.pizza-caja svg { display: block; width: 100%; height: auto; }
.pizza-caja.activa { filter: drop-shadow(0 0 10px #ff9800) drop-shadow(0 0 4px #ff9800); }
.pieza { transform: rotate(var(--giro)) scale(var(--esc)); transform-box: fill-box; transform-origin: center; animation: aparece .28s ease-out; }
@keyframes aparece { from { opacity: 0; transform: rotate(var(--giro)) scale(2.2); } to { opacity: 1; transform: rotate(var(--giro)) scale(var(--esc)); } }
@media (prefers-reduced-motion: reduce) { .pieza { animation: none; } .pizza-caja { transition: none; } }
</style>
