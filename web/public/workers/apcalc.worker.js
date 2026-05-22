importScripts('../workerTools.js')

onmessage = (msg) => {
  const wasmBase = new URL('../wasm/', self.location.href).href
  self.Module = {
    locateFile: (_path) => wasmBase + 'apcalc-core.wasm',
  }
  importScripts('../wasm/apcalc-core.js')
  emscriptenHack(new TtyClient(msg.data))
}
