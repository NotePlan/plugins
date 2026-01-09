// @flow
//--------------------------------------------------------------------------
// React Utility Functions
//--------------------------------------------------------------------------

/**
 * Split a string into an array of Unicode characters (code points)
 * This properly handles emojis and other multi-byte characters
 * @param {string} text - The text to split
 * @returns {Array<string>} - Array of Unicode characters
 */
function splitUnicode(text: string): Array<string> {
  // Use Array.from() to properly split into Unicode code points
  // This handles emojis and other multi-byte characters correctly
  return Array.from(text)
}

/**
 * Get the visual length of a string (number of Unicode characters, not code units)
 * @param {string} text - The text to measure
 * @returns {number} - Number of Unicode characters
 */
function unicodeLength(text: string): number {
  return splitUnicode(text).length
}

/**
 * Get a substring of Unicode characters (not code units)
 * @param {string} text - The text to substring
 * @param {number} start - Start index (in Unicode characters)
 * @param {number} end - End index (in Unicode characters, optional)
 * @returns {string} - Substring of Unicode characters
 */
function unicodeSlice(text: string, start: number, end?: number): string {
  const chars = splitUnicode(text)
  if (end === undefined) {
    return chars.slice(start).join('')
  }
  return chars.slice(start, end).join('')
}

/**
 * Truncate a note title or any string, showing start and end when too long
 * Ensures we show meaningful portions of both start and end
 * Unicode-aware: properly handles emojis and multi-byte characters
 *
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length (default: 50)
 * @returns {string} - The truncated text
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (!text) {
    return text
  }

  // Use Unicode-aware length check
  const textLength = unicodeLength(text)
  if (textLength <= maxLength) {
    return text
  }

  const ellipsis = '…'
  const ellipsisLength = 1 // Single character
  const availableLength = maxLength - ellipsisLength

  // Ensure we show at least 30% of start and 30% of end
  // This gives us better visibility of both ends
  const minStartLength = Math.max(5, Math.floor(availableLength * 0.3))
  const minEndLength = Math.max(5, Math.floor(availableLength * 0.3))

  // If the text is very short relative to what we want to show, just show end
  if (availableLength < minStartLength + minEndLength) {
    // Show as much end as possible
    const endLength = Math.max(1, availableLength - 1)
    const end = unicodeSlice(text, textLength - endLength)
    return `${ellipsis}${end}`
  }

  // Show start and end portions using Unicode-aware slicing
  const start = unicodeSlice(text, 0, minStartLength)
  const end = unicodeSlice(text, textLength - minEndLength)
  return `${start}${ellipsis}${end}`
}

/**
 * Truncate a path (folder path or file path) to show the beginning and end
 * when it's too long, with ellipsis in the middle.
 * Example: "very/long/path/to/some/folder" -> "very/.../folder" (if maxLength allows)
 *
 * @param {string} path - The path to truncate
 * @param {number} maxLength - Maximum length of the truncated path (default: 50)
 * @returns {string} - The truncated path
 */
