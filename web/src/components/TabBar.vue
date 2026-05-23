<script setup lang="ts">
import { useTerminalStore } from '../stores/useTerminalStore'
import { useThemeStore } from '../stores/useThemeStore'
import type { ActiveTab } from '../types/wasm'

const store = useTerminalStore()
const theme = useThemeStore()

const tabs: { id: ActiveTab; label: string }[] = [
  { id: 'compare', label: '比較' },
  { id: 'calc', label: 'calc' },
  { id: 'bc', label: 'bc' },
  { id: 'dc', label: 'dc' },
  { id: 'apcalc', label: 'apcalc' },
]
</script>

<template>
  <nav class="flex items-center border-b border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :class="[
        'px-4 py-2 text-sm font-medium transition-colors',
        store.activeTab === tab.id
          ? 'border-b-2 border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
          : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
      ]"
      @click="store.setActiveTab(tab.id)"
    >
      {{ tab.label }}
    </button>

    <div class="ml-auto px-3">
      <button
        class="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        :title="theme.isDark ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'"
        @click="theme.toggle()"
      >
        {{ theme.isDark ? '☀' : '🌙' }}
      </button>
    </div>
  </nav>
</template>
