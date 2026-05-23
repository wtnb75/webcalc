import type { CalcName } from './types/wasm'

export interface CalcInfo {
  label: string
  version: string
  license: string
  url: string
  description: string
}

export const calcInfo: Record<CalcName, CalcInfo> = {
  dc: {
    label: 'GNU dc',
    version: '1.08.2',
    license: 'GPL v3+',
    url: 'https://www.gnu.org/software/bc/',
    description:
      'Reverse Polish Notation (RPN) 卓上計算機。bc と同梱。スタック操作と任意精度演算に対応。p で表示、q で終了。',
  },
  bc: {
    label: 'GNU bc',
    version: '1.08.2',
    license: 'GPL v3+',
    url: 'https://www.gnu.org/software/bc/',
    description:
      '任意精度の10進演算言語。scale変数で精度を制御。-lオプションで数学関数ライブラリを使用可。',
  },
  apcalc: {
    label: 'calc (apcalc)',
    version: '2.17.0.0',
    license: 'LGPL v2.1',
    url: 'http://www.isthe.com/chongo/tech/comp/calc/',
    description:
      'Landon Curt Noll 作の任意精度対話型計算機。config() で設定変更、help コマンドで関数一覧を確認できる。',
  },
  calc: {
    label: 'calc (Rust)',
    version: '0.5.0',
    license: 'GPL v3',
    url: 'https://github.com/coriolinus/calc',
    description:
      'Rust製の数式評価器。IEEE 754 倍精度浮動小数点演算。四則演算・べき乗・括弧に対応。',
  },
}
