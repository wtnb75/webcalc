import type { Terminal } from '@xterm/xterm'
import { openpty, TtyServer } from 'xterm-pty'
import type { CalcName, WasmBridge } from '../types/wasm'

export function useWasmBridge(name: CalcName): WasmBridge {
  if (name === 'calc') return createCalcBridge()
  return createEmscriptenBridge(name)
}

const PROMPTS: Partial<Record<CalcName, string>> = { bc: 'bc> ', dc: 'dc> ' }

type SlaveInternal = {
  fromLdiscToUpperBuffer: number[]
  _onReadable: { fire(): void }
}

type MasterInternal = {
  notifyResize(rows: number, cols: number): void
}

function feedLine(slave: ReturnType<typeof openpty>['slave'], line: string) {
  const raw = slave as unknown as SlaveInternal
  const bytes = Array.from(new TextEncoder().encode(line + '\n'))
  raw.fromLdiscToUpperBuffer.push(...bytes)
  raw._onReadable.fire()
}

// apcalc prints this on startup when it can't find its key bindings file.
// The message is written to stderr before emscriptenHack connects, so we
// can't prevent it at the WASM level — filter it from the first output chunk.
const APCALC_NOISE = /\S+: Cannot open bindings file "[^"]+", fancy editing disabled\.\r?\n/

function createEmscriptenBridge(name: 'bc' | 'dc' | 'apcalc'): WasmBridge {
  const PROMPT = PROMPTS[name]
  const usePrompt = PROMPT !== undefined
  const hasBanner = name === 'bc'

  let terminal: Terminal | null = null
  let currentSlave: ReturnType<typeof openpty>['slave'] | null = null
  let worker: Worker | null = null
  let disposables: Array<{ dispose(): void }> = []

  let inputBuf = ''
  const history: string[] = []
  let histIndex = 0
  let savedBuf = ''

  // prompt state
  let promptPending = false
  let promptTimer: ReturnType<typeof setTimeout> | null = null

  function writePrompt() {
    if (promptTimer) { clearTimeout(promptTimer); promptTimer = null }
    promptPending = false
    terminal?.write(PROMPT!)
  }

  function schedulePrompt() {
    // write prompt after bc output arrives; fall back to timeout for silent ops
    promptPending = true
    promptTimer = setTimeout(writePrompt, 60)
  }

  function eraseInput() {
    if (terminal && inputBuf.length > 0) terminal.write('\b \b'.repeat(inputBuf.length))
  }

  function replaceInput(next: string) {
    eraseInput()
    inputBuf = next
    if (next.length > 0) terminal?.write(next)
  }

  function handleInput(data: string) {
    if (!terminal || !currentSlave) return
    if (data === '\r') {
      terminal.write('\r\n')
      const line = inputBuf
      if (line.trim()) history.push(line)
      histIndex = history.length
      savedBuf = ''
      inputBuf = ''
      feedLine(currentSlave, line)
      if (usePrompt) schedulePrompt()
    } else if (data === '\x7f') {
      if (inputBuf.length > 0) {
        inputBuf = inputBuf.slice(0, -1)
        terminal.write('\b \b')
      }
    } else if (data === '\x1b[A') {
      if (histIndex === history.length) savedBuf = inputBuf
      if (histIndex > 0) replaceInput(history[--histIndex])
    } else if (data === '\x1b[B') {
      if (histIndex < history.length) {
        histIndex++
        replaceInput(histIndex === history.length ? savedBuf : history[histIndex])
      }
    } else if (data.startsWith('\x1b')) {
      // ignore other escape sequences
    } else {
      inputBuf += data
      terminal.write(data)
    }
  }

  function start() {
    const { master, slave } = openpty()
    currentSlave = slave
    inputBuf = ''
    histIndex = history.length
    savedBuf = ''
    promptPending = false
    if (promptTimer) { clearTimeout(promptTimer); promptTimer = null }

    let startupFilterDone = name !== 'apcalc'

    disposables.push(
      master.onWrite(([data, ack]: [Uint8Array, () => void]) => {
        // filter apcalc startup noise on first output chunk
        if (!startupFilterDone) {
          startupFilterDone = true
          const text = new TextDecoder().decode(data)
          const filtered = text.replace(APCALC_NOISE, '')
          if (filtered !== text) {
            if (filtered) terminal?.write(new TextEncoder().encode(filtered), ack)
            else ack()
            return
          }
        }

        terminal?.write(data, ack)

        // after bc outputs (ends with newline), show prompt
        if (usePrompt && promptPending) {
          const text = new TextDecoder().decode(data)
          if (text.endsWith('\n')) writePrompt()
        }
      }),
      terminal!.onData(handleInput),
      terminal!.onResize(({ cols, rows }) => {
        ;(master as unknown as MasterInternal).notifyResize(rows, cols)
      }),
    )

    worker = new Worker(`${import.meta.env.BASE_URL}workers/${name}.worker.js`)
    new TtyServer(slave).start(worker)

    if (usePrompt) {
      if (hasBanner) {
        // bc: show prompt after startup banner (ends with double newline)
        let bannerDone = false
        const bannerSub = master.onWrite(([data]: [Uint8Array, () => void]) => {
          if (bannerDone) return
          const text = new TextDecoder().decode(data)
          if (text.includes('\n\n')) {
            bannerDone = true
            bannerSub.dispose()
            terminal?.write(PROMPT!)
          }
        })
      } else {
        // dc and others: no banner, show prompt immediately after init
        setTimeout(() => terminal?.write(PROMPT!), 80)
      }
    }
  }

  return {
    async connectTerminal(t: Terminal) {
      terminal = t
      start()
    },

    sendInput(data: string) {
      if (!terminal || !currentSlave) return
      const line = data.replace(/\r$/, '')
      terminal.write(line + '\r\n')
      if (line.trim()) {
        history.push(line)
        histIndex = history.length
      }
      inputBuf = ''
      feedLine(currentSlave, line)
      if (usePrompt) schedulePrompt()
    },

    reset() {
      if (promptTimer) { clearTimeout(promptTimer); promptTimer = null }
      disposables.forEach((d) => d.dispose())
      disposables = []
      worker?.terminate()
      worker = null
      currentSlave = null
      inputBuf = ''
      terminal?.reset()
      if (terminal) start()
    },
  }
}

