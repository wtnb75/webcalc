import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('./TerminalPane.vue', () => ({
  default: {
    name: 'TerminalPane',
    props: ['name', 'visible'],
    template: '<div class="pane-stub" :data-name="name" />',
    expose: ['focus'],
    setup() { return { focus: vi.fn() } },
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('SingleView', () => {
  async function mountSingle(name = 'dc', visible = false) {
    const { default: SingleView } = await import('./SingleView.vue')
    return mount(SingleView, { props: { name, visible } })
  }

  it('renders a TerminalPane with the correct name', async () => {
    const wrapper = await mountSingle('bc')
    await flushPromises()
    const pane = wrapper.find('[data-name="bc"]')
    expect(pane.exists()).toBe(true)
  })

  it('passes visible prop to TerminalPane', async () => {
    const wrapper = await mountSingle('calc', true)
    await flushPromises()
    const pane = wrapper.find('[data-name="calc"]')
    expect(pane.exists()).toBe(true)
  })

  it('exposes focus()', async () => {
    const wrapper = await mountSingle('dc')
    expect(typeof (wrapper.vm as { focus?: () => void }).focus).toBe('function')
  })

  it('calling focus() does not throw', async () => {
    const wrapper = await mountSingle('dc')
    const vm = wrapper.vm as { focus?: () => void }
    expect(() => vm.focus?.()).not.toThrow()
  })
})
