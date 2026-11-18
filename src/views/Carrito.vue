<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { items, total, cambiar, quitar, vaciar, ultimoPedido } from '../store/cart.js'
import { crearPedido } from '../firebase/pedidos.js'
import { guardarEnHistorial } from '../store/historial.js'
import { money } from '../data/menu.js'
import Icono from '../components/Icono.vue'

const route = useRoute()
const router = useRouter()

/* ---------- Pasos: 1) carrito  2) datos de entrega ---------- */
const paso = computed(() => (route.query.paso === 'datos' && items.value.length ? 2 : 1))
const continuar = () => router.push({ path: '/carrito', query: { paso: 'datos' } })
const volver = () => router.push({ path: '/carrito' })

/* ---------- Datos del cliente: se guardan solo en este dispositivo ---------- */
const CLAVE = 'anonimus-datos-cliente'
const f = reactive({ nombre: '', telefono: '', calle: '', referencia: '', localidad: '', notas: '' })
const guardados = ref(false) // ¿hay datos de una compra anterior?
function leerGuardados() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || null } catch { return null }
}
onMounted(() => {
  const d = leerGuardados()
  if (d) {
    for (const k of ['nombre', 'telefono', 'calle', 'referencia', 'localidad']) if (typeof d[k] === 'string') f[k] = d[k]
    guardados.value = Object.values(d).some((v) => v)
  }
})
// Se guardan mientras escribe (y al confirmar). Las notas son de cada pedido, así que no se guardan.
watch(() => [f.nombre, f.telefono, f.calle, f.referencia, f.localidad], () => {
  try { localStorage.setItem(CLAVE, JSON.stringify({ nombre: f.nombre, telefono: f.telefono, calle: f.calle, referencia: f.referencia, localidad: f.localidad })) } catch { /* sin almacenamiento */ }
})
function olvidarDatos() {
  try { localStorage.removeItem(CLAVE) } catch { /* sin almacenamiento */ }
  for (const k of ['nombre', 'telefono', 'calle', 'referencia', 'localidad', 'notas']) f[k] = ''
  guardados.value = false
}

/* ---------- Enviar pedido ---------- */
const error = ref('')
const enviando = ref(false)

function validar() {
  if (!items.value.length) return 'Tu carrito está vacío.'
  if (!f.nombre.trim()) return 'Escribe tu nombre.'
  if (f.telefono.replace(/\D/g, '').length !== 10) return 'El teléfono debe tener 10 dígitos.'
  if (!f.calle.trim()) return 'Escribe la calle y número.'
  if (!f.localidad.trim()) return 'Escribe tu localidad.'
  return ''
}

