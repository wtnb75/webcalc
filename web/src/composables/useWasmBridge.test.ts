import { describe, it, expect, vi } from 'vitest'

// mock the calc WASM dynamic import (path = BASE_URL + 'wasm/calc_wasm.js')
const mockEvaluate = vi.fn((s: string) => `result(${s})`)
vi.mock('/webcalc/wasm/calc_wasm.js', () => ({
  default: vi.fn(async () => {}),
  Context: class { evaluate(s: string) { return mockEvaluate(s) } },
}))

// ── instance tracking ─────────────────────────────────────────────────────────
const tracked = vi.hoisted(() => ({
  lastMaster: null as InstanceType<typeof FakeMaster> | null,
  lastSlave: null as InstanceType<typeof FakeSlave> | null,
}))

// ── FakeMaster / FakeSlave ────────────────────────────────────────────────────
type WriteHandler = (args: [Uint8Array, () => void]) => void

class FakeMaster {
  private handlers: WriteHandler[] = []
  onWrite(fn: WriteHandler) {
    this.handlers.push(fn)
    return { dispose: () => { this.handlers = this.handlers.filter((h) => h !== fn) } }
  }
  simulateOutput(text: string) {
    const data = new TextEncoder().encode(text)
    this.handlers.forEach((h) => h([data, () => {}]))
  }
}

class FakeSlave {
  fromLdiscToUpperBuffer: number[] = []
  _onReadable = { fire: vi.fn() }
  reset() {
    this.fromLdiscToUpperBuffer = []
    this._onReadable.fire.mockClear()
  }
}

// ── xterm mock ────────────────────────────────────────────────────────────────
type DataHandler = (data: string) => void
type ResizeHandler = (size: { cols: number; rows: number }) => void

class FakeTerminal {
  written: string[] = []
  options: Record<string, unknown> = {}
  private dataHandlers: DataHandler[] = []
  private resizeHandlers: ResizeHandler[] = []

  write(data: string | Uint8Array, cb?: () => void) {
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data)
    this.written.push(text)
    cb?.()
  }
  onData(fn: DataHandler) {
    this.dataHandlers.push(fn)
    return { dispose: () => { this.dataHandlers = this.dataHandlers.filter((h) => h !== fn) } }
  }
  onResize(fn: ResizeHandler) {
    this.resizeHandlers.push(fn)
    return { dispose: () => { this.resizeHandlers = this.resizeHandlers.filter((h) => h !== fn) } }
  }
  reset() { this.written = [] }
  focus() {}
  dispose() {}

  simulateInput(data: string) { this.dataHandlers.forEach((h) => h(data)) }
  allOutput() { return this.written.join('') }
}

vi.mock('@xterm/xterm', () => ({ Terminal: FakeTerminal }))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} activate() {} } }))

vi.mock('xterm-pty', () => ({
  openpty: () => {
    const master = new FakeMaster()
    const slave = new FakeSlave()
    tracked.lastMaster = master
    tracked.lastSlave = slave
    return { master, slave }
  },
  TtyServer: class { start(_w: unknown) {} },
}))

vi.stubGlobal('Worker', class { terminate = vi.fn() })

// ── helpers ───────────────────────────────────────────────────────────────────
import { useWasmBridge } from './useWasmBridge'

async function makeEmscriptenBridge(name: 'bc' | 'dc' | 'apcalc') {
  const bridge = useWasmBridge(name)
  const terminal = new FakeTerminal()
  await bridge.connectTerminal(terminal as unknown as import('@xterm/xterm').Terminal)
  const master = tracked.lastMaster!
  const slave = tracked.lastSlave!
  slave.reset()
  return { bridge, terminal, master, slave }
}

// ── interface ─────────────────────────────────────────────────────────────────
describe('useWasmBridge interface', () => {
  it.each(['calc', 'bc', 'dc', 'apcalc'] as const)('%s exposes the WasmBridge API', (name) => {
    const bridge = useWasmBridge(name)
    expect(typeof bridge.connectTerminal).toBe('function')
    expect(typeof bridge.sendInput).toBe('function')
    expect(typeof bridge.reset).toBe('function')
  })

  it.each(['bc', 'dc', 'apcalc'] as const)('%s: sendInput before connect is a no-op', (name) => {
    const bridge = useWasmBridge(name)
    expect(() => bridge.sendInput('test')).not.toThrow()
  })

  it.each(['bc', 'dc', 'apcalc'] as const)('%s: reset before connect is a no-op', (name) => {
    const bridge = useWasmBridge(name)
    expect(() => bridge.reset()).not.toThrow()
  })
})

