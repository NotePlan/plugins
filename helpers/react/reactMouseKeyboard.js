//@flow

export type Modifiers = {
  metaKey: boolean,
  shiftKey: boolean,
  ctrlKey: boolean,
  altKey: boolean,
  hasModifier: boolean,
}

/**
 * Extracts modifier key information from a MouseEvent.
 * e.g. onClick handler
 * Use extractModifierKeys(event).hasModifier to check if any modifier keys are pressed
 *
 * @param {MouseEvent} event - The MouseEvent object.
 * @returns {Modifiers} An object containing modifier key information.
 */
export function extractModifierKeys(event): Modifiers {
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
