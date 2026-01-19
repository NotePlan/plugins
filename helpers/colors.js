// Helper functions for working with colors
// Uses chroma.js, a fantastic utility for deriving colors https://gka.github.io/chroma.js/

import chroma from 'chroma-js'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'

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
 * Tailwind CSS default color palette (hex values)
 * Based on Tailwind CSS v3 default colors: https://tailwindcss.com/docs/customizing-colors
 * This allows any Tailwind color name (e.g., 'gray-500', 'blue-500', 'orange-500') to be converted to hex values
 */
// NOTE: DO NOT FLOW TYPE THIS. IT IS IMPORTED BY JSX FILE AND FOR SOME REASON, ROLLUP CHOKES ON FLOW
const TAILWIND_COLORS = {
  // Gray scale
  'gray-50': '#f9fafb',
  'gray-100': '#f3f4f6',
  'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db',
  'gray-400': '#9ca3af',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'gray-800': '#1f2937',
  'gray-900': '#111827',
  'gray-950': '#030712',
  // Red
  'red-50': '#fef2f2',
  'red-100': '#fee2e2',
  'red-200': '#fecaca',
  'red-300': '#fca5a5',
  'red-400': '#f87171',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  'red-700': '#b91c1c',
  'red-800': '#991b1b',
  'red-900': '#7f1d1d',
  'red-950': '#450a0a',
  // Orange
  'orange-50': '#fff7ed',
  'orange-100': '#ffedd5',
  'orange-200': '#fed7aa',
  'orange-300': '#fdba74',
  'orange-400': '#fb923c',
  'orange-500': '#f97316',
  'orange-600': '#ea580c',
  'orange-700': '#c2410c',
  'orange-800': '#9a3412',
  'orange-900': '#7c2d12',
  'orange-950': '#431407',
  // Yellow
  'yellow-50': '#fefce8',
  'yellow-100': '#fef9c3',
  'yellow-200': '#fef08a',
  'yellow-300': '#fde047',
  'yellow-400': '#facc15',
  'yellow-500': '#eab308',
  'yellow-600': '#ca8a04',
  'yellow-700': '#a16207',
  'yellow-800': '#854d0e',
  'yellow-900': '#713f12',
  'yellow-950': '#422006',
  // Green
  'green-50': '#f0fdf4',
  'green-100': '#dcfce7',
  'green-200': '#bbf7d0',
  'green-300': '#86efac',
  'green-400': '#4ade80',
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'green-700': '#15803d',
  'green-800': '#166534',
  'green-900': '#14532d',
  'green-950': '#052e16',
  // Blue
  'blue-50': '#eff6ff',
  'blue-100': '#dbeafe',
  'blue-200': '#bfdbfe',
  'blue-300': '#93c5fd',
  'blue-400': '#60a5fa',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'blue-700': '#1d4ed8',
  'blue-800': '#1e40af',
  'blue-900': '#1e3a8a',
  'blue-950': '#172554',
  // Indigo
  'indigo-50': '#eef2ff',
  'indigo-100': '#e0e7ff',
  'indigo-200': '#c7d2fe',
  'indigo-300': '#a5b4fc',
  'indigo-400': '#818cf8',
  'indigo-500': '#6366f1',
  'indigo-600': '#4f46e5',
  'indigo-700': '#4338ca',
  'indigo-800': '#3730a3',
  'indigo-900': '#312e81',
  'indigo-950': '#1e1b4b',
  // Purple
  'purple-50': '#faf5ff',
  'purple-100': '#f3e8ff',
  'purple-200': '#e9d5ff',
  'purple-300': '#d8b4fe',
  'purple-400': '#c084fc',
  'purple-500': '#a855f7',
  'purple-600': '#9333ea',
  'purple-700': '#7e22ce',
  'purple-800': '#6b21a8',
  'purple-900': '#581c87',
  'purple-950': '#3b0764',
  // Pink
  'pink-50': '#fdf2f8',
  'pink-100': '#fce7f3',
  'pink-200': '#fbcfe8',
  'pink-300': '#f9a8d4',
  'pink-400': '#f472b6',
  'pink-500': '#ec4899',
  'pink-600': '#db2777',
  'pink-700': '#be185d',
  'pink-800': '#9f1239',
  'pink-900': '#831843',
  'pink-950': '#500724',
}

