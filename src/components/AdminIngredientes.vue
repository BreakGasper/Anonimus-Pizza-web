<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { dbAdmin as db } from '../firebase/admin.js'
import Icono from './Icono.vue'
import { INICIALES, normalizarIng, esDeFabrica, aplicarLista, aplicarImagenes } from '../store/ingredientes.js'
import { imgIconoSlug } from '../data/imagenes.js'
import { leerFuente, tieneTransparencia, procesar, ErrorImagenIng} from '../utils/recorte.js'
import { avisar } from '../store/toast.js'

defineProps({ puedeRestablecer: Boolean })

const MAX_ING = 40, MAX_IMG = 24
const PIEZAS_PREVIA = [[-30, -22, 20], [26, -30, 110], [-4, 2, 200], [36, 14, 290], [-38, 26, 60], [10, 38, 150], [-14, -44, 250]] // x, y, giro
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
const nombreOcupado = (n, id) => lista.value.some((x) => x.id !== id && x.nombre.toLowerCase() === n.toLowerCase())
function abrir(ing) {
  error.value = ''
  ed.value = reactive({
    esNuevo: !ing, id: ing?.id || '', nombre: ing?.nombre || '', tipo: ing?.tipo || 'verdura', activo: ing?.activo ?? true,
    piezas: ing?.piezas || 0, tam: ing?.tam || 0, imagen: ing ? imgDe(ing) : '', tieneFotoPropia: !!(ing && imagenes.value[ing.id]),
    nueva: false, quitarPropia: false, fuente: null, quitarFondo: true, sens: 25, nota: '', aviso: '', err: '', leyendo: false,
  })
}
const cerrar = () => { ed.value = null }

function recalcular() {
  const e = ed.value
  if (!e?.fuente) return
  try { const r = procesar(e.fuente, e.quitarFondo, e.sens); e.imagen = r.url; e.aviso = r.fondoPocoUniforme ? 'El fondo no es parejo, así que puede quedar con restos. Mejor usa una foto con fondo liso (blanco) o un PNG sin fondo.' : ''; e.err = '' }
  catch (x) { e.err = x instanceof ErrorImagenIng ? x.message : 'No se pudo procesar la imagen.' }
}
let t = 0
const recalcularPronto = () => { clearTimeout(t); t = setTimeout(recalcular, 90) }

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
    e.nueva = true; e.quitarPropia = false; e.tieneFotoPropia = true
    recalcular()
  } catch (x) { e.err = x instanceof ErrorImagenIng ? x.message : 'No se pudo leer la imagen.' }
  finally { e.leyendo = false }
}
function volverOriginal() {
  const e = ed.value
  e.nueva = false; e.fuente = null; e.quitarPropia = true; e.tieneFotoPropia = false; e.imagen = imgIconoSlug(e.id); e.nota = ''; e.aviso = ''; e.err = ''
}

