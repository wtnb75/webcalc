import { describe, it, expect } from 'vitest'
import { calcInfo } from './calcInfo'
import type { CalcName } from './types/wasm'

const names: CalcName[] = ['calc', 'bc', 'dc', 'apcalc']

describe('calcInfo', () => {
  it('has an entry for every CalcName', () => {
    for (const name of names) {
      expect(calcInfo[name]).toBeDefined()
    }
  })

  it.each(names)('%s has all required fields', (name) => {
    const info = calcInfo[name]
    expect(typeof info.label).toBe('string')
    expect(info.label.length).toBeGreaterThan(0)
    expect(typeof info.version).toBe('string')
    expect(info.version.length).toBeGreaterThan(0)
    expect(typeof info.license).toBe('string')
    expect(info.license.length).toBeGreaterThan(0)
    expect(typeof info.url).toBe('string')
    expect(info.url).toMatch(/^https?:\/\//)
    expect(typeof info.description).toBe('string')
    expect(info.description.length).toBeGreaterThan(0)
  })
})
