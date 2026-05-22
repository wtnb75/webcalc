# CLAUDE.md — WebCalc プロジェクト規約

詳細仕様は SPEC.md を参照。

---

## 大原則

- **元ソースを変更しない**: `bc-1.08.2/` `calc-0.5.0/` `calc-2.17.0.0/` は読み取り専用扱い。ラッパーは `wasm/` 配下に置く。
- **ホスト環境に依存しない**: WASMビルドはすべてDockerコンテナ内で実行する。
- **静的配信のみ**: サーバーサイド処理は一切書かない。

---

## ビルド規約

### タスク管理

タスクは `Taskfile.yml` で管理する。新しいビルドステップは必ずTaskfileにタスクとして追加する。

```
task web:install   # npm install（WASMビルドの前提）
task build:wasm    # WASMを全部ビルド（web:install に依存）
task build:web     # フロントエンドをビルド
task build         # 両方まとめて
task dev           # 開発サーバー起動（WASM事前ビルド済み前提）
task test          # テスト実行
task clean         # 成果物を削除
```

### Docker ビルドの共通規則

**前提:** `emscripten-pty.js` は `web/node_modules/xterm-pty/emscripten-pty.js` にある。  
`build:bc` / `build:apcalc` は必ず `web:install` タスクに依存させる。

**ボリュームマウント規則:**

| ホストパス | コンテナパス | 権限 |
|---|---|---|
| 元ソースディレクトリ | `/src/<name>` | `:ro` |
| `wasm/<name>/` | `/work` | 読み書き |
| `web/public/wasm/` | `/out` | 読み書き |
| `web/node_modules/xterm-pty/emscripten-pty.js` | `/emscripten-pty.js` | `:ro` |

**docker run の基本形（Taskfile 内）:**

```yaml
vars:
  UID:
    sh: id -u
  GID:
    sh: id -g

tasks:
  web:install:
    dir: web
    sources: [package.json]
    generates: [node_modules/.package-lock.json]
    cmds:
      - npm install

  build:bc:
    deps: [web:install]
    cmds:
      - mkdir -p web/public/wasm
      - |
        docker run --rm \
          -v "{{.ROOT_DIR}}/bc-1.08.2:/src/bc:ro" \
          -v "{{.ROOT_DIR}}/wasm/bc:/work" \
          -v "{{.ROOT_DIR}}/web/public/wasm:/out" \
          -v "{{.ROOT_DIR}}/web/node_modules/xterm-pty/emscripten-pty.js:/emscripten-pty.js:ro" \
          --user "{{.UID}}:{{.GID}}" \
          -w /work \
          emscripten/emsdk:latest \
          make OUT=/out SRC=/src/bc PTY_JS=/emscripten-pty.js
```

- `--user` で出力ファイルの所有者をホストユーザーに合わせる（root 所有ファイルを避ける）
- `sources` / `generates` でファイル変更がない場合はスキップされる
- apcalc も同じパターン（`SRC=/src/apcalc` に変えるだけ）

### Emscripten（bc / apcalc）

- イメージ: `emscripten/emsdk:latest`
- 必須フラグ:
  ```
  -sNO_EXIT_RUNTIME=1
  -sFORCE_FILESYSTEM=1
  -Os
  ```
- ASYNCIFY は不要（Web Worker 内で Atomics.wait を使うため）
- readline / editline は必ず無効化する（`--without-readline` 等、ソースにより異なる）
- 出力先: `web/public/wasm/<name>-core.js` + `<name>-core.wasm`（Worker が importScripts で読む）

### xterm-pty の Emscripten 統合アーキテクチャ

xterm-pty v0.9.x は **Web Worker + SharedArrayBuffer** で Emscripten と通信する。  
`emscripten-pty.js` は存在しない。ASYNCIFY も不要。

```
[メインスレッド]                    [Web Worker]
 Terminal                           bc-core.js (Emscripten)
   ↕ loadAddon(master)               ↕ emscriptenHack(new TtyClient(msg))
 TtyServer(slave).start(worker) ←→ workerTools.js
```

