<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { auth } from '../firebase/auth.js'
import { db } from '../firebase/db.js'
import { money } from '../data/menu.js'
import { leerHistorial, borrarHistorial, CLAVE_SESION } from '../store/historial.js'
import TicketPedido from '../components/TicketPedido.vue'

/* ---------- Sesión ---------- */
const usuario = ref(null)
const cargando = ref(true)
const modo = ref('entrar') // entrar | crear
const correo = ref('')
const clave = ref('')
const verClave = ref(false)
const trabajando = ref(false)
const error = ref('')
const info = ref('')

function mensaje(e) {
  const c = e?.code || ''
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Correo o contraseña incorrectos.'
  if (c.includes('email-already-in-use')) return 'Ese correo ya tiene una cuenta. Inicia sesión.'
  if (c.includes('weak-password')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (c.includes('invalid-email')) return 'Escribe un correo válido.'
  if (c.includes('too-many-requests')) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  if (c.includes('network')) return 'Sin conexión. Revisa tu internet.'
  if (c.includes('operation-not-allowed')) return 'Este tipo de acceso aún no está activado.'
  return 'No se pudo completar. Inténtalo de nuevo.'
}
async function enviar() {
  error.value = ''; info.value = ''
  if (!correo.value.trim() || !clave.value) return (error.value = 'Escribe tu correo y tu contraseña.')
  trabajando.value = true
  try {
    if (modo.value === 'crear') await createUserWithEmailAndPassword(auth, correo.value.trim(), clave.value)
    else await signInWithEmailAndPassword(auth, correo.value.trim(), clave.value)
    clave.value = ''
  } catch (e) { error.value = mensaje(e) } finally { trabajando.value = false }
}
async function conGoogle() {
  error.value = ''; info.value = ''
  try { await signInWithPopup(auth, new GoogleAuthProvider()) }
  catch (e) { if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) error.value = mensaje(e) }
}
async function olvide() {
  error.value = ''; info.value = ''
  if (!correo.value.trim()) return (error.value = 'Escribe tu correo y vuelve a tocar “¿Olvidaste tu contraseña?”.')
  try { await sendPasswordResetEmail(auth, correo.value.trim()); info.value = 'Te enviamos un correo para cambiar tu contraseña.' } catch (e) { error.value = mensaje(e) }
}
function salir() { signOut(auth) }

/* ---------- Pedidos ---------- */
const remotos = ref([]) // de la cuenta (Firestore)
const errorDatos = ref('')
const locales = ref(leerHistorial()) // hechos en este dispositivo
let cortar = null

onMounted(() => {
  onAuthStateChanged(auth, (u) => {
    usuario.value = u; cargando.value = false
    try { u ? localStorage.setItem(CLAVE_SESION, '1') : localStorage.removeItem(CLAVE_SESION) } catch { /* sin almacenamiento */ }
    cortar?.(); remotos.value = []; errorDatos.value = ''
    if (u) {
      // Solo se piden los pedidos de esta cuenta (sin ordenar en el servidor: así no hace falta ningún índice). Se ordenan aquí.
      cortar = onSnapshot(query(collection(db, 'pedidos'), where('uid', '==', u.uid)), (s) => {
        remotos.value = s.docs.map((d) => ({ id: d.id, ...d.data() }))
      }, () => { errorDatos.value = 'No se pudieron cargar tus pedidos.' })
    }
  })
})
onUnmounted(() => cortar?.())

const fechaDe = (p) => (p.creado?.toDate ? p.creado.toDate() : p.fecha ? new Date(p.fecha) : new Date())
// Pedidos de la cuenta + los hechos en este dispositivo que no estén ya en la cuenta; del más reciente al más antiguo.
const pedidos = computed(() => {
  const ids = new Set(remotos.value.map((p) => p.id))
  const todos = [
    ...remotos.value.map((p) => ({ ...p, fecha: fechaDe(p), enCuenta: true })),
    ...locales.value.filter((p) => !ids.has(p.id)).map((p) => ({ ...p, fecha: fechaDe(p), enCuenta: false })),
  ]
  return todos.sort((a, b) => b.fecha - a.fecha)
})

const dia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }
function tituloDia(d) {
  const hoy = dia(new Date()), t = dia(d)
  if (t === hoy) return 'Hoy'
  if (t === hoy - 864e5) return 'Ayer'
  const texto = new Date(d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1) // "Viernes, 13 de noviembre de 2026"
}
const grupos = computed(() => {
  const out = []
  for (const p of pedidos.value) {
    const t = tituloDia(p.fecha)
    if (!out.length || out[out.length - 1].titulo !== t) out.push({ titulo: t, pedidos: [] })
    out[out.length - 1].pedidos.push(p)
  }
  return out
})
const hora = (d) => new Date(d).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })

