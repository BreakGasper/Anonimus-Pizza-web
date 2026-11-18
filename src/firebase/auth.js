import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { app } from './config.js'

// Sesión de los CLIENTES (perfil, pedidos a su nombre). El panel de administración tiene la suya, aparte (admin.js).
export const auth = getAuth(app)

// Solo para pruebas locales contra el emulador (VITE_EMULATOR=1 npm run dev).
if (import.meta.env.VITE_EMULATOR === '1') connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
