<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { dbAdmin as db } from '../firebase/admin.js'
import Icono from './Icono.vue'
import { INICIALES, normalizarIng, esDeFabrica, aplicarLista, aplicarImagenes } from '../store/ingredientes.js'
import { imgIconoSlug, PIEZAS } from '../data/imagenes.js'
import PizzaPreview from './PizzaPreview.vue'
import { leerFuente, leerFuenteUrl, tieneTransparencia, sinFondo, conAjustes, AJUSTES_NEUTROS, hayAjustes, ErrorImagenIng } from '../utils/recorte.js'
import { avisar } from '../store/toast.js'
import { bloquearFondo } from '../utils/bloquearFondo.js'

defineProps({ puedeRestablecer: Boolean })

const MAX_ING = 40, MAX_IMG = 24
const lista = ref([])
const imagenes = ref({})
const cargado = ref(false)
const guardando = ref(false)
const error = ref('')
let cortar = null

onMounted(() => {
  cortar = onSnapshot(doc(db, 'config', 'ingredientes'), (s) => {
    if (s.exists() && Array.isArray(s.data().lista)) { lista.value = s.data().lista.map(normalizarIng).filter((i) => i.id && i.nombre); imagenes.value = s.data().imagenes || {} }
    else { lista.value = INICIALES.map((i) => ({ ...i })); imagenes.value = {} }
    cargado.value = true
  }, () => { error.value = 'No se pudieron cargar los ingredientes.'; cargado.value = true })
})
onUnmounted(() => cortar?.())

const imgDe = (ing) => imagenes.value[ing.id] || (esDeFabrica(ing.id) ? imgIconoSlug(ing.id) : '')
const nImagenes = () => Object.keys(imagenes.value).length

async function guardar(nuevaLista, nuevasImagenes, mensaje) {
  error.value = ''
  if (nuevaLista.length > MAX_ING) { error.value = `Máximo ${MAX_ING} ingredientes. Quita alguno para agregar otro.`; return false }
  if (Object.keys(nuevasImagenes).length > MAX_IMG) { error.value = `Máximo ${MAX_IMG} fotos propias. Quita alguna para agregar otra.`; return false }
  guardando.value = true
  try {
    const version = Date.now()
    await setDoc(doc(db, 'config', 'ingredientes'), { lista: nuevaLista, imagenes: nuevasImagenes, version })
    aplicarLista(nuevaLista); aplicarImagenes(nuevasImagenes, version) // la tienda abierta en este mismo navegador ya lo ve
    if (mensaje) avisar(mensaje)
    return true
  } catch (e) {
    error.value = e?.code === 'permission-denied' ? 'No tienes permiso para cambiar los ingredientes.' : 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.'
    return false
  } finally { guardando.value = false }
}

/* ---------- Acciones de la lista ---------- */
const alternarActivo = (ing) => guardar(lista.value.map((x) => (x.id === ing.id ? { ...x, activo: !x.activo } : x)), imagenes.value, ing.activo ? `${ing.nombre} ya no aparece en Arma tu pizza` : `${ing.nombre} ya aparece en Arma tu pizza`)
async function quitar(ing) {
  if (!confirm(`¿Quitar "${ing.nombre}"? Las especialidades que lo usan dejarán de mostrarlo.`)) return
  const imgs = { ...imagenes.value }; delete imgs[ing.id]
  await guardar(lista.value.filter((x) => x.id !== ing.id), imgs, `${ing.nombre} se quitó`)
}
async function restablecer() {
  if (!confirm('¿Volver a los 12 ingredientes y fotos originales? Se pierden los cambios y los ingredientes nuevos.')) return
  await guardar(INICIALES.map((i) => ({ ...i })), {}, 'Ingredientes originales restablecidos')
}

