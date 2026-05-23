import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

const matchMediaMock = vi.fn().mockReturnValue({ matches: false })
Object.defineProperty(globalThis, 'matchMedia', { value: matchMediaMock, writable: true })

describe('useThemeStore', () => {
  beforeEach(() => {
    localStorageMock.clear()
    matchMediaMock.mockReturnValue({ matches: false })
    document.documentElement.classList.remove('dark')
    setActivePinia(createPinia())
    vi.resetModules()
  })

  it('defaults to light when no saved preference and system is light', async () => {
    matchMediaMock.mockReturnValue({ matches: false })
    const { useThemeStore } = await import('./useThemeStore')
    const store = useThemeStore()
    expect(store.isDark).toBe(false)
  })

  it('defaults to dark when system prefers dark', async () => {
    matchMediaMock.mockReturnValue({ matches: true })
    const { useThemeStore } = await import('./useThemeStore')
    const store = useThemeStore()
    expect(store.isDark).toBe(true)
  })

  it('uses saved localStorage preference over system', async () => {
    localStorageMock.setItem('webcalc-theme', 'dark')
    matchMediaMock.mockReturnValue({ matches: false })
    const { useThemeStore } = await import('./useThemeStore')
    const store = useThemeStore()
    expect(store.isDark).toBe(true)
  })

  it('saved light overrides system dark', async () => {
    localStorageMock.setItem('webcalc-theme', 'light')
    matchMediaMock.mockReturnValue({ matches: true })
    const { useThemeStore } = await import('./useThemeStore')
    const store = useThemeStore()
    expect(store.isDark).toBe(false)
  })

  it('toggle flips isDark', async () => {
    const { useThemeStore } = await import('./useThemeStore')
    const store = useThemeStore()
    const initial = store.isDark
    store.toggle()
    expect(store.isDark).toBe(!initial)
  })

  it('toggle twice returns to original', async () => {
    const { useThemeStore } = await import('./useThemeStore')
    const store = useThemeStore()
    const initial = store.isDark
    store.toggle()
    store.toggle()
    expect(store.isDark).toBe(initial)
  })

  it('adds dark class to documentElement when dark', async () => {
    localStorageMock.setItem('webcalc-theme', 'dark')
    const { useThemeStore } = await import('./useThemeStore')
    useThemeStore()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes dark class when light', async () => {
    document.documentElement.classList.add('dark')
    localStorageMock.setItem('webcalc-theme', 'light')
    const { useThemeStore } = await import('./useThemeStore')
    useThemeStore()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists theme to localStorage on toggle', async () => {
    const { useThemeStore } = await import('./useThemeStore')
    const store = useThemeStore()
    store.toggle()
    await nextTick()
    const saved = localStorageMock.getItem('webcalc-theme')
    expect(saved).toBe(store.isDark ? 'dark' : 'light')
  })
})
