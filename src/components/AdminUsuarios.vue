<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { dbAdmin as db } from '../firebase/admin.js'
import { firebaseConfig, correoDeTelefono } from '../firebase/claves.js'

const props = defineProps({ uidActual: { type: String, default: '' } })

const personal = ref([])
const cargando = ref(true)
const error = ref('')
const aviso = ref('')
let cortar = null, tAviso

const ROLES = [
  { id: 'admin', nombre: 'Administrador', desc: 'Ve y configura todo: pedidos, ventas, menú, fotos, promociones y usuarios.' },
  { id: 'tienda', nombre: 'Tienda', desc: 'Pedidos (ver, avanzar y cancelar) y menú con promociones y fotos. No ve ventas ni usuarios.' },
  { id: 'empleado', nombre: 'Empleado', desc: 'Solo los pedidos por atender; puede avanzarlos (preparando, en camino, entregado).' },
]
const nombreRol = (r) => ROLES.find((x) => x.id === r)?.nombre || r
// Un perfil sin campo `rol` (creado a mano en la consola) cuenta como administrador, igual que en las reglas.
const rolDe = (p) => p.rol || 'admin'

onMounted(() => {
  cortar = onSnapshot(collection(db, 'admins'), (s) => {
    personal.value = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
    cargando.value = false
  }, () => { error.value = 'No se pudo cargar la lista.'; cargando.value = false })
})
onUnmounted(() => cortar?.())
function avisar(t) { aviso.value = t; clearTimeout(tAviso); tAviso = setTimeout(() => (aviso.value = ''), 3500) }

/* ---------- Registrar a alguien ---------- */
const f = ref({ nombre: '', telefono: '', clave: '', rol: 'empleado' })
const verClave = ref(false)
const trabajando = ref(false)
const errForm = ref('')

// La cuenta se crea con una instancia temporal de Firebase para no cerrar la sesión del administrador.
async function uidDeCuenta(correo, clave) {
  const app2 = initializeApp(firebaseConfig, 'registro-' + Date.now())
  const auth2 = getAuth(app2)
  if (import.meta.env.VITE_EMULATOR === '1') connectAuthEmulator(auth2, 'http://127.0.0.1:9099', { disableWarnings: true })
  try {
    try { return (await createUserWithEmailAndPassword(auth2, correo, clave)).user.uid }
    catch (e) {
      // Si el teléfono ya tenía cuenta (por ejemplo, un registro que quedó a medias), se reutiliza cuando la contraseña coincide.
      if (e.code === 'auth/email-already-in-use') return (await signInWithEmailAndPassword(auth2, correo, clave)).user.uid
      throw e
    }
  } finally { try { await signOut(auth2) } catch { /* ya cerrada */ } await deleteApp(app2) }
}