export function truncatePath(path: string, maxLength: number = 50): string {
  if (!path || path.length <= maxLength) {
    return path
  }

  // Handle root folder specially
  if (path === '/') {
    return path
  }

  const ellipsis = '…'
  const ellipsisLength = 1 // Single character

  // Split the path into parts
  const parts = path.split('/').filter((part) => part.length > 0)

  // If we only have one part (single folder name), use truncateText logic to show start and end
  if (parts.length <= 1) {
    // Use truncateText for single-part paths to ensure Unicode-aware truncation
    return truncateText(path, maxLength)
  }

  // Try to show first part + … + last part
  const firstPart = parts[0]
  const lastPart = parts[parts.length - 1]

  // Minimum needed: "firstPart/…/lastPart" (3 chars for "/…/")
  const minNeeded = firstPart.length + 3 + lastPart.length

  // If even the minimal version is too long, truncate the parts themselves
  if (minNeeded > maxLength) {
    // Reserve space for ellipsis and slashes: "/…/" = 3 chars
    const availableForParts = maxLength - 3
    // Try to show at least 30% start and 30% end, rest for middle
    const startLength = Math.max(1, Math.floor(availableForParts * 0.3))
    const endLength = Math.max(1, Math.floor(availableForParts * 0.3))
    // Use Unicode-aware slicing for path parts
    const firstPartLength = unicodeLength(firstPart)
    const lastPartLength = unicodeLength(lastPart)
    const truncatedFirst = unicodeSlice(firstPart, 0, Math.min(startLength, firstPartLength))
    const truncatedLast = unicodeSlice(lastPart, Math.max(0, lastPartLength - endLength))
    return `${truncatedFirst}/${ellipsis}/${truncatedLast}`
  }

  // We have room for at least "firstPart/…/lastPart"
  // Calculate how much room we have for middle parts
  const fixedPartsLength = firstPart.length + 3 + lastPart.length // 3 = "/…/"
  const availableForMiddle = maxLength - fixedPartsLength

  // Build result with as many middle parts as fit
  let middleParts = ''
  if (availableForMiddle > 0 && parts.length > 2) {
    // Try to fit middle parts
    for (let i = 1; i < parts.length - 1; i++) {
      const part = parts[i]
      const partWithSlash = `/${part}`
      if (middleParts.length + partWithSlash.length <= availableForMiddle) {
        middleParts += partWithSlash
      } else {
        break
      }
    }
  }

  // Build final result: "firstPart/middleParts/…/lastPart"
  // Handle case where middleParts might be empty
  if (middleParts) {
    return `${firstPart}${middleParts}/${ellipsis}/${lastPart}`
  } else {
    return `${firstPart}/${ellipsis}/${lastPart}`
  }
}

/**
 * Calculate position for a portaled element (dropdown, popup, tooltip, etc.) relative to a reference element
 * Ensures the element fits within the viewport and handles positioning preferences
 *
 * @param {Object} options - Position calculation options
 * @param {HTMLElement} options.referenceElement - The element to position relative to (must have getBoundingClientRect())
 * @param {number} options.elementWidth - Width of the element to position (px)
 * @param {number} options.elementHeight - Height of the element to position (px)
 * @param {string} options.preferredPlacement - Preferred placement: 'below' | 'above' | 'left' | 'right' (default: 'below')
 * @param {string} options.preferredAlignment - Preferred alignment: 'start' | 'center' | 'end' (default: 'start')
 * @param {number} options.offset - Offset distance from reference element (px, default: 5)
 * @param {number} options.viewportPadding - Minimum padding from viewport edges (px, default: 10)
 * @returns {?{top: number, left: number, placement: string, alignment: string}} - Position and placement info, or null if referenceElement is missing
 *
 * @example
 * // Position dropdown below input, aligned to left edge
 * const position = calculatePortalPosition({
 *   referenceElement: inputRef.current,
 *   elementWidth: 200,
 *   elementHeight: 150,
 *   preferredPlacement: 'below',
 *   preferredAlignment: 'start',
 * })
 */
