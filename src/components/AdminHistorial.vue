<script setup>
import { ref, computed, watch } from 'vue'
import { collection, query, orderBy, startAfter, limit, getDocs } from 'firebase/firestore'
import { dbAdmin as db } from '../firebase/admin.js'
import { money } from '../data/menu.js'
import Icono from './Icono.vue'

// Historial de pedidos (solo admin): todos los estados y de cualquier día. Usa los pedidos que ya llegan en vivo (los 500 más
// recientes) y, si hace falta, carga más antiguos por tandas.
const props = defineProps({ pedidos: { type: Array, default: () => [] } })

const ETIQUETA = { nuevo: 'Nuevo', preparando: 'Preparando', en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado' }
const EN_PROCESO = ['nuevo', 'preparando', 'en_camino']
const LIMITE_VIVO = 500, TANDA = 200, PAGINA = 40

const periodo = ref('todo') // hoy | 7 | 30 | todo
const estado = ref('todos') // todos | entregado | cancelado | proceso
const busqueda = ref('')
const dia = ref('') // yyyy-mm-dd (un día en concreto; manda sobre el periodo)
const visibles = ref(PAGINA)
const abierto = ref({})
watch([periodo, estado, busqueda, dia], () => (visibles.value = PAGINA))

const antiguos = ref([])
const cargandoMas = ref(false)
const sinMas = ref(false)
const errorMas = ref('')
const todos = computed(() => {
  const ids = new Set(props.pedidos.map((p) => p.id))
  return [...props.pedidos, ...antiguos.value.filter((p) => !ids.has(p.id))]
})
const puedeCargarMas = computed(() => !sinMas.value && (antiguos.value.length > 0 || props.pedidos.length >= LIMITE_VIVO))

const fechaDe = (p) => (p.creado?.toDate ? p.creado.toDate() : null)
const inicioDia = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

async function cargarMas() {
  const fechados = todos.value.filter((p) => p.creado?.toDate)
  if (!fechados.length) return
  const ultimo = fechados.reduce((a, b) => (fechaDe(a) <= fechaDe(b) ? a : b))
  cargandoMas.value = true; errorMas.value = ''
  try {
    const s = await getDocs(query(collection(db, 'pedidos'), orderBy('creado', 'desc'), startAfter(ultimo.creado), limit(TANDA)))
    antiguos.value = [...antiguos.value, ...s.docs.map((d) => ({ id: d.id, ...d.data() }))]
    if (s.docs.length < TANDA) sinMas.value = true
  } catch { errorMas.value = 'No se pudieron cargar más pedidos.' }
  finally { cargandoMas.value = false }
}

const filtrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  let desde = null, hasta = null
  if (dia.value) { const [a, m, d] = dia.value.split('-').map(Number); desde = new Date(a, m - 1, d); hasta = new Date(a, m - 1, d + 1) }
  else if (periodo.value === 'hoy') desde = inicioDia()
  else if (periodo.value === '7') desde = inicioDia(new Date(Date.now() - 6 * 864e5))
  else if (periodo.value === '30') desde = inicioDia(new Date(Date.now() - 29 * 864e5))
  return todos.value.filter((p) => {
    const f = fechaDe(p)
    if (desde && (!f || f < desde)) return false
    if (hasta && (!f || f >= hasta)) return false
    if (estado.value === 'proceso' ? !EN_PROCESO.includes(p.estado) : estado.value !== 'todos' && p.estado !== estado.value) return false
    if (!q) return true
    return `${p.nombre} ${p.telefono} ${p.direccion} ${p.id.slice(0, 6)}`.toLowerCase().includes(q)
  }).sort((a, b) => (fechaDe(b)?.getTime() ?? Date.now()) - (fechaDe(a)?.getTime() ?? Date.now()))
})
const totales = computed(() => {
  const ventas = filtrados.value.filter((p) => p.estado !== 'cancelado')
  return { n: filtrados.value.length, ventas: ventas.reduce((s, p) => s + (p.total || 0), 0), canc: filtrados.value.length - ventas.length }
})
const titulo = (f) => (f ? f.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha')
const grupos = computed(() => {
  const out = []
  for (const p of filtrados.value.slice(0, visibles.value)) {
    const t = titulo(fechaDe(p))
    if (!out.length || out[out.length - 1].titulo !== t) out.push({ titulo: t, lista: [] })
    out[out.length - 1].lista.push(p)
  }
  return out
})
const hora = (p) => fechaDe(p)?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) || ''
const resumen = (p) => (p.items || []).map((i) => `${i.cantidad || 1}× ${i.nombre}`).join(', ')
const alternar = (id) => (abierto.value = { ...abierto.value, [id]: !abierto.value[id] })
const fechaCancelado = (p) => (p.canceladoEn?.toDate ? p.canceladoEn.toDate().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '')
</script>

