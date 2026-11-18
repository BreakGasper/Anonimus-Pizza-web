// Imágenes reales (public/img). La ruta respeta la base de Vite.
const base = import.meta.env.BASE_URL

const SLUG = {
  'Champiñones': 'champinones', 'Pimiento verde': 'pimiento-verde', 'Cebolla': 'cebolla', 'Aceitunas negras': 'aceitunas-negras',
  'Jalapeño': 'jalapeno', 'Piña': 'pina', 'Pepperoni': 'pepperoni', 'Jamón': 'jamon', 'Salchicha': 'salchicha',
  'Salchicha italiana': 'salchicha-italiana', 'Chorizo': 'chorizo', 'Carne molida': 'carne-molida',
}

// Capas de abajo hacia arriba: lo grande y plano abajo, lo pequeño encima. Dentro de cada nivel el orden es al azar
// (así cada pizza se apila distinto, pero nada queda tapado por completo).
export const NIVELES_CAPAS = [
  ['Champiñones', 'Carne molida', 'Cebolla', 'Jamón'],
  ['Salchicha', 'Salchicha italiana', 'Chorizo', 'Pepperoni'],
  ['Pimiento verde', 'Jalapeño', 'Piña', 'Aceitunas negras'],
]

// Piezas por pizza cuando el ingrediente va solo (con más ingredientes se reparte).
export const PIEZAS = {
  champinones: 15, 'pimiento-verde': 20, cebolla: 15, 'aceitunas-negras': 36, jalapeno: 30, pina: 28,
  pepperoni: 17, jamon: 30, salchicha: 24, 'salchicha-italiana': 15, chorizo: 40, 'carne-molida': 46,
}

export const slugDe = (nombre) => SLUG[nombre]
export const imgBase = `${base}img/base.webp`
export const imgLogo = `${base}img/logo.webp`
export const urlSprites = `${base}img/sprites/sprites.json`
export const imgAtlas = (slug) => `${base}img/sprites/${slug}.webp`
export const imgIcono = (nombre) => `${base}img/iconos/${SLUG[nombre]}.webp`
export const imgCalzone = `${base}img/calzone.webp`
export const imgEspecialidad = (id) => `${base}img/esp/${id}.webp`
