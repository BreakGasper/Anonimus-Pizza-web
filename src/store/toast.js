import { ref } from 'vue'
export const mensaje = ref('')
let t
export function avisar(texto) {
  mensaje.value = texto
  clearTimeout(t)
  t = setTimeout(() => (mensaje.value = ''), 1800)
}
