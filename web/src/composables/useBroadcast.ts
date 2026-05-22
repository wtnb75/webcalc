import type { CalcName, WasmBridge } from '../types/wasm'

export function useBroadcast(bridges: Partial<Record<CalcName, WasmBridge>>) {
  function broadcast(text: string) {
    const all = Object.values(bridges) as WasmBridge[]
    all.forEach((b) => b.sendInput(text + '\r'))
  }
  return { broadcast }
}