<template>
  <section class="hist" aria-label="Historial de pedidos">
    <h2 style="margin:0 0 4px">Historial de pedidos</h2>
    <p class="desc" style="margin:0 0 12px">Todos los pedidos, de cualquier día: entregados, en proceso y cancelados.</p>

    <div class="hist-filtros">
      <input v-model="busqueda" class="buscar" type="search" placeholder="Buscar por nombre, teléfono, dirección o folio" aria-label="Buscar en el historial" />
      <select v-model="periodo" :disabled="!!dia" aria-label="Periodo del historial">
        <option value="hoy">Hoy</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="todo">Todos</option>
      </select>
      <select v-model="estado" aria-label="Estado en el historial">
        <option value="todos">Todos los estados</option><option value="entregado">Entregados</option><option value="proceso">En proceso</option><option value="cancelado">Cancelados</option>
      </select>
      <label class="hist-dia">Día <input v-model="dia" type="date" aria-label="Ver un día en concreto" /><button v-if="dia" type="button" class="btn chico claro" @click="dia = ''">Quitar</button></label>
    </div>

    <div class="hist-totales" role="status">
      <span><b>{{ totales.n }}</b> {{ totales.n === 1 ? 'pedido' : 'pedidos' }}</span>
      <span><b>{{ money(totales.ventas) }}</b> en ventas</span>
      <span v-if="totales.canc"><b>{{ totales.canc }}</b> {{ totales.canc === 1 ? 'cancelado' : 'cancelados' }}</span>
    </div>

    <p v-if="!filtrados.length" class="sub">No hay pedidos con estos filtros.</p>
    <div v-for="g in grupos" :key="g.titulo" class="hist-dia-grupo">
      <h3 class="hist-titulo">{{ g.titulo }}</h3>
      <article v-for="p in g.lista" :key="p.id" :class="['hist-fila', p.estado, { abierta: abierto[p.id] }]">
        <button type="button" class="hist-cab" :aria-expanded="!!abierto[p.id]" @click="alternar(p.id)">
          <span class="hist-hora">{{ hora(p) }}</span>
          <span class="grow hist-quien"><b>{{ p.nombre }}</b><small class="desc">{{ resumen(p) }}</small></span>
          <span class="hist-der"><span :class="['estado', p.estado]">{{ ETIQUETA[p.estado] || p.estado }}</span><b class="precio">{{ money(p.total || 0) }}</b></span>
        </button>
        <div v-if="abierto[p.id]" class="hist-det">
          <p class="desc" style="margin:0 0 6px">Folio {{ p.id.slice(0, 6).toUpperCase() }}</p>
          <a :href="'tel:' + p.telefono" class="enlace"><Icono nombre="telefono" :tam="16" class="txt" />{{ p.telefono }}</a>
          <a :href="'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.direccion)" target="_blank" rel="noopener" class="enlace"><Icono nombre="ubicacion" :tam="16" class="txt" />{{ p.direccion }}</a>
          <ul class="lineas"><li v-for="(i, n) in p.items" :key="n"><b>{{ i.cantidad }}×</b> {{ i.nombre }}<span v-if="i.detalle" class="desc"> — {{ i.detalle }}</span></li></ul>
          <p v-if="p.notas" class="desc" style="margin:6px 0 0">Notas: {{ p.notas }}</p>
          <p v-if="p.repartidorNombre" class="desc" style="margin:6px 0 0"><Icono nombre="usuario" :tam="14" class="txt" />Repartidor: {{ p.repartidorNombre }}</p>
          <p v-if="p.estado === 'cancelado'" class="desc" style="margin:6px 0 0">Cancelado<template v-if="fechaCancelado(p)"> el {{ fechaCancelado(p) }}</template>. No cuenta en las ventas.</p>
        </div>
      </article>
    </div>

    <div class="hist-pie">
      <button v-if="filtrados.length > visibles" type="button" class="btn claro" @click="visibles += PAGINA">Mostrar más ({{ filtrados.length - visibles }})</button>
      <button v-if="puedeCargarMas && filtrados.length <= visibles" type="button" class="btn claro" :disabled="cargandoMas" @click="cargarMas">{{ cargandoMas ? 'Cargando…' : 'Cargar pedidos más antiguos' }}</button>
      <p v-if="errorMas" class="error" role="alert">{{ errorMas }}</p>
      <p v-if="!puedeCargarMas && filtrados.length && filtrados.length <= visibles" class="desc">Esos son todos los pedidos.</p>
    </div>
  </section>
</template>

<style>
.hist { margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--borde); }
.hist-filtros { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.hist-filtros .buscar { flex: 1 1 100%; min-width: 0; }
.hist-filtros .buscar { background: var(--sup); color: var(--texto); border: 1.5px solid var(--borde); border-radius: 12px; padding: 11px 14px; font-family: inherit; min-height: 44px; }
.hist-filtros select, .hist-dia input { background: var(--sup); color: var(--texto); border: 1.5px solid var(--borde); border-radius: 12px; padding: 11px 12px; font-family: inherit; min-height: 44px; }
.hist-dia { display: inline-flex; align-items: center; gap: 8px; color: var(--suave); font-size: .9rem; }
.hist-totales { display: flex; gap: 14px; flex-wrap: wrap; color: var(--suave); font-size: .9rem; margin-bottom: 8px; }
.hist-totales b { color: var(--texto); }
.hist-titulo { font: 700 1rem var(--cuerpo); text-transform: none; letter-spacing: 0; color: var(--suave); margin: 16px 0 6px; }
.hist-titulo::first-letter { text-transform: uppercase; }
.hist-fila { background: var(--sup); border: 1px solid var(--borde); border-left: 5px solid var(--borde); border-radius: 12px; margin-bottom: 6px; overflow: hidden; }
.hist-fila.nuevo { border-left-color: var(--rojo); } .hist-fila.preparando { border-left-color: #e0a100; } .hist-fila.en_camino { border-left-color: #3b82f6; } .hist-fila.entregado { border-left-color: var(--verde); } .hist-fila.cancelado { opacity: .7; }
.hist-cab { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; background: none; border: 0; padding: 12px; min-height: 56px; }
.hist-hora { color: var(--suave); font-size: .85rem; min-width: 44px; }
.hist-quien { min-width: 0; display: grid; }
.hist-quien small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hist-der { display: grid; justify-items: end; gap: 4px; flex: none; }
.hist-det { padding: 0 12px 12px 12px; display: grid; gap: 4px; }
.hist-pie { display: grid; justify-items: center; gap: 8px; margin-top: 14px; }
</style>
