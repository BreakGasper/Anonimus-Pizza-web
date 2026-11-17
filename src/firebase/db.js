import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { app } from './config.js'

export const db = getFirestore(app)

// Solo para pruebas locales contra el emulador (VITE_EMULATOR=1 npm run dev).
if (import.meta.env.VITE_EMULATOR === '1') connectFirestoreEmulator(db, '127.0.0.1', 8080)