// ── emscripten bridge: connect ────────────────────────────────────────────────
describe('emscripten bridge — connectTerminal', () => {
  it('bc: creates PTY master/slave', async () => {
    await makeEmscriptenBridge('bc')
    expect(tracked.lastMaster).not.toBeNull()
    expect(tracked.lastSlave).not.toBeNull()
  })

  it('dc: creates PTY master/slave', async () => {
    await makeEmscriptenBridge('dc')
    expect(tracked.lastMaster).not.toBeNull()
  })

  it('apcalc: creates PTY master/slave', async () => {
    await makeEmscriptenBridge('apcalc')
    expect(tracked.lastMaster).not.toBeNull()
  })
})

// ── emscripten bridge: sendInput ──────────────────────────────────────────────
describe('emscripten bridge — sendInput', () => {
  it('writes the line to the terminal', async () => {
    const { bridge, terminal } = await makeEmscriptenBridge('dc')
    bridge.sendInput('2 2 +p')
    expect(terminal.allOutput()).toContain('2 2 +p')
  })

  it('pushes bytes to the slave buffer and fires _onReadable', async () => {
    const { bridge, slave } = await makeEmscriptenBridge('dc')
    bridge.sendInput('42')
    expect(slave.fromLdiscToUpperBuffer.length).toBeGreaterThan(0)
    expect(slave._onReadable.fire).toHaveBeenCalled()
  })

  it('feeds "line\\n" to the slave', async () => {
    const { bridge, slave } = await makeEmscriptenBridge('dc')
    bridge.sendInput('5')
    const text = new TextDecoder().decode(new Uint8Array(slave.fromLdiscToUpperBuffer))
    expect(text).toBe('5\n')
  })

  it('strips trailing \\r before feeding', async () => {
    const { bridge, slave } = await makeEmscriptenBridge('dc')
    bridge.sendInput('5\r')
    const text = new TextDecoder().decode(new Uint8Array(slave.fromLdiscToUpperBuffer))
    expect(text).toBe('5\n')
  })
})

// ── emscripten bridge: master → terminal ──────────────────────────────────────
describe('emscripten bridge — master output → terminal', () => {
  it('forwards master output to the terminal', async () => {
    const { terminal, master } = await makeEmscriptenBridge('dc')
    master.simulateOutput('hello\n')
    expect(terminal.allOutput()).toContain('hello\n')
  })

  it('apcalc: filters startup noise from first output chunk', async () => {
    const { terminal, master } = await makeEmscriptenBridge('apcalc')
    master.simulateOutput(
      './this.program: Cannot open bindings file "bindings", fancy editing disabled.\n',
    )
    expect(terminal.allOutput()).not.toContain('Cannot open bindings file')
  })

  it('apcalc: passes through normal output after noise chunk', async () => {
    const { terminal, master } = await makeEmscriptenBridge('apcalc')
    master.simulateOutput(
      './this.program: Cannot open bindings file "bindings", fancy editing disabled.\n',
    )
    master.simulateOutput('42\n')
    expect(terminal.allOutput()).toContain('42\n')
  })

  it('apcalc: noise-free first chunk passes through unchanged', async () => {
    const { terminal, master } = await makeEmscriptenBridge('apcalc')
    master.simulateOutput('42\n')
    expect(terminal.allOutput()).toContain('42\n')
  })

  it('bc: output triggers prompt after sendInput + newline output', async () => {
    const { bridge, terminal, master, slave } = await makeEmscriptenBridge('bc')
    bridge.sendInput('1+1')
    slave.reset()
    master.simulateOutput('2\n')
    expect(terminal.allOutput()).toContain('bc> ')
  })
})

