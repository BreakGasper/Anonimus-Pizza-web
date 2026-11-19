<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { collection, query, orderBy, where, limit, onSnapshot, updateDoc, getDoc, getDocs, doc, serverTimestamp, deleteField } from 'firebase/firestore'
import { authAdmin as auth, dbAdmin as db } from '../firebase/admin.js'
import { correoDeTelefono } from '../firebase/claves.js'
import { money } from '../data/menu.js'
import { avisar } from '../store/toast.js'
import { bloquearFondo } from '../utils/bloquearFondo.js'
import Logo from '../components/Logo.vue'
import Icono from '../components/Icono.vue'
import AdminMenu from '../components/AdminMenu.vue'
import AdminIngredientes from '../components/AdminIngredientes.vue'
import AdminHistorial from '../components/AdminHistorial.vue'
import AdminUsuarios from '../components/AdminUsuarios.vue'

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

/* ---------- Móvil: menú de abajo (pulgar) y cuenta en una hoja ---------- */
const mqMovil = typeof matchMedia === 'function' ? matchMedia('(max-width: 720px)') : null
const esMovil = ref(!!mqMovil?.matches)
const alCambiarMovil = (e) => (esMovil.value = e.matches)
const menuCuenta = ref(false)
bloquearFondo(() => menuCuenta.value)
watch(esMovil, (m) => { if (!m) menuCuenta.value = false })
const salir = () => { menuCuenta.value = false; signOut(auth) }

/* ---------- Pedidos en vivo ---------- */
const pedidos = ref([])
const errorDatos = ref('')
let cortar = null
let primera = true
const ESTADOS = ['nuevo', 'preparando', 'en_camino', 'entregado', 'cancelado']
const SIGUIENTE = { nuevo: 'preparando', preparando: 'en_camino', en_camino: 'entregado' }
const ETIQUETA = { nuevo: 'Nuevo', preparando: 'Preparando', en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado' }

/* ---------- Perfil (rol) de quien entra: admin, tienda o empleado ---------- */
const rol = ref(null)
const esAdminRol = computed(() => rol.value === 'admin')
const esEmpleadoRol = computed(() => rol.value === 'empleado')
const esRepartidorRol = computed(() => rol.value === 'repartidor')
const soloPedidos = computed(() => esEmpleadoRol.value || esRepartidorRol.value) // sin pestañas ni filtros: solo su lista
const puedeGestionar = computed(() => rol.value === 'admin' || rol.value === 'tienda') // cancelar, reabrir y menú
const ROL_ETIQUETA = { admin: 'Administrador', tienda: 'Tienda', empleado: 'Empleado', repartidor: 'Repartidor' }
const PENDIENTES = ['nuevo', 'preparando', 'en_camino']

async function detectarRol(u) {
  try {
    const s = await getDoc(doc(db, 'admins', u.uid))
    if (s.exists()) {
      const d = s.data()
      if (d.activo === false) return 'inactivo'
      return ['admin', 'tienda', 'empleado', 'repartidor'].includes(d.rol) ? d.rol : 'admin' // un perfil sin rol (creado a mano) es admin
    }
  } catch { /* se intenta la comprobación de abajo */ }
  // Sin perfil: solo puede ser el admin de Google (autorizado por su correo en las reglas). Se comprueba con una lectura de prueba.
  try { await getDocs(query(collection(db, 'pedidos'), limit(1))); return 'admin' } catch { return null }
}

function escuchar() {
  cortar?.(); errorDatos.value = ''; primera = true
  // El empleado solo puede leer los pedidos por atender (lo exigen las reglas); admin y tienda leen todos.
  // El repartidor solo lee los pedidos que le asignaron y van en camino (las reglas también lo exigen).
  const q = rol.value === 'repartidor'
    ? query(collection(db, 'pedidos'), where('repartidorUid', '==', usuario.value.uid), where('estado', '==', 'en_camino'), limit(100))
    : rol.value === 'empleado'
    ? query(collection(db, 'pedidos'), where('estado', 'in', PENDIENTES), limit(300))
    : query(collection(db, 'pedidos'), orderBy('creado', 'desc'), limit(500))
  cortar = onSnapshot(q, (s) => {
    pedidos.value = s.docs.map((d) => ({ id: d.id, ...d.data() }))
    if (!primera) s.docChanges().forEach((c) => { if (c.type === 'added') alertaNuevo({ ...c.doc.data(), id: c.doc.id }) })
    primera = false
    abrirPedidoPendiente()
  }, (e) => {
    pedidos.value = []
    errorDatos.value = e.code === 'permission-denied' ? 'sinpermiso' : 'No se pudieron cargar los pedidos.'
  })
}
onMounted(() => {
  mqMovil?.addEventListener('change', alCambiarMovil)
  // Manifiesto solo del panel: al agregarlo a la pantalla de inicio se abre /admin (no la tienda).
  enlaceManifiesto = document.createElement('link'); enlaceManifiesto.rel = 'manifest'; enlaceManifiesto.href = '/admin.webmanifest'; document.head.appendChild(enlaceManifiesto)
  navigator.serviceWorker?.addEventListener('message', enMensaje)
  document.addEventListener('visibilitychange', alVisible)
  if (avisosActivos.value) { registrarSW(); mantenerPantalla() }
  onAuthStateChanged(auth, async (u) => {
    usuario.value = u; cortar?.(); pedidos.value = []; errorDatos.value = ''; rol.value = null
    if (!u) { cargando.value = false; return }
    cargando.value = true
    const r = await detectarRol(u)
    cargando.value = false
    if (!r || r === 'inactivo') { errorDatos.value = r === 'inactivo' ? 'inactivo' : 'sinpermiso'; return }
    rol.value = r; pestana.value = 'pedidos'; estado.value = 'activos'
    escuchar()
  })
})
onUnmounted(() => { cortar?.(); document.title = tituloOriginal; quitarAvisos(); mqMovil?.removeEventListener('change', alCambiarMovil) })

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
  aviso.value = `${esRepartidorRol.value ? 'Pedido asignado a ti' : 'Nuevo pedido'} de ${p.nombre} · ${money(p.total || 0)}`
  clearTimeout(tAviso); tAviso = setTimeout(() => (aviso.value = ''), 6000)
  notificar(p)
}