const PASOS = [['nuevo', 'Recibido'], ['preparando', 'Preparando'], ['en_camino', 'En camino'], ['entregado', 'Entregado']]
const ETIQ = { nuevo: 'Recibido', preparando: 'Preparando', en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado' }
const abiertos = ref(new Set())
function alternar(id) { const s = new Set(abiertos.value); s.has(id) ? s.delete(id) : s.add(id); abiertos.value = s }
const resumen = (p) => (p.items || []).map((i) => `${i.cantidad}× ${i.nombre}`).join(', ')

/* ---------- Mis datos guardados en este dispositivo ---------- */
const CLAVE_DATOS = 'anonimus-datos-cliente'
const datos = ref(null)
const leerDatos = () => { try { const d = JSON.parse(localStorage.getItem(CLAVE_DATOS)); return d && Object.values(d).some((v) => v) ? d : null } catch { return null } }
datos.value = leerDatos()
function borrarDatos() { try { localStorage.removeItem(CLAVE_DATOS) } catch { /* sin almacenamiento */ } datos.value = null }
function borrarHistorialLocal() {
  if (!confirm('¿Borrar la lista de pedidos guardada en este dispositivo? Los pedidos de tu cuenta no se borran.')) return
  borrarHistorial(); locales.value = []
}
const inicial = computed(() => (usuario.value?.displayName || usuario.value?.email || '?').trim()[0]?.toUpperCase() || '?')
</script>

<template>
  <h1 class="titulo">Mi <em>perfil</em></h1>

  <p v-if="cargando" class="sub">Cargando…</p>
  <template v-else>
    <!-- Cuenta -->
    <section v-if="usuario" class="tarjeta cuenta">
      <div class="fila">
        <div class="avatar" aria-hidden="true"><img v-if="usuario.photoURL" :src="usuario.photoURL" alt="" referrerpolicy="no-referrer" width="52" height="52" /><span v-else>{{ inicial }}</span></div>
        <div class="grow"><b>{{ usuario.displayName || 'Mi cuenta' }}</b><div class="desc">{{ usuario.email }}</div></div>
        <button class="btn chico claro" @click="salir">Cerrar sesión</button>
      </div>
      <p class="desc" style="margin-top:10px">Tus pedidos quedan en tu cuenta y puedes verlos desde cualquier dispositivo.</p>
    </section>

    <section v-else class="tarjeta acceso">
      <h2>Guarda tus pedidos</h2>
      <p class="desc" style="margin-bottom:12px">Crea una cuenta o inicia sesión para ver tus pedidos y tickets desde cualquier dispositivo y seguir el estado de cada uno.</p>
      <button type="button" class="btn block claro" @click="conGoogle">Continuar con Google</button>
      <p class="o">o con tu correo</p>
      <form @submit.prevent="enviar" novalidate>
        <label class="campo">Correo
          <input v-model="correo" type="email" autocomplete="email" inputmode="email" />
        </label>
        <label class="campo">Contraseña
          <span class="clave"><input v-model="clave" :type="verClave ? 'text' : 'password'" :autocomplete="modo === 'crear' ? 'new-password' : 'current-password'" />
            <button type="button" class="ojo" :aria-label="verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="verClave = !verClave">{{ verClave ? '🙈' : '👁️' }}</button></span>
        </label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="info" class="aviso" role="status">{{ info }}</p>
        <button class="btn block" :disabled="trabajando">{{ trabajando ? 'Un momento…' : modo === 'crear' ? 'Crear mi cuenta' : 'Entrar' }}</button>
      </form>
      <p class="cambiar">
        <button type="button" class="enlace-btn" @click="modo = modo === 'crear' ? 'entrar' : 'crear'; error = ''; info = ''">{{ modo === 'crear' ? 'Ya tengo cuenta' : 'Crear una cuenta' }}</button>
        <button v-if="modo === 'entrar'" type="button" class="enlace-btn" @click="olvide">¿Olvidaste tu contraseña?</button>
      </p>
    </section>

    <!-- Pedidos -->
    <section class="mis-pedidos">
      <div class="seccion-cab"><h2>Mis pedidos</h2><span v-if="pedidos.length" class="desc">{{ pedidos.length }} en total · del más reciente al más antiguo</span></div>
      <p v-if="!usuario && pedidos.length" class="aviso">Estos son los pedidos hechos <b>en este dispositivo</b>. Inicia sesión para guardarlos en tu cuenta y ver cómo va cada uno.</p>
      <p v-if="errorDatos" class="error" role="alert">{{ errorDatos }}</p>

      <div v-if="!pedidos.length" class="tarjeta vacio">
        <p>Aún no tienes pedidos.</p>
        <router-link to="/arma" class="btn">Arma tu primera pizza</router-link>
      </div>

      <template v-for="g in grupos" :key="g.titulo">
        <h3 class="dia">{{ g.titulo }}</h3>
        <article v-for="p in g.pedidos" :key="p.id" class="tarjeta pedido-cli" :data-folio="p.id.slice(0, 6).toUpperCase()">
          <div class="fila" style="align-items:flex-start">
            <div class="grow">
              <b>{{ hora(p.fecha) }}</b> <span class="desc">· folio {{ p.id.slice(0, 6).toUpperCase() }}</span>
              <p class="desc resumen-linea">{{ resumen(p) }}</p>
            </div>
            <div style="text-align:right">
              <div class="precio">{{ money(p.total) }}</div>
              <span v-if="p.enCuenta" :class="['estado', p.estado]">{{ ETIQ[p.estado] || p.estado }}</span>
              <span v-else class="estado enviado">Enviado</span>
            </div>
          </div>

          <ol v-if="p.enCuenta && p.estado !== 'cancelado'" class="progreso" :aria-label="'Estado: ' + (ETIQ[p.estado] || p.estado)">
            <li v-for="(s, n) in PASOS" :key="s[0]" :class="{ hecho: PASOS.findIndex((x) => x[0] === p.estado) >= n }"><i></i><span>{{ s[1] }}</span></li>
          </ol>

          <button type="button" class="btn chico claro" style="margin-top:10px" :aria-expanded="abiertos.has(p.id)" @click="alternar(p.id)">{{ abiertos.has(p.id) ? 'Ocultar ticket' : 'Ver ticket' }}</button>
          <div v-if="abiertos.has(p.id)" style="margin-top:12px"><TicketPedido :pedido="p" /></div>
        </article>
      </template>
      <p v-if="locales.length" style="margin-top:12px"><button class="enlace-btn" @click="borrarHistorialLocal">Borrar la lista de este dispositivo</button></p>
    </section>

    <!-- Datos guardados -->
    <section v-if="datos" class="tarjeta mis-datos">
      <h3>Mis datos de entrega</h3>
      <p class="desc">Se guardan solo en este dispositivo y se rellenan en tu próxima compra.</p>
      <p style="margin:8px 0 0"><b>{{ datos.nombre }}</b> · {{ datos.telefono }}<br />{{ datos.calle }}<template v-if="datos.referencia"> ({{ datos.referencia }})</template>, {{ datos.localidad }}</p>
      <button class="enlace-btn" style="margin-top:8px" @click="borrarDatos">Borrar mis datos</button>
    </section>
  </template>
</template>

<style>
.cuenta .avatar { width: 52px; height: 52px; border-radius: 50%; background: var(--rojo); display: grid; place-items: center; font: 800 1.5rem var(--display); overflow: hidden; flex: none; }
.cuenta .avatar img { width: 100%; height: 100%; object-fit: cover; }
.acceso { max-width: 460px; }
.acceso .o { text-align: center; color: var(--suave); margin: 12px 0; }
.acceso .clave { position: relative; display: block; } .acceso .clave input { padding-right: 48px; }
.acceso .ojo { position: absolute; right: 6px; top: 50%; transform: translateY(-38%); background: none; border: 0; font-size: 1.2rem; padding: 6px 8px; }
.cambiar { display: flex; flex-wrap: wrap; gap: 6px 18px; justify-content: space-between; margin: 12px 0 0; }
.mis-pedidos { margin-top: 22px; max-width: 760px; }
.dia { margin: 18px 0 8px; color: var(--ambar); font-size: 1.1rem; }
.pedido-cli { margin-bottom: 10px; }
.resumen-linea { margin: 4px 0 0; }
.estado.enviado { background: #444; }
.progreso { display: flex; list-style: none; padding: 0; margin: 12px 0 0; gap: 4px; }
.progreso li { flex: 1; text-align: center; font-size: .7rem; color: var(--suave); position: relative; }
.progreso li i { display: block; height: 6px; border-radius: 3px; background: var(--sup2); margin-bottom: 5px; }
.progreso li.hecho { color: var(--texto); } .progreso li.hecho i { background: var(--verde); }
.vacio { text-align: center; }
.mis-datos { margin-top: 22px; max-width: 760px; }
</style>
