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
 * Convert a hex color to RGB values using chroma.js
 * @param {string} hex - Hex color string (e.g., '#ff0000')
 * @returns {?{r: number, g: number, b: number}} RGB values or null if invalid
 */
// export const hexToRgb = (hex: string): ?{ r: number, g: number, b: number } => {
// NOTE: DO NOT FLOW TYPE THIS FUNCTION. IT IS IMPORTED BY JSX FILE AND FOR SOME REASON, ROLLUP CHOKES ON FLOW
export const hexToRgb = (hex) => {
  try {
    if (!hex) return null
    const rgb = chroma(hex).rgb()
    return { r: rgb[0], g: rgb[1], b: rgb[2] }
  } catch (error) {
    return null
  }
}

/**
 * Mix two hex colors by averaging them (50/50 blend) using chroma.js
 * Uses RGB color space for mixing to maintain backward compatibility with simple averaging
 * @param {string} color1 - The first hex color string (e.g., '#ff0000')
 * @param {string} color2 - The second hex color string (e.g., '#0000ff')
 * @param {number} ratio - Blend ratio from 0-1 (default 0.5 for 50/50 mix)
 * @returns {string} The resulting hex color string after mixing (e.g., '#800080')
 */
// export const mixHexColors = (color1: string, color2: string, ratio: number = 0.5): string => {
// NOTE: DO NOT FLOW TYPE THIS FUNCTION. IT IS IMPORTED BY JSX FILE AND FOR SOME REASON, ROLLUP CHOKES ON FLOW
export const mixHexColors = (color1, color2, ratio = 0.5) => {
  try {
    if (!color1 || !color2) throw new Error('Both colors required')
    // Use 'rgb' mode for simple averaging (backward compatible with original implementation)
    return chroma.mix(color1, color2, ratio, 'rgb').hex()
  } catch (error) {
    throw new Error(`Invalid hex color format: ${error.message}`)
  }
}
