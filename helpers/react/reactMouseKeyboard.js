// @flow

/**
 * @typedef {Object} Modifiers
 * @property {boolean} metaKey - Indicates if the meta key is pressed.
 * @property {boolean} shiftKey - Indicates if the shift key is pressed.
 * @property {boolean} ctrlKey - Indicates if the ctrl key is pressed.
 * @property {boolean} altKey - Indicates if the alt key is pressed.
 * @property {boolean} hasModifier - Indicates if any modifier key is pressed.
 */

/**
 * Extracts modifier key information from a MouseEvent.
 * e.g. onClick handler
 * Use extractModifierKeys(event).hasModifier to check if any modifier keys are pressed.
 *
 * @param {MouseEvent} event - The MouseEvent object.
 * @returns {Modifiers} An object containing modifier key information.
 */
export function extractModifierKeys(event: MouseEvent | KeyboardEvent): {
  metaKey: boolean,
  shiftKey: boolean,
  ctrlKey: boolean,
  altKey: boolean,
  hasModifier: boolean,
} {
  const metaKey = event.metaKey
  const shiftKey = event.shiftKey
  const ctrlKey = event.ctrlKey
  const altKey = event.altKey

  const hasModifier = metaKey || shiftKey || ctrlKey || altKey

  return {
    metaKey,
    shiftKey,
    ctrlKey,
    altKey,
    hasModifier,
  }
}