/* ---------- Notificaciones del sistema (con el panel instalado en el teléfono) ----------
   No hay servidor de envío (plan gratuito): el aviso sale desde este mismo panel cuando llega un pedido, así que
   funciona mientras la app esté abierta o en segundo plano, no con el teléfono bloqueado o la app cerrada del todo. */
const avisosSoportados = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
const permisoAvisos = ref(avisosSoportados ? Notification.permission : 'unsupported') // default | granted | denied | unsupported
const avisosOn = ref((() => { try { return localStorage.getItem('anonimus-admin-avisos') === '1' } catch { return false } })())
const avisosActivos = computed(() => avisosOn.value && permisoAvisos.value === 'granted')
const instalada = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true)
const esIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
const textoAvisos = computed(() => {
  if (permisoAvisos.value === 'unsupported') return esIOS && !instalada ? 'En iPhone, primero agrega esta página a la pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí.' : 'Este navegador no permite notificaciones.'
  if (permisoAvisos.value === 'denied') return 'Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador o de la app.'
  return 'No se activaron las notificaciones. Vuelve a tocar el botón y elige Permitir.'
})
let registroSW = null, pantalla = null, enlaceManifiesto = null
const ayudaAvisos = ref(false)
async function registrarSW() {
  if (!avisosSoportados) return null
  try { await navigator.serviceWorker.register('/sw.js'); registroSW ||= await navigator.serviceWorker.ready; return registroSW } catch { return null }
}
async function mantenerPantalla() {
  try { if (avisosActivos.value && document.visibilityState === 'visible' && 'wakeLock' in navigator && !pantalla) { pantalla = await navigator.wakeLock.request('screen'); pantalla.addEventListener('release', () => (pantalla = null)) } } catch { /* sin wake lock */ }
}
async function soltarPantalla() { try { await pantalla?.release() } catch { /* nada */ } pantalla = null }
async function alternarAvisos() {
  if (avisosActivos.value) { avisosOn.value = false; try { localStorage.setItem('anonimus-admin-avisos', '0') } catch { /* nada */ } soltarPantalla(); return }
  if (!avisosSoportados || permisoAvisos.value === 'denied') { ayudaAvisos.value = true; return }
  ayudaAvisos.value = false
  if (Notification.permission !== 'granted') permisoAvisos.value = await Notification.requestPermission() // debe salir de un toque
  else permisoAvisos.value = 'granted'
  if (permisoAvisos.value !== 'granted') { ayudaAvisos.value = true; return }
  avisosOn.value = true; try { localStorage.setItem('anonimus-admin-avisos', '1') } catch { /* nada */ }
  mantenerPantalla()
  const r = await registrarSW(); try { await r?.showNotification('Avisos activados', { body: 'Te avisaremos de cada pedido nuevo.', icon: '/icono-192.png', tag: 'prueba' }) } catch { /* nada */ }
}
async function notificar(p) {
  if (!avisosActivos.value || (document.visibilityState === 'visible' && document.hasFocus())) return // con el panel a la vista basta el aviso en pantalla
  const r = await registrarSW(); if (!r) return
  try {
    await r.showNotification((esRepartidorRol.value ? 'Pedido para entregar · ' : 'Nuevo pedido · ') + money(p.total || 0), {
      body: `${p.nombre || 'Cliente'}${esRepartidorRol.value && p.direccion ? ' · ' + p.direccion : ''} · folio ${String(p.id || '').slice(0, 6).toUpperCase()}`, icon: '/icono-192.png', badge: '/icono-192.png',
      tag: 'pedido-' + p.id, data: { id: p.id }, renotify: true, requireInteraction: true, vibrate: [200, 100, 200],
    })
  } catch { /* sin permiso o sin soporte */ }
}
function enMensaje(ev) { if (ev.data?.tipo === 'abrir-pedido') { idPendiente = ev.data.id; abrirPedidoPendiente() } }
function alVisible() { if (document.visibilityState === 'visible') mantenerPantalla() }
function quitarAvisos() { enlaceManifiesto?.remove(); navigator.serviceWorker?.removeEventListener('message', enMensaje); document.removeEventListener('visibilitychange', alVisible); soltarPantalla() }

