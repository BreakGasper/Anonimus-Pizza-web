import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { firebaseConfig } from './claves.js'

// El panel de administración usa su PROPIA instancia de Firebase ("admin"): su sesión (guardada aparte en el navegador)
// es independiente de la de los clientes. Entrar o salir en el perfil no afecta al panel, ni al revés.
const appAdmin = initializeApp(firebaseConfig, 'admin')
export const authAdmin = getAuth(appAdmin)
export const dbAdmin = getFirestore(appAdmin)

// Solo para pruebas locales contra los emuladores (VITE_EMULATOR=1 npm run dev).
if (import.meta.env.VITE_EMULATOR === '1') {
  connectAuthEmulator(authAdmin, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(dbAdmin, '127.0.0.1', 8080)
}
