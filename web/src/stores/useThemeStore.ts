import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'webcalc-theme'

function resolveInitial(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved !== null) return saved === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(resolveInitial())

  watch(
    isDark,
    (dark) => {
      document.documentElement.classList.toggle('dark', dark)
      localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
    },
    { immediate: true },
  )

  function toggle() {
    isDark.value = !isDark.value
  }

  return { isDark, toggle }
})
