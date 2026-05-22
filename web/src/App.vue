<script setup lang="ts">
import { computed } from 'vue'
import TabBar from './components/TabBar.vue'
import CompareView from './components/CompareView.vue'
import SingleView from './components/SingleView.vue'
import { useTerminalStore } from './stores/useTerminalStore'

const store = useTerminalStore()
const tab = computed(() => store.activeTab)
</script>

<template>
  <div class="flex h-screen flex-col bg-gray-950 text-gray-100">
    <TabBar />
    <div class="min-h-0 flex-1">
      <CompareView v-show="tab === 'compare'" :visible="tab === 'compare'" class="h-full" />
      <SingleView v-show="tab === 'calc'" name="calc" :visible="tab === 'calc'" class="h-full" />
      <SingleView v-show="tab === 'bc'" name="bc" :visible="tab === 'bc'" class="h-full" />
      <SingleView
        v-show="tab === 'apcalc'"
        name="apcalc"
        :visible="tab === 'apcalc'"
        class="h-full"
      />
    </div>
  </div>
</template>
