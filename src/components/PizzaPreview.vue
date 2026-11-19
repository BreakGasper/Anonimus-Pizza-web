<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { imgBase, urlSprites, imgAtlas, slugDe, NIVELES_CAPAS, PIEZAS } from '../data/imagenes.js'
import { ingredientes as listaIng, imagenesIng, porNombre, esDeFabrica } from '../store/ingredientes.js'

const props = defineProps({
  ingredientes: { type: Array, default: () => [] },
  extras: { type: Array, default: () => [] }, // ids: 'salsa', 'queso'
  tamano: { type: String, default: 'med' },
  activa: { type: Boolean, default: false }, // resalta mientras se arrastra encima
  semilla: { type: Number, default: 1 }, // cada valor distinto da una pizza distinta (posiciones, giros, orden)
  // Ingredientes de prueba (editor del panel, sin guardar): { ing: {id, nombre, tipo, piezas, tam}, url?: imagen } que reemplazan al guardado con el mismo id.
  borradores: { type: Array, default: () => [] },
  pausado: { type: Boolean, default: false }, // no dibuja (ventana flotante escondida)
  mini: { type: Boolean, default: false }, // ventana flotante: ocupa todo su contenedor, sin vapor ni marcas de la pizza principal
})

const ESCALA = { ind: 0.68, med: 0.84, fam: 1 }
const DURACION = 480
// Cada ingrediente lleva siempre la misma cantidad (así los que ya cayeron no cambian al agregar otros).
const ESCASEZ = 0.8
const HALO = { pepperoni: 0.5, chorizo: 0.42, salchicha: 0.3, 'salchicha-italiana': 0.36, jamon: 0.16, 'carne-molida': 0.3 }
const MOVIMIENTO_REDUCIDO = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// Lista efectiva: la guardada, con los borradores encima.
const ingEfectivos = computed(() => [...listaIng.value.filter((i) => !props.borradores.some((b) => b.ing.id === i.id)), ...props.borradores.map((b) => b.ing)])
let ultimaBorrador = null // última imagen de borrador ya cargada (evita parpadeos mientras carga la siguiente)

const caja = ref(null)
const lienzo = ref(null)
const listo = ref(false)

/* ---------- Recursos (se cargan una vez y se reutilizan) ---------- */
let meta = null
let imgPizza = null
const atlas = new Map() // clave -> HTMLImageElement | 'error'

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
function pedirAtlas(clave, url) {
  if (atlas.has(clave)) return
  atlas.set(clave, null)
  cargarImagen(url).then((i) => atlas.set(clave, i)).catch(() => atlas.set(clave, 'error')).finally(programar)
}

/* Un ingrediente de fábrica usa sus piezas recortadas (atlas); si el panel le puso foto, o es uno nuevo, se usa esa imagen
   (con fondo transparente) como única pieza, girada y a distinto tamaño en cada lugar. */
const LADO_PIEZA = 110 // tamaño por defecto de una pieza propia, en las unidades de la pizza (lado 965)
function recursoDe(ing) {
  const bor = props.borradores.find((b) => b.ing.id === ing.id)
  if (bor?.url) return { clave: `propia:borrador:${bor.url.length}:${bor.url.slice(-16)}`, url: bor.url, propia: true, borrador: true }
  const propia = imagenesIng.value[ing.id]
  if (propia) return { clave: `propia:${ing.id}:${propia.length}:${propia.slice(-16)}`, url: propia, propia: true }
  if (esDeFabrica(ing.id)) return { clave: ing.id, url: imgAtlas(ing.id), propia: false }
  return null // ingrediente nuevo sin imagen: no se dibuja
}
function piezasDe(ing, r, im) {
  if (!r.propia) return meta.ingredientes[ing.id].piezas
  const lado = ing.tam || LADO_PIEZA, k = lado / Math.max(im.naturalWidth, im.naturalHeight)
  return [{ x: 0, y: 0, w: im.naturalWidth, h: im.naturalHeight, dw: im.naturalWidth * k, dh: im.naturalHeight * k }]
}
const cantidadBase = (ing, r) => (r.propia ? (ing.piezas || (ing.tipo === 'carne' ? 16 : 20)) : (ing.piezas || PIEZAS[ing.id]))