**SharedArrayBuffer を使うため COOP/COEP ヘッダーが必要。**  
GitHub Pages はカスタムヘッダー不可なので `coi-serviceworker` を使う。

### bc のビルド手順（autoconf/automake + Emscripten）

Emscripten でビルドするフラグは `-sNO_EXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1` のみ。  
出力ファイル名は `bc-core.js` とする（Worker の `importScripts` で読み込む）。

`wasm/bc/Makefile` のひな型:

```makefile
SRC   ?= /src/bc
OUT   ?= /out
BUILD := /tmp/bc-build

EMCC_LDFLAGS := -sNO_EXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1 -Os

.PHONY: all

all: $(OUT)/bc-core.js

$(OUT)/bc-core.js:
	mkdir -p $(BUILD) $(OUT)
	cd $(BUILD) && \
	    emconfigure $(SRC)/configure \
	        --without-readline \
	        --without-libedit && \
	    emmake make EXEEXT=.js LDFLAGS="$(EMCC_LDFLAGS)"
	cp $(BUILD)/bc/bc.js   $(OUT)/bc-core.js
	cp $(BUILD)/bc/bc.wasm $(OUT)/bc-core.wasm
```

- `--without-readline --without-libedit` で対話ライブラリを両方無効化
- 出力は Worker で `importScripts` するので ESM 形式不要

### apcalc のビルド手順（手書き Makefile + Emscripten）

`wasm/apcalc/Makefile` のひな型:

```makefile
SRC   ?= /src/apcalc
OUT   ?= /out
BUILD := /tmp/apcalc-build

EMCC_LDFLAGS := -sNO_EXIT_RUNTIME=1 -sFORCE_FILESYSTEM=1 -Os

.PHONY: all

all: $(OUT)/apcalc-core.js

$(OUT)/apcalc-core.js:
	cp -r $(SRC)/. $(BUILD)
	emmake make -C $(BUILD) \
	    USE_READLINE= \
	    READLINE_LIB= \
	    READLINE_EXTRAS= \
	    READLINE_INCLUDE= \
	    LDFLAGS="$(EMCC_LDFLAGS)" \
	    EXEEXT=.js \
	    calc
	cp $(BUILD)/calc.js   $(OUT)/apcalc-core.js
	cp $(BUILD)/calc.wasm $(OUT)/apcalc-core.wasm
```

### Web Worker スクリプト（bc / apcalc 共通パターン）

`web/public/workers/bc.worker.js` として配置:

```js
importScripts('../workerTools.js')

onmessage = (msg) => {
  // Emscripten uses self.location.href (the worker URL) as scriptDirectory,
  // so it would look for bc.wasm in workers/ instead of wasm/.
  // Module.locateFile overrides path resolution to point at the correct wasm file.
  const wasmBase = new URL('../wasm/', self.location.href).href
  self.Module = {
    locateFile: (_path) => wasmBase + 'bc-core.wasm',
  }
  importScripts('../wasm/bc-core.js')
  emscriptenHack(new TtyClient(msg.data))
}
```

- `workerTools.js` と WASM ファイルへのパスは相対URLで指定する（base パスが変わっても動くため）
- `Module.locateFile` を `importScripts` より先に設定しないと Emscripten が誤ったパスを使う

### メインスレッドの接続パターン

```typescript
import { openpty } from 'xterm-pty'

const { master, slave } = openpty()
terminal.loadAddon(master)

const worker = new Worker('/workers/bc.worker.js')
new TtyServer(slave).start(worker)
```

### wasm-pack（calc）

- イメージ: `rust:latest`（コンテナ内で `cargo install wasm-pack`）
- ターゲット: `--target web`
- `calc-0.5.0` を `path` 依存で参照し、`default-features = false`（rustyline を除外）
- 出力先: `web/public/wasm/calc.js` + `calc_bg.wasm`

---

## フロントエンド規約

### 技術スタック