/* ---------- Editor ---------- */
const ed = ref(null)
bloquearFondo(() => ed.value)
const nombreOcupado = (n, id) => lista.value.some((x) => x.id !== id && x.nombre.toLowerCase() === n.toLowerCase())
const piezasPorDefecto = (ing) => (ing && esDeFabrica(ing.id) ? PIEZAS[ing.id] : ing?.tipo === 'carne' ? 16 : 20)
const TAM_NORMAL = 110
async function abrir(ing) {
  error.value = ''
  const propia = ing ? imagenes.value[ing.id] : ''
  const e = reactive({
    esNuevo: !ing, id: ing?.id || '', nombre: ing?.nombre || '', tipo: ing?.tipo || 'verdura', activo: ing?.activo ?? true,
    piezas: ing?.piezas || piezasPorDefecto(ing), tam: ing?.tam || TAM_NORMAL, imagen: ing ? imgDe(ing) : '', tieneFotoPropia: !!propia,
    cambioImagen: false, subida: false, quitarPropia: false, fuente: null, base: null, quitarFondo: true, sens: 25, ajustes: { ...AJUSTES_NEUTROS },
    nota: '', aviso: '', err: '', leyendo: false,
  })
  ed.value = e
  if (propia) { // la foto ya guardada se puede volver a ajustar (color, saturación, contraste)
    try { e.fuente = await leerFuenteUrl(propia); e.base = e.fuente; e.quitarFondo = false } catch { /* sin edición de color */ }
  }
}
const cerrar = () => { ed.value = null }

// Borrador que se dibuja en la pizza de la vista previa (sin guardar nada todavía).
const borrador = computed(() => {
  const e = ed.value
  if (!e) return []
  return [{ ing: { id: e.id || 'ing-borrador', nombre: NOMBRE_BORRADOR, tipo: e.tipo, activo: true, piezas: e.piezas, tam: e.tam }, url: e.cambioImagen ? e.imagen : '' }]
})
const NOMBRE_BORRADOR = '__borrador__'
const hayColor = computed(() => hayAjustes(ed.value?.ajustes))

function recalcularColor() {
  const e = ed.value
  if (!e?.base) return
  try {
    const r = conAjustes(e.base, e.ajustes)
    e.imagen = r.url; e.cambioImagen = true; e.err = ''
    e.aviso = r.fondoPocoUniforme ? 'El fondo no es parejo, así que puede quedar con restos. Mejor usa una foto con fondo liso (blanco) o un PNG sin fondo.' : ''
  } catch (x) { e.err = x instanceof ErrorImagenIng ? x.message : 'No se pudo procesar la imagen.' }
}
function recalcularFondo() {
  const e = ed.value
  if (!e?.fuente) return
  try { e.base = sinFondo(e.fuente, e.quitarFondo, e.sens); recalcularColor() }
  catch (x) { e.err = x instanceof ErrorImagenIng ? x.message : 'No se pudo procesar la imagen.' }
}
let t = 0
const pronto = (fn) => { clearTimeout(t); t = setTimeout(fn, 70) }
function restablecerColor() { ed.value.ajustes = { ...AJUSTES_NEUTROS }; recalcularColor() }

async function alElegir(ev) {
  const archivo = ev.target.files?.[0]; ev.target.value = ''
  const e = ed.value
  if (!archivo || !e) return
  e.leyendo = true; e.err = ''
  try {
    e.fuente = await leerFuente(archivo)
    const yaTransparente = tieneTransparencia(e.fuente)
    e.quitarFondo = !yaTransparente
    e.nota = yaTransparente ? 'Esta imagen ya tiene fondo transparente: se usa tal cual.' : ''
    e.quitarPropia = false; e.tieneFotoPropia = true; e.subida = true; e.ajustes = { ...AJUSTES_NEUTROS }
    recalcularFondo()
  } catch (x) { e.err = x instanceof ErrorImagenIng ? x.message : 'No se pudo leer la imagen.' }
  finally { e.leyendo = false }
}
function volverOriginal() {
  const e = ed.value
  e.cambioImagen = false; e.subida = false; e.fuente = null; e.base = null; e.quitarPropia = true; e.tieneFotoPropia = false; e.imagen = imgIconoSlug(e.id); e.nota = ''; e.aviso = ''; e.err = ''; e.ajustes = { ...AJUSTES_NEUTROS }
}

