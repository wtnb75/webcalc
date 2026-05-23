import { describe, it, expect } from 'vitest'
import { darkTheme, lightTheme } from './xtermThemes'

describe('xtermThemes', () => {
  it('darkTheme has required color fields', () => {
    expect(darkTheme.background).toBeDefined()
    expect(darkTheme.foreground).toBeDefined()
    expect(darkTheme.cursor).toBeDefined()
    expect(darkTheme.selectionBackground).toBeDefined()
  })

  it('lightTheme has required color fields', () => {
    expect(lightTheme.background).toBeDefined()
    expect(lightTheme.foreground).toBeDefined()
    expect(lightTheme.cursor).toBeDefined()
    expect(lightTheme.selectionBackground).toBeDefined()
  })

  it('dark and light backgrounds are different', () => {
    expect(darkTheme.background).not.toBe(lightTheme.background)
  })

  it('dark and light foregrounds are different', () => {
    expect(darkTheme.foreground).not.toBe(lightTheme.foreground)
  })
})
