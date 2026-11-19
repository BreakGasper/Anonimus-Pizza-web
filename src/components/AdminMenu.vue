<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { doc, onSnapshot, writeBatch, serverTimestamp, deleteField } from 'firebase/firestore'
import Icono from './Icono.vue'
import { ICONOS_PRODUCTO, iconoProducto } from '../utils/iconos.js'
import { ingredientes as ingredientesTodos } from '../store/ingredientes.js'
import { dbAdmin as db } from '../firebase/admin.js'
import { MENU_INICIAL, ARMA, money, TITULOS_CATEGORIA } from '../data/menu.js'
import { normalizar, FOTOS_BIBLIOTECA, fotoDe, hayPromo, precioFinal, fotosSubidas } from '../store/menu.js'
import { prepararFoto, ErrorFoto } from '../utils/imagen.js'

const props = defineProps({ puedeRestablecer: { type: Boolean, default: true } })
const items = ref([])
const guardado = ref(false) // ¿ya existe el menú en Firestore? (si no, se muestra el inicial)
const cargando = ref(true)
const error = ref('')
const aviso = ref('')
const filtro = ref('todos')
let cortar = null, cortarFotos = null, tAviso

// Topes: 20 fotos subidas, y 20 entre especialidades y paquetes/promos (para borrar alguno antes de agregar más).
const MAX_FOTOS = 20
const MAX_PRINCIPALES = 20
const esPrincipal = (tipo) => tipo === 'especialidad' || tipo === 'paquete'

const TIPOS = { especialidad: 'Especialidad', paquete: 'Paquete', adicional: 'Adicional' }
const TODOS_INGREDIENTES = computed(() => ingredientesTodos.value.map((i) => i.nombre))