/* ---------- Abrir un pedido concreto (al tocar la notificación: /admin?pedido=ID) ---------- */
const route = useRoute()
const router = useRouter()
let idPendiente = route.query.pedido ? String(route.query.pedido) : ''
const resaltado = ref('')
async function abrirPedidoPendiente() {
  if (!idPendiente || !pedidos.value.length) return
  const p = pedidos.value.find((x) => x.id === idPendiente)
  const id = idPendiente; idPendiente = ''
  if (route.query.pedido) router.replace({ path: '/admin' })
  if (!p) return
  pestana.value = 'pedidos'; busqueda.value = ''
  if (!soloPedidos.value) { estado.value = esPend(p) ? 'activos' : 'todos'; periodo.value = 'todo' }
  resaltado.value = id
  await nextTick()
  document.getElementById('ped-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => { if (resaltado.value === id) resaltado.value = '' }, 4000)
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
const esPend = (p) => PENDIENTES.includes(p.estado)
// Los pedidos por atender se ven siempre (de cualquier día); el periodo solo filtra los ya atendidos (entregados y cancelados).
const delPeriodo = computed(() => pedidos.value.filter((p) => esPend(p) || enPeriodo(p)))
const conteo = computed(() => {
  const c = { activos: 0, todos: delPeriodo.value.length }
  ESTADOS.forEach((e) => (c[e] = 0))
  delPeriodo.value.forEach((p) => { c[p.estado] = (c[p.estado] || 0) + 1; if (esPend(p)) c.activos++ })
  return c
})
// Orden para TODOS los perfiles: primero lo que falta por atender, del más viejo al más nuevo; después lo ya atendido, del más reciente al más antiguo.
const marca = (p) => (fechaDe(p) ? fechaDe(p).getTime() : Date.now())
const ordenar = (l) => [...l.filter(esPend).sort((a, b) => marca(a) - marca(b)), ...l.filter((p) => !esPend(p)).sort((a, b) => marca(b) - marca(a))]
const visibles = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  const lista = delPeriodo.value.filter((p) => {
    if (estado.value === 'activos' && !esPend(p)) return false
    if (!['activos', 'todos'].includes(estado.value) && p.estado !== estado.value) return false
    if (!q) return true
    return `${p.nombre} ${p.telefono} ${p.direccion} ${p.id.slice(0, 6)}`.toLowerCase().includes(q)
  })
  return ordenar(lista)
})
const nuevos = computed(() => pedidos.value.filter((p) => p.estado === 'nuevo').length)
const pestanas = computed(() => [
  { id: 'pedidos', nombre: 'Pedidos', icono: 'lista' },
  ...(esAdminRol.value ? [{ id: 'resumen', nombre: 'Resumen', icono: 'grafica' }] : []),
  ...(puedeGestionar.value ? [{ id: 'menu', nombre: 'Menú', icono: 'carta' }, { id: 'ingredientes', nombre: 'Ingredientes', icono: 'hoja' }] : []),
  ...(esAdminRol.value ? [{ id: 'usuarios', nombre: 'Usuarios', icono: 'pareja' }] : []),
])
const irA = (id) => { pestana.value = id; window.scrollTo(0, 0) }
watch(nuevos, (n) => { document.title = n ? `(${n}) Pedidos nuevos · Anonimus` : tituloOriginal }, { immediate: true })

const hora = (p) => { const f = fechaDe(p); return f ? f.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '' }
const mapa = (p) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.direccion)

