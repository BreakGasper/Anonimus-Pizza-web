<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { imgBase, urlSprites, imgAtlas, slugDe, ORDEN_CAPAS, PIEZAS } from '../data/imagenes.js'

const props = defineProps({
  ingredientes: { type: Array, default: () => [] },
  extras: { type: Array, default: () => [] }, // ids: 'salsa', 'queso'
  tamano: { type: String, default: 'med' },
  activa: { type: Boolean, default: false }, // resalta mientras se arrastra encima
})

const ESCALA = { ind: 0.68, med: 0.84, fam: 1 }
const MOVIMIENTO_REDUCIDO = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const caja = ref(null)
const lienzo = ref(null)
const listo = ref(false)

/* ---------- Recursos (se cargan una vez y se reutilizan) ---------- */
let meta = null
let imgPizza = null
const atlas = new Map() // slug -> HTMLImageElement | 'error'

function cargarImagen(url) {
  return new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url })
}
async function cargarBase() {
  try {
    const [m, im] = await Promise.all([fetch(urlSprites).then((r) => r.json()), cargarImagen(imgBase)])
    meta = m; imgPizza = im
  } catch { /* sin imágenes: se queda la pizza vacía */ }
  programar()
}
function pedirAtlas(slug) {
  if (atlas.has(slug)) return
  atlas.set(slug, null)
  cargarImagen(imgAtlas(slug)).then((i) => atlas.set(slug, i)).catch(() => atlas.set(slug, 'error')).finally(programar)
}

