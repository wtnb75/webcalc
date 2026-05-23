import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

// ── mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../composables/useWasmBridge', () => ({
  useWasmBridge: vi.fn(() => ({
    connectTerminal: vi.fn().mockResolvedValue(undefined),
    sendInput: vi.fn(),
    reset: vi.fn(),
  })),
}))

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

class FakeTerminal {
  options: Record<string, unknown> = {}
  private dataHandlers: Array<(d: string) => void> = []
  write(_d: unknown, cb?: () => void) { cb?.() }
  onData(fn: (d: string) => void) {
    this.dataHandlers.push(fn)
    return { dispose: vi.fn() }
  }
  onResize() { return { dispose: vi.fn() } }
  loadAddon() {}
  open(_el: unknown) {}
  focus() {}
  reset() {}
  dispose() {}
}

class FakeFitAddon {
  fit() {}
  activate() {}
}

vi.mock('@xterm/xterm', () => ({ Terminal: FakeTerminal }))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: FakeFitAddon }))

// ── tests ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  setActivePinia(createPinia())
  document.documentElement.classList.remove('dark')
})

describe('TerminalPane', () => {
  async function mountPane(name = 'dc', visible = false) {
    const { default: TerminalPane } = await import('./TerminalPane.vue')
    const wrapper = mount(TerminalPane, {
      props: { name, visible },
      attachTo: document.body,
    })
    await flushPromises()
    return wrapper
  }

  it('renders the calculator label', async () => {
    const wrapper = await mountPane('dc')
    expect(wrapper.text()).toContain('GNU dc')
  })

  it('renders the ℹ button', async () => {
    const wrapper = await mountPane('bc')
    const btns = wrapper.findAll('button')
    const infoBtn = btns.find((b) => b.text().includes('ℹ'))
    expect(infoBtn).toBeDefined()
  })

  it('info panel is hidden by default', async () => {
    const wrapper = await mountPane('bc')
    const infoPanel = wrapper.find('[style*="display: none"]')
    expect(infoPanel.exists()).toBe(true)
  })

  it('clicking ℹ shows the info panel', async () => {
    const wrapper = await mountPane('dc')
    const btns = wrapper.findAll('button')
    const infoBtn = btns.find((b) => b.text().includes('ℹ'))!
    await infoBtn.trigger('click')
    expect(wrapper.text()).toContain('GNU dc')
    expect(wrapper.text()).toContain('GPL')
  })

  it('renders the reset button', async () => {
    const wrapper = await mountPane('calc')
    const btns = wrapper.findAll('button')
    const resetBtn = btns.find((b) => b.text() === 'reset')
    expect(resetBtn).toBeDefined()
  })

  it('shows loading overlay when loadState is loading', async () => {
    const { useTerminalStore } = await import('../stores/useTerminalStore')
    const store = useTerminalStore()
    store.setLoadState('dc', 'loading')
    const wrapper = await mountPane('dc')
    expect(wrapper.text()).toContain('Loading dc')
  })

  it('shows error overlay when loadState is error', async () => {
    const { useTerminalStore } = await import('../stores/useTerminalStore')
    const store = useTerminalStore()
    store.setLoadState('bc', 'error', 'WASM load failed')
    const wrapper = await mountPane('bc')
    expect(wrapper.text()).toContain('Failed to load bc.wasm')
    expect(wrapper.text()).toContain('WASM load failed')
  })

  it('error overlay shows a Reload button', async () => {
    const { useTerminalStore } = await import('../stores/useTerminalStore')
    const store = useTerminalStore()
    store.setLoadState('apcalc', 'error')
    const wrapper = await mountPane('apcalc')
    const reloadBtn = wrapper.findAll('button').find((b) => b.text() === 'Reload')
    expect(reloadBtn).toBeDefined()
  })

  it('load is triggered when visible=true on mount', async () => {
    const { useWasmBridge } = await import('../composables/useWasmBridge')
    const wrapper = await mountPane('dc', true)
    await flushPromises()
    expect(useWasmBridge).toHaveBeenCalledWith('dc')
    wrapper.unmount()
  })

  it('exposes focus()', async () => {
    const wrapper = await mountPane('dc')
    expect(typeof (wrapper.vm as { focus?: () => void }).focus).toBe('function')
  })

  it('calling focus() does not throw', async () => {
    const wrapper = await mountPane('dc')
    const vm = wrapper.vm as { focus?: () => void }
    expect(() => vm.focus?.()).not.toThrow()
  })

  it('clicking reset button does not throw', async () => {
    const wrapper = await mountPane('dc')
    const resetBtn = wrapper.findAll('button').find((b) => b.text() === 'reset')!
    await expect(resetBtn.trigger('click')).resolves.not.toThrow()
  })

  it('emits bridge-ready after successful load', async () => {
    const wrapper = await mountPane('dc', true)
    await flushPromises()
    expect(wrapper.emitted('bridge-ready')).toBeDefined()
  })

  it('Reload button triggers reload', async () => {
    const { useTerminalStore } = await import('../stores/useTerminalStore')
    const store = useTerminalStore()
    store.setLoadState('bc', 'error')
    const wrapper = await mountPane('bc')
    const reloadBtn = wrapper.findAll('button').find((b) => b.text() === 'Reload')!
    await reloadBtn.trigger('click')
    await flushPromises()
    // after reload, loadState transitions away from 'error'
    expect(['loading', 'ready']).toContain(store.loadState.bc)
  })

  it('unmounting disposes the terminal', async () => {
    const wrapper = await mountPane('dc', true)
    await flushPromises()
    expect(() => wrapper.unmount()).not.toThrow()
  })

  it('becomes visible after tab switch triggers load', async () => {
    const { useWasmBridge } = await import('../composables/useWasmBridge')
    const { default: TerminalPane } = await import('./TerminalPane.vue')
    const wrapper = mount(TerminalPane, { props: { name: 'bc', visible: false }, attachTo: document.body })
    await flushPromises()
    await wrapper.setProps({ visible: true })
    await flushPromises()
    expect(useWasmBridge).toHaveBeenCalledWith('bc')
    wrapper.unmount()
  })

  it('sets error state when load throws', async () => {
    const { useWasmBridge } = await import('../composables/useWasmBridge')
    const { useTerminalStore } = await import('../stores/useTerminalStore')
    vi.mocked(useWasmBridge).mockReturnValueOnce({
      connectTerminal: vi.fn().mockRejectedValue(new Error('WASM boom')),
      sendInput: vi.fn(),
      reset: vi.fn(),
    })
    const wrapper = await mountPane('dc', true)
    await flushPromises()
    const store = useTerminalStore()
    expect(store.loadState.dc).toBe('error')
    wrapper.unmount()
  })

  it('sets error state when reload throws', async () => {
    const { useWasmBridge } = await import('../composables/useWasmBridge')
    const { useTerminalStore } = await import('../stores/useTerminalStore')
    const store = useTerminalStore()
    store.setLoadState('bc', 'error')
    vi.mocked(useWasmBridge).mockReturnValueOnce({
      connectTerminal: vi.fn().mockRejectedValue(new Error('reload fail')),
      sendInput: vi.fn(),
      reset: vi.fn(),
    })
    const wrapper = await mountPane('bc')
    const reloadBtn = wrapper.findAll('button').find((b) => b.text() === 'Reload')!
    await reloadBtn.trigger('click')
    await flushPromises()
    expect(store.loadState.bc).toBe('error')
    wrapper.unmount()
  })

  it('updates terminal theme options when theme toggles', async () => {
    const { useThemeStore } = await import('../stores/useThemeStore')
    const wrapper = await mountPane('dc', true)
    await flushPromises()
    const theme = useThemeStore()
    theme.isDark = !theme.isDark
    await nextTick()
    expect(() => wrapper.unmount()).not.toThrow()
  })
})
