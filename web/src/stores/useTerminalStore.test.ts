import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTerminalStore } from './useTerminalStore'

describe('useTerminalStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initialises with compare tab active', () => {
    const store = useTerminalStore()
    expect(store.activeTab).toBe('compare')
  })

  it('initialises all load states as idle', () => {
    const store = useTerminalStore()
    expect(store.loadState.calc).toBe('idle')
    expect(store.loadState.bc).toBe('idle')
    expect(store.loadState.dc).toBe('idle')
    expect(store.loadState.apcalc).toBe('idle')
  })

  it('setActiveTab changes the active tab', () => {
    const store = useTerminalStore()
    store.setActiveTab('bc')
    expect(store.activeTab).toBe('bc')
  })

  it('setActiveTab accepts all valid tabs', () => {
    const store = useTerminalStore()
    const tabs = ['compare', 'calc', 'bc', 'dc', 'apcalc'] as const
    for (const tab of tabs) {
      store.setActiveTab(tab)
      expect(store.activeTab).toBe(tab)
    }
  })

  it('setLoadState updates load state', () => {
    const store = useTerminalStore()
    store.setLoadState('calc', 'loading')
    expect(store.loadState.calc).toBe('loading')
    store.setLoadState('calc', 'ready')
    expect(store.loadState.calc).toBe('ready')
  })

  it('setLoadState with error stores the message', () => {
    const store = useTerminalStore()
    store.setLoadState('bc', 'error', 'WASM load failed')
    expect(store.loadState.bc).toBe('error')
    expect(store.errorMessage.bc).toBe('WASM load failed')
  })

  it('setLoadState without error does not overwrite existing error message', () => {
    const store = useTerminalStore()
    store.setLoadState('apcalc', 'error', 'first error')
    store.setLoadState('apcalc', 'loading')
    expect(store.errorMessage.apcalc).toBe('first error')
  })
})
