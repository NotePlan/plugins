// @flow

/**
 * @typedef {Object} Modifiers
 * @property {boolean} metaKey - Indicates if the meta key is pressed.
 * @property {boolean} shiftKey - Indicates if the shift key is pressed.
 * @property {boolean} ctrlKey - Indicates if the ctrl key is pressed.
 * @property {boolean} altKey - Indicates if the alt key is pressed.
 * @property {boolean} hasModifier - Indicates if any modifier key is pressed.
 * @property {'meta'|'shift'|'ctrl'|'alt'} modifierName - The name of a single modifier key that is pressed.
 */

export type ModifierType = {
  metaKey: boolean,
  shiftKey: boolean,
  ctrlKey: boolean,
  altKey: boolean,
  hasModifier: boolean,
  modifierName: ?'meta' | 'shift' | 'ctrl' | 'alt',
}

/**
 * Extracts modifier key information from a MouseEvent.
 * e.g. onClick handler
 * Use extractModifierKeys(event).hasModifier to check if any modifier keys are pressed.
 *
 * @param {MouseEvent} event - The MouseEvent object.
 * @returns {ModifierType} An object containing modifier key information.
 */
export function extractModifierKeys(event: MouseEvent | KeyboardEvent): ModifierType {
  const metaKey = event.metaKey
  const shiftKey = event.shiftKey
  const ctrlKey = event.ctrlKey
  const altKey = event.altKey

  const hasModifier = metaKey || shiftKey || ctrlKey || altKey
  const modifierName = metaKey ? 'meta' : shiftKey ? 'shift' : ctrlKey ? 'ctrl' : altKey ? 'alt' : null

  return {
    metaKey,
    shiftKey,
    ctrlKey,
    altKey,
    hasModifier,
    modifierName,
  }
}
