<script setup>
import { computed } from 'vue'
import { imgBase, imgCapa, ORDEN_CAPAS } from '../data/imagenes.js'

const props = defineProps({
  ingredientes: { type: Array, default: () => [] },
  extras: { type: Array, default: () => [] }, // ids: 'salsa', 'queso'
  tamano: { type: String, default: 'med' },
  activa: { type: Boolean, default: false }, // resalta mientras se arrastra encima
})

const ESCALA = { ind: 0.68, med: 0.84, fam: 1 }
const capas = computed(() => ORDEN_CAPAS.filter((n) => props.ingredientes.includes(n)))
</script>

<template>
  <div class="pizza-caja" :class="{ activa }" :style="{ width: ESCALA[tamano] * 100 + '%' }" data-pizza
    role="img" :aria-label="ingredientes.length ? 'Tu pizza con ' + ingredientes.join(', ') : 'Tu pizza solo con queso'">
    <img :src="imgBase" alt="" class="pizza-base" draggable="false" />
    <div v-if="extras.includes('salsa')" class="extra-salsa"></div>
    <div v-if="extras.includes('queso')" class="extra-queso"></div>
    <TransitionGroup name="capa">
      <img v-for="n in capas" :key="n" :src="imgCapa(n)" alt="" class="capa" draggable="false" />
    </TransitionGroup>
  </div>
</template>

<style>
.pizza-caja { position: relative; aspect-ratio: 1; margin: 0 auto; max-width: 340px; transition: width .3s ease, filter .2s; border-radius: 50%;
  filter: drop-shadow(0 8px 10px #0005); }
.pizza-caja.activa { filter: drop-shadow(0 0 12px #ff9800) drop-shadow(0 0 4px #ff9800); }
.pizza-caja img { position: absolute; inset: 0; width: 100%; height: 100%; user-select: none; -webkit-user-drag: none; pointer-events: none; }
.extra-salsa, .extra-queso { position: absolute; inset: 7% 7% 7% 9%; border-radius: 50%; pointer-events: none; }
.extra-salsa { background: radial-gradient(circle, rgba(190, 30, 20, .0) 30%, rgba(190, 30, 20, .5)); mix-blend-mode: multiply; }
.extra-queso { background: radial-gradient(circle at 40% 35%, rgba(255, 244, 190, .75), rgba(255, 226, 120, .35)); mix-blend-mode: soft-light; }
.capa-enter-active { transition: opacity .3s ease, transform .3s ease; }
.capa-leave-active { transition: opacity .2s ease; }
.capa-enter-from { opacity: 0; transform: scale(1.12) rotate(6deg); }
.capa-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .capa-enter-active, .capa-leave-active, .pizza-caja { transition: none; } }
</style>
