<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useWasmBridge } from '../composables/useWasmBridge'
import { useTerminalStore } from '../stores/useTerminalStore'
import { useThemeStore } from '../stores/useThemeStore'
import { calcInfo } from '../calcInfo'
import { darkTheme, lightTheme } from '../xtermThemes'
import type { CalcName, WasmBridge } from '../types/wasm'

const props = defineProps<{
  name: CalcName
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'bridge-ready', bridge: WasmBridge): void
}>()

const store = useTerminalStore()
const themeStore = useThemeStore()
const containerRef = ref<HTMLDivElement | null>(null)
const hasLoaded = ref(false)
const showInfo = ref(false)
const info = calcInfo[props.name]

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let bridge: WasmBridge | null = null

async function load() {
  if (!containerRef.value || !terminal) return
  store.setLoadState(props.name, 'loading')
  try {
    bridge = useWasmBridge(props.name)
    await bridge.connectTerminal(terminal)
    emit('bridge-ready', bridge)
    store.setLoadState(props.name, 'ready')
  } catch (e) {
    store.setLoadState(props.name, 'error', String(e))
  }
}

async function reload() {
  store.setLoadState(props.name, 'loading')
  try {
    bridge = useWasmBridge(props.name)
    await bridge.connectTerminal(terminal!)
    emit('bridge-ready', bridge)
    store.setLoadState(props.name, 'ready')
  } catch (e) {
    store.setLoadState(props.name, 'error', String(e))
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v && !hasLoaded.value) {
      hasLoaded.value = true
      load()
    }
    if (v) fitAddon?.fit()
  },
)

onMounted(() => {
  terminal = new Terminal({
    convertEol: true,
    cursorBlink: true,
    theme: themeStore.isDark ? darkTheme : lightTheme,
  })

  watch(
    () => themeStore.isDark,
    (dark) => {
      if (terminal) terminal.options.theme = dark ? darkTheme : lightTheme
    },
  )
  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(containerRef.value!)
  fitAddon.fit()

  const ro = new ResizeObserver(() => fitAddon?.fit())
  ro.observe(containerRef.value!)
  onUnmounted(() => ro.disconnect())

  if (props.visible) {
    hasLoaded.value = true
    load()
  }
})

onUnmounted(() => {
  terminal?.dispose()
  terminal = null
})

defineExpose({
  focus() { terminal?.focus() },
})
</script>

<template>
  <div class="flex h-full flex-col bg-white dark:bg-black">
    <div class="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-3 py-1 dark:border-gray-700 dark:bg-gray-800">
      <span class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ info.label }}</span>
      <div class="flex items-center gap-1">
        <button
          class="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          :class="{ 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200': showInfo }"
          @click="showInfo = !showInfo"
        >
          ℹ
        </button>
        <button
          class="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          @click="bridge?.reset()"
        >
          reset
        </button>
      </div>
    </div>

    <div
      v-show="showInfo"
      class="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
    >
      <div class="flex flex-wrap gap-x-4 gap-y-1">
        <span><span class="text-gray-400 dark:text-gray-500">version</span> {{ info.version }}</span>
        <span><span class="text-gray-400 dark:text-gray-500">license</span> {{ info.license }}</span>
        <a
          :href="info.url"
          target="_blank"
          rel="noopener"
          class="text-blue-600 hover:underline dark:text-blue-400"
        >{{ info.url }}</a>
      </div>
      <p class="mt-1 text-gray-500 dark:text-gray-400">{{ info.description }}</p>
    </div>

    <div class="relative flex-1 overflow-hidden">
      <div ref="containerRef" class="absolute inset-0" />

      <div
        v-if="store.loadState[name] === 'loading'"
        class="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-black/80"
      >
        <span class="text-sm text-gray-500 dark:text-gray-400">Loading {{ name }}…</span>
      </div>

      <div
        v-if="store.loadState[name] === 'error'"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white dark:bg-black"
      >
        <span class="text-sm text-red-500 dark:text-red-400">❌ Failed to load {{ name }}.wasm</span>
        <span v-if="store.errorMessage[name]" class="max-w-xs text-center text-xs text-gray-400 dark:text-gray-500">
          {{ store.errorMessage[name] }}
        </span>
        <button
          class="rounded bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          @click="reload()"
        >
          Reload
        </button>
      </div>
    </div>
  </div>
</template>
