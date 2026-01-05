// @flow
/**
 * Utility functions to detect and fix UTF-8 encoding issues
 * Common problem: UTF-8 strings being interpreted as ISO-8859-1 and re-encoded as UTF-8
 * This causes double-encoding issues like: — becomes â€", 🟢 becomes Ã°Å¸Å¸Â¢
 */

/**
 * Detect if a string appears to be double-encoded UTF-8
 * @param {string} str - The string to check
 * @returns {boolean} - true if the string appears to be double-encoded
 */
export function isDoubleEncoded(str: string): boolean {
  if (!str || typeof str !== 'string') return false
  
  // Common double-encoding patterns (multiple levels of corruption possible):
  // Level 1 (UTF-8 -> ISO-8859-1 -> UTF-8):
  // — (em dash) becomes â€" or —
  // Emojis: 🟢 becomes Ã°Å¸Å¸Â¢ or ðŸŸ¢
  // BOM: becomes Ã¯Â¿Â¼ or ï¿¼
  // 
  // Level 2 (already corrupted, but patterns visible):
  // ðŸ patterns (emoji corruption)
  // ô€ patterns (emoji corruption)  
  // ï¿¼ (BOM/zero-width corruption)
  const doubleEncodedPatterns = [
    /â€"/g, // em dash or en dash (Level 1)
    /â€"/g, // alternative dash encoding
    /â€œ/g, // left double quote
    /â€\u009d/g, // right double quote (with explicit escape)
    /â€[^\u009d"]/g, // right double quote (alternative)
    /â€™/g, // right single quote
    /â€˜/g, // left single quote
    /Ã°Å¸/g, // emoji start Level 1
    /Ã¯Â¿Â¼/g, // BOM Level 1
    /Ã´/g, // common in corrupted text Level 1
    /Ã°/g, // common in corrupted text Level 1
    // Level 2 patterns (what we're actually seeing in the file):
    /ðŸ/g, // emoji corruption pattern (e.g., ðŸ©º, ðŸŸ¢, ðŸ‚)
    /ô€/g, // emoji corruption pattern (e.g., ô€Žž, ô€©)
    /ô[€©»]/g, // additional emoji corruption patterns
    /ï¿¼/g, // BOM/zero-width corruption (Level 2) - this is what we see in the file
  ]
  
  // Check each pattern and log which ones match for debugging
  let matchedPatterns = []
  for (let i = 0; i < doubleEncodedPatterns.length; i++) {
    if (doubleEncodedPatterns[i].test(str)) {
      matchedPatterns.push(i)
    }
  }
  
  const hasPattern = matchedPatterns.length > 0
  
  if (hasPattern) {
    // Also check if the string has a high ratio of these patterns
    const totalChars = str.length
    const corruptedChars = (str.match(/[â€Ãðôï¿]/g) || []).length
    const corruptionRatio = corruptedChars / totalChars
    
    // Log for debugging
    if (typeof console !== 'undefined' && console.log) {
      console.log(`[encodingFix] isDoubleEncoded: matchedPatterns=${matchedPatterns.join(',')}, corruptionRatio=${corruptionRatio.toFixed(4)}, totalChars=${totalChars}, corruptedChars=${corruptedChars}`)
    }
    
    // If more than 0.5% of characters are corrupted patterns, it's likely double-encoded
    return corruptionRatio > 0.005 || hasPattern
  }
  
  return false
}

/**
 * Attempt to fix double-encoded UTF-8 strings
 * This reverses the double-encoding by treating the string as ISO-8859-1 bytes and decoding as UTF-8
 * @param {string} str - The potentially corrupted string
 * @returns {string} - The fixed string (or original if no fix was possible)
 */
export function fixDoubleEncoded(str: string): string {
  if (!str || typeof str !== 'string') return str
  if (!isDoubleEncoded(str)) return str
  
  try {
    let fixed: string = str
    
    // Method 1: Try to decode by treating each char as a byte and decoding as UTF-8
    // This reverses: UTF-8 -> interpreted as ISO-8859-1 -> re-encoded as UTF-8
    try {
      const bytes = new Uint8Array(str.length)
      for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i) & 0xFF // Get low byte
      }
      
      // Decode bytes as UTF-8
      // In JavaScript, we can use TextDecoder for this
      if (typeof TextDecoder !== 'undefined') {
        const decoder = new TextDecoder('utf-8')
        const decoded = decoder.decode(bytes)
        // If decoding produces valid UTF-8, use it
        // Check if it looks more correct (fewer corruption patterns)
        const originalCorruptionCount = (str.match(/[â€Ãðôï¿]/g) || []).length
        const decodedCorruptionCount = (decoded.match(/[â€Ãðôï¿]/g) || []).length
        if (decodedCorruptionCount < originalCorruptionCount) {
          fixed = decoded
        }
      }
    } catch (e) {
      // TextDecoder failed or not available, fall back to pattern replacement
    }
    
    // Method 2: Pattern-based replacements for common cases
    // This handles specific known corruption patterns at different encoding levels
    
    // Level 1 patterns (UTF-8 -> ISO-8859-1 -> UTF-8):
    fixed = fixed
      .replace(/â€"/g, '—') // em dash (U+2014)
      .replace(/â€"/g, '–') // en dash (U+2013)
      .replace(/â€œ/g, '"') // left double quote (U+201C)
      .replace(/â€\u009d/g, '"') // right double quote (U+201D)
      .replace(/â€[^\u009d"]/g, '"') // alternative right double quote
      .replace(/â€™/g, "'") // right single quote (U+2019)
      .replace(/â€˜/g, "'") // left single quote (U+2018)
      .replace(/Ã¯Â¿Â¼/g, '') // BOM (U+FEFF) Level 1
    
    // Level 2 patterns (what we're actually seeing in the file):
    // Fix BOM/zero-width characters
    fixed = fixed.replace(/ï¿¼/g, '') // BOM (U+FEFF) Level 2
    
    // Fix emoji patterns - these need byte-level decoding
    // The corruption happens because UTF-8 emoji bytes are being interpreted as ISO-8859-1
    // We need to convert the corrupted string back to bytes and re-decode as UTF-8
    
    // For emoji patterns like ðŸ©º, ðŸŸ¢, ðŸ‚, ô€Žž, ô€©, ô»Š:
    // These are UTF-8 bytes that were interpreted as ISO-8859-1 characters
    // We need to extract the byte values and decode them properly
    
    // Try a more aggressive fix: convert the entire string byte-by-byte
    // This should fix emoji corruption
    try {
      const byteArray = []
      for (let i = 0; i < fixed.length; i++) {
        const charCode = fixed.charCodeAt(i)
        // If it's a high byte (above 127), it might be part of UTF-8 corruption
        if (charCode > 127 && charCode < 256) {
          byteArray.push(charCode)
        } else if (charCode < 128) {
          // ASCII character, keep as-is
          byteArray.push(charCode)
        } else {
          // Multi-byte character, extract low byte
          byteArray.push(charCode & 0xFF)
        }
      }
      
      // Try to decode as UTF-8 using TextDecoder if available
      if (typeof TextDecoder !== 'undefined' && byteArray.length > 0) {
        const bytes = new Uint8Array(byteArray)
        const decoder = new TextDecoder('utf-8', { fatal: false })
        const decoded = decoder.decode(bytes)
        
        // Check if decoding improved things (fewer corruption patterns)
        const beforeCount = (fixed.match(/[ðôï¿]/g) || []).length
        const afterCount = (decoded.match(/[ðôï¿]/g) || []).length
        if (afterCount < beforeCount || (beforeCount > 0 && afterCount === 0)) {
          fixed = decoded
        }
      }
    } catch (e) {
      // Byte-level decoding failed, continue with pattern replacements
    }
    
    // Final cleanup: remove any remaining BOM/zero-width characters
    fixed = fixed.replace(/ï¿¼/g, '')
    
    return fixed
  } catch (error) {
    // If fixing fails, return original
    return str
  }
}

