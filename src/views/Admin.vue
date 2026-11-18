<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { collection, query, orderBy, limit, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { auth, correoDeTelefono } from '../firebase/auth.js'
import { db } from '../firebase/db.js'
import { money } from '../data/menu.js'
import Logo from '../components/Logo.vue'
import Icono from '../components/Icono.vue'
import AdminMenu from '../components/AdminMenu.vue'

/* ---------- Sesión ---------- */
const usuario = ref(null)
const cargando = ref(true)
const tel = ref('')
const clave = ref('')
const verClave = ref(false)
const entrando = ref(false)
const errorLogin = ref('')

function mensajeLogin(e) {
  const c = e?.code || ''
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-email')) return 'Teléfono o contraseña incorrectos.'
  if (c.includes('too-many-requests')) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  if (c.includes('network')) return 'Sin conexión. Revisa tu internet.'
  if (c.includes('operation-not-allowed')) return 'El acceso con contraseña no está activado en Firebase.'
  return 'No se pudo iniciar sesión.'
}
async function entrarConTelefono() {
  errorLogin.value = ''
  const digitos = tel.value.replace(/\D/g, '')
  if (digitos.length !== 10) return (errorLogin.value = 'Escribe tu teléfono de 10 dígitos.')
  if (!clave.value) return (errorLogin.value = 'Escribe tu contraseña.')
  entrando.value = true
  try { await signInWithEmailAndPassword(auth, correoDeTelefono(digitos), clave.value) }
  catch (e) { errorLogin.value = mensajeLogin(e) }
  finally { entrando.value = false; clave.value = '' }
}
async function entrarConGoogle() {
  errorLogin.value = ''
  try { await signInWithPopup(auth, new GoogleAuthProvider()) }
  catch (e) { if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') errorLogin.value = 'No se pudo iniciar sesión con Google.' }
}

/* ---------- Pedidos en vivo ---------- */
const pedidos = ref([])
const errorDatos = ref('')
let cortar = null
let primera = true
const ESTADOS = ['nuevo', 'preparando', 'en_camino', 'entregado', 'cancelado']
const SIGUIENTE = { nuevo: 'preparando', preparando: 'en_camino', en_camino: 'entregado' }
const ETIQUETA = { nuevo: 'Nuevo', preparando: 'Preparando', en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado' }

function escuchar() {
  cortar?.(); errorDatos.value = ''; primera = true
  const q = query(collection(db, 'pedidos'), orderBy('creado', 'desc'), limit(500))
  cortar = onSnapshot(q, (s) => {
    pedidos.value = s.docs.map((d) => ({ id: d.id, ...d.data() }))
    if (!primera) s.docChanges().forEach((c) => { if (c.type === 'added') alertaNuevo(c.doc.data()) })
    primera = false
  }, (e) => {
    pedidos.value = []
    errorDatos.value = e.code === 'permission-denied' ? 'sinpermiso' : 'No se pudieron cargar los pedidos.'
  })
}
onMounted(() => {
  onAuthStateChanged(auth, (u) => {
    usuario.value = u; cargando.value = false
    if (u) escuchar(); else { cortar?.(); pedidos.value = []; errorDatos.value = '' }
  })
})
onUnmounted(() => { cortar?.(); document.title = tituloOriginal })

/* ---------- Aviso de pedidos nuevos ---------- */
const tituloOriginal = typeof document !== 'undefined' ? document.title : ''
const sonido = ref((() => { try { return localStorage.getItem('anonimus-admin-sonido') !== '0' } catch { return true } })())
const aviso = ref('')
let ctxAudio = null, tAviso
function guardarSonido() { try { localStorage.setItem('anonimus-admin-sonido', sonido.value ? '1' : '0') } catch { /* sin almacenamiento */ } if (sonido.value) pitar() }
function pitar() {
  try {
    ctxAudio ||= new (window.AudioContext || window.webkitAudioContext)()
    const t0 = ctxAudio.currentTime
    ;[0, 0.22].forEach((d, i) => {
      const o = ctxAudio.createOscillator(), g = ctxAudio.createGain()
      o.frequency.value = i ? 1175 : 880; o.type = 'sine'
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.2)
      o.connect(g); g.connect(ctxAudio.destination); o.start(t0 + d); o.stop(t0 + d + 0.22)
    })
  } catch { /* sin audio */ }
}
function alertaNuevo(p) {
  if (sonido.value) pitar()
  aviso.value = `🍕 Nuevo pedido de ${p.nombre} · ${money(p.total || 0)}`
  clearTimeout(tAviso); tAviso = setTimeout(() => (aviso.value = ''), 6000)
}

/* ---------- Filtros ---------- */
const pestana = ref('pedidos')
const periodo = ref('hoy') // hoy | 7 | todo
const estado = ref('activos') // activos | todos | <estado>
const busqueda = ref('')

const inicioDia = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const fechaDe = (p) => (p.creado?.toDate ? p.creado.toDate() : null)
const enPeriodo = (p) => {
  const f = fechaDe(p); if (!f) return true
  if (periodo.value === 'hoy') return f >= inicioDia()
  if (periodo.value === '7') return f >= inicioDia(new Date(Date.now() - 6 * 864e5))
  return true
}
const delPeriodo = computed(() => pedidos.value.filter(enPeriodo))
const conteo = computed(() => {
  const c = { activos: 0, todos: delPeriodo.value.length }
  ESTADOS.forEach((e) => (c[e] = 0))
  delPeriodo.value.forEach((p) => { c[p.estado] = (c[p.estado] || 0) + 1; if (['nuevo', 'preparando', 'en_camino'].includes(p.estado)) c.activos++ })
  return c
})
const visibles = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  return delPeriodo.value.filter((p) => {
    if (estado.value === 'activos' && !['nuevo', 'preparando', 'en_camino'].includes(p.estado)) return false
    if (!['activos', 'todos'].includes(estado.value) && p.estado !== estado.value) return false
    if (!q) return true
    return `${p.nombre} ${p.telefono} ${p.direccion} ${p.id.slice(0, 6)}`.toLowerCase().includes(q)
  })
})
const nuevos = computed(() => pedidos.value.filter((p) => p.estado === 'nuevo').length)
watch(nuevos, (n) => { document.title = n ? `(${n}) Pedidos nuevos · Anonimus` : tituloOriginal }, { immediate: true })

