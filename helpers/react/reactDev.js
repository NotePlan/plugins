// Functions which can be imported into any React Component
// @flow
/**
 * Remove HTML entities from a string. Useful if you want to allow people to enter text in an HTML field.
 * @param {string} text
 * @returns {string} cleaned text without HTML entities
 */
// eslint-disable-next-line no-unused-vars

export function decodeHTMLEntities(text: string): string {
  const textArea = document.createElement('textarea')
  textArea.innerHTML = text
  const decoded = textArea.value
  return decoded
}

/****************************************************************************************************************************
 *                             CONSOLE LOGGING
 ****************************************************************************************************************************/
// color this component's output differently in the console
/**
 * Generates a readable RGB color from a string's hash.
 * The color is guaranteed to be light enough to be readable on a white background.
 * @param {string} input The input string to hash.
 * @returns {string} The RGB color in the format 'rgb(r, g, b)'.
 */
function stringToColor(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash)
  }

  const color = (hash & 0x00ffffff).toString(16).toUpperCase()
  const hexColor = `#${`000000${color}`.slice(-6)}`
  const rgb = hexToRgb(hexColor)

  // Adjust the brightness to ensure the color is not too dark
  const brightnessAdjusted = adjustBrightness(rgb.r, rgb.g, rgb.b)
  return `rgb(${brightnessAdjusted.r}, ${brightnessAdjusted.g}, ${brightnessAdjusted.b})`
}

/**
 * Converts a hex color to an RGB object.
 * @param {string} hex The hex color string.
 * @returns {{r: number, g: number, b: number}} RGB representation.
 */
function hexToRgb(hex: string): { r: number, g: number, b: number } {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

/**
 * Adjusts the brightness of the color to ensure good readability on a white background.
 * @param {number} r Red component of the color.
 * @param {number} g Green component of the color.
 * @param {number} b Blue component of the color.
 * @returns {{r: number, g: number, b: number}} Brightened RGB color.
 */
function adjustBrightness(_r: number, _g: number, _b: number): { r: number, g: number, b: number } {
  const luminance = 0.2126 * _r + 0.7152 * _g + 0.0722 * _b
  const brightnessFactor = luminance < 128 ? 0.5 : 0.25
  const r = Math.floor(Math.min(255, _r + brightnessFactor * 255))
  const g = Math.floor(Math.min(255, _g + brightnessFactor * 255))
  const b = Math.floor(Math.min(255, _b + brightnessFactor * 255))
  return { r, g, b }
}
/**
 * A prettier version of logDebug
 * Looks the same in the NotePlan console, but when debugging in a browser, it colors results with a color based on the componentName text
 * Uses the same color for each call in a component (based on the first param)
 * @param {string} componentName|fullString (recommended that you use the first param for a component name), e.g. "ItemGrid" -- try to use the same first param for each call in a component
 * @param {string} detail other text (detail) to display (does display in NotePlan also)
 * @param  {...any} args other args (optional) -- will display in browser, not NotePlan -- could be object or text
 * @returns {void}
 */
export const logDebug = (componentName: string, detail?: string, ...args?: any): void =>
  console.log(
    `${window.webkit ? `${componentName}${detail ? `: ${detail} ` : ''}` : `%c${componentName}${detail ? `: ${detail} ` : ''}`}`,
    `${window.webkit ? '' : `color: #000; background: ${stringToColor(componentName)}`}`,
    ...args,
  )

/**
 * Logs an error message to the console.. (Similar to above.)
 * @param {string} componentName The error message to log.
 * @param {string} detail The detail of the error message.
 * @param {...any} args The arguments to log.
 */
export const logError = (componentName: string, detail?: string = '', ...args: any): void =>
  console.error(
    `${window.webkit ? `${componentName}${detail ? `: ${detail} ` : ''}` : `%c${componentName}${detail ? `: ${detail} ` : ''}`}`,
    `${window.webkit ? '' : `color: #F00; background: #FFF`}`,
    ...args,
  )

/**
 * Create a deep copy of the input object so it can be safely modified without affecting the original
 * Works on basic JS objects, but not on objects with functions or other non-JSON-serializable properties
 * So will work in React but not on NotePlan objects
 * @param {{[string]:any}} input
 * @returns {{[string]:any}} copy
 */
export const deepCopy = (input: TAnyObject): TAnyObject => JSON.parse(JSON.stringify(input)) // Deep copy so we don't mutate the original pluginData

/**
 * Error objects in React are not JSON stringifiable. This function makes them JSON stringifiable.
 * It also removes the redundant file path from the stack trace.
 * @param {Error} error
 * @param {string} cs - (optional) component stack
 * @returns {any} - a simple JS Object with the errror details: name, message, inComponent, line, column, componentStack
 */

export const formatReactError = (error: Error, cs: string = '') => {
  return {
    name: error.name,
    message: error.message,
    inComponent: cs.split('@file', 1)[0]?.replace('\n', ''),
    line: error.line || '',
    column: error.column,
    componentStack: cs
      .split('\n')
      .map((s) => s.replace(/\@file.*$/, ''))
      .filter((s) => s.trim() !== 'div' && s.trim() !== '' && s.trim() !== 'Root' && s.trim() !== 'ErrorBoundary')
      .join(' < '),
  }
}

export { clo, JSP } from '@helpers/dev'
