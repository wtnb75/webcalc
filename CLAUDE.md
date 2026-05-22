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
task build:wasm   # WASMを全部ビルド
task build:web    # フロントエンドをビルド
task build        # 両方まとめて
task dev          # 開発サーバー起動（WASM事前ビルド済み前提）
task clean        # 成果物を削除
```

### Emscripten（bc / apcalc）

- イメージ: `emscripten/emsdk:latest`
- 必須フラグ:
  ```
  -sASYNCIFY
  -sEXPORTED_RUNTIME_METHODS=callMain
  -Os
  --closure 1
  ```
- readline / editline は必ず無効化する（`-DHAVE_READLINE=0` 等、ソースにより異なる）
- 出力先: `web/public/wasm/<name>.js` + `<name>.wasm`

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

### ファイル・命名規則

```
src/
  components/      # PascalCase.vue
  composables/     # use*.ts
  stores/          # use*Store.ts（Pinia）
  types/           # *.ts（型定義のみ）
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

### xterm.js の使い方

- `Terminal` インスタンスはコンポーネントの `onMounted` で生成し、`onUnmounted` で `dispose()` する
- タブ切り替えでセッションを維持するため、インスタンスは Pinia store で保持し、`open()` の付け替えで DOM に再接続する
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

```typescript
import { openpty } from 'xterm-pty'
import { PtyAddon } from '@xterm-pty/xterm-addon'  // パッケージ名は要確認

const { master, slave } = openpty()
terminal.loadAddon(new PtyAddon(master))

// Emscripten Module に slave を渡す
const Module = await loadModule({ pty: slave })
```

- `openpty()` と `PtyAddon` の接続は毎回この形に揃える
- bc と apcalc で同じパターンを使う（コピペ可）

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
