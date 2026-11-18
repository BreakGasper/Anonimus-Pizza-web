<script setup>
import { imgLogo } from '../data/imagenes.js'
// Logo original de Anonimus Pizza. `completo` solo cambia el alt (el tamaño lo da el contenedor).
defineProps({ completo: { type: Boolean, default: false } })
</script>

<template>
  <img :src="imgLogo" alt="Anonimus Pizza: pizza, calzone y algo más" class="logo" decoding="async" :fetchpriority="completo ? 'high' : undefined" />
</template>

<style>
.logo { display: block; width: 100%; height: auto; }
</style>
