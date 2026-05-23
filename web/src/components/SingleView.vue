<script setup lang="ts">
import { ref } from 'vue'
import TerminalPane from './TerminalPane.vue'
import type { CalcName } from '../types/wasm'

defineProps<{
  name: CalcName
  visible: boolean
}>()

const paneRef = ref<InstanceType<typeof TerminalPane> | null>(null)
defineExpose({ focus() { paneRef.value?.focus() } })
</script>

<template>
  <div class="h-full">
    <TerminalPane
      ref="paneRef"
      :name="name"
      :visible="visible"
    />
  </div>
</template>
