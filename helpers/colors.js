// Helper functions for working with colors
// Uses chroma.js, a fantastic utility for deriving colors https://gka.github.io/chroma.js/

import chroma from 'chroma-js'

export const isDark = (bgColor) => chroma(bgColor).luminance() < 0.5
export const isLight = (bgColor) => !isDark(bgColor)

/**
 * Calculate a lightly-offset altColor based on the background color
 * Useful for striped rows (default) and highlight on hover
 * @param {string} bgColor
 * @param {number} strength - 0-1 (default 0.2)
 * @returns {string} - the calculated altColor in #hex format
 */
// export const getAltColor = (bgColor: string, strength: number = 0.2): string => {
// NOTE: DO NOT FLOW TYPE THIS FUNCTION. IT IS IMPORTED BY JSX FILE AND FOR SOME REASON, ROLLUP CHOKES ON FLOW
export const getAltColor = (bgColor, strength = 0.2) => {
  const calcAltFromBGColor = isLight(bgColor) ? chroma(bgColor).darken(strength).css() : chroma(bgColor).brighten(strength).css()
  // if (!altColor || chroma.deltaE(bgColor,altColor) < ) return calcAltFromBGColor
  return calcAltFromBGColor
}

/**
 * Calculate Computes CEI color difference (0-100 where 0 is identical and 100 is maximally different)
 * Useful for knowing if text will be readable on a background or calculating stripes
 * @param {string} a
 * @param {string} b
 * @returns {number} - the deltaE difference between the two colors (0-100) or null if one number is not valid
 */
// export const howDifferentAreTheseColors = (a: string, b: string): number => chroma.deltaE(a, b)
// NOTE: DO NOT FLOW TYPE THIS FUNCTION. IT IS IMPORTED BY JSX FILE AND FOR SOME REASON, ROLLUP CHOKES ON FLOW
export const howDifferentAreTheseColors = (a, b) => (a && b ? chroma.deltaE(a, b) : null)

/**
 * Converts a string to a consistent RGB hex color code
 * Avoids colors that are too close to black or white for better visibility
 * @author Cursor AI guided by @jgclark
 * 
 * @param {string} str - The input string to hash
 * @returns {string} - RGB hex color code (e.g., "#FF5733")
 */
export function stringToColor(str) {
  if (!str || typeof str !== 'string') {
    return '#808080' // Default gray for invalid input
  }

  // Simple hash function to convert string to number
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }

  // Convert hash to positive number
  hash = Math.abs(hash)

  // Generate RGB values with constraints to avoid black/white
  const r = ((hash % 200) + 55) // Range: 55-254 (avoiding 0-54 and 255)
  const g = (((hash >> 8) % 200) + 55) // Range: 55-254
  const b = (((hash >> 16) % 200) + 55) // Range: 55-254

  // Convert to hex and ensure 2 digits
  const toHex = (num) => {
    const hex = num.toString(16).toUpperCase()
    return hex.length === 1 ? `0${  hex}` : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Alternative implementation using HSL for better color distribution
 * This version ensures more vibrant colors by controlling saturation and lightness.
 * @author Cursor AI guided by @jgclark
 * 
 * @param {string} str - The input string to hash
 * @returns {string} - RGB hex color code
 */
export function stringToColorHSL(str) {
  if (!str || typeof str !== 'string') {
    return '#808080' // Default gray for invalid input
  }

  // Simple hash function
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  // Convert hash to positive number
  hash = Math.abs(hash)

  // Generate HSL values
  const hue = hash % 360 // Full hue range (0-359)
  const saturation = 60 + (hash % 30) // Range: 60-89% (avoiding too low/too high)
  const lightness = 35 + (hash % 30) // Range: 35-64% (avoiding too dark/too light)

  // Convert HSL to RGB
  const hslToRgb = (h, s, l) => {
    h /= 360
    s /= 100
    l /= 100

    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }

    let r, g, b

    if (s === 0) {
      r = g = b = l // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1/3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1/3)
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
  }

  const [r, g, b] = hslToRgb(hue, saturation, lightness)

  const toHex = (num) => {
    const hex = num.toString(16).toUpperCase()
    return hex.length === 1 ? `0${  hex}` : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Maps a string to a Tailwind CSS color name from a restricted palette of predefined colors.
 * Uses a hash function to consistently select from the palette
 * @author Cursor AI guided by @jgclark
 * 
 * @param {string} str - The input string to hash
 * @returns {string} - RGB hex color code from the restricted palette
 */
export function stringToTailwindColorName(str) {
  if (!str || typeof str !== 'string') {
    return 'zinc-500' // Default color for invalid input
  }

  // Predefined color palette (Tailwind CSS inspired colors)
  const colorPalette = [
    'amber', // '#F59E0B'
    'blue', // '#3B82F6'
    'cyan', // '#06B6D4'
    'emerald', // '#10B981'
    'fuchsia', // '#D946EF'
    'grey', // '#6B7280'
    'indigo', // '#4F46E5'
    'lime', // '#84CC16'
    'orange', // '#F97316'
    'pink', // '#EC4899'
    'purple', // '#8B5CF6'
    'red', // '#EF4444'
    'rose', // '#F43F5E'
    'sky', // '#0EA5E9'
    'stone', // '#78716C'
    'violet', // '#8B5CF6'
    'teal', // '#14B8A6'
    'yellow', // '#EAB308'
    'zinc', // '#71717A'
  ]

  // Simple hash function to convert string to number
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }

  // Convert hash to positive number and map to palette index
  const index = Math.abs(hash) % colorPalette.length
  // convert to Tailwind CSS color name by adding "-500"
  const tailwindColorName = `${colorPalette[index]}-500`
  return tailwindColorName
}

/**
 * Test function to demonstrate the color generation
 * @param {string} str - String to test
 * @returns {object} - Object containing all color variants and color info
 */
export function testStringToColor(str) {
  const rgbColor = stringToColor(str)
  const hslColor = stringToColorHSL(str)
  const tailwindColor = stringToTailwindColorName(str)
  
  return {
    input: str,
    rgbColor,
    hslColor,
    tailwindColor,
    // Calculate brightness for verification
    rgbBrightness: getBrightness(rgbColor),
    hslBrightness: getBrightness(hslColor),
    paletteBrightness: getBrightness(tailwindColor)
  }
}

/**
 * Calculate the perceived brightness of a hex color
 * @param {string} hex - Hex color code
 * @returns {number} - Brightness value (0-255)
 */
function getBrightness(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  
  // Perceived brightness formula
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b)
}