async function guardarEditor() {
  const e = ed.value
  e.err = ''
  const nombre = e.nombre.trim()
  if (!nombre) return (e.err = 'Escribe el nombre del ingrediente.')
  if (nombre.length > 30) return (e.err = 'El nombre es muy largo (máximo 30 letras).')
  if (nombreOcupado(nombre, e.id)) return (e.err = 'Ya existe un ingrediente con ese nombre.')
  if (e.nueva && e.err) return
  const id = e.esNuevo ? 'ing-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) : e.id
  const imgs = { ...imagenes.value }
  if (e.nueva) imgs[id] = e.imagen
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
        <div class="ig-mcab"><h3 style="margin:0">{{ ed.esNuevo ? 'Agregar ingrediente' : 'Editar ingrediente' }}</h3><button type="button" class="ig-x" aria-label="Cerrar" @click="cerrar"><Icono nombre="cerrar" :tam="20" /></button></div>

        <label class="campo">Nombre
          <input v-model="ed.nombre" maxlength="30" :readonly="!ed.esNuevo" placeholder="Ej. Tocino" />
        </label>
        <p v-if="!ed.esNuevo" class="desc" style="margin:-4px 0 10px">El nombre no se cambia porque las especialidades lo usan. Para otro nombre, agrega uno nuevo y quita este.</p>
        <label class="campo">Tipo (para ordenar las capas de la pizza)
          <select v-model="ed.tipo"><option value="verdura">Verdura o fruta (arriba)</option><option value="carne">Carne (abajo)</option></select>
        </label>

        <div class="ig-foto-ed">
          <span class="damero ig-previa"><img v-if="ed.imagen" :src="ed.imagen" alt="Vista previa" /><span v-else class="desc">Sin foto</span></span>
          <div class="ig-foto-acc">
            <label class="btn chico claro archivo"><Icono nombre="camara" :tam="16" class="txt" />{{ ed.imagen ? 'Cambiar foto' : 'Elegir foto' }}<input type="file" accept="image/*" hidden @change="alElegir" /></label>
            <button v-if="!ed.esNuevo && esDeFabrica(ed.id) && ed.tieneFotoPropia" type="button" class="btn chico claro" @click="volverOriginal">Volver a la original</button>
            <p class="desc" style="margin:0">El cuadro de cuadritos muestra lo transparente. Funciona mejor con fondo liso o un PNG sin fondo.</p>
          </div>
        </div>
        <p v-if="ed.leyendo" class="sub">Procesando…</p>
        <template v-if="ed.fuente">
          <label class="check"><input type="checkbox" v-model="ed.quitarFondo" @change="recalcular" /> Quitar el fondo automáticamente</label>
          <label v-if="ed.quitarFondo" class="campo">Sensibilidad: {{ ed.sens }}
            <input type="range" min="0" max="100" step="1" v-model.number="ed.sens" @input="recalcularPronto" />
            <span class="desc">Más alta quita más tonos parecidos al fondo; si se come parte del ingrediente, bájala.</span>
          </label>
          <p v-if="ed.nota" class="desc">{{ ed.nota }}</p>
          <p v-if="ed.aviso" class="aviso">{{ ed.aviso }}</p>
        </template>

        <template v-if="ed.imagen">
          <p class="desc" style="margin:10px 0 4px">Así se verá sobre la pizza</p>
          <div class="ig-pizza" aria-hidden="true"><img v-for="(q, n) in PIEZAS_PREVIA" :key="n" :src="ed.imagen" :style="{ left: `calc(50% + ${q[0]}px - 17px)`, top: `calc(50% + ${q[1]}px - 17px)`, transform: `rotate(${q[2]}deg)` }" alt="" /></div>
        </template>

        <div v-if="ed.nueva || ed.tieneFotoPropia" class="dos">
          <label class="campo">Cantidad: {{ ed.piezas || 'auto' }}
            <input type="range" min="0" max="60" step="2" v-model.number="ed.piezas" />
          </label>
          <label class="campo">Tamaño: {{ ed.tam || 'auto' }}
            <input type="range" min="0" max="200" step="10" v-model.number="ed.tam" />
          </label>
        </div>
        <p v-if="ed.nueva || ed.tieneFotoPropia" class="desc" style="margin:-4px 0 8px">Cuántas piezas lleva la pizza y qué tan grandes se ven (en "auto" se calcula solo).</p>

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
.ig-modal { position: fixed; inset: 0; z-index: 70; background: #000b; display: flex; align-items: flex-end; justify-content: center; }
.ig-caja { background: var(--fondo); border: 1px solid var(--borde); border-radius: 22px 22px 0 0; width: 100%; max-width: 560px; max-height: 94dvh; overflow-y: auto; padding: 18px 16px calc(18px + env(safe-area-inset-bottom, 0px)); }
.ig-mcab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.ig-x { background: var(--sup2); border: 1px solid var(--borde); width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; }
.ig-caja .campo input[type=text], .ig-caja .campo input:not([type]), .ig-caja .campo select { width: 100%; }
.ig-caja select, .ig-caja input[maxlength] { padding: 13px 14px; border: 1.5px solid var(--borde); border-radius: 12px; background: var(--sup); color: var(--texto); font-family: inherit; margin-top: 5px; }
.ig-caja .campo .desc { font-weight: 400; display: block; margin-top: 4px; }
.ig-caja input[type=range] { width: 100%; accent-color: var(--rojo); }
.ig-foto-ed { display: flex; gap: 14px; align-items: center; margin: 6px 0 10px; }
.ig-previa { width: 112px; height: 112px; border-radius: 16px; display: grid; place-items: center; flex: none; overflow: hidden; border: 1px solid var(--borde); }
.ig-foto-acc { display: grid; gap: 8px; justify-items: start; }
.ig-pizza { position: relative; width: 150px; height: 150px; margin: 0 auto 12px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #f6c768, #d9902f 70%, #b86f1c); box-shadow: 0 6px 14px #000a; overflow: hidden; }
.ig-pizza img { position: absolute; width: 34px; height: 34px; object-fit: contain; filter: drop-shadow(0 2px 2px #0007); }
.ig-pie { display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px; }
@media (min-width: 640px) { .ig-modal { align-items: center; } .ig-caja { border-radius: 22px; } }
</style>
