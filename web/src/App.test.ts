import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('./components/TabBar.vue', () => ({
  default: {
    name: 'TabBar',
    template: '<nav class="tabbar-stub" />',
  },
}))

vi.mock('./components/CompareView.vue', () => ({
  default: {
    name: 'CompareView',
    props: ['visible'],
    template: '<div class="compare-stub" :data-visible="visible" />',
    expose: ['focus'],
    setup() { return { focus: vi.fn() } },
  },
}))

vi.mock('./components/SingleView.vue', () => ({
  default: {
    name: 'SingleView',
    props: ['name', 'visible'],
    template: '<div class="single-stub" :data-name="name" :data-visible="visible" />',
    expose: ['focus'],
    setup() { return { focus: vi.fn() } },
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  document.documentElement.classList.remove('dark')
})

describe('App', () => {
  async function mountApp() {
    const { default: App } = await import('./App.vue')
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  it('renders TabBar', async () => {
    const wrapper = await mountApp()
    expect(wrapper.find('.tabbar-stub').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders CompareView', async () => {
    const wrapper = await mountApp()
    expect(wrapper.find('.compare-stub').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders all single-view panels', async () => {
    const wrapper = await mountApp()
    const singles = wrapper.findAll('.single-stub')
    const names = singles.map((s) => s.attributes('data-name'))
    expect(names).toContain('calc')
    expect(names).toContain('bc')
    expect(names).toContain('dc')
    expect(names).toContain('apcalc')
    wrapper.unmount()
  })

  it('compare view is visible when activeTab is compare', async () => {
    const { useTerminalStore } = await import('./stores/useTerminalStore')
    const store = useTerminalStore()
    store.setActiveTab('compare')
    const wrapper = await mountApp()
    const compare = wrapper.find('.compare-stub')
    expect(compare.attributes('data-visible')).toBe('true')
    wrapper.unmount()
  })

  it('single view is visible for the active calc tab', async () => {
    const { useTerminalStore } = await import('./stores/useTerminalStore')
    const store = useTerminalStore()
    store.setActiveTab('bc')
    const wrapper = await mountApp()
    const bcView = wrapper.findAll('.single-stub').find((s) => s.attributes('data-name') === 'bc')
    expect(bcView!.attributes('data-visible')).toBe('true')
    wrapper.unmount()
  })

  it('switching tab triggers focus on the new view', async () => {
    const { useTerminalStore } = await import('./stores/useTerminalStore')
    const store = useTerminalStore()
    const wrapper = await mountApp()
    store.setActiveTab('calc')
    await nextTick()
    store.setActiveTab('dc')
    await nextTick()
    store.setActiveTab('apcalc')
    await nextTick()
    store.setActiveTab('compare')
    await nextTick()
    // No errors expected
    wrapper.unmount()
  })
})
