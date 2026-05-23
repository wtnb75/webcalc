import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import TabBar from './TabBar.vue'
import { useTerminalStore } from '../stores/useTerminalStore'
import { useThemeStore } from '../stores/useThemeStore'

beforeEach(() => {
  setActivePinia(createPinia())
  document.documentElement.classList.remove('dark')
})

describe('TabBar', () => {
  it('renders all 5 tabs', () => {
    const wrapper = mount(TabBar)
    const buttons = wrapper.findAll('button')
    const labels = buttons.map((b) => b.text())
    expect(labels).toContain('比較')
    expect(labels).toContain('calc')
    expect(labels).toContain('bc')
    expect(labels).toContain('dc')
    expect(labels).toContain('apcalc')
  })

  it('clicking a tab sets the active tab in the store', async () => {
    const wrapper = mount(TabBar)
    const store = useTerminalStore()
    const bcButton = wrapper.findAll('button').find((b) => b.text() === 'bc')
    await bcButton!.trigger('click')
    expect(store.activeTab).toBe('bc')
  })

  it('clicking calc tab sets activeTab to calc', async () => {
    const wrapper = mount(TabBar)
    const store = useTerminalStore()
    const calcButton = wrapper.findAll('button').find((b) => b.text() === 'calc')
    await calcButton!.trigger('click')
    expect(store.activeTab).toBe('calc')
  })

  it('active tab has border-blue-500 class', async () => {
    const store = useTerminalStore()
    store.setActiveTab('bc')
    const wrapper = mount(TabBar)
    const bcButton = wrapper.findAll('button').find((b) => b.text() === 'bc')
    expect(bcButton!.classes()).toContain('border-blue-500')
  })

  it('inactive tabs do not have border-blue-500 class', async () => {
    const store = useTerminalStore()
    store.setActiveTab('compare')
    const wrapper = mount(TabBar)
    const calcButton = wrapper.findAll('button').find((b) => b.text() === 'calc')
    expect(calcButton!.classes()).not.toContain('border-blue-500')
  })

  it('renders a theme toggle button', () => {
    const wrapper = mount(TabBar)
    const themeBtn = wrapper.find('[title]')
    expect(themeBtn.exists()).toBe(true)
  })

  it('theme toggle button calls theme.toggle()', async () => {
    const wrapper = mount(TabBar)
    const theme = useThemeStore()
    const initial = theme.isDark
    const themeBtn = wrapper.find('[title]')
    await themeBtn.trigger('click')
    expect(theme.isDark).toBe(!initial)
  })

  it('theme toggle shows moon icon when light', () => {
    const theme = useThemeStore()
    theme.isDark = false
    const wrapper = mount(TabBar)
    const themeBtn = wrapper.find('[title]')
    expect(themeBtn.text()).toContain('🌙')
  })

  it('theme toggle shows sun icon when dark', () => {
    const theme = useThemeStore()
    theme.isDark = true
    const wrapper = mount(TabBar)
    const themeBtn = wrapper.find('[title]')
    expect(themeBtn.text()).toContain('☀')
  })
})
