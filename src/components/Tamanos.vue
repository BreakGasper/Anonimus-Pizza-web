<script setup>
import { TAMANOS } from '../data/menu.js'
defineProps({ modelValue: String })
defineEmits(['update:modelValue'])
</script>

<template>
  <div class="tamanos" role="radiogroup" aria-label="Tamaño">
    <button v-for="t in TAMANOS" :key="t.id" type="button" role="radio" :aria-checked="modelValue === t.id"
      :class="['tam', { on: modelValue === t.id }]" @click="$emit('update:modelValue', t.id)">
      <b>{{ t.nombre }}</b>{{ t.cm }}
    </button>
  </div>
</template>