async function confirmar() {
  error.value = validar()
  if (error.value) return
  enviando.value = true
  const direccion = `${f.calle.trim()}${f.referencia.trim() ? ` (${f.referencia.trim()})` : ''}, ${f.localidad.trim()}`
  const lineas = items.value.map((i) => ({ ...i }))
  const suma = total.value
  const datos = { nombre: f.nombre.trim(), telefono: f.telefono.replace(/\D/g, ''), direccion, notas: f.notas.trim() }
  try {
    const id = await crearPedido(datos, lineas, suma)
    ultimoPedido.value = { id, ...datos, items: lineas, total: suma, fecha: new Date().toISOString() }
    guardarEnHistorial(ultimoPedido.value) // queda en este dispositivo para el perfil
    vaciar()
    router.push('/ticket')
  } catch (e) {
    console.error(e)
    error.value = 'No pudimos enviar tu pedido. Revisa tu conexión e inténtalo de nuevo.'
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <h1 class="titulo">Tu <em>pedido</em></h1>

  <div v-if="!items.length" class="tarjeta" style="text-align:center">
    <p>Aún no agregas nada.</p>
    <router-link to="/especialidades" class="btn">Ver el menú</router-link>
  </div>

  <template v-else>
    <ol class="pasos-cab" aria-label="Pasos del pedido">
      <li :class="{ on: paso === 1, hecho: paso > 1 }"><i>1</i> Carrito</li>
      <li class="linea" aria-hidden="true"></li>
      <li :class="{ on: paso === 2 }"><i>2</i> Entrega</li>
    </ol>

    <!-- Paso 1: carrito -->
    <section v-if="paso === 1" class="paso-carrito">
      <article v-for="i in items" :key="i.clave" class="tarjeta">
        <div class="fila">
          <div class="item-foto" aria-hidden="true">
            <img v-if="i.foto" :src="i.foto" alt="" width="72" height="72" decoding="async" />
            <span v-else>{{ i.emoji || '🍕' }}</span>
          </div>
          <div class="grow">
            <b>{{ i.nombre }}</b>
            <p v-if="i.detalle" class="desc">{{ i.detalle }}</p>
            <div class="cant" style="margin-top:8px">
              <button type="button" class="menos" aria-label="Quitar uno" @click="cambiar(i.clave, -1)"><Icono nombre="menos" :tam="18" /></button>
              <b>{{ i.cantidad }}</b>
              <button type="button" class="mas" aria-label="Agregar uno" @click="cambiar(i.clave, 1)"><Icono nombre="mas" :tam="18" /></button>
              <button type="button" class="basura" :aria-label="'Quitar ' + i.nombre + ' del carrito'" title="Quitar del carrito" @click="quitar(i.clave)"><Icono nombre="basura" :tam="20" /></button>
            </div>
          </div>
          <div class="precio">{{ money(i.precio * i.cantidad) }}</div>
        </div>
      </article>

      <div class="total"><span>Total</span><span>{{ money(total) }}</span></div>
      <button type="button" class="btn block" @click="continuar">Continuar · {{ money(total) }}</button>
      <router-link to="/especialidades" class="seguir">+ Seguir agregando productos</router-link>
    </section>

    <!-- Paso 2: datos de entrega -->
    <div v-else class="carrito-grid">
      <section class="entrega">
        <h2 style="margin:0 0 6px">¿Dónde la llevamos?</h2>
        <div v-if="guardados" class="guardados" role="status">
          <span>✔ Usamos los datos de tu compra anterior.</span>
          <button type="button" class="enlace-btn" @click="olvidarDatos">Borrar mis datos</button>
        </div>
        <form @submit.prevent="confirmar" novalidate>
          <label class="campo">Nombre
            <input v-model="f.nombre" maxlength="80" autocomplete="name" />
          </label>
          <label class="campo">Celular (10 dígitos)
            <input v-model="f.telefono" type="tel" inputmode="numeric" maxlength="14" autocomplete="tel" />
          </label>
          <label class="campo">Calle y número
            <input v-model="f.calle" maxlength="90" autocomplete="street-address" />
          </label>
          <label class="campo">Referencia del lugar (opcional)
            <input v-model="f.referencia" maxlength="50" placeholder="Ej. Casa verde, puerta negra" />
          </label>
          <label class="campo">Localidad
            <input v-model="f.localidad" maxlength="40" />
          </label>
          <label class="campo">Notas para tu pedido (opcional)
            <textarea v-model="f.notas" rows="2" maxlength="300"></textarea>
          </label>
          <p class="aviso">Pagas en efectivo al recibir tu pedido.</p>
          <p class="privado">Tus datos se guardan solo en este dispositivo para tu próxima compra.</p>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <button class="btn block" :disabled="enviando">{{ enviando ? 'Enviando…' : 'Confirmar pedido · ' + money(total) }}</button>
          <button type="button" class="btn block claro" style="margin-top:10px" @click="volver">← Volver al carrito</button>
        </form>
      </section>

      <aside class="resumen-pedido" aria-label="Resumen de tu pedido">
        <h3>Tu pedido</h3>
        <ul>
          <li v-for="i in items" :key="i.clave">
            <span class="mini" aria-hidden="true"><img v-if="i.foto" :src="i.foto" alt="" width="40" height="40" /><span v-else>{{ i.emoji || '🍕' }}</span></span>
            <span class="grow">{{ i.cantidad }} × {{ i.nombre }}</span>
            <b>{{ money(i.precio * i.cantidad) }}</b>
          </li>
        </ul>
        <div class="total"><span>Total</span><span>{{ money(total) }}</span></div>
      </aside>
    </div>
  </template>
</template>
