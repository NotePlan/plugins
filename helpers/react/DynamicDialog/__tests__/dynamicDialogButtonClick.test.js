// @flow
/* globals describe, expect, test */

import { resolveDynamicDialogButtonClick } from '../dynamicDialogButtonClick.js'

describe('resolveDynamicDialogButtonClick', () => {
  test('returns true when handler is missing', async () => {
    expect(await resolveDynamicDialogButtonClick(null, 'key', 'value')).toBe(true)
  })

  test('returns false when sync handler returns false', async () => {
    const handler = () => false
    expect(await resolveDynamicDialogButtonClick(handler, 'key', 'value')).toBe(false)
  })

  test('returns true when sync handler returns void', async () => {
    const handler = () => {}
    expect(await resolveDynamicDialogButtonClick(handler, 'key', 'value')).toBe(true)
  })

  test('awaits async handler before interpreting false', async () => {
    let completed = false
    const handler = async () => {
      await Promise.resolve()
      completed = true
      return false
    }
    expect(await resolveDynamicDialogButtonClick(handler, 'key', 'value')).toBe(false)
    expect(completed).toBe(true)
  })
})