async function guardarEditor() {
  const e = ed.value
  e.err = ''
  const nombre = e.nombre.trim()
  if (!nombre) return (e.err = 'Escribe el nombre del ingrediente.')
  if (nombre.length > 30) return (e.err = 'El nombre es muy largo (máximo 30 letras).')
  if (nombreOcupado(nombre, e.id)) return (e.err = 'Ya existe un ingrediente con ese nombre.')
  const id = e.esNuevo ? 'ing-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) : e.id
  const imgs = { ...imagenes.value }
  if (e.cambioImagen) imgs[id] = e.imagen
  else if (e.quitarPropia) delete imgs[id]
  if (!esDeFabrica(id) && !imgs[id]) return (e.err = 'Elige la foto del ingrediente.')
  const nuevo = normalizarIng({ id, nombre, tipo: e.tipo, activo: e.activo, piezas: e.piezas, tam: e.tam })
  const nuevaLista = e.esNuevo ? [...lista.value, nuevo] : lista.value.map((x) => (x.id === id ? nuevo : x))
  if (await guardar(nuevaLista, imgs, e.esNuevo ? `${nombre} agregado` : 'Cambios guardados')) cerrar()
  else e.err = error.value
}
</script>

<template>
  <section class="ig">
    <div class="ig-cab">
      <div>
        <h2 style="margin:0">Ingredientes</h2>
        <p class="desc" style="margin:4px 0 0">Los que se pueden elegir en <b>Arma tu pizza</b>. Las fotos se muestran siempre con fondo transparente.</p>
      </div>
      <button class="btn chico" :disabled="!cargado" @click="abrir(null)"><Icono nombre="mas" :tam="16" class="txt" />Agregar</button>
    </div>
    <p v-if="error && !ed" class="error" role="alert">{{ error }}</p>
    <p v-if="!cargado" class="sub">Cargando…</p>

    <div class="ig-lista">
      <article v-for="ing in lista" :key="ing.id" :class="['ig-fila', { off: !ing.activo }]">
        <span class="damero ig-foto"><img v-if="imgDe(ing)" :src="imgDe(ing)" :alt="ing.nombre" width="56" height="56" /></span>
        <div class="grow">
          <b>{{ ing.nombre }}</b>
          <div class="desc">{{ ing.tipo === 'carne' ? 'Carne' : 'Verdura o fruta' }}<template v-if="imagenes[ing.id]"> · foto propia</template><template v-if="!ing.activo"> · oculto</template></div>
        </div>
        <div class="ig-acc">
          <button class="btn chico claro" @click="abrir(ing)">Editar</button>
          <button class="btn chico claro" :disabled="guardando" @click="alternarActivo(ing)">{{ ing.activo ? 'Ocultar' : 'Mostrar' }}</button>
          <button class="btn chico basura-btn" :aria-label="'Quitar ' + ing.nombre" :disabled="guardando" @click="quitar(ing)"><Icono nombre="basura" :tam="18" /></button>
        </div>
      </article>
    </div>
    <p v-if="cargado" class="desc" style="margin-top:12px">{{ lista.length }} de {{ MAX_ING }} ingredientes · {{ nImagenes() }} de {{ MAX_IMG }} fotos propias.</p>
    <button v-if="puedeRestablecer && cargado" class="btn chico claro" style="margin-top:8px" :disabled="guardando" @click="restablecer">Restablecer los 12 originales</button>

    <div v-if="ed" class="ig-modal" role="dialog" aria-modal="true" aria-label="Ingrediente" @click.self="cerrar">
      <div class="ig-caja">
        <div class="ig-fijo">
          <div class="ig-mcab"><h3 style="margin:0">{{ ed.esNuevo ? 'Agregar ingrediente' : 'Editar ingrediente' }}</h3><button type="button" class="ig-x" aria-label="Cerrar" @click="cerrar"><Icono nombre="cerrar" :tam="20" /></button></div>
          <div class="ig-vista">
            <div class="ig-vista-pizza" data-vista-pizza><PizzaPreview mini :ingredientes="[NOMBRE_BORRADOR]" :borradores="borrador" tamano="fam" :semilla="7" /></div>
            <p class="desc">Así se ve en la pizza. Los controles de abajo se reflejan aquí al instante.</p>
          </div>
        </div>

        <label class="campo">Nombre
          <input v-model="ed.nombre" maxlength="30" :readonly="!ed.esNuevo" placeholder="Ej. Tocino" />
        </label>
        <p v-if="!ed.esNuevo" class="desc" style="margin:-4px 0 10px">El nombre no se cambia porque las especialidades lo usan. Para otro nombre, agrega uno nuevo y quita este.</p>
        <label class="campo">Tipo (para ordenar las capas de la pizza)
          <select v-model="ed.tipo"><option value="verdura">Verdura o fruta (arriba)</option><option value="carne">Carne (abajo)</option></select>
        </label>

        <div class="ig-foto-ed">
          <span class="damero ig-previa"><img v-if="ed.imagen" :src="ed.imagen" alt="Foto del ingrediente" /><span v-else class="desc">Sin foto</span></span>
          <div class="ig-foto-acc">
            <label class="btn chico claro archivo"><Icono nombre="camara" :tam="16" class="txt" />{{ ed.imagen ? 'Cambiar foto' : 'Elegir foto' }}<input type="file" accept="image/*" hidden @change="alElegir" /></label>
            <button v-if="!ed.esNuevo && esDeFabrica(ed.id) && ed.tieneFotoPropia" type="button" class="btn chico claro" @click="volverOriginal">Volver a la original</button>
            <p class="desc" style="margin:0">Cuadritos = transparente. Funciona mejor con fondo liso o un PNG sin fondo.</p>
          </div>
        </div>
        <p v-if="ed.leyendo" class="sub">Procesando…</p>
        <template v-if="ed.subida">
          <label class="check"><input type="checkbox" v-model="ed.quitarFondo" @change="recalcularFondo" /> Quitar el fondo automáticamente</label>
          <label v-if="ed.quitarFondo" class="campo">Sensibilidad del recorte: {{ ed.sens }}
            <input type="range" min="0" max="100" step="1" v-model.number="ed.sens" @input="pronto(recalcularFondo)" />
            <span class="desc">Más alta quita más tonos parecidos al fondo; si se come parte del ingrediente, bájala.</span>
          </label>
          <p v-if="ed.nota" class="desc">{{ ed.nota }}</p>
          <p v-if="ed.aviso" class="aviso">{{ ed.aviso }}</p>
        </template>

        <fieldset v-if="ed.base" class="ig-color">
          <legend>Editor de color</legend>
          <label class="campo">Tono: {{ ed.ajustes.tono }}°
            <input type="range" min="-180" max="180" step="1" v-model.number="ed.ajustes.tono" data-aj="tono" @input="pronto(recalcularColor)" />
          </label>
          <label class="campo">Saturación: {{ ed.ajustes.saturacion }}%
            <input type="range" min="0" max="200" step="1" v-model.number="ed.ajustes.saturacion" data-aj="saturacion" @input="pronto(recalcularColor)" />
          </label>
          <label class="campo">Contraste: {{ ed.ajustes.contraste }}%
            <input type="range" min="50" max="160" step="1" v-model.number="ed.ajustes.contraste" data-aj="contraste" @input="pronto(recalcularColor)" />
          </label>
          <label class="campo">Brillo: {{ ed.ajustes.brillo }}%
            <input type="range" min="50" max="150" step="1" v-model.number="ed.ajustes.brillo" data-aj="brillo" @input="pronto(recalcularColor)" />
          </label>
          <button v-if="hayColor" type="button" class="btn chico claro" @click="restablecerColor">Restablecer color</button>
        </fieldset>
        <p v-else-if="ed.imagen && !ed.leyendo" class="desc">Para ajustar el color, elige una foto con "Cambiar foto".</p>

        <fieldset class="ig-color">
          <legend>En la pizza</legend>
          <label class="campo">Tamaño de cada pieza: {{ ed.tam }}{{ ed.tam === 110 ? ' (normal)' : '' }}
            <input type="range" min="20" max="220" step="5" v-model.number="ed.tam" data-aj="tam" />
            <span class="ig-rango"><small>más chico</small><small>más grande</small></span>
          </label>
          <label class="campo">Cantidad de piezas: {{ ed.piezas }}
            <input type="range" min="4" max="60" step="1" v-model.number="ed.piezas" data-aj="piezas" />
          </label>
        </fieldset>

        <label class="check"><input type="checkbox" v-model="ed.activo" /> Disponible en Arma tu pizza</label>
        <p v-if="ed.err" class="error" role="alert">{{ ed.err }}</p>
        <div class="ig-pie">
          <button type="button" class="btn claro" @click="cerrar">Cancelar</button>
          <button type="button" class="btn" :disabled="guardando || ed.leyendo" @click="guardarEditor">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