// ── emscripten bridge: handleInput ────────────────────────────────────────────
describe('emscripten bridge — keyboard input', () => {
  it('regular character echoes and buffers', async () => {
    const { terminal } = await makeEmscriptenBridge('dc')
    terminal.simulateInput('a')
    expect(terminal.allOutput()).toContain('a')
  })

  it('Enter feeds buffered input to slave', async () => {
    const { terminal, slave } = await makeEmscriptenBridge('dc')
    terminal.simulateInput('5')
    slave.reset()
    terminal.simulateInput('\r')
    expect(slave._onReadable.fire).toHaveBeenCalled()
    const text = new TextDecoder().decode(new Uint8Array(slave.fromLdiscToUpperBuffer))
    expect(text).toBe('5\n')
  })

  it('Enter on empty buffer feeds empty line', async () => {
    const { terminal, slave } = await makeEmscriptenBridge('dc')
    slave.reset()
    terminal.simulateInput('\r')
    expect(slave._onReadable.fire).toHaveBeenCalled()
  })

  it('Backspace removes last character', async () => {
    const { terminal } = await makeEmscriptenBridge('dc')
    terminal.simulateInput('x')
    const before = terminal.written.length
    terminal.simulateInput('\x7f')
    expect(terminal.written.length).toBeGreaterThan(before)
    expect(terminal.allOutput()).toContain('\b \b')
  })

  it('Backspace on empty buffer is a no-op', async () => {
    const { terminal } = await makeEmscriptenBridge('dc')
    const before = terminal.written.length
    terminal.simulateInput('\x7f')
    expect(terminal.written.length).toBe(before)
  })

  it('ArrowUp with empty history is a no-op', async () => {
    const { terminal } = await makeEmscriptenBridge('dc')
    const before = terminal.written.length
    terminal.simulateInput('\x1b[A')
    expect(terminal.written.length).toBe(before)
  })

  it('ArrowUp after Enter retrieves last entry', async () => {
    const { terminal } = await makeEmscriptenBridge('dc')
    terminal.simulateInput('5')
    terminal.simulateInput('\r')
    terminal.written = []
    terminal.simulateInput('\x1b[A')
    expect(terminal.allOutput()).toContain('5')
  })

  it('ArrowDown after ArrowUp restores saved buffer', async () => {
    const { terminal } = await makeEmscriptenBridge('dc')
    terminal.simulateInput('5')
    terminal.simulateInput('\r')
    terminal.simulateInput('x')
    terminal.simulateInput('\x1b[A')
    terminal.written = []
    terminal.simulateInput('\x1b[B')
    expect(terminal.allOutput()).toContain('x')
  })

  it('ArrowDown at bottom is a no-op', async () => {
    const { terminal } = await makeEmscriptenBridge('dc')
    const before = terminal.written.length
    terminal.simulateInput('\x1b[B')
    expect(terminal.written.length).toBe(before)
  })

  it('other escape sequences are ignored', async () => {
    const { terminal } = await makeEmscriptenBridge('dc')
    const before = terminal.written.length
    terminal.simulateInput('\x1b[C')
    terminal.simulateInput('\x1b[D')
    expect(terminal.written.length).toBe(before)
  })
})

// ── emscripten bridge: reset ──────────────────────────────────────────────────
describe('emscripten bridge — reset', () => {
  it('calls terminal.reset()', async () => {
    const { bridge, terminal } = await makeEmscriptenBridge('dc')
    const spy = vi.spyOn(terminal, 'reset')
    bridge.reset()
    expect(spy).toHaveBeenCalled()
  })

  it('after reset, sendInput still works without throwing', async () => {
    const { bridge } = await makeEmscriptenBridge('dc')
    bridge.reset()
    expect(() => bridge.sendInput('1')).not.toThrow()
  })

  it('after reset, new input is fed to the new slave', async () => {
    const { bridge } = await makeEmscriptenBridge('dc')
    bridge.reset()
    bridge.sendInput('99')
    const slave = tracked.lastSlave!
    expect(slave._onReadable.fire).toHaveBeenCalled()
  })
})

// ── calc bridge ───────────────────────────────────────────────────────────────
async function makeCalcBridge() {
  const bridge = useWasmBridge('calc')
  const terminal = new FakeTerminal()
  await bridge.connectTerminal(terminal as unknown as import('@xterm/xterm').Terminal)
  return { bridge, terminal }
}

describe('calc bridge — connectTerminal', () => {
  it('writes the prompt after connecting', async () => {
    const { terminal } = await makeCalcBridge()
    expect(terminal.allOutput()).toContain('calc> ')
  })
})