/* ---------- Colocación determinista de piezas ---------- */
function semilla(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
function azar(a) { return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

const cache = new Map()
// Reparte las piezas con "mejor candidato": cada nueva se coloca lejos de las anteriores, sin rejilla visible.
// Es estable mientras no cambie la semilla: al agregar otro ingrediente, los que ya estaban no se mueven.
function colocar(slug, nSprites, base) {
  if (cache.has(slug) && cache.get(slug).base === base) return cache.get(slug)
  const rnd = azar(semilla(`${slug}:${props.semilla}`)), Rmax = meta.pizza.radio * 0.74
  const total = Math.round(base * (1.2 + rnd() * 0.2)) // piezas de sobra; la cantidad mostrada varía por pizza
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
  out.base = base
  cache.set(slug, out)
  return out
}

// Orden de apilado al azar dentro de cada nivel (el nivel de abajo siempre queda abajo).
// Los ingredientes nuevos entran en el nivel que les toca por su tipo (carne: medio; verdura: arriba) y siempre después de los de fábrica.
function ordenCapas() {
  const rnd = azar(semilla(`orden:${props.semilla}`))
  const nuevos = ingEfectivos.value.filter((i) => !esDeFabrica(i.id)).sort((a, b) => (a.id < b.id ? -1 : 1))
  return NIVELES_CAPAS.flatMap((nivel, n) => {
    const a = [...nivel.map((nombre) => ingEfectivos.value.find((i) => i.id === slugDe(nombre))).filter(Boolean),
      ...nuevos.filter((i) => (i.tipo === 'carne' ? 1 : 2) === n)]
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
  if (props.pausado) return // ventana flotante escondida: no se gasta nada; al mostrarse se dibuja de una vez
  const { animando, pendiente } = pintar(cv.getContext('2d'), cv.width, false)
  saltarAnimacion = false
  listo.value = !pendiente && !animando
  if (animando) programar()
}

/* ---------- Salsa y queso extra: bordes ondulados, no un círculo perfecto ---------- */
// Cada pizza (semilla) tiene su propio contorno: varias ondas suaves + unos bultos (como salsa o queso derretido que se extiende).
const contornos = new Map()
function radios(tipo) {
  const clave = `${tipo}:${props.semilla}`
  if (contornos.has(clave)) return contornos.get(clave)
  const rnd = azar(semilla(`contorno:${clave}`)), N = 140, TAU = Math.PI * 2
  const ondas = [[3, 0.035 + rnd() * 0.03], [5, 0.03 + rnd() * 0.025], [8, 0.02 + rnd() * 0.02], [13, 0.012 + rnd() * 0.012]].map(([n, a]) => ({ n, a, f: rnd() * TAU }))
  const bultos = Array.from({ length: 4 + Math.floor(rnd() * 3) }, () => ({ a: rnd() * TAU, h: (rnd() < 0.55 ? 1 : -1) * (0.04 + rnd() * 0.07), w: 0.16 + rnd() * 0.24 }))
  const out = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const th = (i / N) * TAU
    let r = 1
    for (const o of ondas) r += o.a * Math.sin(o.n * th + o.f)
    for (const b of bultos) { let d = Math.abs(th - b.a); d = Math.min(d, TAU - d); r += b.h * Math.exp(-((d / b.w) ** 2)) }
    out[i] = r
  }
  contornos.set(clave, out)
  return out
}
function trazarOndulado(ctx, cx, cy, R, rs) {
  const N = rs.length, TAU = Math.PI * 2
  const pt = (i) => { const th = ((i % N) / N) * TAU, r = R * rs[i % N]; return [cx + r * Math.cos(th), cy + r * Math.sin(th)] }
  ctx.beginPath()
  const [x0, y0] = pt(0), [x1, y1] = pt(1)
  ctx.moveTo((x0 + x1) / 2, (y0 + y1) / 2)
  for (let i = 1; i <= N; i++) { const [a, b] = pt(i), [c2, d] = pt(i + 1); ctx.quadraticCurveTo(a, b, (a + c2) / 2, (b + d) / 2) }
  ctx.closePath()
}
function extrasOndulados(ctx, c, R) {
  if (props.extras.includes('salsa')) {
    const rs = radios('salsa'), Rs = R * 0.86
    ctx.save(); ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = 'rgba(190,35,20,.16)'; trazarOndulado(ctx, c, c, Rs * 1.035, rs); ctx.fill() // orilla fina de salsa que se escurre
    const g = ctx.createRadialGradient(c, c, Rs * 0.25, c, c, Rs)
    g.addColorStop(0, 'rgba(200,40,25,.05)'); g.addColorStop(0.7, 'rgba(200,40,25,.32)'); g.addColorStop(1, 'rgba(185,30,18,.55)')
    ctx.fillStyle = g; trazarOndulado(ctx, c, c, Rs, rs); ctx.fill()
    ctx.restore()
  }
  if (props.extras.includes('queso')) {
    const rs = radios('queso'), Rq = R * 0.86
    ctx.save(); ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = 'rgba(255,224,120,.10)'; trazarOndulado(ctx, c, c, Rq * 1.03, rs); ctx.fill()
    const g = ctx.createRadialGradient(c * 0.92, c * 0.86, 0, c, c, Rq)
    g.addColorStop(0, 'rgba(255,238,160,.42)'); g.addColorStop(1, 'rgba(255,214,90,.24)')
    ctx.fillStyle = g; trazarOndulado(ctx, c, c, Rq, rs); ctx.fill()
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(255,236,170,.22)'; ctx.lineWidth = Math.max(1, R * 0.012); trazarOndulado(ctx, c, c, Rq, rs); ctx.stroke()
    ctx.restore()
  }
}

/* ---------- Capa guardada: lo que ya cayó no se vuelve a dibujar en cada cuadro ---------- */
// Con muchos ingredientes (≈250 piezas con sombra) redibujarlo todo en cada cuadro de la animación se volvía lento en el teléfono.
// Se guarda en un lienzo aparte la pizza con las piezas ya asentadas y en cada cuadro solo se dibujan encima las que están cayendo.
const capa = { cv: null, firma: '', claves: new Set(), partes: new Map() } // partes: ingrediente → lo que afecta a cómo se ven sus piezas
let saltarAnimacion = false // al volver a mostrarse (ventana flotante pausada), lo que cambió mientras tanto aparece sin caer otra vez

function dibujarPieza(ctx, W, p) {
  const { ing, rec, im, d, x, y, alto, t, aterrizada, e, halo, dw, dh } = p
  // aceite que suelta la carne sobre el queso
  if (halo && aterrizada) {
    const r = Math.max(dw, dh) * e * 0.62
    const g = ctx.createRadialGradient(x, y, r * 0.35, x, y, r)
    g.addColorStop(0, `rgba(235,125,25,${halo})`); g.addColorStop(1, 'rgba(235,125,25,0)')
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore()
  }
  ctx.save()
  ctx.globalAlpha = Math.min(1, t / 0.25)
  ctx.shadowColor = 'rgba(40,15,5,.5)'
  ctx.shadowBlur = props.mini ? 0 : W * 0.011 + alto * 0.14 // sin desenfoque en la ventana flotante (mucho más rápido)
  ctx.shadowOffsetY = W * 0.004 + alto * 0.55 // la sombra se queda en el queso mientras la pieza baja
  ctx.translate(x, y - alto)
  ctx.rotate(p.p.rot)
  ctx.scale(e, e)
  ctx.drawImage(im, d.x, d.y, d.w, d.h, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()
}

function luzDeHorno(ctx, W, c, R) {
  // tono cálido, brillo del queso derretido y borde más oscuro para dar volumen
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

// Pizza + salsa/queso extra + piezas (en el orden de apilado) + luz de horno.
function escena(ctx, W, c, R, piezas, hayAlgo) {
  ctx.clearRect(0, 0, W, W)
  ctx.drawImage(imgPizza, 0, 0, W, W)
  extrasOndulados(ctx, c, R)
  for (const p of piezas) dibujarPieza(ctx, W, p)
  if (hayAlgo) luzDeHorno(ctx, W, c, R)
}

// Dibuja la pizza. Con `final` no anima ni toca el estado de la animación (sirve para la miniatura del carrito).
function pintar(ctx, W, final) {
  const k = W / meta.pizza.lado, ahora = performance.now(), c = W / 2, R = meta.pizza.radio * k
  const elegidos = ordenCapas().filter((i) => props.ingredientes.includes(i.nombre))
  const vigentes = new Set()
  const usadosBorrador = new Set()
  let animando = false, pendiente = false
  const ALTO = W * 0.17 // desde qué altura "caen" las piezas
  const piezasVivas = [] // en orden de apilado, solo las que ya se ven (t > 0)
  const firma = [W, props.extras.join(','), props.semilla, props.mini ? 1 : 0, elegidos.length ? 1 : 0]
  const partes = new Map()

  for (const ing of elegidos) {
    const rec = recursoDe(ing)
    if (!rec) continue
    const slug = ing.id
    pedirAtlas(rec.clave, rec.url)
    if (rec.borrador) usadosBorrador.add(rec.clave)
    let im = atlas.get(rec.clave)
    if (rec.borrador) { if (im && im !== 'error') ultimaBorrador = im; else if (ultimaBorrador) im = ultimaBorrador }
    if (!im || im === 'error') { pendiente = pendiente || im === null; continue }
    const defs = piezasDe(ing, rec, im), base = cantidadBase(ing, rec)
    partes.set(slug, `${rec.clave}|${ing.tam}|${base}`)
    const piezas = colocar(`${slug}:${rec.propia ? 'p' : 'f'}`, defs.length, base), n = Math.min(piezas.length, Math.max(1, Math.round(base * piezas.densidad * ESCASEZ)))
    const halo = rec.propia ? (ing.tipo === 'carne' ? 0.25 : 0) : HALO[slug]
    let nuevas = 0
    for (let i = 0; i < n; i++) {
      const p = piezas[i], d = defs[p.s], clave = `${slug}:${i}`
      vigentes.add(clave)
      if (!final && !vistos.has(clave)) vistos.set(clave, ahora + (MOVIMIENTO_REDUCIDO || saltarAnimacion ? -1000 : Math.min(nuevas++ * 22, 520)))
      const t = (MOVIMIENTO_REDUCIDO || final) ? 1 : Math.min(1, Math.max(0, (ahora - vistos.get(clave)) / DURACION))
      if (t < 1) animando = true
      if (t <= 0) continue
      // cae (acelera), toca el queso y rebota un poquito
      const caida = Math.min(1, t / 0.7)
      let alto = ALTO * (1 - caida) ** 2
      if (t > 0.7) alto = ALTO * 0.07 * Math.sin(Math.PI * ((t - 0.7) / 0.3))
      const e = p.esc * k * (1 + 0.16 * (1 - caida)) * (rec.propia || !ing.tam ? 1 : ing.tam / LADO_PIEZA) // tam 110 = normal; menor = más chico
      piezasVivas.push({ clave, ing, rec, im, d, p, t, alto, e, halo, aterrizada: t >= 0.7, x: c + p.x * k, y: c + p.y * k, dw: d.dw ?? d.w, dh: d.dh ?? d.h })
    }
  }
  if (usadosBorrador.size) for (const kk of [...atlas.keys()]) if (kk.startsWith('propia:borrador:') && !usadosBorrador.has(kk)) atlas.delete(kk) // libera imágenes de borrador viejas
  const hayAlgo = elegidos.length > 0 || props.extras.length > 0

  if (final) {
    escena(ctx, W, c, R, piezasVivas, hayAlgo)
    return { animando: false, pendiente }
  }

  // ¿sigue sirviendo la capa guardada? (mismo tamaño y ajustes, y ninguna de sus piezas se quitó)
  const f = firma.join('~'), claves = new Set(piezasVivas.map((p) => p.clave))
  let valida = !!capa.cv && capa.cv.width === W && capa.firma === f
  // Agregar un ingrediente NO invalida la capa (sus piezas caen encima); cambiar o quitar uno que ya estaba sí.
  if (valida) for (const [id, parte] of capa.partes) if (partes.get(id) !== parte) { valida = false; break }
  if (valida) for (const kk of capa.claves) if (!claves.has(kk)) { valida = false; break }
  if (!valida) {
    if (!capa.cv) capa.cv = document.createElement('canvas')
    capa.cv.width = W; capa.cv.height = W
    const asentadas = piezasVivas.filter((p) => p.t >= 1)
    escena(capa.cv.getContext('2d'), W, c, R, asentadas, hayAlgo)
    capa.claves = new Set(asentadas.map((p) => p.clave)); capa.firma = f
    capa.partes = new Map([...new Set(asentadas.map((p) => p.ing.id))].map((id) => [id, partes.get(id)]))
  }
  ctx.clearRect(0, 0, W, W)
  ctx.drawImage(capa.cv, 0, 0)
  const cayendo = piezasVivas.filter((p) => !capa.claves.has(p.clave))
  for (const p of cayendo) dibujarPieza(ctx, W, p)
  if (!animando && cayendo.length) { capa.firma = ''; animando = true } // terminó de caer: un cuadro más para guardarlas en la capa
  for (const clave of vistos.keys()) if (!vigentes.has(clave)) vistos.delete(clave)
  return { animando, pendiente }
}

// Miniatura de la pizza tal como está ahora (sin animación), para mostrarla en el carrito.
function instantanea(lado = 220) {
  if (!meta || !imgPizza) return null
  const cv = document.createElement('canvas'); cv.width = cv.height = lado
  pintar(cv.getContext('2d'), lado, true)
  try { return cv.toDataURL('image/webp', 0.85) } catch { return null }
}
defineExpose({ instantanea })

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
watch(() => props.borradores, programar, { deep: true })
// Al volver a mostrarse tras una pausa, lo que cambió mientras tanto aparece ya puesto (sin caer otra vez).
watch(() => props.pausado, (p) => { if (!p) { saltarAnimacion = true; programar() } })
// Si el panel cambia la lista o las fotos, se vuelve a dibujar con lo nuevo.
watch([listaIng, imagenesIng], () => { cache.clear(); programar() })
// Pizza nueva: se vuelve a repartir todo y las piezas caen otra vez.
watch(() => props.semilla, () => { cache.clear(); vistos.clear(); programar() })
</script>

<template>
  <div ref="caja" class="pizza-caja" :class="{ activa, mini }" :style="{ width: mini ? '100%' : ESCALA[tamano] * 100 + '%' }"
    v-bind="mini ? { 'data-pizza-mini': '' } : { 'data-pizza': '' }"
    :data-ingredientes="ingredientes.length" :data-listo="listo"
    :role="mini ? 'presentation' : 'img'" :aria-label="mini ? null : ingredientes.length ? 'Tu pizza con ' + ingredientes.join(', ') : 'Tu pizza solo con queso'">
    <canvas ref="lienzo" width="10" height="10"></canvas>
    <div v-if="ingredientes.length && !mini" class="vapor" aria-hidden="true"><i></i><i></i><i></i></div>
  </div>
</template>

<style>
.pizza-caja { position: relative; aspect-ratio: 1; margin: 0 auto; max-width: 340px; transition: width .3s ease, filter .2s; border-radius: 50%;
  filter: drop-shadow(0 14px 14px #000a); }
.pizza-caja.mini { max-width: none; margin: 0; filter: drop-shadow(0 4px 6px #000a); }
.pizza-caja.mini.activa { filter: drop-shadow(0 0 10px #ff9800) drop-shadow(0 0 3px #ff9800); }
.pizza-caja.activa { filter: drop-shadow(0 0 14px #ff9800) drop-shadow(0 0 5px #ff9800); }
.vapor { position: absolute; left: 18%; right: 18%; top: -16%; height: 46%; pointer-events: none; }
.vapor i { position: absolute; bottom: 0; width: 40%; height: 75%; border-radius: 50%; opacity: 0; filter: blur(9px);
  background: radial-gradient(closest-side, rgba(255,255,255,.38), rgba(255,255,255,0)); animation: sube 4s ease-out infinite; }
.vapor i:nth-child(1) { left: 0; } .vapor i:nth-child(2) { left: 30%; animation-delay: 1.3s; } .vapor i:nth-child(3) { left: 60%; animation-delay: 2.6s; }
@keyframes sube { 0% { opacity: 0; transform: translateY(30%) scale(.7); } 25% { opacity: .75; } 100% { opacity: 0; transform: translateY(-75%) scale(1.35); } }
.pizza-caja canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
@media (max-width: 720px) { .vapor { display: none; } } /* el vapor desenfocado y animado pesa en el teléfono */
@media (prefers-reduced-motion: reduce) { .pizza-caja { transition: none; } .vapor { display: none; } }
</style>
