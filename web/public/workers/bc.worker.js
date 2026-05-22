importScripts('../workerTools.js')

onmessage = (msg) => {
  const wasmBase = new URL('../wasm/', self.location.href).href
  self.Module = {
    locateFile: (_path) => wasmBase + 'bc-core.wasm',
  }
  importScripts('../wasm/bc-core.js')
  emscriptenHack(new TtyClient(msg.data))
}
