<script setup lang="ts">
import { onUnmounted, reactive, ref } from 'vue'
import TerminalPane from './TerminalPane.vue'
import { useBroadcast } from '../composables/useBroadcast'
import type { CalcName, WasmBridge } from '../types/wasm'

defineProps<{ visible: boolean }>()

const bridges = reactive<Partial<Record<CalcName, WasmBridge>>>({})
const broadcastText = ref('')

const { broadcast } = useBroadcast(bridges)

function onBridgeReady(name: CalcName, bridge: WasmBridge) {
  bridges[name] = bridge
}

const broadcastHistory: string[] = []
let histIndex = 0
let savedText = ''

function sendBroadcast() {
  const text = broadcastText.value.trim()
  if (!text) return
  broadcast(text)
  broadcastHistory.push(text)
  histIndex = broadcastHistory.length
  savedText = ''
  broadcastText.value = ''
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (histIndex === broadcastHistory.length) savedText = broadcastText.value
    if (histIndex > 0) broadcastText.value = broadcastHistory[--histIndex]
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (histIndex < broadcastHistory.length) {
      histIndex++
      broadcastText.value =
        histIndex === broadcastHistory.length ? savedText : broadcastHistory[histIndex]
    }
  }
}

const broadcastInputRef = ref<HTMLInputElement | null>(null)
defineExpose({ focus() { broadcastInputRef.value?.focus() } })

// ── pane resize ──────────────────────────────────────────────────────────────

const panesRef = ref<HTMLElement | null>(null)
const growths = ref<[number, number, number]>([1, 1, 1])

type DragState = {
  handle: 0 | 1
  startX: number
  startGrowths: [number, number, number]
}
let drag: DragState | null = null

function startDrag(handle: 0 | 1, e: MouseEvent) {
  e.preventDefault()
  drag = { handle, startX: e.clientX, startGrowths: [...growths.value] as [number, number, number] }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!drag || !panesRef.value) return
  const totalW = panesRef.value.getBoundingClientRect().width
  const g = drag.startGrowths
  const total = g[0] + g[1] + g[2]
  const delta = ((e.clientX - drag.startX) / totalW) * total
  const min = total * 0.1
  const h = drag.handle
  const newLeft = Math.max(min, Math.min(g[h] + g[h + 1] - min, g[h] + delta))
  const next = [...g] as [number, number, number]
  next[h] = newLeft
  next[h + 1] = g[h] + g[h + 1] - newLeft
  growths.value = next
}

function stopDrag() {
  drag = null
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
})
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      ref="panesRef"
      class="flex min-h-0 flex-1"
    >
      <div
        :style="{ flex: growths[0] }"
        class="min-w-0"
      >
        <TerminalPane
          name="calc"
          :visible="visible"
          @bridge-ready="(b) => onBridgeReady('calc', b)"
        />
      </div>
      <div
        class="w-1 shrink-0 cursor-col-resize bg-gray-300 hover:bg-blue-400 active:bg-blue-500 dark:bg-gray-700 dark:hover:bg-blue-500 dark:active:bg-blue-400"
        @mousedown="startDrag(0, $event)"
      />
      <div
        :style="{ flex: growths[1] }"
        class="min-w-0"
      >
        <TerminalPane
          name="bc"
          :visible="visible"
          @bridge-ready="(b) => onBridgeReady('bc', b)"
        />
      </div>
      <div
        class="w-1 shrink-0 cursor-col-resize bg-gray-300 hover:bg-blue-400 active:bg-blue-500 dark:bg-gray-700 dark:hover:bg-blue-500 dark:active:bg-blue-400"
        @mousedown="startDrag(1, $event)"
      />
      <div
        :style="{ flex: growths[2] }"
        class="min-w-0"
      >
        <TerminalPane
          name="apcalc"
          :visible="visible"
          @bridge-ready="(b) => onBridgeReady('apcalc', b)"
        />
      </div>
    </div>

    <div class="flex items-center gap-2 border-t border-gray-200 bg-gray-100 px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
      <span class="shrink-0 text-sm text-gray-500 dark:text-gray-400">全端末に送る:</span>
      <input
        ref="broadcastInputRef"
        v-model="broadcastText"
        class="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400"
        placeholder="式を入力…"
        @keydown.enter="sendBroadcast"
        @keydown="onKeydown"
      >
      <button
        class="shrink-0 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500"
        @click="sendBroadcast"
      >
        → 送信
      </button>
    </div>
  </div>
</template>
