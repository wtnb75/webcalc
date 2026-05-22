import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ActiveTab, CalcName, LoadState } from '../types/wasm'

export const useTerminalStore = defineStore('terminal', () => {
  const activeTab = ref<ActiveTab>('compare')
  const loadState = ref<Record<CalcName, LoadState>>({
    calc: 'idle',
    bc: 'idle',
    apcalc: 'idle',
  })
  const errorMessage = ref<Partial<Record<CalcName, string>>>({})

  function setActiveTab(tab: ActiveTab) {
    activeTab.value = tab
  }

  function setLoadState(name: CalcName, state: LoadState, error?: string) {
    loadState.value[name] = state
    if (error !== undefined) errorMessage.value[name] = error
  }

  return { activeTab, loadState, errorMessage, setActiveTab, setLoadState }
})