/**
 * Convert a color value to CSS color string
 * Supports CSS variables (e.g., 'teamspace-color'), Tailwind color names (e.g., 'gray-500', 'blue-500', 'green-700'),
 * and direct colors (e.g., '#8cbb9b', 'rgb(...)', 'rgba(...)')
 *
 * Tailwind colors are converted to their hex values. Special mappings allow some colors to use CSS variables
 * with hex fallbacks (e.g., green-700 can use --teamspace-color if available).
 *
 * @param {?string} color - Color value (CSS variable name, Tailwind color name, or direct color)
 * @returns {?string} CSS color string or undefined
 */
// NOTE: DO NOT FLOW TYPE THIS FUNCTION. IT IS IMPORTED BY JSX FILE AND FOR SOME REASON, ROLLUP CHOKES ON FLOW
export const getColorStyle = (color) => {
  if (!color) return undefined
  // If it's a direct color (hex, rgb, rgba), use it as-is
  if (color.startsWith('#') || color.startsWith('rgb')) {
    return color
  }
  // Special mappings: Tailwind colors that should prefer CSS variables with hex fallbacks
  // These match what NotePlan uses internally and what's defined in helper CSS files
  const specialMappings = {
    'green-700': { var: 'teamspace-color', fallback: TAILWIND_COLORS['green-700'] || '#15803d' },
  }
  // Check for special mappings first
  const specialMapping = specialMappings[color]
  if (specialMapping) {
    return `var(--${specialMapping.var}, ${specialMapping.fallback})`
  }
  // Check if it's a Tailwind color name (format: colorName-number, e.g., 'gray-500')
  if (TAILWIND_COLORS[color]) {
    return TAILWIND_COLORS[color]
  }
  // Otherwise, treat it as a CSS variable name (fallback to inherit if not defined)
  return `var(--${color}, inherit)`
}

/**
 * Convert Tailwind color definitions to HSL format suitable for CSS style statements
 * Accepts Tailwind color names (e.g., "amber-200", "slate-800") or any chroma-parseable color format
 * @param {string} color - Tailwind color name (e.g., "amber-200", "slate-800") or hex/rgb/rgba string
 * @param {boolean} includeAlpha - Whether to include alpha channel in output (default: false)
 * @returns {string} - HSL color string in format "hsl(h, s%, l%)" or "hsla(h, s%, l%, a)"
 * @example
 * tailwindToHsl('amber-200') // returns "hsl(45, 93%, 77%)"
 * tailwindToHsl('slate-800') // returns "hsl(222, 47%, 11%)"
 * tailwindToHsl('blue-500') // returns "hsl(217, 91%, 60%)"
 * tailwindToHsl('#3b82f6', true) // returns "hsla(217, 91%, 60%, 1)"
 */
// NOTE: DO NOT FLOW TYPE THIS FUNCTION. IT IS IMPORTED BY JSX FILE AND FOR SOME REASON, ROLLUP CHOKES ON FLOW
export const tailwindToHsl = (color, includeAlpha = false) => {
  if (!color) {
    logWarn(`tailwindToHsl`, `color is null or undefined`)
    return null
  }
  
  try {
    let colorValue = color
    
    // Check if it's a Tailwind color name (e.g., "amber-200")
    if (typeof color === 'string' && /^[a-z]+-\d+$/i.test(color)) {
      // const [colorName, shade] = color.split('-')
      // const shadeNum = parseInt(shade, 10)
      
      // if (TAILWIND_COLORS[colorName] && TAILWIND_COLORS[colorName][shadeNum]) {
      if (TAILWIND_COLORS[color]) {
        colorValue = TAILWIND_COLORS[color]
      } else {
        // Invalid Tailwind color name
        logWarn(`tailwindToHsl`, `Invalid Tailwind color name: ${color}`)
        return null
      }
    }
    
    const chromaColor = chroma(colorValue)
    const hsl = chromaColor.hsl()
    
    // chroma returns [h, s, l] where h is 0-360, s and l are 0-1
    const h = Math.round(hsl[0] || 0)
    const s = Math.round(hsl[1] * 100)
    const l = Math.round(hsl[2] * 100)
    
    if (includeAlpha) {
      const alpha = chromaColor.alpha()
      return `hsla(${h}, ${s}%, ${l}%, ${alpha})`
    }
    
    return `hsl(${h}, ${s}%, ${l}%)`
  } catch (error) {
    // If chroma can't parse the color, return null
    logError(`tailwindToHsl`, `Error: ${error.message}`)
    return null
  }
}
