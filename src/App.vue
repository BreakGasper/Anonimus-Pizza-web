<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { cantidad } from './store/cart.js'
import { mensaje } from './store/toast.js'
import Logo from './components/Logo.vue'
import Icono from './components/Icono.vue'

const route = useRoute()
const esAdmin = computed(() => !!route.meta.admin)
</script>

<template>
  <header v-if="!esAdmin" class="cab">
    <router-link to="/" class="marca" aria-label="Anonimus Pizza, inicio">
      <span class="marca-logo"><Logo /></span>
      <span class="marca-txt">Anonimus Pizza</span>
    </router-link>
    <nav class="cab-menu" aria-label="Principal">
      <router-link to="/" exact-active-class="on">Inicio</router-link>
      <router-link to="/especialidades" active-class="on">Menú</router-link>
      <router-link to="/arma" active-class="on">Arma tu pizza</router-link>
      <router-link to="/paquetes" active-class="on">Paquetes</router-link>
      <router-link to="/adicionales" active-class="on">Adicionales</router-link>
    </nav>
    <div class="cab-der">
    <router-link to="/perfil" class="pildora perfil-pildora" active-class="on" aria-label="Mi perfil"><Icono nombre="usuario" :tam="20" /><span>Perfil</span></router-link>
    <router-link to="/carrito" class="pildora" aria-label="Ver carrito">
      <Icono nombre="carrito" :tam="20" /><span class="solo-escritorio-flex">Carrito</span>
      <span v-if="cantidad" class="badge">{{ cantidad }}</span>
    </router-link>
    </div>
  </header>

  <main :class="['pagina', { admin: esAdmin }]">
    <router-view />
  </main>

  <div v-if="mensaje" class="toast" role="status">{{ mensaje }}</div>

  <nav v-if="!esAdmin" class="nav" aria-label="Navegación principal">
    <router-link to="/" exact-active-class="on"><Icono nombre="inicio" />Inicio</router-link>
    <router-link to="/especialidades" active-class="on"><Icono nombre="carta" />Menú</router-link>
    <router-link to="/arma" class="centro" active-class="on"><span class="burbuja"><Icono nombre="pizza" :tam="28" /></span><span>Arma</span></router-link>
    <router-link to="/perfil" active-class="on"><Icono nombre="usuario" />Perfil</router-link>
    <router-link to="/carrito" active-class="on"><span class="nav-icono"><Icono nombre="carrito" /><i v-if="cantidad" class="nav-badge">{{ cantidad }}</i></span>Carrito</router-link>
  </nav>
</template>