/* ---------- Colocación determinista de piezas ---------- */
function semilla(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
function azar(a) { return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

const cache = new Map()
// Reparte las piezas con "mejor candidato": cada nueva se coloca lejos de las anteriores, sin rejilla visible.
function colocar(slug) {
  if (cache.has(slug)) return cache.get(slug)
  const total = PIEZAS[slug], nSprites = meta.ingredientes[slug].piezas.length
  const rnd = azar(semilla(slug)), Rmax = meta.pizza.radio * 0.74
  const out = []
  for (let i = 0; i < total; i++) {
    let mejor = null, dmej = -1
    for (let c = 0; c < 14; c++) {
      const r = Rmax * Math.sqrt(rnd()), a = rnd() * Math.PI * 2
      const x = r * Math.cos(a), y = r * Math.sin(a)
      let d = Infinity
      for (const p of out) d = Math.min(d, (p.x - x) ** 2 + (p.y - y) ** 2)
      if (d > dmej) { dmej = d; mejor = { x, y } }
    }
    out.push({ ...mejor, s: Math.floor(rnd() * nSprites), rot: rnd() * Math.PI * 2, esc: 0.92 + rnd() * 0.22 })
  }
  cache.set(slug, out)
  return out
}

/* ---------- Dibujo ---------- */
const vistos = new Map() // "slug:i" -> instante en que aparece (para animar solo lo nuevo)
let raf = 0

function programar() { if (!raf) raf = requestAnimationFrame(dibujar) }

function dibujar() {
  raf = 0
  const cv = lienzo.value
  if (!cv || !meta || !imgPizza) return
  const ctx = cv.getContext('2d')
  const W = cv.width, k = W / meta.pizza.lado, ahora = performance.now()
  ctx.clearRect(0, 0, W, W)
  ctx.drawImage(imgPizza, 0, 0, W, W)

  const R = meta.pizza.radio * k, c = W / 2
  if (props.extras.includes('salsa')) {
    const g = ctx.createRadialGradient(c, c, R * 0.3, c, c, R * 0.88)
    g.addColorStop(0, 'rgba(200,40,25,0)'); g.addColorStop(1, 'rgba(200,40,25,.55)')
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(c, c, R * 0.88, 0, 7); ctx.fill(); ctx.restore()
  }
  if (props.extras.includes('queso')) {
    const g = ctx.createRadialGradient(c * 0.92, c * 0.86, 0, c, c, R * 0.88)
    g.addColorStop(0, 'rgba(255,238,160,.42)'); g.addColorStop(1, 'rgba(255,214,90,.22)')
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(c, c, R * 0.88, 0, 7); ctx.fill(); ctx.restore()
  }

  // ingredientes elegidos, en el orden de apilado
  const elegidos = ORDEN_CAPAS.filter((n) => props.ingredientes.includes(n)).map(slugDe)
  const reparto = Math.max(0.6, 1 - 0.07 * (elegidos.length - 1)) // con más ingredientes, menos piezas de cada uno
  const vigentes = new Set()
  let animando = false, pendiente = false

  ctx.save()
  ctx.shadowColor = 'rgba(40,15,5,.5)'; ctx.shadowBlur = W * 0.011; ctx.shadowOffsetY = W * 0.004
  for (const slug of elegidos) {
    pedirAtlas(slug)
    const im = atlas.get(slug)
    if (!im || im === 'error') { pendiente = pendiente || im === null; continue }
    const piezas = colocar(slug), n = Math.max(1, Math.round(PIEZAS[slug] * reparto))
    const defs = meta.ingredientes[slug].piezas
    let nuevas = 0
    for (let i = 0; i < n; i++) {
      const p = piezas[i], d = defs[p.s], clave = `${slug}:${i}`
      vigentes.add(clave)
      if (!vistos.has(clave)) vistos.set(clave, ahora + (MOVIMIENTO_REDUCIDO ? -1000 : nuevas++ * 16))
      const t = MOVIMIENTO_REDUCIDO ? 1 : Math.min(1, Math.max(0, (ahora - vistos.get(clave)) / 300))
      if (t < 1) animando = true
      if (t <= 0) continue
      const ease = 1 - (1 - t) ** 3
      ctx.save()
      ctx.globalAlpha = ease
      ctx.translate(c + p.x * k, c + p.y * k)
      ctx.rotate(p.rot)
      const e = p.esc * k * (1 + (1 - ease) * 0.5)
      ctx.scale(e, e)
      ctx.drawImage(im, d.x, d.y, d.w, d.h, -d.w / 2, -d.h / 2, d.w, d.h)
      ctx.restore()
    }
  }
  ctx.restore()
  for (const clave of vistos.keys()) if (!vigentes.has(clave)) vistos.delete(clave)

  listo.value = !pendiente && !animando
  if (animando) programar()
}

/* ---------- Tamaño del lienzo ---------- */
let observador
function ajustar() {
  const cv = lienzo.value, cj = caja.value
  if (!cv || !cj) return
  const px = Math.max(1, Math.round(cj.clientWidth * Math.min(window.devicePixelRatio || 1, 2)))
  if (cv.width !== px) { cv.width = px; cv.height = px }
  programar()
}

onMounted(() => {
  observador = new ResizeObserver(ajustar)
  observador.observe(caja.value)
  ajustar()
  cargarBase()
})
onBeforeUnmount(() => { observador?.disconnect(); cancelAnimationFrame(raf) })
watch(() => [props.ingredientes.slice(), props.extras.slice()], programar, { deep: true })
</script>

<template>
  <div ref="caja" class="pizza-caja" :class="{ activa }" :style="{ width: ESCALA[tamano] * 100 + '%' }" data-pizza
    :data-ingredientes="ingredientes.length" :data-listo="listo"
    role="img" :aria-label="ingredientes.length ? 'Tu pizza con ' + ingredientes.join(', ') : 'Tu pizza solo con queso'">
    <canvas ref="lienzo" width="10" height="10"></canvas>
  </div>
</template>

<style>
.pizza-caja { position: relative; aspect-ratio: 1; margin: 0 auto; max-width: 340px; transition: width .3s ease, filter .2s; border-radius: 50%;
  filter: drop-shadow(0 8px 10px #0005); }
.pizza-caja.activa { filter: drop-shadow(0 0 12px #ff9800) drop-shadow(0 0 4px #ff9800); }
.pizza-caja canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .pizza-caja { transition: none; } }
</style>