- **Vue 3** — `<script setup>` + Composition API のみ（Options API は使わない）
- **TypeScript** — `strict: true`、`any` は禁止（`unknown` を使う）
- **Tailwind CSS** — スタイルはユーティリティクラスで書く。`<style>` ブロックは原則不使用。Tailwind で表現できない場合のみ `<style scoped>` を使う。
- **Pinia** — 状態管理。コンポーネントをまたぐ状態はすべて store に置く。
- **Vite ターゲット** — `target: 'esnext'`（モダンブラウザ最新2バージョンのみ）
- **Vite base** — GitHub Pages 用にリポジトリ名を `base` に設定する（例: `base: '/webcalc/'`）

### ファイル・命名規則

```
src/
  components/      # PascalCase.vue
  composables/     # use*.ts
  stores/          # use*Store.ts（Pinia）
  types/           # *.ts（型定義のみ）
                   # WasmBridge 型は src/types/wasm.ts に置く
```

- コンポーネント名は PascalCase（`TerminalPane.vue`）
- composable は `use` プレフィックス（`useWasmBridge.ts`）
- Pinia store は `use*Store` 命名（`useTerminalStore.ts`）

### Vue コンポーネントの書き方

```vue
<script setup lang="ts">
// 1. import
// 2. props / emits
// 3. store
// 4. ref / reactive / computed
// 5. 関数
// 6. onMounted などライフサイクル
</script>

<template>
  <!-- ルート要素は1つ -->
</template>
```

- `defineProps` / `defineEmits` は型引数で書く（`withDefaults` 使用可）
- テンプレート内ロジックは最小限。computed に切り出す。

### タブ切り替え

タブは `v-show` で実装する（`v-if` 禁止）。全タブを常時 DOM にマウントすることで  
xterm.js のセッションが自然に維持され、`open()` の付け替えが不要になる。

### WASMの遅延ロード

WASM は各タブを**初めて表示したとき**に動的インポートする。  
ロード中は `loadState: 'loading'` として `TerminalPane` がスピナーを表示する。

```typescript
// Emscripten (bc / apcalc)
const { default: createModule } = await import('/wasm/bc.js')
const Module = await createModule({ pty: slave })

// wasm-pack (calc)
const { default: init, Context } = await import('/wasm/calc.js')
await init()
const ctx = new Context()
```

### xterm.js の使い方

- `Terminal` インスタンスは `onMounted` で生成し、`onUnmounted` で `dispose()` する
- `FitAddon` は必ずロードし、ウィンドウリサイズ時に `fit()` を呼ぶ

```typescript
// 最小パターン
const terminal = new Terminal({ convertEol: true })
const fitAddon = new FitAddon()
terminal.loadAddon(fitAddon)
terminal.open(containerEl)
fitAddon.fit()
```

### xterm-pty の接続パターン（Emscripten用）

Emscripten コードは **Web Worker** で動かす。メインスレッドとは `TtyServer` / `TtyClient` 経由で通信。

```typescript
// メインスレッド（TerminalPane.vue 内）
import { openpty, TtyServer } from 'xterm-pty'

const { master, slave } = openpty()
terminal.loadAddon(master)

const worker = new Worker('/workers/bc.worker.js')
new TtyServer(slave).start(worker)
```

- `TtyServer` は `xterm-pty` からインポートする
- Worker スクリプトは `web/public/workers/<name>.worker.js` に置く
- bc と apcalc で同じパターンを使う
- **SharedArrayBuffer が必要**: `coi-serviceworker` をページに仕込むこと（下記参照）

### calc（Rust wasm-bindgen）のREPLパターン

xterm-pty は使わず、JS 側でエコーとプロンプトを制御する。

```typescript
const PROMPT = 'calc> '
terminal.write(PROMPT)
let buf = ''

terminal.onData(data => {
  if (data === '\r') {
    terminal.write('\r\n')
    const result = ctx.evaluate(buf.trim())
    terminal.write(result + '\r\n' + PROMPT)
    buf = ''
  } else if (data === '\x7f') {         // Backspace
    if (buf.length > 0) {
      buf = buf.slice(0, -1)
      terminal.write('\b \b')
    }
  } else {
    buf += data
    terminal.write(data)
  }
})
```

### Pinia store の書き方

Setup store スタイルを使う（Options store は使わない）。

