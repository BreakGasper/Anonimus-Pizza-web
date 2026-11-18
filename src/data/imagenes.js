// Imágenes reales (public/img). La ruta respeta la base de Vite.
const base = import.meta.env.BASE_URL

const SLUG = {
  'Champiñones': 'champinones', 'Pimiento verde': 'pimiento-verde', 'Cebolla': 'cebolla', 'Aceitunas negras': 'aceitunas-negras',
  'Jalapeño': 'jalapeno', 'Piña': 'pina', 'Pepperoni': 'pepperoni', 'Jamón': 'jamon', 'Salchicha': 'salchicha',
  'Salchicha italiana': 'salchicha-italiana', 'Chorizo': 'chorizo', 'Carne molida': 'carne-molida',
}

// De abajo hacia arriba: lo grande y plano abajo, lo pequeño encima (se ve más natural).
export const ORDEN_CAPAS = ['Champiñones', 'Carne molida', 'Cebolla', 'Jamón', 'Salchicha', 'Salchicha italiana', 'Chorizo',
  'Pepperoni', 'Pimiento verde', 'Jalapeño', 'Piña', 'Aceitunas negras']

export const imgBase = `${base}img/base.webp`
export const imgLogo = `${base}img/logo.webp`
export const imgCapa = (nombre) => `${base}img/capas/${SLUG[nombre]}.webp`
export const imgIcono = (nombre) => `${base}img/iconos/${SLUG[nombre]}.webp`
export const imgEspecialidad = (id) => `${base}img/esp/${id}.webp`
