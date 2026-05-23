<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import TabBar from './components/TabBar.vue'
import CompareView from './components/CompareView.vue'
import SingleView from './components/SingleView.vue'
import { useTerminalStore } from './stores/useTerminalStore'

const store = useTerminalStore()
const tab = computed(() => store.activeTab)

const compareRef = ref<InstanceType<typeof CompareView> | null>(null)
const calcRef = ref<InstanceType<typeof SingleView> | null>(null)
const bcRef = ref<InstanceType<typeof SingleView> | null>(null)
const dcRef = ref<InstanceType<typeof SingleView> | null>(null)
const apcalcRef = ref<InstanceType<typeof SingleView> | null>(null)

watch(tab, (t) => {
  nextTick(() => {
    if (t === 'compare') compareRef.value?.focus()
    else if (t === 'calc') calcRef.value?.focus()
    else if (t === 'bc') bcRef.value?.focus()
    else if (t === 'dc') dcRef.value?.focus()
    else if (t === 'apcalc') apcalcRef.value?.focus()
  })
})
</script>

<template>
  <div class="flex h-screen flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
    <TabBar />
    <div class="min-h-0 flex-1">
      <CompareView ref="compareRef" v-show="tab === 'compare'" :visible="tab === 'compare'" class="h-full" />
      <SingleView ref="calcRef" v-show="tab === 'calc'" name="calc" :visible="tab === 'calc'" class="h-full" />
      <SingleView ref="bcRef" v-show="tab === 'bc'" name="bc" :visible="tab === 'bc'" class="h-full" />
      <SingleView ref="dcRef" v-show="tab === 'dc'" name="dc" :visible="tab === 'dc'" class="h-full" />
      <SingleView
        ref="apcalcRef"
        v-show="tab === 'apcalc'"
        name="apcalc"
        :visible="tab === 'apcalc'"
        class="h-full"
      />
    </div>
  </div>
</template>