function validar() {
  const n = f.value.nombre.trim(), tel = f.value.telefono.replace(/\D/g, '')
  if (!n) return 'Escribe el nombre.'
  if (n.length > 60) return 'El nombre es muy largo (máximo 60 letras).'
  if (tel.length !== 10) return 'El teléfono debe tener 10 dígitos.'
  if (f.value.clave.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
  if (personal.value.some((p) => (p.telefono || '').replace(/\D/g, '') === tel)) return 'Ese teléfono ya está en la lista. Edítalo ahí.'
  return ''
}
async function registrar() {
  errForm.value = validar()
  if (errForm.value) return
  trabajando.value = true; error.value = ''
  const tel = f.value.telefono.replace(/\D/g, '')
  try {
    const uid = await uidDeCuenta(correoDeTelefono(tel), f.value.clave)
    await setDoc(doc(db, 'admins', uid), { nombre: f.value.nombre.trim(), telefono: tel, rol: f.value.rol, activo: true, creado: serverTimestamp(), creadoPor: props.uidActual })
    avisar(`${f.value.nombre.trim()} ya puede entrar como ${nombreRol(f.value.rol)} con el teléfono ${tel}`)
    f.value = { nombre: '', telefono: '', clave: '', rol: f.value.rol }
  } catch (e) {
    const c = e?.code || ''
    errForm.value = c.includes('invalid-credential') || c.includes('wrong-password') ? 'Ese teléfono ya tiene una cuenta con otra contraseña. Si es alguien de la lista, edítalo ahí; si no, bórrala en la consola de Firebase y vuelve a intentar.'
      : c.includes('weak-password') ? 'La contraseña debe tener al menos 6 caracteres.'
      : c.includes('operation-not-allowed') ? 'El acceso con correo y contraseña no está activado en Firebase.'
      : c.includes('permission-denied') ? 'Esta cuenta no tiene permiso para registrar personal.'
      : c.includes('network') ? 'Sin conexión. Revisa tu internet.' : 'No se pudo registrar. Inténtalo de nuevo.'
  } finally { trabajando.value = false }
}

/* ---------- Cambiar el rol o desactivar ---------- */
const adminsActivos = computed(() => personal.value.filter((p) => rolDe(p) === 'admin' && p.activo !== false).length)
const esUltimoAdmin = (p) => rolDe(p) === 'admin' && p.activo !== false && adminsActivos.value <= 1
async function cambiar(p, campos, msg) {
  error.value = ''
  try { await updateDoc(doc(db, 'admins', p.id), campos); avisar(msg) }
  catch { error.value = 'No se pudo guardar el cambio.' }
}
const cambiarRol = (p, rol) => {
  if (p.id === props.uidActual) return (error.value = 'No puedes cambiar tu propio rol.')
  if (esUltimoAdmin(p) && rol !== 'admin') return (error.value = 'Debe quedar al menos un administrador.')
  return cambiar(p, { rol }, `${p.nombre} ahora es ${nombreRol(rol)}`)
}
const alternarActivo = (p) => {
  if (p.id === props.uidActual) return (error.value = 'No puedes desactivar tu propia cuenta.')
  if (esUltimoAdmin(p)) return (error.value = 'Debe quedar al menos un administrador activo.')
  return cambiar(p, { activo: p.activo === false }, p.activo === false ? `${p.nombre} fue activado` : `${p.nombre} fue desactivado: ya no puede entrar`)
}
const fecha = (p) => (p.creado?.toDate ? p.creado.toDate().toLocaleDateString('es-MX', { dateStyle: 'medium' }) : '')
</script>

<template>
  <section class="au">
    <div class="am-cab"><div><h2 style="margin:0">Usuarios</h2><p class="desc">Registra a quien trabaja contigo y elige qué puede hacer cada quien.</p></div></div>

    <div v-if="aviso" class="adm-aviso" role="status">{{ aviso }}</div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <form class="tarjeta au-form" @submit.prevent="registrar" novalidate>
      <h3>Registrar un usuario</h3>
      <div class="dos">
        <label class="campo">Nombre
          <input v-model="f.nombre" maxlength="60" autocomplete="off" placeholder="Ej. María López" />
        </label>
        <label class="campo">Teléfono (10 dígitos)
          <input v-model="f.telefono" type="tel" inputmode="numeric" maxlength="14" autocomplete="off" />
        </label>
        <label class="campo">Contraseña (mínimo 6)
          <span class="clave"><input v-model="f.clave" :type="verClave ? 'text' : 'password'" autocomplete="new-password" />
            <button type="button" class="ojo" :aria-label="verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="verClave = !verClave">{{ verClave ? '🙈' : '👁️' }}</button></span>
        </label>
        <label class="campo">Perfil
          <select v-model="f.rol"><option v-for="r in ROLES" :key="r.id" :value="r.id">{{ r.nombre }}</option></select>
        </label>
      </div>
      <p class="desc" style="margin:-4px 0 10px">{{ ROLES.find((r) => r.id === f.rol).desc }}</p>
      <p class="desc" style="margin:0 0 10px">Entrará en el panel con su <b>teléfono</b> y esa contraseña. Entrégale la contraseña en persona; por seguridad no se vuelve a mostrar.</p>
      <p v-if="errForm" class="error" role="alert">{{ errForm }}</p>
      <button class="btn verde" :disabled="trabajando">{{ trabajando ? 'Registrando…' : 'Registrar usuario' }}</button>
    </form>

    <h3 style="margin:18px 0 8px">Personal registrado</h3>
    <p v-if="cargando" class="sub">Cargando…</p>
    <p v-else-if="!personal.length" class="sub">Aún no hay nadie registrado.</p>
    <div class="au-lista">
      <article v-for="p in personal" :key="p.id" :class="['tarjeta', 'au-item', { inactivo: p.activo === false }]">
        <div class="fila" style="align-items:flex-start">
          <div class="grow">
            <b>{{ p.nombre }}</b><span v-if="p.id === uidActual" class="desc"> (tú)</span>
            <div class="desc"><template v-if="p.telefono">📞 {{ p.telefono }}</template><template v-if="fecha(p)"> · registrado {{ fecha(p) }}</template></div>
          </div>
          <span :class="['rol-insignia', rolDe(p)]">{{ nombreRol(rolDe(p)) }}</span>
        </div>
        <div class="acciones">
          <label class="au-rol">Perfil
            <select :value="rolDe(p)" :disabled="p.id === uidActual" :aria-label="'Perfil de ' + p.nombre" @change="cambiarRol(p, $event.target.value)">
              <option v-for="r in ROLES" :key="r.id" :value="r.id">{{ r.nombre }}</option>
            </select>
          </label>
          <button type="button" :class="['btn', 'chico', p.activo === false ? 'verde' : 'claro']" :disabled="p.id === uidActual" @click="alternarActivo(p)">{{ p.activo === false ? 'Activar' : 'Desactivar' }}</button>
          <span v-if="p.activo === false" class="ins oculto">Desactivado</span>
        </div>
      </article>
    </div>
    <p class="desc" style="margin-top:14px">Para cambiar la contraseña de alguien, bórralo en la consola de Firebase (Authentication) y regístralo de nuevo aquí. Un usuario desactivado no puede entrar; tampoco se pueden borrar usuarios desde aquí para conservar su historial.</p>
  </section>
</template>

<style>
.au-lista { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); }
.au-item { min-width: 0; }
.au-item.inactivo { opacity: .65; }
.au-rol { display: inline-flex; align-items: center; gap: 8px; font-size: .85rem; color: var(--suave); }
.au-rol select { background: var(--sup); color: var(--texto); border: 1.5px solid var(--borde); border-radius: 10px; padding: 7px 10px; font-family: inherit; font-size: .9rem; }
.au-form .dos { display: grid; gap: 0 12px; grid-template-columns: 1fr; }
.au-form select { width: 100%; margin-top: 5px; padding: 13px 14px; border: 1.5px solid var(--borde); border-radius: 12px; background: var(--sup); color: var(--texto); font-family: inherit; }
@media (min-width: 720px) { .au-form .dos { grid-template-columns: 1fr 1fr; } .au-lista { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
