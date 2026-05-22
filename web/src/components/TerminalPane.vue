<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useWasmBridge } from '../composables/useWasmBridge'
import { useTerminalStore } from '../stores/useTerminalStore'
import type { CalcName, WasmBridge } from '../types/wasm'

const props = defineProps<{
  name: CalcName
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'bridge-ready', bridge: WasmBridge): void
}>()

const store = useTerminalStore()
const containerRef = ref<HTMLDivElement | null>(null)
const hasLoaded = ref(false)

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
  terminal = new Terminal({ convertEol: true, cursorBlink: true })
  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(containerRef.value!)
  fitAddon.fit()

  const onResize = () => fitAddon?.fit()
  window.addEventListener('resize', onResize)
  onUnmounted(() => window.removeEventListener('resize', onResize))

  if (props.visible) {
    hasLoaded.value = true
    load()
  }
})

onUnmounted(() => {
  terminal?.dispose()
  terminal = null
})
</script>

<template>
  <div class="flex h-full flex-col bg-black">
    <div class="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-3 py-1">
      <span class="text-sm font-medium text-gray-200">{{ name }}</span>
      <button
        class="rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        @click="bridge?.reset()"
      >
        reset
      </button>
    </div>

    <div class="relative flex-1 overflow-hidden">
      <div ref="containerRef" class="absolute inset-0" />

      <div
        v-if="store.loadState[name] === 'loading'"
        class="absolute inset-0 flex items-center justify-center bg-black/80"
      >
        <span class="text-sm text-gray-400">Loading {{ name }}…</span>
      </div>

      <div
        v-if="store.loadState[name] === 'error'"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black"
      >
        <span class="text-sm text-red-400">❌ Failed to load {{ name }}.wasm</span>
        <span v-if="store.errorMessage[name]" class="max-w-xs text-center text-xs text-gray-500">
          {{ store.errorMessage[name] }}
        </span>
        <button
          class="rounded bg-gray-700 px-3 py-1 text-sm text-gray-200 hover:bg-gray-600"
          @click="reload()"
        >
          Reload
        </button>
      </div>
    </div>
  </div>
</template>