onMounted(() => {
  cortar = onSnapshot(doc(db, 'config', 'menu'), (s) => {
    if (s.exists()) { items.value = (s.data().items || []).map(normalizar); guardado.value = true }
    else { items.value = MENU_INICIAL.map(normalizar); guardado.value = false }
    cargando.value = false
  }, () => { error.value = 'No se pudo cargar el menú.'; cargando.value = false })
  cortarFotos = onSnapshot(doc(db, 'config', 'fotos'), (s) => { fotosSubidas.value = s.exists() ? (s.data().fotos || {}) : {} })
})
onUnmounted(() => { cortar?.(); cortarFotos?.() })
const fotosUsadas = computed(() => Object.keys(fotosSubidas.value).length)
const principales = computed(() => items.value.filter((i) => esPrincipal(i.tipo)).length)
const nuevoIdFoto = () => `f${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

function avisar(t) { aviso.value = t; clearTimeout(tAviso); tAviso = setTimeout(() => (aviso.value = ''), 2500) }

/* ---------- Guardar (el menú y, si cambian, las fotos, en un solo lote) ---------- */
// cambiosFotos: { idFoto: 'data:…' (agregar o reemplazar) | null (borrar) }  ·  { todas: true } borra todas las fotos.
async function guardar(nuevos, mensaje, cambiosFotos = null) {
  const previo = items.value, fotosPrevias = fotosSubidas.value
  items.value = nuevos
  error.value = ''
  try {
    const lote = writeBatch(db)
    const datos = { items: nuevos.map((i) => ({ ...i })), actualizado: serverTimestamp() }
    if (cambiosFotos) {
      const version = Date.now()
      datos.fotosVersion = version // la tienda descarga las fotos solo cuando cambia este número
      const refFotos = doc(db, 'config', 'fotos')
      if (cambiosFotos.todas) lote.set(refFotos, { fotos: {}, version })
      else lote.set(refFotos, { fotos: Object.fromEntries(Object.entries(cambiosFotos).map(([k, v]) => [k, v === null ? deleteField() : v])), version }, { merge: true })
      const siguiente = cambiosFotos.todas ? {} : { ...fotosSubidas.value }
      if (!cambiosFotos.todas) for (const [k, v] of Object.entries(cambiosFotos)) { if (v === null) delete siguiente[k]; else siguiente[k] = v }
      fotosSubidas.value = siguiente
    }
    lote.set(doc(db, 'config', 'menu'), datos, { merge: true }) // merge: conserva fotosVersion cuando solo cambian los productos
    await lote.commit()
    guardado.value = true
    if (mensaje) avisar(mensaje)
    return true
  } catch (e) {
    items.value = previo; fotosSubidas.value = fotosPrevias
    error.value = e.code === 'permission-denied' ? 'Esta cuenta no tiene permiso para cambiar el menú (o se superó el tope de 20 fotos).' : 'No se pudo guardar. Revisa tu conexión.'
    return false
  }
}

/* ---------- Lista y filtros ---------- */
const conteo = computed(() => ({
  todos: items.value.length,
  especialidad: items.value.filter((i) => i.tipo === 'especialidad').length,
  paquete: items.value.filter((i) => i.tipo === 'paquete').length,
  adicional: items.value.filter((i) => i.tipo === 'adicional').length,
  favoritas: items.value.filter((i) => i.favorita).length,
  promos: items.value.filter((i) => i.enPromo).length,
  ocultos: items.value.filter((i) => !i.activo).length,
}))
const FILTROS = [['todos', 'Todos'], ['especialidad', 'Especialidades'], ['paquete', 'Paquetes'], ['adicional', 'Adicionales'], ['favoritas', 'Favoritas'], ['promos', 'Promos'], ['ocultos', 'Ocultos']]
const lista = computed(() => items.value.filter((i) => {
  if (filtro.value === 'todos') return true
  if (filtro.value === 'favoritas') return i.favorita
  if (filtro.value === 'promos') return i.enPromo
  if (filtro.value === 'ocultos') return !i.activo
  return i.tipo === filtro.value
}))

/* ---------- Acciones rápidas ---------- */
const cambiar = (it, campos, msg) => guardar(items.value.map((x) => (x.id === it.id ? { ...x, ...campos } : x)), msg)
const alternarActivo = (it) => cambiar(it, { activo: !it.activo }, it.activo ? `“${it.nombre}” ya no se muestra en la tienda` : `“${it.nombre}” ahora se muestra en la tienda`)
const alternarFavorita = (it) => cambiar(it, { favorita: !it.favorita }, it.favorita ? 'Quitada de las favoritas' : 'Agregada a las favoritas del inicio')
function mover(it, dir) {
  const arr = [...items.value]
  const i = arr.findIndex((x) => x.id === it.id)
  let j = i + dir
  while (j >= 0 && j < arr.length && arr[j].tipo !== it.tipo) j += dir
  if (j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  guardar(arr)
}
const puedeMover = (it, dir) => { const arr = items.value; let j = arr.findIndex((x) => x.id === it.id) + dir; while (j >= 0 && j < arr.length && arr[j].tipo !== it.tipo) j += dir; return j >= 0 && j < arr.length }
function duplicar(it) {
  if (esPrincipal(it.tipo) && principales.value >= MAX_PRINCIPALES) { error.value = limitePrincipales(); return }
  const copia = { ...it, id: nuevoId(it.tipo), nombre: (it.nombre + ' (copia)').slice(0, 60), activo: false, ingredientes: [...it.ingredientes] }
  let cambios = null, extra = ''
  if (it.foto.startsWith('sub:')) { // la copia lleva su propia foto (así borrar una no quita la otra) si queda espacio
    const idViejo = it.foto.slice(4), dato = fotosSubidas.value[idViejo]
    if (dato && fotosUsadas.value < MAX_FOTOS) { const nid = nuevoIdFoto(); cambios = { [nid]: dato }; copia.foto = 'sub:' + nid }
    else { copia.foto = ''; extra = ' Sin foto: ya tienes 20 fotos subidas.' }
  }
  guardar([...items.value, copia], 'Copia creada (oculta). Edítala y muéstrala cuando esté lista.' + extra, cambios)
}
function borrar(it) {
  if (!confirm(`¿Borrar “${it.nombre}” del menú? No se puede deshacer.`)) return
  guardar(items.value.filter((x) => x.id !== it.id), 'Producto borrado' + (it.foto.startsWith('sub:') ? ' (y se liberó una foto)' : ''), it.foto.startsWith('sub:') ? { [it.foto.slice(4)]: null } : null)
}
function restablecer() {
  if (!confirm('¿Restablecer el menú inicial? Se perderán todos tus cambios del menú (productos, precios, promociones y favoritas) y las fotos que subiste.')) return
  guardar(MENU_INICIAL.map(normalizar), 'Menú inicial restablecido', { todas: true })
}
const limitePrincipales = () => `Llegaste al límite: ya tienes ${MAX_PRINCIPALES} entre especialidades y paquetes/promos. Borra alguno para poder agregar otro.`
const limiteFotos = () => `Llegaste al límite de ${MAX_FOTOS} fotos subidas. Borra la foto de otro producto (o el producto) para poder subir otra.`
const nuevoId = (tipo) => `${tipo.slice(0, 3)}-${Date.now().toString(36)}${Math.floor(Math.random() * 36).toString(36)}`

/* ---------- Editor ---------- */
const ed = ref(null)
const errEd = ref('')
const refNombre = ref(null)
const modoFoto = ref('ninguna')
const procesando = ref(false)
const errFoto = ref('')

function abrir(it) {
  errEd.value = ''
  const base = it ? { ...it, ingredientes: [...it.ingredientes] } : normalizar({ tipo: ['especialidad', 'paquete', 'adicional'].includes(filtro.value) ? filtro.value : 'especialidad', categoria: 'calzones', precio: '', activo: true })
  base.precio = it ? it.precio : ''
  base.precioPromo = it?.precioPromo ?? ''
  ed.value = reactive({ ...base, esNuevo: !it, fotoNueva: '', fotoOriginal: base.foto })
  errFoto.value = ''
  modoFoto.value = !base.foto ? 'ninguna' : base.foto.startsWith('lib:') ? 'biblioteca' : base.foto.startsWith('sub:') ? 'subida' : 'url'
  nextTick(() => refNombre.value?.focus())
}
function cerrar() { ed.value = null }
function alternarIngrediente(n) { const a = ed.value.ingredientes; const i = a.indexOf(n); if (i >= 0) a.splice(i, 1); else a.push(n) }
function elegirModoFoto(m) {
  modoFoto.value = m; errFoto.value = ''
  const f = ed.value.foto
  if (m === 'ninguna') { ed.value.foto = ''; ed.value.fotoNueva = '' }
  if (m === 'biblioteca' && !f.startsWith('lib:')) ed.value.foto = ''
  if (m === 'url' && (f.startsWith('lib:') || f.startsWith('sub:'))) ed.value.foto = ''
  if (m === 'subida') ed.value.foto = ed.value.fotoOriginal.startsWith('sub:') ? ed.value.fotoOriginal : ''
}
const previa = computed(() => { const e = ed.value; if (!e) return null; return e.fotoNueva || (e.foto?.startsWith('sub:') ? fotosSubidas.value[e.foto.slice(4)] : null) || null })
async function alElegirArchivo(ev) {
  const archivo = ev.target.files?.[0]
  ev.target.value = '' // permite volver a elegir el mismo archivo
  if (!archivo) return
  errFoto.value = ''; procesando.value = true
  try { ed.value.fotoNueva = await prepararFoto(archivo) }
  catch (e) {
    const c = e instanceof ErrorFoto ? e.codigo : ''
    errFoto.value = c === 'tipo' ? 'Elige una imagen (JPG, PNG o WebP).' : c === 'grande' ? 'La imagen pesa demasiado (máximo 12 MB).' : c === 'pesada' ? 'No se pudo reducir esa imagen lo suficiente. Prueba con otra.' : 'No se pudo leer la imagen.'
  } finally { procesando.value = false }
}
function quitarFoto() { ed.value.fotoNueva = ''; ed.value.foto = ''; modoFoto.value = 'ninguna' }

function validar(e) {
  if (!e.nombre.trim()) return 'Escribe el nombre.'
  if (e.nombre.trim().length > 60) return 'El nombre es muy largo (máximo 60 letras).'
  const p = Number(e.precio)
  if (!(p > 0) || p > 5000) return 'Escribe un precio válido (mayor a 0).'
  if (e.desc.length > 200) return 'La descripción es muy larga (máximo 200 letras).'
  if (e.enPromo) {
    const pp = Number(e.precioPromo)
    if (!(pp > 0)) return 'Escribe el precio de la promoción.'
    if (pp >= p) return 'El precio de promoción debe ser menor al precio normal.'
  }
  if (modoFoto.value === 'url' && e.foto && !/^https:\/\/\S+$/i.test(e.foto.trim())) return 'La dirección de la imagen debe empezar con https://'
  if (modoFoto.value === 'biblioteca' && !e.foto) return 'Elige una foto de la biblioteca o cambia a “Sin foto”.'
  if (modoFoto.value === 'subida' && !previa.value) return 'Elige una foto de tu dispositivo o cambia a “Sin foto”.'
  const vienePrincipal = esPrincipal(e.tipo) && (e.esNuevo || !esPrincipal(items.value.find((x) => x.id === e.id)?.tipo))
  if (vienePrincipal && principales.value >= MAX_PRINCIPALES) return limitePrincipales()
  if (modoFoto.value === 'subida' && e.fotoNueva && !e.foto.startsWith('sub:') && fotosUsadas.value >= MAX_FOTOS) return limiteFotos()
  return ''
}
async function guardarEd() {
  errEd.value = validar(ed.value)
  if (errEd.value) return
  const e = ed.value
  const idViejo = e.fotoOriginal.startsWith('sub:') ? e.fotoOriginal.slice(4) : null
  let fotoFinal = '', cambios = null
  if (modoFoto.value === 'subida') {
    if (e.fotoNueva) { const id = idViejo || nuevoIdFoto(); cambios = { [id]: e.fotoNueva }; fotoFinal = 'sub:' + id } // nueva o reemplazo
    else fotoFinal = e.foto // la que ya tenía, sin cambios
  } else {
    fotoFinal = modoFoto.value === 'ninguna' ? '' : e.foto.trim()
    if (idViejo) cambios = { [idViejo]: null } // dejó de usar su foto subida: se libera el espacio
  }
  const item = normalizar({
    ...e, nombre: e.nombre.trim(), desc: e.desc.trim(), precio: Number(e.precio), precioPromo: e.enPromo ? Number(e.precioPromo) : (e.precioPromo === '' ? null : Number(e.precioPromo) || null),
    icono: e.icono, foto: fotoFinal, categoria: e.tipo === 'adicional' ? e.categoria : '',
    ingredientes: e.tipo === 'especialidad' ? e.ingredientes : [], id: e.esNuevo ? nuevoId(e.tipo) : e.id,
  })
  const nuevos = e.esNuevo ? [...items.value, item] : items.value.map((x) => (x.id === item.id ? item : x))
  if (await guardar(nuevos, e.esNuevo ? `“${item.nombre}” agregado al menú` : 'Cambios guardados', cambios)) cerrar()
  else errEd.value = error.value
}
const descuento = computed(() => { const e = ed.value; if (!e || !e.enPromo) return 0; const p = Number(e.precio), pp = Number(e.precioPromo); return p > 0 && pp > 0 && pp < p ? Math.round((1 - pp / p) * 100) : 0 })
</script>

<template>
  <section class="am">
    <div class="am-cab">
      <div><h2 style="margin:0">Menú de la tienda</h2><p class="desc">Lo que cambies aquí se ve en la tienda al recargar la página.</p></div>
      <div class="am-botones"><button class="btn" @click="abrir()">＋ Agregar</button></div>
    </div>

    <p v-if="cargando" class="sub">Cargando menú…</p>
    <template v-else>
      <div class="topes" role="status">
        <span :class="{ lleno: principales >= MAX_PRINCIPALES }">Especialidades y paquetes: <b>{{ principales }}</b> de {{ MAX_PRINCIPALES }}</span>
        <span :class="{ lleno: fotosUsadas >= MAX_FOTOS }">Fotos subidas: <b>{{ fotosUsadas }}</b> de {{ MAX_FOTOS }}</span>
      </div>
      <div v-if="!guardado" class="aviso" role="status">Estás viendo el <b>menú inicial</b>. Se guardará en tu base de datos cuando hagas el primer cambio.</div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div v-if="aviso" class="adm-aviso" role="status">{{ aviso }}</div>

      <div class="adm-estados" role="tablist">
        <button v-for="f in FILTROS" :key="f[0]" :class="['chip', { on: filtro === f[0] }]" @click="filtro = f[0]">{{ f[1] }} <b>{{ conteo[f[0]] }}</b></button>
      </div>

      <p v-if="!lista.length" class="sub">No hay productos en este filtro.</p>
      <div class="am-lista">
        <article v-for="it in lista" :key="it.id" :class="['tarjeta', 'am-item', { oculto: !it.activo }]">
          <div class="fila" style="align-items:flex-start">
            <div class="am-foto" aria-hidden="true"><img v-if="fotoDe(it)" :src="fotoDe(it)" alt="" width="64" height="64" /><span v-else><Icono :nombre="iconoProducto(it)" :tam="30" /></span></div>
            <div class="grow">
              <b class="am-nombre">{{ it.nombre }}</b>
              <div class="desc">{{ TIPOS[it.tipo] }}<template v-if="it.tipo === 'adicional'"> · {{ TITULOS_CATEGORIA[it.categoria] || 'Otros' }}</template></div>
              <div class="insignias">
                <span v-if="it.favorita" class="ins fav"><Icono nombre="estrella" :tam="12" class="txt" />Favorita</span>
                <span v-if="hayPromo(it)" class="ins promo"><Icono nombre="etiqueta" :tam="12" class="txt" />Promo</span>
                <span v-if="!it.activo" class="ins oculto">Oculto</span>
              </div>
            </div>
            <div class="precio" style="text-align:right"><s v-if="hayPromo(it)" class="tachado">{{ money(it.precio) }}</s><br v-if="hayPromo(it)" />{{ money(precioFinal(it)) }}</div>
          </div>
          <div class="acciones">
            <button class="btn chico claro" @click="abrir(it)">Editar</button>
            <button class="btn chico claro" :aria-pressed="it.favorita" :title="it.favorita ? 'Quitar de favoritas' : 'Marcar como favorita'" @click="alternarFavorita(it)"><Icono nombre="estrella" :tam="16" class="txt" :class="{ llena: it.favorita }" />Favorita</button>
            <button class="btn chico claro" @click="alternarActivo(it)">{{ it.activo ? 'Ocultar' : 'Mostrar' }}</button>
            <button class="btn chico claro" :disabled="!puedeMover(it, -1)" aria-label="Subir" title="Subir" @click="mover(it, -1)"><Icono nombre="arriba" :tam="16" /></button>
            <button class="btn chico claro" :disabled="!puedeMover(it, 1)" aria-label="Bajar" title="Bajar" @click="mover(it, 1)"><Icono nombre="flecha" :tam="16" /></button>
            <button class="btn chico claro" @click="duplicar(it)">Duplicar</button>
            <button class="btn chico basura-btn" :aria-label="'Borrar ' + it.nombre" @click="borrar(it)"><Icono nombre="basura" :tam="18" /></button>
          </div>
        </article>
      </div>
      <p v-if="puedeRestablecer" style="margin-top:18px"><button class="enlace-btn" @click="restablecer">Restablecer el menú inicial</button></p>
    </template>

    <!-- Editor -->
    <div v-if="ed" class="modal" role="dialog" aria-modal="true" :aria-label="ed.esNuevo ? 'Agregar producto' : 'Editar producto'" @keydown.esc="cerrar" @click.self="cerrar">
      <form class="modal-caja" @submit.prevent="guardarEd" novalidate>
        <div class="modal-cab"><h3 style="margin:0">{{ ed.esNuevo ? 'Agregar al menú' : 'Editar producto' }}</h3><button type="button" class="cerrar" aria-label="Cerrar" @click="cerrar"><Icono nombre="cerrar" :tam="20" /></button></div>

        <div class="dos">
          <label class="campo">Tipo
            <select v-model="ed.tipo"><option value="especialidad">Especialidad (pizza)</option><option value="paquete">Paquete / promo</option><option value="adicional">Adicional (calzone, bebida…)</option></select>
          </label>
          <label v-if="ed.tipo === 'adicional'" class="campo">Categoría
            <select v-model="ed.categoria"><option value="calzones">Calzones</option><option value="bebidas">Bebidas</option><option value="otros">Otros</option></select>
          </label>
        </div>
        <p v-if="ed.esNuevo && esPrincipal(ed.tipo) && principales >= MAX_PRINCIPALES" class="error" role="alert">{{ limitePrincipales() }}</p>
        <label class="campo">Nombre
          <input ref="refNombre" v-model="ed.nombre" maxlength="60" placeholder="Ej. Pizza Hawaiana" />
        </label>
        <label class="campo">Descripción (opcional)
          <textarea v-model="ed.desc" rows="2" maxlength="200" placeholder="Ingredientes o lo que incluye"></textarea>
        </label>
        <div class="dos">
          <label class="campo">{{ ed.tipo === 'especialidad' ? 'Precio mediana ($)' : 'Precio ($)' }}
            <input v-model="ed.precio" type="number" inputmode="decimal" min="1" step="1" />
          </label>
          <label class="campo">Ícono (si no hay foto)
            <select v-model="ed.icono"><option v-for="[id, nom] in ICONOS_PRODUCTO" :key="id" :value="id">{{ nom }}</option></select>
          </label>
        </div>
        <p v-if="ed.tipo === 'especialidad'" class="desc" style="margin:-4px 0 10px">Los precios de individual y familiar se calculan solos a partir del de la mediana.</p>

        <fieldset class="caja">
          <legend>Promoción</legend>
          <label class="check"><input type="checkbox" v-model="ed.enPromo" /> Ponerlo en promoción</label>
          <label v-if="ed.enPromo" class="campo">Precio de promoción ($)
            <input v-model="ed.precioPromo" type="number" inputmode="decimal" min="1" step="1" />
          </label>
          <p v-if="ed.enPromo && descuento" class="desc">Descuento del <b>{{ descuento }}%</b>. En la tienda se verá el precio normal tachado.</p>
        </fieldset>

        <div class="dos checks">
          <label class="check"><input type="checkbox" v-model="ed.favorita" /> Favorita (sale en el inicio)</label>
          <label class="check"><input type="checkbox" v-model="ed.activo" /> Visible en la tienda</label>
        </div>

        <fieldset class="caja">
          <legend>Foto</legend>
          <div class="modos">
            <label class="check"><input type="radio" value="ninguna" :checked="modoFoto === 'ninguna'" @change="elegirModoFoto('ninguna')" /> Sin foto</label>
            <label class="check"><input type="radio" value="subida" :checked="modoFoto === 'subida'" @change="elegirModoFoto('subida')" /> Subir mi foto</label>
            <label class="check"><input type="radio" value="biblioteca" :checked="modoFoto === 'biblioteca'" @change="elegirModoFoto('biblioteca')" /> De la biblioteca</label>
            <label class="check"><input type="radio" value="url" :checked="modoFoto === 'url'" @change="elegirModoFoto('url')" /> Dirección de imagen</label>
          </div>
          <div v-if="modoFoto === 'subida'" class="subida">
            <div class="previa" aria-hidden="true"><img v-if="previa" :src="previa" alt="" width="96" height="96" /><span v-else><Icono nombre="camara" :tam="34" /></span></div>
            <div class="subida-acciones">
              <label class="btn chico claro archivo">{{ previa ? 'Cambiar foto' : 'Elegir foto' }}<input type="file" accept="image/*" hidden @change="alElegirArchivo" /></label>
              <button v-if="previa" type="button" class="btn chico claro" @click="quitarFoto">Quitar foto</button>
              <span v-if="procesando" class="desc">Preparando la foto…</span>
            </div>
            <p class="desc" style="flex-basis:100%">Se recorta cuadrada y se reduce (≈30 KB) para guardarse gratis en tu base de datos. Fotos subidas: <b>{{ fotosUsadas }}</b> de {{ MAX_FOTOS }}.</p>
            <p v-if="errFoto" class="error" role="alert" style="flex-basis:100%">{{ errFoto }}</p>
          </div>
          <div v-if="modoFoto === 'biblioteca'" class="biblio">
            <button v-for="f in FOTOS_BIBLIOTECA" :key="f.clave" type="button" :class="['bib', { on: ed.foto === 'lib:' + f.clave }]" :aria-pressed="ed.foto === 'lib:' + f.clave" @click="ed.foto = 'lib:' + f.clave">
              <img :src="f.url" :alt="f.nombre" width="56" height="56" /><span>{{ f.nombre }}</span>
            </button>
          </div>
          <label v-if="modoFoto === 'url'" class="campo">Dirección (https://…)
            <input v-model="ed.foto" type="url" placeholder="https://ejemplo.com/foto.jpg" />
          </label>
          <p v-if="modoFoto === 'url'" class="desc">Usa una imagen cuadrada y ligera.</p>
        </fieldset>

        <fieldset v-if="ed.tipo === 'especialidad'" class="caja">
          <legend>Ingredientes de la receta</legend>
          <p class="desc" style="margin:0 0 8px">Se usan en “Empieza rápido” de Arma tu pizza: un toque arma esta pizza.</p>
          <div class="chips">
            <button v-for="n in TODOS_INGREDIENTES" :key="n" type="button" :class="['chip', { on: ed.ingredientes.includes(n) }]" :aria-pressed="ed.ingredientes.includes(n)" @click="alternarIngrediente(n)">{{ n }}</button>
          </div>
        </fieldset>

        <p v-if="errEd" class="error" role="alert">{{ errEd }}</p>
        <div class="modal-pie"><button type="button" class="btn claro" @click="cerrar">Cancelar</button><button class="btn verde">Guardar</button></div>
      </form>
    </div>
  </section>
</template>

<style>
.am-cab { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.am-lista { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
.am-item { min-width: 0; } .am-item .grow { min-width: 0; } .am-nombre { overflow-wrap: anywhere; }
.am-item { margin: 0; } .am-item.oculto { opacity: .6; }
.am-foto { width: 64px; height: 64px; flex: none; border-radius: 50%; background: var(--sup2); display: grid; place-items: center; overflow: hidden; font-size: 2rem; }
.am-foto img { width: 100%; height: 100%; object-fit: cover; }
.am-nombre { font-size: 1.05rem; }
.insignias { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.ins { font-size: .72rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--sup2); }
.ins.fav { background: #4a3a0c; color: #ffd86b; } .ins.promo { background: #5a1d17; color: #ffb3aa; } .ins.oculto { background: #444; color: #ddd; }
.am .acciones .btn[disabled] { opacity: .35; }
.topes { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: .88rem; color: var(--suave); margin-bottom: 10px; }
.topes b { color: var(--texto); } .topes .lleno, .topes .lleno b { color: #ff8a80; }
.subida { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 10px; }
.previa { width: 96px; height: 96px; border-radius: 14px; background: var(--sup2); display: grid; place-items: center; overflow: hidden; font-size: 2.2rem; }
.previa img { width: 100%; height: 100%; object-fit: cover; }
.subida-acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.archivo { cursor: pointer; }
.modal { position: fixed; inset: 0; z-index: 60; background: #000a; display: flex; align-items: flex-end; justify-content: center; padding: 0; }
.modal-caja { background: var(--fondo); border: 1px solid var(--borde); border-radius: 22px 22px 0 0; width: 100%; max-width: 640px; max-height: 94dvh; overflow-y: auto; padding: 18px 16px calc(18px + env(safe-area-inset-bottom, 0px)); }
.modal-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; position: sticky; top: -18px; background: var(--fondo); padding: 4px 0 8px; z-index: 1; }
.cerrar { background: var(--sup2); border: 1px solid var(--borde); width: 38px; height: 38px; border-radius: 50%; font-size: 1rem; }
.dos { display: grid; grid-template-columns: 1fr; gap: 0 12px; }
.caja { border: 1px solid var(--borde); border-radius: 14px; padding: 12px; margin: 0 0 14px; }
.caja legend { padding: 0 8px; font-weight: 700; color: var(--ambar); }
.check { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: .95rem; }
.check input { width: 20px; height: 20px; accent-color: var(--verde); }
.modos { display: flex; flex-wrap: wrap; gap: 4px 16px; }
.biblio { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; margin-top: 10px; }
.bib { background: var(--sup); border: 2px solid var(--borde); border-radius: 12px; padding: 6px 4px; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: .72rem; }
.bib.on { border-color: var(--ambar); background: #3a2610; } .bib img { border-radius: 50%; object-fit: cover; }
.modal-pie { display: flex; gap: 10px; justify-content: flex-end; margin-top: 6px; }
.modal select { width: 100%; margin-top: 5px; padding: 13px 14px; border: 1.5px solid var(--borde); border-radius: 12px; background: var(--sup); color: var(--texto); font-family: inherit; }
@media (min-width: 720px) {
  .modal { align-items: center; padding: 20px; } .modal-caja { border-radius: 22px; }
  .dos { grid-template-columns: 1fr 1fr; } .am-lista { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
