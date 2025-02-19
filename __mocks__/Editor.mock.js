/* eslint-disable */
/**
 * Editor mocks with Proxy
 *
 * Editor and Note share many of the same properties+methods (CoreNoteFields), so most of them are defined in Note.mock.js and can apply to both.
 *
 * This module uses a JavaScript Proxy to redirect all function calls to the underlying `note` object unless specifically overridden.
 * The `get` trap in the Proxy checks if a property exists on the `Editor` object. If it does, it returns that property.
 * If not, it delegates the call to the `note` object. If the property is not found in either, it throws an error.
 *
 * To override a function that is not in the underlying `note`, simply define it in the `editorOverrides` object.
 *
 * Note: All `open*` functions are specifically overridden to return `this.note`.
 */

import { Note } from './Note.mock'
const noteObject = new Note() // NOTE: try to reference the code in the Note mock wherever possible!
// NOTE: noteObject is spread into Editor below, so any properties that exist in Note will overwrite the ones in Editor

const editorOverrides = {
  ...{
    async openNoteByDate(date: Date, newWindow?: boolean, highlightStart?: number, highlightEnd?: number, splitView?: boolean, timeframe?: string): Promise<TNote> {
      return noteObject
    },
    async openNoteByDateString() {
      return noteObject
    },
    async openNoteByFilename() {
      return noteObject
    },
    async openNoteByTitle() {
      return noteObject
    },
    async openNoteByTitleCaseInsensitive() {
      return noteObject
    },
    note: noteObject,
  },
  ...noteObject,
}

export const Editor = new Proxy(editorOverrides, {
  get(target, prop) {
    if (prop in target) {
      return target[prop]
    }
    if (prop in target.note) {
      return target.note[prop]
    }
    // Handle known built-in Symbol properties with sensible defaults
    const symbolProperties = [Symbol.iterator, Symbol.toPrimitive, Symbol.asyncIterator, Symbol.hasInstance, Symbol.toStringTag]
    if (symbolProperties.includes(prop)) {
      if (prop === Symbol.iterator) return undefined
      if (prop === Symbol.toPrimitive) return (hint) => (hint === 'number' ? NaN : String(target.note))
      if (prop === Symbol.asyncIterator) return undefined
      if (prop === Symbol.hasInstance) return undefined
      if (prop === Symbol.toStringTag) return 'Editor'
    }
    // Handle Jest specific methods that are not defined on Note and which should not cause errors
    if (['asymmetricMatch'].includes(prop)) {
      return undefined
    }
    // Throw detailed error if property is not found
    throw new Error(
      `Editor.mock.js: Property "${String(prop)}" not found. Editor.${String(prop)} or Note.${String(prop)} does not exist.\n` +
        `- Check if this property/method should be implemented in Note.mock.js.\n` +
        `- If it's Editor-specific, consider adding it to Editor.mock.js overrides in editorOverrides.\n` +
        `- If this is a Jest-specific method (such as 'asymmetricMatch') or a built-in Symbol (e.g., Symbol.iterator, Symbol.toPrimitive), ` +
        `return a sensible default instead.\n`,
    )
  },
})
