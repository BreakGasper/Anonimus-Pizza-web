<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { items, total, cambiar, quitar, vaciar, ultimoPedido } from '../store/cart.js'
import { crearPedido } from '../firebase/pedidos.js'
import { money } from '../data/menu.js'
import Icono from '../components/Icono.vue'

const router = useRouter()
const f = reactive({ nombre: '', telefono: '', calle: '', referencia: '', localidad: '', notas: '' })
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

  <div v-else class="carrito-grid">
   <section>
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
   </section>

   <section>
    <h2 style="margin:0 0 10px">¿Dónde la llevamos?</h2>
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
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="btn block" :disabled="enviando">{{ enviando ? 'Enviando…' : 'Confirmar pedido · ' + money(total) }}</button>
    </form>
   </section>
  </div>
</template>
