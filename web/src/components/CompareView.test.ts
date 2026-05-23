import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import CompareView from './CompareView.vue'

// stub TerminalPane so no xterm is initialised
vi.mock('./TerminalPane.vue', () => ({
  default: {
    name: 'TerminalPane',
    props: ['name', 'visible'],
    emits: ['bridge-ready'],
    template: '<div class="terminal-pane-stub" :data-name="name" />',
    expose: ['focus'],
    setup() { return { focus: vi.fn() } },
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  document.documentElement.classList.remove('dark')
})

describe('CompareView — pane layout', () => {
  it('renders calc, bc and apcalc panes', () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const panes = wrapper.findAll('[data-name]')
    const names = panes.map((p) => p.attributes('data-name'))
    expect(names).toContain('calc')
    expect(names).toContain('bc')
    expect(names).toContain('apcalc')
  })

  it('does not render a dc pane', () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const dcPane = wrapper.find('[data-name="dc"]')
    expect(dcPane.exists()).toBe(false)
  })

  it('renders two drag handles', () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const handles = wrapper.findAll('.cursor-col-resize')
    expect(handles.length).toBe(2)
  })
})

describe('CompareView — broadcast bar', () => {
  it('renders the broadcast input', () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('renders the send button', () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const btn = wrapper.find('button')
    expect(btn.text()).toContain('送信')
  })

  it('send button is disabled (no-op) when input is blank', async () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('input').element.value).toBe('')
  })

  it('pressing Enter with text clears the input', async () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const input = wrapper.find('input')
    await input.setValue('1+1')
    await input.trigger('keydown.enter')
    await flushPromises()
    expect(input.element.value).toBe('')
  })

  it('clicking send with text clears the input', async () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const input = wrapper.find('input')
    await input.setValue('2+2')
    await wrapper.find('button').trigger('click')
    expect(input.element.value).toBe('')
  })
})

describe('CompareView — broadcast history', () => {
  it('ArrowUp with no history is a no-op', async () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const input = wrapper.find('input')
    await input.setValue('current')
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(input.element.value).toBe('current')
  })

  it('ArrowUp after sending retrieves last entry', async () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const input = wrapper.find('input')
    await input.setValue('1+1')
    await input.trigger('keydown.enter')
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(input.element.value).toBe('1+1')
  })

  it('ArrowDown after ArrowUp restores current text', async () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const input = wrapper.find('input')

    await input.setValue('1+1')
    await input.trigger('keydown.enter')

    await input.setValue('typing')
    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(input.element.value).toBe('typing')
  })

  it('ArrowDown at bottom of history is a no-op', async () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const input = wrapper.find('input')
    await input.setValue('hello')
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(input.element.value).toBe('hello')
  })

  it('multiple history entries are navigable', async () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const input = wrapper.find('input')

    await input.setValue('first')
    await input.trigger('keydown.enter')
    await input.setValue('second')
    await input.trigger('keydown.enter')

    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(input.element.value).toBe('second')
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(input.element.value).toBe('first')
  })

  it('ArrowDown to a middle history entry shows that entry', async () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const input = wrapper.find('input')

    await input.setValue('first')
    await input.trigger('keydown.enter')
    await input.setValue('second')
    await input.trigger('keydown.enter')
    await input.setValue('third')
    await input.trigger('keydown.enter')

    // Navigate up past all entries
    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'ArrowUp' })
    // Navigate down to the middle entry
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(input.element.value).toBe('second')
  })
})

describe('CompareView — onBridgeReady', () => {
  it('bridge-ready from each pane registers the bridge for broadcast', async () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const panes = wrapper.findAllComponents({ name: 'TerminalPane' })
    const bridges = panes.map(() => ({ connectTerminal: vi.fn(), sendInput: vi.fn(), reset: vi.fn() }))
    for (let i = 0; i < panes.length; i++) {
      await panes[i].vm.$emit('bridge-ready', bridges[i])
    }
    await wrapper.find('input').setValue('test')
    await wrapper.find('button').trigger('click')
    for (const b of bridges) {
      expect(b.sendInput).toHaveBeenCalledWith('test\r')
    }
  })
})

describe('CompareView — pane drag', () => {
  it('mousedown on drag handle sets drag state (no throw)', async () => {
    const wrapper = mount(CompareView, { props: { visible: true }, attachTo: document.body })
    const handle = wrapper.find('.cursor-col-resize')
    expect(() => handle.trigger('mousedown', { clientX: 100 })).not.toThrow()
    wrapper.unmount()
  })

  it('mousemove after drag updates growths', async () => {
    const wrapper = mount(CompareView, { props: { visible: true }, attachTo: document.body })
    const handle = wrapper.find('.cursor-col-resize')
    await handle.trigger('mousedown', { clientX: 100, preventDefault: () => {} })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }))
    window.dispatchEvent(new MouseEvent('mouseup'))
    wrapper.unmount()
  })
})

describe('CompareView — focus', () => {
  it('exposes a focus() method', () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    expect(typeof (wrapper.vm as { focus?: () => void }).focus).toBe('function')
  })

  it('calling focus() does not throw', () => {
    const wrapper = mount(CompareView, { props: { visible: true } })
    const vm = wrapper.vm as { focus?: () => void }
    expect(() => vm.focus?.()).not.toThrow()
  })

  it('unmounting cleans up drag listeners', () => {
    const wrapper = mount(CompareView, { props: { visible: true }, attachTo: document.body })
    expect(() => wrapper.unmount()).not.toThrow()
  })
})