export function calculatePortalPosition(options: {
  referenceElement: ?HTMLElement,
  elementWidth: number,
  elementHeight: number,
  preferredPlacement?: 'below' | 'above' | 'left' | 'right',
  preferredAlignment?: 'start' | 'center' | 'end',
  offset?: number,
  viewportPadding?: number,
}): ?{
  top: number,
  left: number,
  placement: string,
  alignment: string,
  width?: number,
} {
  const { referenceElement, elementWidth, elementHeight, preferredPlacement = 'below', preferredAlignment = 'start', offset = 5, viewportPadding = 10 } = options

  if (!referenceElement) {
    return null
  }

  const rect = referenceElement.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // Calculate available space in each direction
  const spaceBelow = viewportHeight - rect.bottom - viewportPadding
  const spaceAbove = rect.top - viewportPadding
  const spaceRight = viewportWidth - rect.right - viewportPadding
  const spaceLeft = rect.left - viewportPadding

  // Determine actual placement based on preference and available space
  let placement = preferredPlacement
  if (preferredPlacement === 'below' && spaceBelow < elementHeight && spaceAbove > spaceBelow) {
    placement = 'above'
  } else if (preferredPlacement === 'above' && spaceAbove < elementHeight && spaceBelow > spaceAbove) {
    placement = 'below'
  } else if (preferredPlacement === 'right' && spaceRight < elementWidth && spaceLeft > spaceRight) {
    placement = 'left'
  } else if (preferredPlacement === 'left' && spaceLeft < elementWidth && spaceRight > spaceLeft) {
    placement = 'right'
  }

  // Calculate top position based on placement
  let top = 0
  if (placement === 'below') {
    top = rect.bottom + offset
  } else if (placement === 'above') {
    top = rect.top - elementHeight - offset
  } else {
    // For left/right placement, center vertically
    top = rect.top + rect.height / 2 - elementHeight / 2
  }

  // Calculate left position based on alignment
  let left = 0
  if (preferredAlignment === 'start') {
    left = rect.left
  } else if (preferredAlignment === 'center') {
    left = rect.left + rect.width / 2 - elementWidth / 2
  } else if (preferredAlignment === 'end') {
    left = rect.right - elementWidth
  }

  // Adjust for left/right placement
  if (placement === 'right') {
    left = rect.right + offset
  } else if (placement === 'left') {
    left = rect.left - elementWidth - offset
  }

  // Constrain to viewport bounds
  // Horizontal constraints
  if (left < viewportPadding) {
    left = viewportPadding
  }
  if (left + elementWidth > viewportWidth - viewportPadding) {
    left = viewportWidth - elementWidth - viewportPadding
  }

  // Vertical constraints
  if (top < viewportPadding) {
    top = viewportPadding
  }
  if (top + elementHeight > viewportHeight - viewportPadding) {
    top = viewportHeight - elementHeight - viewportPadding
  }

  // If placement is above/below but element is too tall, adjust alignment to fit
  let alignment = preferredAlignment
  if ((placement === 'below' || placement === 'above') && left !== rect.left) {
    if (left === viewportPadding) {
      alignment = 'start'
    } else if (left + elementWidth >= viewportWidth - viewportPadding) {
      alignment = 'end'
    }
  }

  return {
    top,
    left,
    placement,
    alignment,
  }
}

/**
 * Get exact screen coordinates for any element
 * Returns a comprehensive object with all position information
 *
 * @param {HTMLElement} element - The element to get coordinates for
 * @returns {?{rect: DOMRect, top: number, bottom: number, left: number, right: number, width: number, height: number, centerX: number, centerY: number, distanceFromRight: number, distanceFromBottom: number}} - Position information, or null if element is missing
 *
 * @example
 * const coords = getElementCoordinates(buttonRef.current)
 * if (coords) {
 *   console.log(`Button center: (${coords.centerX}, ${coords.centerY})`)
 *   console.log(`Distance from right: ${coords.distanceFromRight}px`)
 * }
 */
export function getElementCoordinates(element: ?HTMLElement): ?{
  rect: ClientRect | DOMRect,
  top: number,
  bottom: number,
  left: number,
  right: number,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  distanceFromRight: number,
  distanceFromBottom: number,
} {
  if (!element) {
    console.log('[getElementCoordinates] Element is null/undefined')
    return null
  }

  const rect = element.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const distanceFromRight = viewportWidth - rect.right
  const distanceFromBottom = viewportHeight - rect.bottom

  const coords = {
    rect: (rect: any), // Flow type workaround: getBoundingClientRect returns DOMRect but Flow sees ClientRect
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    width: rect.width,
    height: rect.height,
    centerX,
    centerY,
    distanceFromRight,
    distanceFromBottom,
  }

  // Debug logging
  console.log(`[getElementCoordinates] Element: ${element.className || element.tagName || 'unknown'}`)
  console.log(`[getElementCoordinates] Viewport: width=${viewportWidth}px, height=${viewportHeight}px`)
  console.log(
    `[getElementCoordinates] Rect: left=${rect.left}px, top=${rect.top}px, right=${rect.right}px, bottom=${rect.bottom}px, width=${rect.width}px, height=${rect.height}px`,
  )
  console.log(
    `[getElementCoordinates] Calculated: centerX=${centerX}px, centerY=${centerY}px, distanceFromRight=${distanceFromRight}px, distanceFromBottom=${distanceFromBottom}px`,
  )

  return coords
}
