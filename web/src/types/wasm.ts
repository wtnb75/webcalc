import type { Terminal } from '@xterm/xterm'

export interface WasmBridge {
  connectTerminal(t: Terminal): Promise<void>
  sendInput(data: string): void
  reset(): void
}

export type CalcName = 'calc' | 'bc' | 'dc' | 'apcalc'
export type LoadState = 'idle' | 'loading' | 'ready' | 'error'
export type ActiveTab = 'compare' | CalcName
