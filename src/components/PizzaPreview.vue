<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { imgBase, urlSprites, imgAtlas, slugDe, NIVELES_CAPAS, PIEZAS } from '../data/imagenes.js'

const props = defineProps({
  ingredientes: { type: Array, default: () => [] },
  extras: { type: Array, default: () => [] }, // ids: 'salsa', 'queso'
  tamano: { type: String, default: 'med' },
  activa: { type: Boolean, default: false }, // resalta mientras se arrastra encima
  semilla: { type: Number, default: 1 }, // cada valor distinto da una pizza distinta (posiciones, giros, orden)
})

const ESCALA = { ind: 0.68, med: 0.84, fam: 1 }
const DURACION = 480
const HALO = { pepperoni: 0.5, chorizo: 0.42, salchicha: 0.3, 'salchicha-italiana': 0.36, jamon: 0.16, 'carne-molida': 0.3 }
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
// Es estable mientras no cambie la semilla: al agregar otro ingrediente, los que ya estaban no se mueven.
function colocar(slug) {
  if (cache.has(slug)) return cache.get(slug)
  const nSprites = meta.ingredientes[slug].piezas.length
  const rnd = azar(semilla(`${slug}:${props.semilla}`)), Rmax = meta.pizza.radio * 0.74
  const total = Math.round(PIEZAS[slug] * (1.2 + rnd() * 0.2)) // piezas de sobra; la cantidad mostrada varía por pizza
  const densidad = 0.82 + rnd() * 0.36
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
  out.densidad = densidad
  cache.set(slug, out)
  return out
}

// Orden de apilado al azar dentro de cada nivel (el nivel de abajo siempre queda abajo).
function ordenCapas() {
  const rnd = azar(semilla(`orden:${props.semilla}`))
  return NIVELES_CAPAS.flatMap((nivel) => {
    const a = [...nivel]
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
    return a
  })
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
  const elegidos = ordenCapas().filter((n) => props.ingredientes.includes(n)).map(slugDe)
  const reparto = Math.max(0.6, 1 - 0.07 * (elegidos.length - 1)) // con más ingredientes, menos piezas de cada uno
  const vigentes = new Set()
  let animando = false, pendiente = false
  const ALTO = W * 0.17 // desde qué altura "caen" las piezas

  ctx.save()
  for (const slug of elegidos) {
    pedirAtlas(slug)
    const im = atlas.get(slug)
    if (!im || im === 'error') { pendiente = pendiente || im === null; continue }
    const piezas = colocar(slug), n = Math.min(piezas.length, Math.max(1, Math.round(PIEZAS[slug] * piezas.densidad * reparto)))
    const defs = meta.ingredientes[slug].piezas
    let nuevas = 0
    for (let i = 0; i < n; i++) {
      const p = piezas[i], d = defs[p.s], clave = `${slug}:${i}`
      vigentes.add(clave)
      if (!vistos.has(clave)) vistos.set(clave, ahora + (MOVIMIENTO_REDUCIDO ? -1000 : Math.min(nuevas++ * 22, 520)))
      const t = MOVIMIENTO_REDUCIDO ? 1 : Math.min(1, Math.max(0, (ahora - vistos.get(clave)) / DURACION))
      if (t < 1) animando = true
      if (t <= 0) continue
      // cae (acelera), toca el queso y rebota un poquito
      const caida = Math.min(1, t / 0.7)
      let alto = ALTO * (1 - caida) ** 2
      if (t > 0.7) alto = ALTO * 0.07 * Math.sin(Math.PI * ((t - 0.7) / 0.3))
      const aterrizada = t >= 0.7 ? 1 : 0
      const e = p.esc * k * (1 + 0.16 * (1 - caida))
      const x = c + p.x * k, y = c + p.y * k

      // aceite que suelta la carne sobre el queso
      const halo = HALO[slug]
      if (halo && aterrizada) {
        const r = Math.max(d.w, d.h) * e * 0.62
        const g = ctx.createRadialGradient(x, y, r * 0.35, x, y, r)
        g.addColorStop(0, `rgba(235,125,25,${halo})`); g.addColorStop(1, 'rgba(235,125,25,0)')
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore()
      }

      ctx.save()
      ctx.globalAlpha = Math.min(1, t / 0.25)
      ctx.shadowColor = 'rgba(40,15,5,.5)'
      ctx.shadowBlur = W * 0.011 + alto * 0.14
      ctx.shadowOffsetY = W * 0.004 + alto * 0.55 // la sombra se queda en el queso mientras la pieza baja
      ctx.translate(x, y - alto)
      ctx.rotate(p.rot)
      ctx.scale(e, e)
      ctx.drawImage(im, d.x, d.y, d.w, d.h, -d.w / 2, -d.h / 2, d.w, d.h)
      ctx.restore()
    }
  }
  ctx.restore()

  // luz de horno: tono cálido, brillo del queso derretido y borde más oscuro para dar volumen
  if (elegidos.length || props.extras.length) {
    ctx.save()
    ctx.beginPath(); ctx.arc(c, c, R * 0.995, 0, 7); ctx.clip()
    let g = ctx.createRadialGradient(c * 0.85, c * 0.78, 0, c, c, R)
    g.addColorStop(0, 'rgba(255,214,150,.42)'); g.addColorStop(1, 'rgba(255,150,60,.16)')
    ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, W)
    g = ctx.createRadialGradient(c, c, R * 0.55, c, c, R)
    g.addColorStop(0, 'rgba(110,45,5,0)'); g.addColorStop(1, 'rgba(110,45,5,.30)')
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, W)
    g = ctx.createRadialGradient(c * 0.72, c * 0.62, 0, c * 0.72, c * 0.62, R * 0.5)
    g.addColorStop(0, 'rgba(255,255,255,.20)'); g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, W)
    ctx.restore()
  }
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
// Pizza nueva: se vuelve a repartir todo y las piezas caen otra vez.
watch(() => props.semilla, () => { cache.clear(); vistos.clear(); programar() })
</script>