const hora = (p) => { const f = fechaDe(p); return f ? f.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '' }
const mapa = (p) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.direccion)

/* ---------- Resumen ---------- */
const vendidos = (lista) => lista.filter((p) => p.estado !== 'cancelado')
const hoy = computed(() => pedidos.value.filter((p) => { const f = fechaDe(p); return f && f >= inicioDia() }))
const resumenHoy = computed(() => {
  const v = vendidos(hoy.value), total = v.reduce((s, p) => s + (p.total || 0), 0)
  return { pedidos: hoy.value.length, ventas: total, promedio: v.length ? Math.round(total / v.length) : 0, pendientes: hoy.value.filter((p) => ['nuevo', 'preparando', 'en_camino'].includes(p.estado)).length, entregados: hoy.value.filter((p) => p.estado === 'entregado').length }
})
const dias = computed(() => {
  const out = []
  for (let i = 6; i >= 0; i--) {
    const d0 = inicioDia(new Date(Date.now() - i * 864e5)), d1 = new Date(d0.getTime() + 864e5)
    const v = vendidos(pedidos.value.filter((p) => { const f = fechaDe(p); return f && f >= d0 && f < d1 }))
    out.push({ clave: d0.toISOString(), nombre: d0.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', ''), pedidos: v.length, ventas: v.reduce((s, p) => s + (p.total || 0), 0) })
  }
  const max = Math.max(1, ...out.map((d) => d.ventas))
  return out.map((d) => ({ ...d, alto: Math.max(d.ventas ? 6 : 0, Math.round((d.ventas / max) * 100)) }))
})
const topProductos = computed(() => {
  const m = new Map()
  vendidos(pedidos.value.filter(enPeriodoResumen)).forEach((p) => (p.items || []).forEach((i) => m.set(i.nombre, (m.get(i.nombre) || 0) + (i.cantidad || 1))))
  const arr = [...m].map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n).slice(0, 6)
  const max = Math.max(1, ...arr.map((a) => a.n))
  return arr.map((a) => ({ ...a, ancho: Math.round((a.n / max) * 100) }))
})
function enPeriodoResumen(p) { const f = fechaDe(p); return !f || f >= inicioDia(new Date(Date.now() - 6 * 864e5)) }

/* ---------- Acciones ---------- */
async function cambiarEstado(p, nuevo) {
  try { await updateDoc(doc(db, 'pedidos', p.id), { estado: nuevo }) } catch { errorDatos.value = 'No se pudo actualizar el pedido.' }
}
async function borrar(p) {
  if (!confirm(`¿Borrar el pedido de ${p.nombre}? No se puede deshacer.`)) return
  try { await deleteDoc(doc(db, 'pedidos', p.id)) } catch { errorDatos.value = 'No se pudo borrar el pedido.' }
}
</script>

<template>
  <div class="adm">
    <header class="adm-cab">
      <div class="adm-marca"><span class="adm-logo"><Logo /></span><div><b>Panel de administración</b><small>Anonimus Pizza</small></div></div>
      <div v-if="usuario" class="adm-usuario">
        <label class="interruptor" title="Aviso sonoro de pedidos nuevos"><input type="checkbox" v-model="sonido" @change="guardarSonido" /><span>🔔 Sonido</span></label>
        <button class="btn chico claro" @click="signOut(auth)">Salir</button>
      </div>
      <router-link v-else to="/" class="btn chico claro">← Ir a la tienda</router-link>
    </header>

    <p v-if="cargando" class="sub">Cargando…</p>

    <!-- Acceso -->
    <section v-else-if="!usuario" class="adm-login">
      <h1>Acceso <em>administrador</em></h1>
      <form class="tarjeta" @submit.prevent="entrarConTelefono" novalidate>
        <label class="campo">Teléfono
          <input v-model="tel" type="tel" inputmode="numeric" autocomplete="username" maxlength="14" placeholder="10 dígitos" />
        </label>
        <label class="campo">Contraseña
          <span class="clave"><input v-model="clave" :type="verClave ? 'text' : 'password'" autocomplete="current-password" />
            <button type="button" class="ojo" :aria-label="verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="verClave = !verClave">{{ verClave ? '🙈' : '👁️' }}</button></span>
        </label>
        <p v-if="errorLogin" class="error" role="alert">{{ errorLogin }}</p>
        <button class="btn block" :disabled="entrando">{{ entrando ? 'Entrando…' : 'Entrar' }}</button>
        <p class="o">o</p>
        <button type="button" class="btn block claro" @click="entrarConGoogle">Entrar con Google</button>
      </form>
    </section>

    <!-- Panel -->
    <template v-else>
      <div v-if="errorDatos === 'sinpermiso'" class="tarjeta sin-permiso" role="alert">
        <h2>Sin permiso</h2>
        <p>Esta cuenta no es de administrador, por eso no puede ver los pedidos.</p>
        <button class="btn" @click="signOut(auth)">Salir y probar con otra cuenta</button>
      </div>
      <template v-else>
        <p v-if="errorDatos" class="error" role="alert">{{ errorDatos }}</p>
        <div v-if="aviso" class="adm-aviso" role="status">{{ aviso }}</div>

        <nav class="adm-tabs" aria-label="Secciones">
          <button :class="{ on: pestana === 'pedidos' }" @click="pestana = 'pedidos'">Pedidos <b v-if="nuevos" class="punto">{{ nuevos }}</b></button>
          <button :class="{ on: pestana === 'resumen' }" @click="pestana = 'resumen'">Resumen</button>
          <button :class="{ on: pestana === 'menu' }" @click="pestana = 'menu'">Menú</button>
        </nav>

        <!-- Pedidos -->
        <section v-if="pestana === 'pedidos'">
          <div class="adm-filtros">
            <input v-model="busqueda" class="buscar" type="search" placeholder="Buscar por nombre, teléfono o folio" aria-label="Buscar pedidos" />
            <select v-model="periodo" aria-label="Periodo">
              <option value="hoy">Hoy</option><option value="7">Últimos 7 días</option><option value="todo">Todos</option>
            </select>
          </div>
          <div class="adm-estados" role="tablist">
            <button v-for="e in [['activos', 'Activos'], ['todos', 'Todos'], ...ESTADOS.map((x) => [x, ETIQUETA[x]])]" :key="e[0]" :class="['chip', { on: estado === e[0] }]" @click="estado = e[0]">{{ e[1] }} <b>{{ conteo[e[0]] }}</b></button>
          </div>

          <p v-if="!visibles.length && !errorDatos" class="sub">No hay pedidos con estos filtros.</p>
          <div class="adm-lista">
            <article v-for="p in visibles" :key="p.id" :class="['tarjeta', 'pedido', p.estado]">
              <div class="fila" style="align-items:flex-start">
                <div class="grow">
                  <b>{{ p.nombre }}</b>
                  <div class="desc">{{ hora(p) }} · folio {{ p.id.slice(0, 6).toUpperCase() }}</div>
                </div>
                <div style="text-align:right"><span :class="['estado', p.estado]">{{ ETIQUETA[p.estado] || p.estado }}</span><div class="precio">{{ money(p.total) }}</div></div>
              </div>
              <div class="contacto">
                <a :href="'tel:' + p.telefono" class="enlace">📞 {{ p.telefono }}</a>
                <a :href="mapa(p)" target="_blank" rel="noopener" class="enlace">📍 {{ p.direccion }}</a>
              </div>
              <ul class="lineas"><li v-for="(i, n) in p.items" :key="n"><b>{{ i.cantidad }}×</b> {{ i.nombre }}<span v-if="i.detalle" class="desc"> — {{ i.detalle }}</span></li></ul>
              <div v-if="p.notas" class="aviso">Notas: {{ p.notas }}</div>
              <div class="acciones">
                <button v-if="SIGUIENTE[p.estado]" class="btn chico verde" @click="cambiarEstado(p, SIGUIENTE[p.estado])">Pasar a: {{ ETIQUETA[SIGUIENTE[p.estado]] }}</button>
                <button v-if="p.estado !== 'cancelado' && p.estado !== 'entregado'" class="btn chico claro" @click="cambiarEstado(p, 'cancelado')">Cancelar</button>
                <button v-if="p.estado === 'cancelado' || p.estado === 'entregado'" class="btn chico claro" @click="cambiarEstado(p, 'nuevo')">Reabrir</button>
                <button class="btn chico basura-btn" :aria-label="'Borrar pedido de ' + p.nombre" @click="borrar(p)"><Icono nombre="basura" :tam="18" /></button>
              </div>
            </article>
          </div>
        </section>

        <!-- Resumen -->
        <section v-else-if="pestana === 'resumen'">
          <div class="resumen">
            <div class="tarjeta"><b>{{ resumenHoy.pedidos }}</b>Pedidos de hoy</div>
            <div class="tarjeta"><b>{{ money(resumenHoy.ventas) }}</b>Ventas de hoy</div>
            <div class="tarjeta"><b>{{ money(resumenHoy.promedio) }}</b>Ticket promedio</div>
            <div class="tarjeta"><b>{{ resumenHoy.pendientes }}</b>Pendientes</div>
            <div class="tarjeta"><b>{{ resumenHoy.entregados }}</b>Entregados</div>
          </div>
          <div class="adm-dos">
            <div class="tarjeta">
              <h3>Ventas de los últimos 7 días</h3>
              <div class="barras" role="img" aria-label="Ventas por día">
                <div v-for="d in dias" :key="d.clave" class="barra"><span class="v">{{ d.ventas ? money(d.ventas) : '' }}</span><i :style="{ height: d.alto + '%' }"></i><span class="n">{{ d.nombre }}</span></div>
              </div>
            </div>
            <div class="tarjeta">
              <h3>Más pedidos (7 días)</h3>
              <p v-if="!topProductos.length" class="desc">Aún no hay datos.</p>
              <div v-for="t in topProductos" :key="t.nombre" class="top"><div class="fila"><span class="grow">{{ t.nombre }}</span><b>{{ t.n }}</b></div><div class="riel"><i :style="{ width: t.ancho + '%' }"></i></div></div>
            </div>
          </div>
          <p class="desc">Las cifras no incluyen pedidos cancelados. Se calculan con los últimos 500 pedidos.</p>
        </section>

        <!-- Menú de la tienda -->
        <AdminMenu v-else />
      </template>
    </template>
  </div>
</template>

<style>
.adm { max-width: 1100px; margin: 0 auto; }
.adm-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--borde); }
.adm-marca { display: flex; align-items: center; gap: 12px; }
.adm-marca b { display: block; font: 800 1.4rem var(--display); text-transform: uppercase; letter-spacing: .03em; }
.adm-marca small { color: var(--suave); }
.adm-logo { width: 46px; flex: none; }
.adm-usuario { display: flex; align-items: center; gap: 10px; }
.interruptor { display: inline-flex; align-items: center; gap: 6px; font-size: .9rem; color: var(--suave); }
.adm-login { max-width: 420px; margin: 24px auto; }
.adm-login h1 { font-size: 2.2rem; margin-bottom: 14px; }
.clave { position: relative; display: block; }
.clave input { padding-right: 48px; }
.ojo { position: absolute; right: 6px; top: 50%; transform: translateY(-38%); background: none; border: 0; font-size: 1.2rem; padding: 6px 8px; }
.o { text-align: center; color: var(--suave); margin: 12px 0; }
.sin-permiso { max-width: 460px; margin: 30px auto; text-align: center; }
.adm-aviso { position: sticky; top: 8px; z-index: 5; background: var(--verde); color: #fff; font-weight: 700; padding: 12px 16px; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 6px 18px #0007; }
.adm-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.adm-tabs button { padding: 10px 20px; border-radius: 999px; background: var(--sup); border: 1px solid var(--borde); color: var(--suave); font-weight: 700; }
.adm-tabs button.on { background: var(--rojo); border-color: var(--rojo); color: #fff; }
.punto { background: #fff; color: var(--rojo2); border-radius: 999px; padding: 0 7px; margin-left: 4px; font-size: .8rem; }
.adm-filtros { display: flex; gap: 10px; margin-bottom: 10px; }
.adm-filtros .buscar, .adm-filtros select { background: var(--sup); color: var(--texto); border: 1.5px solid var(--borde); border-radius: 12px; padding: 11px 14px; font-family: inherit; }
.adm-filtros .buscar { flex: 1; min-width: 0; }
.adm-estados { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 12px; scrollbar-width: none; }
.adm-estados::-webkit-scrollbar { display: none; }
.adm-estados .chip { flex: none; font-size: .88rem; padding: 7px 12px; }
.adm-estados .chip b { margin-left: 4px; opacity: .85; }
.adm-lista { display: grid; gap: 12px; }
.pedido { margin: 0; border-left: 5px solid var(--borde); }
.pedido.nuevo { border-left-color: var(--rojo); } .pedido.preparando { border-left-color: #e0a100; } .pedido.en_camino { border-left-color: #3b82f6; } .pedido.entregado { border-left-color: var(--verde); } .pedido.cancelado { opacity: .65; }
.contacto { display: flex; flex-direction: column; gap: 4px; margin: 10px 0 6px; }
.enlace { color: #ffd48a; font-weight: 600; word-break: break-word; }
.lineas { margin: 6px 0 0; padding-left: 20px; }
.basura-btn { background: #e8392b1f; border: 1.5px solid #e8392b; color: #ff4d3f; box-shadow: none; padding: 8px 12px; }
.resumen .tarjeta { font-size: .85rem; color: var(--suave); }
.adm-dos { display: grid; gap: 12px; }
.barras { display: flex; align-items: flex-end; gap: 8px; height: 190px; margin-top: 12px; }
.barra { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; min-width: 0; }
.barra i { display: block; width: 100%; max-width: 44px; border-radius: 8px 8px 0 0; background: linear-gradient(var(--ambar), #d98a00); }
.barra .v { font-size: .68rem; color: var(--suave); white-space: nowrap; } .barra .n { font-size: .78rem; text-transform: capitalize; }
.top { margin: 10px 0; } .riel { height: 8px; border-radius: 4px; background: var(--sup2); margin-top: 4px; } .riel i { display: block; height: 100%; border-radius: 4px; background: var(--verde); }
@media (min-width: 900px) { .adm-lista { grid-template-columns: 1fr 1fr; } .adm-dos { grid-template-columns: 1.3fr 1fr; } }
</style>
