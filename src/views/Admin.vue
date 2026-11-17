<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { collection, query, orderBy, limit, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { app } from '../firebase/config.js'
import { db } from '../firebase/db.js'
import { money } from '../data/menu.js'

const auth = getAuth(app)
const usuario = ref(null)
const cargando = ref(true)
const pedidos = ref([])
const error = ref('')
const soloHoy = ref(true)
let cortarPedidos = null

const SIGUIENTE = { nuevo: 'preparando', preparando: 'en_camino', en_camino: 'entregado' }
const ETIQUETA = { nuevo: 'Nuevo', preparando: 'Preparando', en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado' }

const esHoy = (p) => p.creado && p.creado.toDate().toDateString() === new Date().toDateString()
const visibles = computed(() => (soloHoy.value ? pedidos.value.filter(esHoy) : pedidos.value))
const delDia = computed(() => pedidos.value.filter(esHoy))
const ventasHoy = computed(() => delDia.value.filter((p) => p.estado !== 'cancelado').reduce((s, p) => s + p.total, 0))
const pendientes = computed(() => delDia.value.filter((p) => p.estado === 'nuevo' || p.estado === 'preparando' || p.estado === 'en_camino').length)

const hora = (p) => (p.creado ? p.creado.toDate().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '')

function escuchar() {
  cortarPedidos?.()
  error.value = ''
  const q = query(collection(db, 'pedidos'), orderBy('creado', 'desc'), limit(200))
  cortarPedidos = onSnapshot(q, (s) => {
    pedidos.value = s.docs.map((d) => ({ id: d.id, ...d.data() }))
  }, (e) => {
    pedidos.value = []
    error.value = e.code === 'permission-denied'
      ? 'Esta cuenta no tiene permiso para ver los pedidos.'
      : 'No se pudieron cargar los pedidos.'
  })
}

onMounted(() => {
  onAuthStateChanged(auth, (u) => {
    usuario.value = u
    cargando.value = false
    if (u) escuchar()
    else { cortarPedidos?.(); pedidos.value = [] }
  })
})
onUnmounted(() => cortarPedidos?.())

async function entrar() {
  error.value = ''
  try { await signInWithPopup(auth, new GoogleAuthProvider()) }
  catch (e) { if (e.code !== 'auth/popup-closed-by-user') error.value = 'No se pudo iniciar sesión con Google.' }
}

async function cambiarEstado(p, estado) {
  try { await updateDoc(doc(db, 'pedidos', p.id), { estado }) }
  catch { error.value = 'No se pudo actualizar el pedido.' }
}
async function borrar(p) {
  if (!confirm(`¿Borrar el pedido de ${p.nombre}? No se puede deshacer.`)) return
  try { await deleteDoc(doc(db, 'pedidos', p.id)) }
  catch { error.value = 'No se pudo borrar el pedido.' }
}
</script>

<template>
  <div class="adm-barra">
    <h1 class="titulo" style="margin:0">Panel de pedidos</h1>
    <div v-if="usuario" class="fila">
      <span class="desc">{{ usuario.email }}</span>
      <button class="btn chico claro" @click="signOut(auth)">Salir</button>
    </div>
  </div>

  <p v-if="cargando" class="sub">Cargando…</p>

  <div v-else-if="!usuario" class="tarjeta" style="max-width:420px">
    <p>Acceso solo para el administrador.</p>
    <button class="btn block" @click="entrar">Entrar con Google</button>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </div>

  <template v-else>
    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <div class="resumen">
      <div class="tarjeta"><b>{{ delDia.length }}</b>Pedidos de hoy</div>
      <div class="tarjeta"><b>{{ pendientes }}</b>Pendientes</div>
      <div class="tarjeta"><b>{{ money(ventasHoy) }}</b>Ventas de hoy</div>
    </div>

    <label class="desc" style="display:flex;gap:6px;align-items:center;margin-bottom:12px">
      <input type="checkbox" v-model="soloHoy" /> Solo pedidos de hoy
    </label>

    <p v-if="!visibles.length && !error" class="sub">No hay pedidos.</p>

    <article v-for="p in visibles" :key="p.id" class="tarjeta">
      <div class="fila" style="align-items:flex-start">
        <div class="grow">
          <b>{{ p.nombre }}</b> · <a :href="'tel:' + p.telefono">{{ p.telefono }}</a>
          <div class="desc">{{ p.direccion }}</div>
          <div class="desc">{{ hora(p) }} · folio {{ p.id.slice(0, 6).toUpperCase() }}</div>
        </div>
        <div style="text-align:right">
          <span :class="['estado', p.estado]">{{ ETIQUETA[p.estado] || p.estado }}</span>
          <div class="precio" style="margin-top:4px">{{ money(p.total) }}</div>
        </div>
      </div>
      <ul style="margin:8px 0 0;padding-left:18px">
        <li v-for="(i, n) in p.items" :key="n">{{ i.cantidad }} × {{ i.nombre }}<span v-if="i.detalle" class="desc"> — {{ i.detalle }}</span></li>
      </ul>
      <div v-if="p.notas" class="aviso">Notas: {{ p.notas }}</div>
      <div class="acciones">
        <button v-if="SIGUIENTE[p.estado]" class="btn chico" @click="cambiarEstado(p, SIGUIENTE[p.estado])">
          Pasar a: {{ ETIQUETA[SIGUIENTE[p.estado]] }}
        </button>
        <button v-if="p.estado !== 'cancelado' && p.estado !== 'entregado'" class="btn chico claro" @click="cambiarEstado(p, 'cancelado')">Cancelar</button>
        <button class="btn chico rojo" @click="borrar(p)">Borrar</button>
      </div>
    </article>
  </template>
</template>