.damero { background: conic-gradient(#3b2a22 25%, #2a1c16 0 50%, #3b2a22 0 75%, #2a1c16 0) 0 0 / 14px 14px; }
.ig-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.ig-lista { display: grid; gap: 8px; }
.ig-fila { display: flex; align-items: center; gap: 12px; background: var(--sup); border: 1px solid var(--borde); border-radius: 14px; padding: 10px; flex-wrap: wrap; }
.ig-fila.off { opacity: .6; }
.ig-foto { width: 56px; height: 56px; border-radius: 12px; display: grid; place-items: center; flex: none; overflow: hidden; }
.ig-foto img, .ig-previa img { width: 100%; height: 100%; object-fit: contain; }
.ig-acc { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
.ig-modal { position: fixed; inset: 0; z-index: 70; background: #000b; display: flex; align-items: flex-end; justify-content: center; overscroll-behavior: contain; }
.ig-caja { background: var(--fondo); border: 1px solid var(--borde); border-radius: 22px 22px 0 0; width: 100%; max-width: 560px; max-height: 94dvh; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; touch-action: pan-y; padding: 18px 16px 0; }
.ig-mcab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.ig-x { background: var(--sup2); border: 1px solid var(--borde); width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; }
.ig-caja .campo input[type=text], .ig-caja .campo input:not([type]), .ig-caja .campo select { width: 100%; }
.ig-caja select, .ig-caja input[maxlength] { padding: 13px 14px; border: 1.5px solid var(--borde); border-radius: 12px; background: var(--sup); color: var(--texto); font-family: inherit; margin-top: 5px; }
.ig-caja .campo .desc { font-weight: 400; display: block; margin-top: 4px; }
.ig-caja input[type=range] { width: 100%; accent-color: var(--rojo); }
.ig-foto-ed { display: flex; gap: 14px; align-items: center; margin: 6px 0 10px; }
.ig-previa { width: 112px; height: 112px; border-radius: 16px; display: grid; place-items: center; flex: none; overflow: hidden; border: 1px solid var(--borde); }
.ig-foto-acc { display: grid; gap: 8px; justify-items: start; }
.ig-fijo { position: sticky; top: -18px; z-index: 3; background: var(--fondo); margin: -18px -16px 8px; padding: 18px 16px 8px; border-bottom: 1px solid var(--borde); }
.ig-vista { display: flex; align-items: center; gap: 12px; }
.ig-vista-pizza { width: 132px; flex: none; }
.ig-vista .desc { margin: 0; }
.ig-color { border: 1px solid var(--borde); border-radius: 14px; padding: 6px 12px 10px; margin: 10px 0; }
.ig-color legend { color: var(--ambar); font-weight: 700; font-size: .85rem; padding: 0 6px; }
.ig-rango { display: flex; justify-content: space-between; color: var(--suave); }
.ig-pizza { position: relative; width: 150px; height: 150px; margin: 0 auto 12px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #f6c768, #d9902f 70%, #b86f1c); box-shadow: 0 6px 14px #000a; overflow: hidden; }
.ig-pizza img { position: absolute; width: 34px; height: 34px; object-fit: contain; filter: drop-shadow(0 2px 2px #0007); }
.ig-pie { display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; position: sticky; bottom: 0; background: var(--fondo); border-top: 1px solid var(--borde); padding: 12px 0 calc(14px + env(safe-area-inset-bottom, 0px)); }
@media (min-width: 640px) { .ig-modal { align-items: center; } .ig-caja { border-radius: 22px; } }
</style>
