<script setup lang="ts">
import { useTerminalStore } from '../stores/useTerminalStore'
import type { ActiveTab } from '../types/wasm'

const store = useTerminalStore()

const tabs: { id: ActiveTab; label: string }[] = [
  { id: 'compare', label: '比較' },
  { id: 'calc', label: 'calc' },
  { id: 'bc', label: 'bc' },
  { id: 'apcalc', label: 'apcalc' },
]
</script>

<template>
  <nav class="flex border-b border-gray-700 bg-gray-900">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :class="[
        'px-4 py-2 text-sm font-medium transition-colors',
        store.activeTab === tab.id
          ? 'border-b-2 border-blue-400 text-blue-400'
          : 'text-gray-400 hover:text-gray-200',
      ]"
      @click="store.setActiveTab(tab.id)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>
