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
