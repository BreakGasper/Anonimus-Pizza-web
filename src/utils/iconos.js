// Íconos de los productos (mismo set de línea que el resto de la app, ver components/Icono.vue).
export const ICONOS_PRODUCTO = [
  ['pizza', 'Pizza'], ['calzone', 'Calzone'], ['bebida', 'Refresco'], ['agua', 'Agua'], ['fuego', 'Fuego'],
  ['chile', 'Picante'], ['hoja', 'Vegetariana'], ['carne', 'Carne'], ['queso', 'Queso'], ['pina', 'Piña'],
  ['usuario', 'Individual'], ['pareja', 'Para dos'], ['fiesta', 'Fiesta'], ['promo', 'Regalo'],
]
const VALIDOS = new Set(ICONOS_PRODUCTO.map(([id]) => id))
// Menús guardados antes con emojis: se traducen al ícono equivalente.
const DE_EMOJI = { '🍍': 'pina', '🍕': 'pizza', '🌶️': 'chile', '🌶': 'chile', '🧀': 'queso', '🥩': 'carne', '🥬': 'hoja', '🔥': 'fuego', '🙋': 'usuario', '👫': 'pareja', '🎉': 'fiesta', '🥟': 'calzone', '🥤': 'bebida', '💧': 'agua', '🎁': 'promo' }

// it: { icono?, emoji?, tipo?, categoria? } → nombre de ícono válido
export function iconoProducto(it) {
  if (!it) return 'pizza'
  if (VALIDOS.has(it.icono)) return it.icono
  if (DE_EMOJI[it.emoji]) return DE_EMOJI[it.emoji]
  if (it.tipo === 'adicional' && it.categoria === 'calzones') return 'calzone'
  if (it.tipo === 'adicional' && it.categoria === 'bebidas') return 'bebida'
  if (it.tipo === 'paquete') return 'promo'
  return 'pizza'
}
