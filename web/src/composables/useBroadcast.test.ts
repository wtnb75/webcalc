import { describe, it, expect, vi } from 'vitest'
import { useBroadcast } from './useBroadcast'
import type { WasmBridge } from '../types/wasm'

function makeBridge(): WasmBridge {
  return {
    connectTerminal: vi.fn(),
    sendInput: vi.fn(),
    reset: vi.fn(),
  }
}

describe('useBroadcast', () => {
  it('calls sendInput on all bridges with text + \\r', () => {
    const a = makeBridge()
    const b = makeBridge()
    const bridges = { calc: a, bc: b }
    const { broadcast } = useBroadcast(bridges)

    broadcast('1+1')

    expect(a.sendInput).toHaveBeenCalledWith('1+1\r')
    expect(b.sendInput).toHaveBeenCalledWith('1+1\r')
  })

  it('sends to all bridges independently', () => {
    const a = makeBridge()
    const bridges = { calc: a }
    const { broadcast } = useBroadcast(bridges)

    broadcast('42')
    broadcast('100')

    expect(a.sendInput).toHaveBeenCalledTimes(2)
    expect(a.sendInput).toHaveBeenNthCalledWith(1, '42\r')
    expect(a.sendInput).toHaveBeenNthCalledWith(2, '100\r')
  })

  it('does nothing when bridges is empty', () => {
    const { broadcast } = useBroadcast({})
    expect(() => broadcast('hello')).not.toThrow()
  })

  it('skips bridges not yet registered (undefined)', () => {
    const a = makeBridge()
    const bridges: ReturnType<typeof useBroadcast>['broadcast'] extends (t: string) => void
      ? Record<string, WasmBridge | undefined>
      : never = { calc: a, bc: undefined as unknown as WasmBridge }
    const { broadcast } = useBroadcast({ calc: a })

    broadcast('test')
    expect(a.sendInput).toHaveBeenCalledWith('test\r')
  })
})