describe('calc bridge — handleInput (keyboard)', () => {
  it('Enter evaluates expression and prints result', async () => {
    mockEvaluate.mockReturnValue('42')
    const { terminal } = await makeCalcBridge()
    terminal.simulateInput('6*7')
    terminal.simulateInput('\r')
    expect(terminal.allOutput()).toContain('42')
  })

  it('Enter on blank input does not call evaluate', async () => {
    mockEvaluate.mockClear()
    const { terminal } = await makeCalcBridge()
    terminal.simulateInput('\r')
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('Backspace removes last character', async () => {
    const { terminal } = await makeCalcBridge()
    terminal.simulateInput('x')
    const before = terminal.written.length
    terminal.simulateInput('\x7f')
    expect(terminal.written.length).toBeGreaterThan(before)
    expect(terminal.allOutput()).toContain('\b \b')
  })

  it('Backspace on empty buffer is a no-op', async () => {
    const { terminal } = await makeCalcBridge()
    const before = terminal.written.length
    terminal.simulateInput('\x7f')
    expect(terminal.written.length).toBe(before)
  })

  it('ArrowUp retrieves last history entry', async () => {
    const { terminal } = await makeCalcBridge()
    terminal.simulateInput('5')
    terminal.simulateInput('\r')
    terminal.written = []
    terminal.simulateInput('\x1b[A')
    expect(terminal.allOutput()).toContain('5')
  })

  it('ArrowDown restores saved buffer', async () => {
    const { terminal } = await makeCalcBridge()
    terminal.simulateInput('5')
    terminal.simulateInput('\r')
    terminal.simulateInput('x')
    terminal.simulateInput('\x1b[A')
    terminal.written = []
    terminal.simulateInput('\x1b[B')
    expect(terminal.allOutput()).toContain('x')
  })

  it('ArrowDown at bottom is a no-op', async () => {
    const { terminal } = await makeCalcBridge()
    const before = terminal.written.length
    terminal.simulateInput('\x1b[B')
    expect(terminal.written.length).toBe(before)
  })

  it('other escape sequences are ignored', async () => {
    const { terminal } = await makeCalcBridge()
    const before = terminal.written.length
    terminal.simulateInput('\x1b[C')
    terminal.simulateInput('\x1b[D')
    expect(terminal.written.length).toBe(before)
  })

  it('regular characters echo to terminal', async () => {
    const { terminal } = await makeCalcBridge()
    terminal.simulateInput('a')
    expect(terminal.allOutput()).toContain('a')
  })
})

describe('calc bridge — sendInput', () => {
  it('writes input and result to terminal', async () => {
    mockEvaluate.mockReturnValue('9')
    const { bridge, terminal } = await makeCalcBridge()
    bridge.sendInput('3*3')
    expect(terminal.allOutput()).toContain('3*3')
    expect(terminal.allOutput()).toContain('9')
  })

  it('strips trailing \\r', async () => {
    mockEvaluate.mockReturnValue('1')
    const { bridge, terminal } = await makeCalcBridge()
    bridge.sendInput('1\r')
    expect(terminal.allOutput()).toContain('1')
  })

  it('blank input is a no-op', async () => {
    mockEvaluate.mockClear()
    const { bridge } = await makeCalcBridge()
    bridge.sendInput('   ')
    expect(mockEvaluate).not.toHaveBeenCalled()
  })
})

describe('calc bridge — reset', () => {
  it('calls terminal.reset()', async () => {
    const { bridge, terminal } = await makeCalcBridge()
    const spy = vi.spyOn(terminal, 'reset')
    bridge.reset()
    expect(spy).toHaveBeenCalled()
  })

  it('writes prompt after reset', async () => {
    const { bridge, terminal } = await makeCalcBridge()
    terminal.written = []
    bridge.reset()
    expect(terminal.allOutput()).toContain('calc> ')
  })

  it('after reset, input still works', async () => {
    mockEvaluate.mockReturnValue('2')
    const { bridge, terminal } = await makeCalcBridge()
    bridge.reset()
    terminal.simulateInput('1+1')
    terminal.simulateInput('\r')
    expect(terminal.allOutput()).toContain('2')
  })
})

// ── APCALC_NOISE regex ────────────────────────────────────────────────────────
describe('APCALC_NOISE regex', () => {
  const APCALC_NOISE = /\S+: Cannot open bindings file "[^"]+", fancy editing disabled\.\r?\n/

  it('matches the standard startup error', () => {
    expect(
      APCALC_NOISE.test('./this.program: Cannot open bindings file "bindings", fancy editing disabled.\n'),
    ).toBe(true)
  })

  it('matches the \\r\\n variant', () => {
    expect(
      APCALC_NOISE.test('calc: Cannot open bindings file "/u/.calc", fancy editing disabled.\r\n'),
    ).toBe(true)
  })

  it('does not match normal output', () => {
    expect(APCALC_NOISE.test('42\n')).toBe(false)
    expect(APCALC_NOISE.test('apcalc 2.17.0.0\n')).toBe(false)
    expect(APCALC_NOISE.test('')).toBe(false)
  })
})