```typescript
export const useTerminalStore = defineStore('terminal', () => {
  // state は ref
  // getters は computed
  // actions は function
  return { ... }
})
```

`useTerminalStore` が持つべき最低限の状態：

```typescript
type CalcName = 'calc' | 'bc' | 'apcalc'
type LoadState = 'idle' | 'loading' | 'ready' | 'error'
type ActiveTab = 'compare' | CalcName

const activeTab = ref<ActiveTab>('compare')
const loadState = ref<Record<CalcName, LoadState>>({
  calc: 'idle', bc: 'idle', apcalc: 'idle',
})
const bridges = ref<Partial<Record<CalcName, WasmBridge>>>({})
const errorMessage = ref<Partial<Record<CalcName, string>>>({})
```

---

## WASMブリッジ実装パターン

bc/apcalc は xterm-pty 経由、calc は JS 直接制御と実装が異なるが、  
Vue コンポーネントからは同一インターフェースで扱う。

```typescript
interface WasmBridge {
  connectTerminal(t: Terminal): Promise<void>  // ロード + xterm.js 接続
  sendInput(data: string): void                // ブロードキャスト用
  reset(): void                                // セッションリセット
}
```

### ブロードキャスト

```typescript
// useBroadcast.ts
function broadcast(text: string, bridges: WasmBridge[]) {
  bridges.forEach(b => b.sendInput(text + '\r'))
}
```

---

## Linter / Formatter

### フロントエンド（TypeScript / Vue）

ESLint + Prettier を使う。設定ファイルを個別に持ち、役割を分離する。

| ツール | 役割 |
|--------|------|
| ESLint | バグ・ルール違反の検出 |
| Prettier | コードフォーマット統一 |
| `prettier-plugin-tailwindcss` | Tailwind クラス順の自動整列 |

```jsonc
// eslint.config.ts（flat config）
// 使用プラグイン: typescript-eslint, eslint-plugin-vue
// ルール: vue/recommended + typescript-eslint/recommended
```

```jsonc
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

実行コマンド（`package.json` の scripts に登録する）:
```
npm run lint      # ESLint チェック
npm run lint:fix  # ESLint 自動修正
npm run format    # Prettier フォーマット
```

CI では `npm run lint` と `prettier --check` を必ず通す。

### Rust（wasm/calc）

```
cargo clippy -- -D warnings   # 警告をエラー扱い
cargo fmt --check              # フォーマットチェック（CI用）
cargo fmt                      # フォーマット適用
```

---

## テスト

### フロントエンド（web/src/）

- フレームワーク: **Vitest** + **@vue/test-utils**
- カバレッジ: **@vitest/coverage-v8**
- **カバレッジ目標: 90%**（lines / branches / functions / statements すべて）

```typescript
// vite.config.ts の test 設定
test: {
  environment: 'jsdom',
  coverage: {
    provider: 'v8',
    thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    include: ['src/**'],
    exclude: ['src/main.ts'],
  },
}
```

テストファイルの配置: ソースと同じディレクトリに `*.test.ts` で置く。

```
src/composables/useWasmBridge.ts
src/composables/useWasmBridge.test.ts   ← 隣に置く
```

コンポーネントテストは実際の DOM マウントより composable / store のユニットテストを優先する。  
xterm.js / WASM モジュールは vi.mock でモックする。

```
npm run test           # watch モード
npm run test:coverage  # カバレッジレポート生成
```

### Rust wasm ラッパー（wasm/calc/）

```
cargo test
```

カバレッジ目標は同じく 90%。ただしブラウザ環境依存のコード（wasm-bindgen エクスポート）は除外可。

### C ラッパー（wasm/bc/, wasm/apcalc/）

元ソースを変更しないためユニットテストは不要。  
WASMビルドが正常に起動し入出力できることをブラウザ上のインテグレーションテストで確認する。

---

## コードスタイル

- インデント: スペース2つ
- セミコロン: なし（Vite デフォルトに合わせる）
- クォート: シングルクォート
- コメントは書かない。書く場合は「なぜ」だけ（何をするかはコードを読めばわかる）
- 型 `any` は禁止。`unknown` + type guard を使う
