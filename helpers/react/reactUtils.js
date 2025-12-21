// @flow
//--------------------------------------------------------------------------
// React Utility Functions
//--------------------------------------------------------------------------

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
    const availableLength = maxLength - ellipsisLength
    const minStartLength = Math.max(5, Math.floor(availableLength * 0.3))
    const minEndLength = Math.max(5, Math.floor(availableLength * 0.3))

    // If the text is very short relative to what we want to show, just show end
    if (availableLength < minStartLength + minEndLength) {
      const endLength = Math.max(1, availableLength - 1)
      const end = path.slice(-endLength)
      return `${ellipsis}${end}`
    }

    // Show start and end portions with ellipsis in middle
    const start = path.slice(0, minStartLength)
    const end = path.slice(-minEndLength)
    return `${start}${ellipsis}${end}`
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
    const truncatedFirst = firstPart.slice(0, startLength)
    const truncatedLast = lastPart.slice(-endLength)
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
 * Truncate a note title or any string, showing start and end when too long
 * Ensures we show meaningful portions of both start and end
 * 
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length (default: 50)
 * @returns {string} - The truncated text
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (!text || text.length <= maxLength) {
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
    const end = text.slice(-endLength)
    return `${ellipsis}${end}`
  }

  // Show start and end portions
  const start = text.slice(0, minStartLength)
  const end = text.slice(-minEndLength)
  return `${start}${ellipsis}${end}`
}

