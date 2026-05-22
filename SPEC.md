# WebCalc 仕様書

## プロジェクト概要

CLI計算機3種をWebAssemblyでビルドし、Vue + Viteの静的Webサイト上で  
**xterm.js ターミナルエミュレータ + タブ切り替え** により操作・横比較できるようにする。

- **配信形式:** GitHub Pages（静的配信）
- **計算処理:** 全てクライアントサイド（WASM）
- **ブラウザ対象:** モダンブラウザ最新2バージョン（Chrome / Firefox / Safari / Edge）
- **スコープ外:** Octave（依存関係が大規模すぎる）、CI/CD（後回し）

---

## 対象計算機

| name   | dir             | 言語     | WASM手段     | 難度 |
|--------|-----------------|----------|--------------|------|
| apcalc | calc-2.17.0.0/  | C        | Emscripten   | 中高 |
| calc   | calc-0.5.0/     | Rust     | wasm-bindgen | 低   |
| bc     | bc-1.08.2/      | C (flex) | Emscripten   | 中   |

---

## ビルド環境

**Docker** で統一。ホストへのツールインストール不要。

### 使用イメージ

| 用途         | イメージ                                 |
|--------------|------------------------------------------|
| C → WASM     | `emscripten/emsdk:latest`                |
| Rust → WASM  | `rust:latest` + `wasm-pack` インストール |
| フロント開発 | `node:lts`                               |

### ディレクトリ構成

```
project-webcalc/
├── SPEC.md
├── Taskfile.yml
├── docker/
│   ├── emscripten.Dockerfile
│   └── rust-wasm.Dockerfile
├── wasm/                          # WASMビルドラッパー（元ソース変更なし）
│   ├── calc/                      # Rust wasm-bindgen ラッパー
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── bc/                        # Emscripten用ビルド設定
│   │   └── Makefile
│   └── apcalc/                    # Emscripten用ビルド設定
│       └── Makefile
├── web/                           # Vue + Vite フロントエンド
│   ├── package.json
│   ├── vite.config.ts
│   ├── public/
│   │   └── wasm/                  # ビルド済みWASMを配置
│   │       ├── calc.wasm + calc.js
│   │       ├── bc.wasm + bc.js
│   │       └── apcalc.wasm + apcalc.js
│   └── src/
│       ├── main.ts
│       ├── App.vue
│       ├── stores/
│       │   └── terminals.ts       # Pinia: 各端末の状態
│       ├── composables/
│       │   ├── useWasmBridge.ts   # WASM↔xterm.js I/Oブリッジ
│       │   └── useBroadcast.ts    # 全端末への一括送信
│       ├── types/
│       │   └── wasm.ts            # WasmBridge 等の共有型定義
│       └── components/
│           ├── TabBar.vue         # タブ切り替えUI
│           ├── TerminalPane.vue   # xterm.js ラッパー（1計算機分）
│           ├── CompareView.vue    # 比較タブ: 3ペイン + ブロードキャストバー
│           └── SingleView.vue     # 個別タブ: 全幅ターミナル
├── bc-1.08.2/                     # 元ソース（変更しない）
├── calc-0.5.0/                    # 元ソース（変更しない）
└── calc-2.17.0.0/                 # 元ソース（変更しない）
```

---

## UIレイアウト

### タブ構成

```
[ 比較 ] [ calc ] [ bc ] [ apcalc ]
```

### 比較タブ（3ペイン並列）

```
┌───────────────────┬───────────────────┬───────────────────┐
│ calc              │ bc                │ apcalc            │
│                   │ bc 1.08.2         │ C-style arb. prec │
│                   │ Copyright...      │ calculator        │
│ calc> 1+2         │ > 1+2             │ calc> 1+2         │
│ 3                 │ 3                 │ 3                 │
│ calc> x=5         │ > x=5             │ calc> x=5         │
│ 5                 │ 5                 │ 5                 │
│ calc> _           │ > _               │ calc> _           │
│                   │                   │                   │
│  [xterm.js]       │  [xterm.js]       │  [xterm.js]       │
├───────────────────┴───────────────────┴───────────────────┤
│ 全端末に送る: [________________________________] [→ 送信]  │
└───────────────────────────────────────────────────────────┘
```

- 各ペインは独立したxterm.jsターミナル（直接タイプ可能）
- ブロードキャストバーからは同じ入力を全端末に同時送信（**Enter キー** または **→送信ボタン**）
- 各端末は独立してスクロール可能
- 各ペインヘッダーに **[reset]** ボタン（そのセッションのみリセット）

### 個別タブ（全幅）

```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  bc 1.08.2                                               │
│  Copyright (C) 1991-1994 Free Software Foundation, Inc.  │
│  This is free software with ABSOLUTELY NO WARRANTY.      │
│                                                           │
│  > define f(x) {                                         │
│  + return x * 2;                                         │
│  + }                                                     │
│  > f(10)                                                 │
│  20                                                      │
│  > _                                                     │
│                                                           │
│  [xterm.js 全幅]                                          │
└───────────────────────────────────────────────────────────┘
```

- 計算機固有の機能（関数定義・変数・制御構文）を快適に操作
- 比較タブの同じセッションと状態を共有（タブを行き来しても状態が保たれる）
- ヘッダーに **[reset]** ボタン

---

## WASMアーキテクチャ

### 基本方針：プロセス常駐 + stdin/stdout ブリッジ