<template>
  <div ref="caja" class="pizza-caja" :class="{ activa }" :style="{ width: ESCALA[tamano] * 100 + '%' }" data-pizza
    :data-ingredientes="ingredientes.length" :data-listo="listo"
    role="img" :aria-label="ingredientes.length ? 'Tu pizza con ' + ingredientes.join(', ') : 'Tu pizza solo con queso'">
    <canvas ref="lienzo" width="10" height="10"></canvas>
    <div v-if="ingredientes.length" class="vapor" aria-hidden="true"><i></i><i></i><i></i></div>
  </div>
</template>

<style>
.pizza-caja { position: relative; aspect-ratio: 1; margin: 0 auto; max-width: 340px; transition: width .3s ease, filter .2s; border-radius: 50%;
  filter: drop-shadow(0 14px 14px #000a); }
.pizza-caja.activa { filter: drop-shadow(0 0 14px #ff9800) drop-shadow(0 0 5px #ff9800); }
.vapor { position: absolute; left: 18%; right: 18%; top: -16%; height: 46%; pointer-events: none; }
.vapor i { position: absolute; bottom: 0; width: 40%; height: 75%; border-radius: 50%; opacity: 0; filter: blur(9px);
  background: radial-gradient(closest-side, rgba(255,255,255,.38), rgba(255,255,255,0)); animation: sube 4s ease-out infinite; }
.vapor i:nth-child(1) { left: 0; } .vapor i:nth-child(2) { left: 30%; animation-delay: 1.3s; } .vapor i:nth-child(3) { left: 60%; animation-delay: 2.6s; }
@keyframes sube { 0% { opacity: 0; transform: translateY(30%) scale(.7); } 25% { opacity: .75; } 100% { opacity: 0; transform: translateY(-75%) scale(1.35); } }
.pizza-caja canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .pizza-caja { transition: none; } .vapor { display: none; } }
</style>
