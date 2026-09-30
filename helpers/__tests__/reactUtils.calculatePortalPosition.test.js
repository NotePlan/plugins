// @flow
/* globals describe, expect, test, beforeEach */

import { calculatePortalPosition } from '../react/reactUtils.js'

/**
 * @param {{ top: number, left: number, width: number, height: number }} box
 * @returns {{ getBoundingClientRect: () => any }}
 */
function fakeEl(box: { top: number, left: number, width: number, height: number }): { getBoundingClientRect: () => any } {
  const right = box.left + box.width
  const bottom = box.top + box.height
  return {
    getBoundingClientRect: () => ({
      top: box.top,
      left: box.left,
      width: box.width,
      height: box.height,
      right,
      bottom,
      x: box.left,
      y: box.top,
      toJSON: () => {},
    }),
  }
}

describe('calculatePortalPosition', () => {
  beforeEach(() => {
    window.innerWidth = 500
    window.innerHeight = 800
  })

  test('start alignment places the popup at the button left', () => {
    const el: any = fakeEl({ top: 100, left: 40, width: 24, height: 24 })
    const pos = calculatePortalPosition({
      referenceElement: el,
      elementWidth: 200,
      elementHeight: 200,
      preferredPlacement: 'below',
      preferredAlignment: 'start',
      offset: 5,
      viewportPadding: 10,
    })
    expect(pos).not.toBeNull()
    if (!pos) return
    expect(pos.left).toBe(40)
    expect(pos.top).toBe(129)
    expect(pos.alignment).toBe('start')
  })

  test('end alignment places the popup so its right edge matches the button', () => {
    const el: any = fakeEl({ top: 100, left: 400, width: 24, height: 24 })
    const pos = calculatePortalPosition({
      referenceElement: el,
      elementWidth: 200,
      elementHeight: 200,
      preferredPlacement: 'below',
      preferredAlignment: 'end',
      offset: 5,
      viewportPadding: 10,
    })
    expect(pos).not.toBeNull()
    if (!pos) return
    expect(pos.left).toBe(224)
    expect(pos.alignment).toBe('end')
  })

  test('auto uses start when the popup fits to the right of the button left', () => {
    const el: any = fakeEl({ top: 100, left: 40, width: 24, height: 24 })
    const pos = calculatePortalPosition({
      referenceElement: el,
      elementWidth: 200,
      elementHeight: 200,
      preferredPlacement: 'below',
      preferredAlignment: 'auto',
      offset: 5,
      viewportPadding: 10,
    })
    expect(pos).not.toBeNull()
    if (!pos) return
    expect(pos.alignment).toBe('start')
    expect(pos.left).toBe(40)
  })

  test('auto uses end when start would overflow the right edge of the window', () => {
    const el: any = fakeEl({ top: 100, left: 400, width: 24, height: 24 })
    const pos = calculatePortalPosition({
      referenceElement: el,
      elementWidth: 320,
      elementHeight: 300,
      preferredPlacement: 'below',
      preferredAlignment: 'auto',
      offset: 5,
      viewportPadding: 10,
    })
    expect(pos).not.toBeNull()
    if (!pos) return
    expect(pos.alignment).toBe('end')
    expect(pos.left + 320).toBeLessThanOrEqual(500 - 10)
    expect(pos.left).toBeGreaterThanOrEqual(10)
  })
})
