<script setup lang="ts">
import { reactive, ref } from 'vue'
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
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex min-h-0 flex-1 divide-x divide-gray-700">
      <div class="flex-1">
        <TerminalPane name="calc" :visible="visible" @bridge-ready="(b) => onBridgeReady('calc', b)" />
      </div>
      <div class="flex-1">
        <TerminalPane name="bc" :visible="visible" @bridge-ready="(b) => onBridgeReady('bc', b)" />
      </div>
      <div class="flex-1">
        <TerminalPane
          name="apcalc"
          :visible="visible"
          @bridge-ready="(b) => onBridgeReady('apcalc', b)"
        />
      </div>
    </div>

    <div class="flex items-center gap-2 border-t border-gray-700 bg-gray-900 px-3 py-2">
      <span class="shrink-0 text-sm text-gray-400">全端末に送る:</span>
      <input
        v-model="broadcastText"
        class="min-w-0 flex-1 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100 focus:border-blue-400 focus:outline-none"
        placeholder="式を入力…"
        @keydown.enter="sendBroadcast"
        @keydown="onKeydown"
      />
      <button
        class="shrink-0 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500"
        @click="sendBroadcast"
      >
        → 送信
      </button>
    </div>
  </div>
</template>
