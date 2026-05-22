<script setup lang="ts">
import TerminalPane from './TerminalPane.vue'
import type { CalcName } from '../types/wasm'

defineProps<{
  name: CalcName
  visible: boolean
}>()
</script>

<template>
  <div class="h-full">
    <TerminalPane :name="name" :visible="visible" />
  </div>
</template>
