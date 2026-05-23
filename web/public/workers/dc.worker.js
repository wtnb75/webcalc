importScripts('../workerTools.js')

onmessage = (msg) => {
  const wasmBase = new URL('../wasm/', self.location.href).href
  self.Module = {
    locateFile: (_path) => wasmBase + 'dc-core.wasm',
  }
  importScripts('../wasm/dc-core.js')
  emscriptenHack(new TtyClient(msg.data))
}