function createCalcBridge(): WasmBridge {
  let terminal: Terminal | null = null
  let ctx: { evaluate(s: string): string } | null = null
  let buf = ''
  const PROMPT = 'calc> '
  let disposable: { dispose(): void } | null = null

  const history: string[] = []
  let histIndex = 0
  let savedBuf = ''

  function eraseInput() {
    if (terminal && buf.length > 0) terminal.write('\b \b'.repeat(buf.length))
  }

  function replaceInput(next: string) {
    eraseInput()
    buf = next
    if (next.length > 0) terminal?.write(next)
  }

  function handleInput(data: string) {
    if (!terminal || !ctx) return
    if (data === '\r') {
      const input = buf.trim()
      terminal.write('\r\n')
      if (input) {
        history.push(input)
        terminal.write(ctx.evaluate(input) + '\r\n')
      }
      histIndex = history.length
      savedBuf = ''
      buf = ''
      terminal.write(PROMPT)
    } else if (data === '\x7f') {
      if (buf.length > 0) {
        buf = buf.slice(0, -1)
        terminal.write('\b \b')
      }
    } else if (data === '\x1b[A') {
      if (histIndex === history.length) savedBuf = buf
      if (histIndex > 0) replaceInput(history[--histIndex])
    } else if (data === '\x1b[B') {
      if (histIndex < history.length) {
        histIndex++
        replaceInput(histIndex === history.length ? savedBuf : history[histIndex])
      }
    } else if (data.startsWith('\x1b')) {
      // ignore other escape sequences
    } else {
      buf += data
      terminal.write(data)
    }
  }

  return {
    async connectTerminal(t: Terminal) {
      terminal = t
      const mod = await import(/* @vite-ignore */ `${import.meta.env.BASE_URL}wasm/calc_wasm.js`)
      await mod.default()
      ctx = new mod.Context() as { evaluate(s: string): string }
      t.write(PROMPT)
      disposable = t.onData(handleInput)
    },

    sendInput(data: string) {
      if (!terminal || !ctx) return
      const input = data.replace(/\r$/, '').trim()
      if (!input) return
      terminal.write(input + '\r\n')
      const result = ctx.evaluate(input)
      terminal.write(result + '\r\n' + PROMPT)
      history.push(input)
      histIndex = history.length
      buf = ''
    },

    reset() {
      disposable?.dispose()
      disposable = null
      buf = ''
      terminal?.reset()
      if (terminal && ctx) {
        terminal.write(PROMPT)
        disposable = terminal.onData(handleInput)
      }
    },
  }
}