計算機WASMを **起動したまま保持** し、xterm.jsとのI/Oをブリッジする。  
ステートレスな `evaluate()` 呼び出しではなく、本物のプロセスとして動作させる。

```
xterm.js ←──────────────────────────────→ WASM プロセス
  onData(input) ──→ [入力キュー] ──→ stdin
  write(output) ←── [出力コールバック] ←── stdout/stderr
```

### bc / apcalc（Emscripten + xterm-pty）

- Emscripten ビルドフラグ: `-sASYNCIFY -sFORCE_FILESYSTEM -sEXPORT_ES6=1 -sMODULARIZE=1 -sEXPORTED_RUNTIME_METHODS=callMain --js-library=emscripten-pty.js`
- readline / editline を無効化（`-DREADLINE=0` 等）し、fgets 入力に統一
- `ASYNCIFY` により main ループが JS イベントループをブロックしない

### calc（Rust / wasm-bindgen）

- wasm-bindgen で `Context` を JS から操作できるように公開
- プロンプト表示・エコー・履歴は JS 側で制御（rustyline は不使用）
- `@` による履歴参照は Context が内部で保持するため動作する

### WASMロードのタイミング

**遅延ロード**：タブを初めて開いたときに `import()` を呼ぶ。  
ロード中はターミナル領域にスピナーを表示し、完了後に xterm.js を起動する。

### WASMエラー時のUI

ロード失敗・クラッシュ時はターミナル領域内にエラー表示と Reload ボタンを出す。  
他の計算機のタブは影響を受けない。

```
┌──────────────────────┐
│ bc            [reset]│
│                      │
│  ❌ Failed to load   │
│     bc.wasm          │
│                      │
│     [ Reload ]       │
└──────────────────────┘
```

### 共通インターフェース・実装パターン

`WasmBridge` 型・xterm-pty 接続・calc REPLループ・ブロードキャストの実装パターンは  
CLAUDE.md「WASMブリッジ実装パターン」を参照。

---

## フロントエンド依存ライブラリ

| ライブラリ | 用途 |
|------------|------|
| Vue 3      | UIフレームワーク |
| Vite       | ビルドツール |
| Pinia      | 状態管理（端末状態・タブ） |
| `@xterm/xterm`     | ターミナルエミュレータ |
| `@xterm/addon-fit` | ターミナルのサイズ自動調整 |
| `xterm-pty`        | Emscripten WASM ↔ xterm.js stdin/stdout ブリッジ |

---

## コンポーネント設計

- **`App.vue`** — タブ状態管理、WASMブリッジの初期化
- **`TabBar.vue`** — タブUI、アクティブタブの切り替え
- **`CompareView.vue`** — 3ペイン配置 + ブロードキャストバー
- **`SingleView.vue`** — 全幅ターミナル（個別タブ）
- **`TerminalPane.vue`** — xterm.js の mount/unmount、WasmBridge との接続、エラー表示・Reloadボタン・Resetボタン

### タブ切り替えの実装

`v-show` で全タブを常時 DOM にマウントする。`v-if` は使わない。  
xterm.js インスタンスの `open()` 付け替えが不要になり、セッションが自然に維持される。

---

## ビルドパイプライン（Taskfile）

```yaml
tasks:
  web:install:   # npm install（build:bc / build:apcalc / build:calc の前提）
  build:calc:    # Docker内でwasm-pack build → public/wasm/ へコピー
  build:bc:      # Docker内でEmscriptenビルド → public/wasm/ へコピー
  build:apcalc:  # Docker内でEmscriptenビルド → public/wasm/ へコピー
  build:wasm:    # 上3つをまとめて実行
  build:web:     # npm run build → dist/ 生成
  build:         # build:wasm + build:web
  dev:           # WASMビルド済み前提でnpm run dev（ホットリロード）
  test:          # npm run test:coverage + cargo test
  clean:         # dist/ + public/wasm/ を削除
```

全てDockerコンテナ経由で実行（ホスト環境依存なし）。  
`build:bc` / `build:apcalc` / `build:calc` は `web:install` に依存（`emscripten-pty.js` の取得のため）。

---

## 実現可能性の懸念点と対策

| 懸念 | 対策 |
|------|------|
| bc/apcalc の readline 依存 | `-DREADLINE=0` 等でコンパイル時に無効化、fgets に置き換え |
| ASYNCIFY のオーバーヘッド | バイナリサイズ増加を許容、`-Os` で最小化 |
| xterm.js の DOM detach/attach | `Terminal` インスタンスを保持し `open()` を付け替える |
| calc のエコー・プロンプト | JS側で完全制御（rustyline 非使用のためシンプル） |
| WASMバイナリサイズ | `-Os` 最適化 + gzip/brotli 配信 |
| xterm-pty と Emscripten の接続 | `openpty()` の slave を Module に渡す公式パターンで対応 |

---

## GitHub Pages デプロイ

- Vite の `base` を `/リポジトリ名/` に設定する
- `dist/` を `gh-pages` ブランチに push する（手動 or 後日 Actions 化）
- WASM ファイルは `public/wasm/` に置くことで `base` パスが自動的に適用される

---

## スコープ外（将来対応候補）

- Octave WASM（octave-online.net のビルド流用）
- xterm.js addon-webgl によるGPUレンダリング
- セッション内容のダウンロード（.txt / .sh 形式）
- 計算結果の差分ハイライト（比較タブでの出力差の強調）
