<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { cantidad } from './store/cart.js'
import { mensaje } from './store/toast.js'
import Logo from './components/Logo.vue'

const route = useRoute()
const esAdmin = computed(() => !!route.meta.admin)
</script>

<template>
  <header v-if="!esAdmin" class="cab">
    <router-link to="/" class="marca" aria-label="Anonimus Pizza, inicio">
      <span class="marca-logo"><Logo /></span>
      <span class="marca-txt">Anonimus Pizza</span>
    </router-link>
    <router-link to="/carrito" class="cab-carrito" aria-label="Ver carrito">
      🛒<span v-if="cantidad" class="badge">{{ cantidad }}</span>
    </router-link>
  </header>

  <main :class="['pagina', { admin: esAdmin }]">
    <router-view />
  </main>

  <div v-if="mensaje" class="toast" role="status">{{ mensaje }}</div>

  <nav v-if="!esAdmin" class="nav" aria-label="Navegación principal">
    <router-link to="/" exact-active-class="on">🏠<span>Inicio</span></router-link>
    <router-link to="/especialidades" active-class="on">📖<span>Menú</span></router-link>
    <router-link to="/carrito" active-class="on">🛒<span>Carrito<b v-if="cantidad"> ({{ cantidad }})</b></span></router-link>
  </nav>
</template>
