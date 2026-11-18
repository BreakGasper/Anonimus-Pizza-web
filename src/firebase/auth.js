import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { app } from './config.js'

export const auth = getAuth(app)

// Solo para pruebas locales contra el emulador (VITE_EMULATOR=1 npm run dev).
if (import.meta.env.VITE_EMULATOR === '1') connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })

// El acceso por teléfono usa Firebase Authentication (correo + contraseña) con un correo "de mentira" derivado del teléfono.
// Ni el teléfono ni la contraseña están en el código: se crean en la consola de Firebase.
export const DOMINIO_ADMIN = 'admin.anonimus.pizza'
export const correoDeTelefono = (tel) => `${String(tel).replace(/\D/g, '')}@${DOMINIO_ADMIN}`