/* ---------- Resumen ---------- */
// "Vendido" = pedido que no se canceló. Los cancelados no cuentan en las ventas; se muestran aparte.
const periodoResumen = ref('hoy') // hoy | 7 | 30 | todo
const esVenta = (p) => p.estado !== 'cancelado'
const enProceso = (p) => ['nuevo', 'preparando', 'en_camino'].includes(p.estado)
const suma = (l) => l.reduce((s, p) => s + (p.total || 0), 0)
const desdeResumen = () => periodoResumen.value === 'hoy' ? inicioDia() : periodoResumen.value === '7' ? inicioDia(new Date(Date.now() - 6 * 864e5)) : periodoResumen.value === '30' ? inicioDia(new Date(Date.now() - 29 * 864e5)) : null
const enResumen = (p) => { const d = desdeResumen(); const f = fechaDe(p); return !d || !f || f >= d }
const stats = computed(() => {
  const lista = pedidos.value.filter(enResumen)
  const validos = lista.filter(esVenta), canc = lista.filter((p) => p.estado === 'cancelado')
  const ventas = suma(validos)
  return {
    recibidos: lista.length, vendidos: validos.length, entregados: lista.filter((p) => p.estado === 'entregado').length, enProceso: lista.filter(enProceso).length,
    cancelados: canc.length, ventas, perdido: suma(canc), promedio: validos.length ? Math.round(ventas / validos.length) : 0,
    tasa: lista.length ? Math.round((canc.length / lista.length) * 100) : 0,
  }
})
const TITULO_PERIODO = { hoy: 'de hoy', 7: 'de los últimos 7 días', 30: 'de los últimos 30 días', todo: 'de todos los pedidos' }
const dias = computed(() => {
  const out = []
  for (let i = 6; i >= 0; i--) {
    const d0 = inicioDia(new Date(Date.now() - i * 864e5)), d1 = new Date(d0.getTime() + 864e5)
    const dia = pedidos.value.filter((p) => { const f = fechaDe(p); return f && f >= d0 && f < d1 })
    out.push({ clave: d0.toISOString(), nombre: d0.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', ''), pedidos: dia.filter(esVenta).length, cancelados: dia.filter((p) => !esVenta(p)).length, ventas: suma(dia.filter(esVenta)) })
  }
  const max = Math.max(1, ...out.map((d) => d.ventas))
  return out.map((d) => ({ ...d, alto: Math.max(d.ventas ? 6 : 0, Math.round((d.ventas / max) * 100)) }))
})
const topProductos = computed(() => {
  const m = new Map()
  pedidos.value.filter(enResumen).filter(esVenta).forEach((p) => (p.items || []).forEach((i) => m.set(i.nombre, (m.get(i.nombre) || 0) + (i.cantidad || 1))))
  const arr = [...m].map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n).slice(0, 6)
  const max = Math.max(1, ...arr.map((a) => a.n))
  return arr.map((a) => ({ ...a, ancho: Math.round((a.n / max) * 100) }))
})

/* ---------- Acciones ---------- */
async function cambiarEstado(p, nuevo) {
  try { await updateDoc(doc(db, 'pedidos', p.id), { estado: nuevo }) } catch { errorDatos.value = 'No se pudo actualizar el pedido.' }
}
// Pasar de "preparando" a "en camino": primero se elige quién lo lleva. Admin y tienda también pueden cambiar de repartidor después.
const asignando = ref(null) // { pedido, cambio: bool }
bloquearFondo(() => asignando.value)
const repartidores = ref([])
const cargandoRep = ref(false)
const errorRep = ref('')
async function pasar(p) {
  if (SIGUIENTE[p.estado] === 'en_camino') return abrirAsignacion(p, false)
  return cambiarEstado(p, SIGUIENTE[p.estado])
}
async function abrirAsignacion(p, cambio) {
  asignando.value = { pedido: p, cambio }; errorRep.value = ''; repartidores.value = []; cargandoRep.value = true
  try {
    const s = await getDocs(query(collection(db, 'admins'), where('rol', '==', 'repartidor')))
    repartidores.value = s.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((x) => x.activo !== false).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'))
  } catch { errorRep.value = 'No se pudo cargar la lista de repartidores.' }
  finally { cargandoRep.value = false }
}
const cerrarAsignacion = () => (asignando.value = null)
async function asignar(rep) { // rep: un repartidor, o null = sin repartidor (lo entrega la tienda)
  const { pedido, cambio } = asignando.value
  const datos = rep ? { repartidorUid: rep.uid, repartidorNombre: String(rep.nombre || '').slice(0, 60) } : { repartidorUid: deleteField(), repartidorNombre: deleteField() }
  try {
    await updateDoc(doc(db, 'pedidos', pedido.id), cambio ? datos : { estado: 'en_camino', ...datos })
    avisar(rep ? `${pedido.nombre}: lo lleva ${rep.nombre}` : `${pedido.nombre}: en camino sin repartidor`)
    cerrarAsignacion()
  } catch { errorRep.value = 'No se pudo asignar el pedido.' }
}
const marcarEntregado = (p) => cambiarEstado(p, 'entregado')
// Los pedidos no se borran: se cancelan. Un pedido cancelado deja de contar en las ventas (queda en el historial y en el conteo de cancelados).
async function cancelar(p) {
  if (!confirm(`¿Cancelar el pedido de ${p.nombre} (${money(p.total)})? Ya no se contará en las ventas.`)) return
  try { await updateDoc(doc(db, 'pedidos', p.id), { estado: 'cancelado', canceladoEn: serverTimestamp() }) } catch { errorDatos.value = 'No se pudo cancelar el pedido.' }
}
async function reabrir(p) {
  try { await updateDoc(doc(db, 'pedidos', p.id), { estado: 'nuevo', canceladoEn: deleteField(), repartidorUid: deleteField(), repartidorNombre: deleteField() }) } catch { errorDatos.value = 'No se pudo reabrir el pedido.' }
}
const horaCancelado = (p) => (p.canceladoEn?.toDate ? p.canceladoEn.toDate().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '')
</script>

<template>
  <div class="adm">
    <header class="adm-cab">
      <div class="adm-marca"><span class="adm-logo"><Logo /></span><div><b>Panel de administración</b><small>Anonimus Pizza</small></div></div>
      <button v-if="usuario && esMovil" type="button" class="adm-cuenta" aria-label="Cuenta y ajustes" @click="menuCuenta = true">
        <Icono nombre="usuario" :tam="24" /><i v-if="avisosActivos" class="adm-punto" aria-hidden="true"></i>
      </button>
      <div v-else-if="usuario" class="adm-usuario">
        <span class="adm-correo" title="Cuenta conectada"><Icono nombre="usuario" :tam="16" class="txt" />{{ usuario.email }}</span>
        <span v-if="rol" :class="['rol-insignia', rol]">{{ ROL_ETIQUETA[rol] }}</span>
        <label class="interruptor" title="Aviso sonoro de pedidos nuevos"><input type="checkbox" v-model="sonido" @change="guardarSonido" /><span><Icono nombre="campana" :tam="16" class="txt" />Sonido</span></label>
        <button :class="['btn', 'chico', avisosActivos ? '' : 'claro']" :aria-pressed="avisosActivos" title="Notificaciones de pedidos nuevos en este teléfono" @click="alternarAvisos"><Icono nombre="campana" :tam="16" class="txt" />{{ avisosActivos ? 'Avisos activos' : 'Activar avisos' }}</button>
        <button class="btn chico claro" @click="signOut(auth)">Salir</button>
      </div>
      <router-link v-else to="/" class="btn chico claro"><Icono nombre="izquierda" :tam="16" class="txt" />Ir a la tienda</router-link>
    </header>

    <p v-if="ayudaAvisos && textoAvisos" class="sub aviso-ayuda">{{ textoAvisos }}</p>
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
            <button type="button" class="ojo" :aria-label="verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="verClave = !verClave"><Icono :nombre="verClave ? 'ojoCerrado' : 'ojo'" :tam="20" /></button></span>
        </label>
        <p v-if="errorLogin" class="error" role="alert">{{ errorLogin }}</p>
        <button class="btn block" :disabled="entrando">{{ entrando ? 'Entrando…' : 'Entrar' }}</button>
        <p class="o">o</p>
        <button type="button" class="btn block claro" @click="entrarConGoogle">Entrar con Google</button>
      </form>
    </section>

    <!-- Panel -->
    <template v-else>
      <div v-if="errorDatos === 'inactivo'" class="tarjeta sin-permiso" role="alert">
        <h2>Perfil desactivado</h2>
        <p>Tu perfil está desactivado. Pide a un administrador que lo vuelva a activar.</p>
        <button class="btn" @click="signOut(auth)">Salir</button>
      </div>
      <div v-else-if="errorDatos === 'sinpermiso'" class="tarjeta sin-permiso" role="alert">
        <h2>Sin permiso</h2>
        <p>Esta cuenta no es de administrador, por eso no puede ver los pedidos.</p>
        <button class="btn" @click="signOut(auth)">Salir y probar con otra cuenta</button>
      </div>
      <template v-else>
        <p v-if="errorDatos" class="error" role="alert">{{ errorDatos }}</p>
        <div v-if="aviso" class="adm-aviso" role="status">{{ aviso }}</div>

        <div v-if="asignando" class="asig" role="dialog" aria-modal="true" aria-label="Elegir repartidor" @click.self="cerrarAsignacion">
          <div class="asig-caja">
            <div class="asig-cab"><h3 style="margin:0">¿Quién lo lleva?</h3><button type="button" class="asig-x" aria-label="Cerrar" @click="cerrarAsignacion"><Icono nombre="cerrar" :tam="20" /></button></div>
            <p class="desc" style="margin:0 0 12px">{{ asignando.pedido.nombre }} · {{ money(asignando.pedido.total || 0) }} · {{ asignando.pedido.direccion }}</p>
            <p v-if="cargandoRep" class="sub">Cargando repartidores…</p>
            <p v-if="errorRep" class="error" role="alert">{{ errorRep }}</p>
            <p v-else-if="!cargandoRep && !repartidores.length" class="sub">No hay repartidores activos. Un administrador puede registrarlos en <b>Usuarios</b> con el perfil Repartidor.</p>
            <button v-for="rp in repartidores" :key="rp.uid" type="button" :class="['asig-op', { actual: asignando.pedido.repartidorUid === rp.uid }]" @click="asignar(rp)">
              <Icono nombre="usuario" :tam="20" /><span class="grow"><b>{{ rp.nombre }}</b><small v-if="rp.telefono" class="desc"> · {{ rp.telefono }}</small></span><Icono v-if="asignando.pedido.repartidorUid === rp.uid" nombre="check" :tam="18" />
            </button>
            <button v-if="!asignando.cambio" type="button" class="asig-op sin" @click="asignar(null)"><Icono nombre="derecha" :tam="20" /><span class="grow"><b>Sin repartidor</b><small class="desc"> · lo entrega la tienda</small></span></button>
          </div>
        </div>

        <div v-if="menuCuenta && esMovil" class="asig" role="dialog" aria-modal="true" aria-label="Cuenta y ajustes" @click.self="menuCuenta = false">
          <div class="asig-caja cuenta-caja">
            <div class="asig-cab"><h3 style="margin:0">Mi cuenta</h3><button type="button" class="asig-x" aria-label="Cerrar" @click="menuCuenta = false"><Icono nombre="cerrar" :tam="20" /></button></div>
            <p class="adm-correo" style="margin:0 0 6px"><Icono nombre="usuario" :tam="16" class="txt" />{{ usuario.email }}</p>
            <span v-if="rol" :class="['rol-insignia', rol]">{{ ROL_ETIQUETA[rol] }}</span>
            <label class="cuenta-fila"><span><Icono nombre="campana" :tam="20" class="txt" />Sonido de pedidos nuevos</span><input type="checkbox" v-model="sonido" @change="guardarSonido" /></label>
            <button type="button" :class="['btn', 'block', avisosActivos ? '' : 'claro']" :aria-pressed="avisosActivos" @click="alternarAvisos"><Icono nombre="campana" :tam="18" class="txt" />{{ avisosActivos ? 'Avisos activos (tocar para apagar)' : 'Activar avisos en este teléfono' }}</button>
            <p v-if="ayudaAvisos && textoAvisos" class="sub aviso-ayuda" style="margin:8px 0 0">{{ textoAvisos }}</p>
            <router-link to="/" class="btn block claro" style="margin-top:10px"><Icono nombre="izquierda" :tam="18" class="txt" />Ir a la tienda</router-link>
            <button type="button" class="btn block cancelar-btn" style="margin-top:10px" @click="salir">Salir</button>
          </div>
        </div>

        <nav v-if="!soloPedidos && esMovil" class="adm-nav" aria-label="Secciones">
          <button v-for="t in pestanas" :key="t.id" type="button" :class="{ on: pestana === t.id }" :aria-current="pestana === t.id ? 'page' : null" @click="irA(t.id)">
            <span class="adm-nav-ico"><Icono :nombre="t.icono" :tam="24" /><b v-if="t.id === 'pedidos' && nuevos" class="adm-nav-punto">{{ nuevos }}</b></span>{{ t.nombre }}
          </button>
        </nav>

        <nav v-if="!soloPedidos && !esMovil" class="adm-tabs" aria-label="Secciones">
          <button :class="{ on: pestana === 'pedidos' }" @click="pestana = 'pedidos'">Pedidos <b v-if="nuevos" class="punto">{{ nuevos }}</b></button>
          <button v-if="esAdminRol" :class="{ on: pestana === 'resumen' }" @click="pestana = 'resumen'">Resumen</button>
          <button v-if="puedeGestionar" :class="{ on: pestana === 'menu' }" @click="pestana = 'menu'">Menú</button>
          <button v-if="puedeGestionar" :class="{ on: pestana === 'ingredientes' }" @click="pestana = 'ingredientes'">Ingredientes</button>
          <button v-if="esAdminRol" :class="{ on: pestana === 'usuarios' }" @click="pestana = 'usuarios'">Usuarios</button>
        </nav>
        <h2 v-else-if="esRepartidorRol" style="margin:0 0 12px">Pedidos por entregar <small class="desc">· los que te asignó la tienda</small></h2>
        <h2 v-else style="margin:0 0 12px">Pedidos por atender <small class="desc">· del más viejo al más nuevo</small></h2>

        <!-- Pedidos -->
        <section v-if="pestana === 'pedidos'">
          <div class="adm-filtros">
            <input v-model="busqueda" class="buscar" type="search" placeholder="Buscar por nombre, teléfono o folio" aria-label="Buscar pedidos" />
            <select v-if="!soloPedidos" v-model="periodo" aria-label="Periodo">
              <option value="hoy">Hoy</option><option value="7">Últimos 7 días</option><option value="todo">Todos</option>
            </select>
          </div>
          <div v-if="!soloPedidos" class="adm-estados" role="tablist">
            <button v-for="e in [['activos', 'Activos'], ['todos', 'Todos'], ...ESTADOS.map((x) => [x, ETIQUETA[x]])]" :key="e[0]" :class="['chip', { on: estado === e[0] }]" @click="estado = e[0]">{{ e[1] }} <b>{{ conteo[e[0]] }}</b></button>
          </div>

          <p v-if="!visibles.length && !errorDatos" class="sub">{{ esRepartidorRol ? 'No tienes pedidos por entregar. Te avisaremos cuando la tienda te asigne uno.' : esEmpleadoRol ? 'No hay pedidos por atender. ¡Todo al día!' : 'No hay pedidos con estos filtros.' }}</p>
          <div class="adm-lista">
            <article v-for="p in visibles" :key="p.id" :id="'ped-' + p.id" :class="['tarjeta', 'pedido', p.estado, { resaltado: resaltado === p.id }]">
              <div class="fila" style="align-items:flex-start">
                <div class="grow">
                  <b>{{ p.nombre }}</b>
                  <div class="desc">{{ hora(p) }} · folio {{ p.id.slice(0, 6).toUpperCase() }}</div>
                </div>
                <div style="text-align:right"><span :class="['estado', p.estado]">{{ ETIQUETA[p.estado] || p.estado }}</span><div class="precio">{{ money(p.total) }}</div></div>
              </div>
              <div class="contacto">
                <a :href="'tel:' + p.telefono" class="enlace"><Icono nombre="telefono" :tam="16" class="txt" />{{ p.telefono }}</a>
                <a :href="mapa(p)" target="_blank" rel="noopener" class="enlace"><Icono nombre="ubicacion" :tam="16" class="txt" />{{ p.direccion }}</a>
              </div>
              <ul class="lineas"><li v-for="(i, n) in p.items" :key="n"><b>{{ i.cantidad }}×</b> {{ i.nombre }}<span v-if="i.detalle" class="desc"> — {{ i.detalle }}</span></li></ul>
              <div v-if="p.notas" class="aviso">Notas: {{ p.notas }}</div>
              <p v-if="p.estado === 'en_camino' && !esRepartidorRol" class="desc repartidor-linea"><Icono nombre="usuario" :tam="14" class="txt" />{{ p.repartidorNombre ? 'Lo lleva ' + p.repartidorNombre : 'Sin repartidor asignado' }}</p>
              <p v-if="p.estado === 'cancelado'" class="desc" style="margin:8px 0 0">Cancelado<template v-if="horaCancelado(p)"> el {{ horaCancelado(p) }}</template>. No cuenta en las ventas.</p>
              <div class="acciones">
                <button v-if="esRepartidorRol" class="btn verde" @click="marcarEntregado(p)"><Icono nombre="check" :tam="18" class="txt" />Marcar como entregado</button>
                <button v-else-if="SIGUIENTE[p.estado]" class="btn chico verde" @click="pasar(p)">Pasar a: {{ ETIQUETA[SIGUIENTE[p.estado]] }}</button>
                <button v-if="puedeGestionar && p.estado === 'en_camino'" class="btn chico claro" @click="abrirAsignacion(p, true)">Cambiar repartidor</button>
                <button v-if="puedeGestionar && p.estado !== 'cancelado'" class="btn chico cancelar-btn" @click="cancelar(p)"><Icono nombre="cerrar" :tam="16" class="txt" />Cancelar pedido</button>
                <button v-if="puedeGestionar && p.estado === 'cancelado'" class="btn chico claro" @click="reabrir(p)">Reabrir</button>
              </div>
            </article>
          </div>
        </section>

        <!-- Resumen -->
        <section v-else-if="pestana === 'resumen' && esAdminRol">
          <div class="adm-filtros">
            <select v-model="periodoResumen" aria-label="Periodo del resumen">
              <option value="hoy">Hoy</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="todo">Todos los pedidos</option>
            </select>
          </div>
          <div class="resumen resumen-grande">
            <div class="tarjeta" data-k="recibidos"><b>{{ stats.recibidos }}</b>Pedidos recibidos</div>
            <div class="tarjeta" data-k="vendidos"><b>{{ stats.vendidos }}</b>Vendidos <small>(sin cancelados)</small></div>
            <div class="tarjeta" data-k="entregados"><b>{{ stats.entregados }}</b>Entregados</div>
            <div class="tarjeta" data-k="proceso"><b>{{ stats.enProceso }}</b>En proceso</div>
            <div class="tarjeta cancelados" data-k="cancelados"><b>{{ stats.cancelados }}</b>Cancelados</div>
            <div class="tarjeta" data-k="ventas"><b>{{ money(stats.ventas) }}</b>Ventas {{ TITULO_PERIODO[periodoResumen] }}</div>
            <div class="tarjeta cancelados" data-k="perdido"><b>{{ money(stats.perdido) }}</b>Monto cancelado</div>
            <div class="tarjeta" data-k="promedio"><b>{{ money(stats.promedio) }}</b>Ticket promedio</div>
            <div class="tarjeta cancelados" data-k="tasa"><b>{{ stats.tasa }}%</b>Pedidos cancelados</div>
          </div>
          <div class="adm-dos">
            <div class="tarjeta">
              <h3>Ventas de los últimos 7 días</h3>
              <div class="barras" role="img" aria-label="Ventas por día">
                <div v-for="d in dias" :key="d.clave" class="barra"><span class="v">{{ d.ventas ? money(d.ventas) : '' }}</span><i :style="{ height: d.alto + '%' }"></i><span class="n">{{ d.nombre }}</span><span class="canc">{{ d.cancelados ? '× ' + d.cancelados : '' }}</span></div>
              </div>
              <p class="desc" style="margin-top:6px">× = pedidos cancelados ese día (no suman a las ventas).</p>
            </div>
            <div class="tarjeta">
              <h3>Más vendidos {{ TITULO_PERIODO[periodoResumen] }}</h3>
              <p v-if="!topProductos.length" class="desc">Aún no hay datos.</p>
              <div v-for="t in topProductos" :key="t.nombre" class="top"><div class="fila"><span class="grow">{{ t.nombre }}</span><b>{{ t.n }}</b></div><div class="riel"><i :style="{ width: t.ancho + '%' }"></i></div></div>
            </div>
          </div>
          <p class="desc">Las ventas y lo más vendido no incluyen pedidos cancelados. Se calcula con los últimos 500 pedidos.</p>
          <AdminHistorial :pedidos="pedidos" />
        </section>

        <!-- Menú de la tienda -->
        <AdminMenu v-else-if="pestana === 'menu' && puedeGestionar" :puede-restablecer="esAdminRol" />
        <AdminIngredientes v-else-if="pestana === 'ingredientes' && puedeGestionar" :puede-restablecer="esAdminRol" />

        <!-- Usuarios (solo admin) -->
        <AdminUsuarios v-else-if="pestana === 'usuarios' && esAdminRol" :uid-actual="usuario.uid" />
      </template>
    </template>
  </div>
</template>

<style>
.adm { max-width: 1100px; margin: 0 auto; }
.adm-cuenta { position: relative; width: 48px; height: 48px; border-radius: 50%; background: var(--sup); border: 1px solid var(--borde); display: grid; place-items: center; flex: none; }
.adm-punto { position: absolute; top: 9px; right: 9px; width: 10px; height: 10px; border-radius: 50%; background: var(--verde); border: 2px solid var(--fondo); }
.cuenta-fila { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 0; margin: 8px 0; border-top: 1px solid var(--borde); border-bottom: 1px solid var(--borde); min-height: 56px; }
.cuenta-fila input { width: 26px; height: 26px; accent-color: var(--verde); }
.adm-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; display: flex; background: #160c08f5; border-top: 1px solid var(--borde); padding-bottom: env(safe-area-inset-bottom, 0px); backdrop-filter: blur(8px); }
.adm-nav button { flex: 1; min-width: 0; min-height: 64px; display: grid; justify-items: center; align-content: center; gap: 3px; background: none; border: 0; color: var(--suave); font-size: .68rem; font-weight: 700; padding: 6px 2px; }
.adm-nav button.on { color: var(--ambar); }
.adm-nav button.on .adm-nav-ico { background: #ffc24724; }
.adm-nav-ico { position: relative; width: 52px; height: 30px; border-radius: 999px; display: grid; place-items: center; transition: background .15s; }
.adm-nav-punto { position: absolute; top: -4px; right: 2px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--rojo); color: #fff; font-size: .68rem; display: grid; place-items: center; }
@media (max-width: 720px) { .pagina.admin { padding-bottom: calc(92px + env(safe-area-inset-bottom, 0px)); } .adm-cab { flex-wrap: nowrap; } .adm-marca { min-width: 0; } .adm-marca b { font-size: 1.15rem; line-height: 1.05; } }
.adm-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--borde); }
.adm-marca { display: flex; align-items: center; gap: 12px; }
.adm-marca b { display: block; font: 800 1.4rem var(--display); text-transform: uppercase; letter-spacing: .03em; }
.adm-marca small { color: var(--suave); }
.adm-logo { width: 46px; flex: none; }
.adm-usuario { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.adm-correo { font-size: .85rem; color: var(--suave); word-break: break-all; }
.interruptor { display: inline-flex; align-items: center; gap: 6px; font-size: .9rem; color: var(--suave); }
.adm-login { max-width: 420px; margin: 24px auto; }
.adm-login h1 { font-size: 2.2rem; margin-bottom: 14px; }
.clave { position: relative; display: block; }
.clave input { padding-right: 48px; }
.ojo { position: absolute; right: 6px; top: 50%; transform: translateY(-38%); background: none; border: 0; font-size: 1.2rem; padding: 6px 8px; }
.o { text-align: center; color: var(--suave); margin: 12px 0; }
.sin-permiso { max-width: 460px; margin: 30px auto; text-align: center; }
.adm-aviso { position: sticky; top: 8px; z-index: 5; background: var(--verde); color: #fff; font-weight: 700; padding: 12px 16px; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 6px 18px #0007; }
.adm-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.adm-tabs button { padding: 10px 18px; border-radius: 999px; background: var(--sup); border: 1px solid var(--borde); color: var(--suave); font-weight: 700; }
.adm-tabs button.on { background: var(--rojo); border-color: var(--rojo); color: #fff; }
.punto { background: #fff; color: var(--rojo2); border-radius: 999px; padding: 0 7px; margin-left: 4px; font-size: .8rem; }
.adm-filtros { display: flex; gap: 10px; margin-bottom: 10px; }
.adm-filtros .buscar, .adm-filtros select { background: var(--sup); color: var(--texto); border: 1.5px solid var(--borde); border-radius: 12px; padding: 11px 14px; font-family: inherit; }
.adm-filtros .buscar { flex: 1; min-width: 0; }
.adm-estados { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 12px; scrollbar-width: none; }
.adm-estados::-webkit-scrollbar { display: none; }
.adm-estados .chip { flex: none; font-size: .88rem; padding: 7px 12px; }
.adm-estados .chip b { margin-left: 4px; opacity: .85; }
.adm-lista { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
.pedido { margin: 0; border-left: 5px solid var(--borde); }
.repartidor-linea { margin: 8px 0 0; }
.asig { position: fixed; inset: 0; z-index: 70; background: #000b; display: flex; align-items: flex-end; justify-content: center; overscroll-behavior: contain; }
.asig-caja { background: var(--fondo); border: 1px solid var(--borde); border-radius: 22px 22px 0 0; width: 100%; max-width: 480px; max-height: 88dvh; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; padding: 18px 16px calc(18px + env(safe-area-inset-bottom, 0px)); }
.asig-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.asig-x { background: var(--sup2); border: 1px solid var(--borde); width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; }
.asig-op { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; background: var(--sup); border: 1.5px solid var(--borde); border-radius: 14px; padding: 14px; margin-bottom: 8px; min-height: 52px; }
.asig-op.actual { border-color: var(--verde); } .asig-op.sin { border-style: dashed; color: var(--suave); }
@media (min-width: 640px) { .asig { align-items: center; } .asig-caja { border-radius: 22px; } }
.pedido.resaltado { outline: 3px solid var(--ambar); outline-offset: 2px; animation: late 1s ease-in-out 3; }
@keyframes late { 50% { box-shadow: 0 0 0 8px #ffc24733; } }
.pedido.nuevo { border-left-color: var(--rojo); } .pedido.preparando { border-left-color: #e0a100; } .pedido.en_camino { border-left-color: #3b82f6; } .pedido.entregado { border-left-color: var(--verde); } .pedido.cancelado { opacity: .65; }
.contacto { display: flex; flex-direction: column; gap: 4px; margin: 10px 0 6px; }
.enlace { color: #ffd48a; font-weight: 600; word-break: break-word; }
.lineas { margin: 6px 0 0; padding-left: 20px; }
.rol-insignia { font-size: .75rem; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: var(--sup2); border: 1px solid var(--borde); }
.rol-insignia.admin { background: #4a1d17; border-color: #8a3128; color: #ffb3aa; } .rol-insignia.tienda { background: #14391f; border-color: #1f6b3b; color: #b9efcd; } .rol-insignia.repartidor { background: #4a3a0c; border-color: #8a6a1c; color: #ffd86b; } .rol-insignia.empleado { background: #1b2f55; border-color: #2c4f93; color: #bcd3ff; }
.cancelar-btn { background: #e8392b1f; border: 1.5px solid #e8392b; color: #ff6a5c; box-shadow: none; }
.resumen-grande { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.resumen .cancelados b { color: #ff6a5c; }
.resumen small { color: var(--suave); }
.barra .canc { font-size: .68rem; color: #ff6a5c; min-height: 1em; }
.basura-btn { background: #e8392b1f; border: 1.5px solid #e8392b; color: #ff4d3f; box-shadow: none; padding: 8px 12px; }
.resumen .tarjeta { font-size: .85rem; color: var(--suave); }
.adm-dos { display: grid; gap: 12px; }
.barras { display: flex; align-items: flex-end; gap: 8px; height: 190px; margin-top: 12px; }
.barra { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; min-width: 0; }
.barra i { display: block; width: 100%; max-width: 44px; border-radius: 8px 8px 0 0; background: linear-gradient(var(--ambar), #d98a00); }
.barra .v { font-size: .68rem; color: var(--suave); white-space: nowrap; } .barra .n { font-size: .78rem; text-transform: capitalize; }
.top { margin: 10px 0; } .riel { height: 8px; border-radius: 4px; background: var(--sup2); margin-top: 4px; } .riel i { display: block; height: 100%; border-radius: 4px; background: var(--verde); }
@media (min-width: 900px) { .adm-lista { grid-template-columns: repeat(2, minmax(0, 1fr)); } .adm-dos { grid-template-columns: 1.3fr 1fr; } }
</style>
