import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { bloquearZoomTactil } from './sinzoom.js'
import './styles.css'

bloquearZoomTactil()
createApp(App).use(router).mount('#app')
