/* global describe, test, expect */
// @flow
// Guards the `lib/rendering` barrel against re-exporting bindings that do not exist.
//
// Background: the barrel re-exported `renderTemplate`, which had been renamed to
// `renderTemplateByName` in ./templateProcessor. Babel compiles `export { X } from './y'` into a
// getter returning `_y.X`, so a missing binding is `undefined` at access time rather than an error
// at module load. The barrel therefore kept working for its one real consumer (`render`), and the
// dead export sat there waiting for its first importer to get `undefined` and fail confusingly.
//
// Nothing in the repo imports the alias today, so there is no runtime path that would catch a
// regression here -- which is exactly why it needs a static test.

import * as renderingBarrel from '../lib/rendering'

describe('lib/rendering barrel exports', () => {
  test('every named export resolves to something defined', () => {
    const undefinedExports = Object.keys(renderingBarrel).filter((key) => renderingBarrel[key] === undefined)
    expect(undefinedExports).toEqual([])
  })

  test('exports render, which is the binding the barrel actually exists to provide', () => {
    // np.Templating/src/NPTemplateRunner.js is the barrel's only consumer and imports exactly this.
    expect(typeof renderingBarrel.render).toBe('function')
  })

  test('exports renderTemplateByName under its current name', () => {
    expect(typeof renderingBarrel.renderTemplateByName).toBe('function')
  })

  test('keeps renderTemplate as a backwards-compatible alias of the same function', () => {
    expect(typeof renderingBarrel.renderTemplate).toBe('function')
    expect(renderingBarrel.renderTemplate).toBe(renderingBarrel.renderTemplateByName)
  })
})
