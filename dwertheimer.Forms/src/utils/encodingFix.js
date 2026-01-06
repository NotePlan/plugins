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
    // 
    // CRITICAL ISSUE: When UTF-8 bytes are misinterpreted, the character codes don't always
    // match the byte values. For example:
    // - Byte 0xF0 (240) → character ð (U+00F0, code point 240) ✓ Direct match
    // - Byte 0x9F (159) → character Ÿ (U+0178, code point 376) ✗ NOT a direct match!
    //
    // This happens because ISO-8859-1 doesn't have a character at 0x9F, so when the byte
    // is interpreted, it might get mapped to a different character or the encoding chain
    // is more complex than a simple byte-to-char mapping.
    //
    // Strategy: Try multiple approaches:
    // 1. Direct byte extraction (charCode < 256 → byte value)
    // 2. Pattern-based fixes for known corruption sequences
    // 3. Aggressive TextDecoder attempt on the entire string
    
    // First, try direct byte extraction for characters < 256
    try {
      const bytes = new Uint8Array(str.length)
      let allBytesValid = true
      for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i)
        // For characters < 256, assume char code = byte value
        // For characters >= 256, extract low byte (less reliable)
        if (charCode < 256) {
          bytes[i] = charCode
        } else {
          bytes[i] = charCode & 0xFF
          // If we have characters >= 256, the byte extraction might not be accurate
          if (charCode > 0xFF) {
            allBytesValid = false
          }
        }
      }
      
      // Only try TextDecoder if we have reasonable confidence in byte extraction
      if (typeof TextDecoder !== 'undefined' && allBytesValid) {
        const decoder = new TextDecoder('utf-8', { fatal: false })
        const decoded = decoder.decode(bytes)
        // If decoding produces valid UTF-8, use it
        // Check if it looks more correct (fewer corruption patterns)
        const originalCorruptionCount = (str.match(/[â€Ãðôï¿]/g) || []).length
        const decodedCorruptionCount = (decoded.match(/[â€Ãðôï¿]/g) || []).length
        
        // Also check for valid Unicode characters that indicate successful decoding
        const hasValidUnicode = /[\u{1F300}-\u{1F9FF}]/u.test(decoded) || 
                               decoded.includes('—') || 
                               decoded.includes('"')
        
        if (decodedCorruptionCount < originalCorruptionCount || 
            (originalCorruptionCount > 0 && decodedCorruptionCount === 0) ||
            hasValidUnicode) {
          fixed = decoded
          // Log for debugging
          if (typeof console !== 'undefined' && console.log) {
            console.log(`[encodingFix] Method 1 (TextDecoder) improved: before=${originalCorruptionCount}, after=${decodedCorruptionCount}`)
          }
        }
      }
    } catch (e) {
      // TextDecoder failed or not available, fall back to pattern replacement
      if (typeof console !== 'undefined' && console.log) {
        console.log(`[encodingFix] Method 1 (TextDecoder) failed: ${e.message}`)
      }
    }
    
    // Method 2: Pattern-based replacements for common cases
    // This handles specific known corruption patterns at different encoding levels
    
    // Level 1 patterns (UTF-8 -> ISO-8859-1 -> UTF-8):
    // These are the most common corruption patterns where UTF-8 bytes were interpreted
    // as ISO-8859-1 and then re-encoded as UTF-8, creating multi-character sequences
    fixed = fixed
      .replace(/â€"/g, '—') // em dash (U+2014) - most common corruption
      .replace(/â€"/g, '–') // en dash (U+2013)
      .replace(/â€œ/g, '"') // left double quote (U+201C)
      .replace(/â€\u009d/g, '"') // right double quote (U+201D)
      .replace(/â€[^\u009d"]/g, '"') // alternative right double quote
      .replace(/â€™/g, "'") // right single quote (U+2019)
      .replace(/â€˜/g, "'") // left single quote (U+2018)
      .replace(/Ã¯Â¿Â¼/g, '') // BOM (U+FEFF) Level 1
      // Fix common emoji corruption patterns that appear as multiple characters
      // Ã°Å¸Å¸Â¢ is the corrupted form of 🟢 (U+1F7E2)
      // The UTF-8 bytes are: F0 9F 9F A2
      // When misinterpreted as ISO-8859-1 and re-encoded as UTF-8:
      // F0 → Ã° (C3 B0 in UTF-8, but interpreted as two chars: Ã + °)
      // Actually, the corruption is: F0→Ã° (C3 B0), 9F→Å¸ (C5 9F), 9F→Å¸, A2→Â¢ (C2 A2)
      // So "Ã°Å¸Å¸Â¢" represents the bytes [C3, B0, C5, 9F, C5, 9F, C2, A2]
      // Which when decoded as UTF-8 gives us the original bytes [F0, 9F, 9F, A2]
      // Which is the UTF-8 encoding of 🟢
      .replace(/Ã°Å¸Å¸Â¢/g, '🟢') // Specific emoji fix for green circle
      // Try to fix other common emoji patterns (4-byte UTF-8 sequences starting with F0)
      // Pattern: Ã°Å¸ followed by two more corrupted bytes
      .replace(/Ã°Å¸([\x80-\xFF]{2})Â([\x80-\xBF])/g, (match) => {
        // This is a corrupted 4-byte emoji
        // We can't reliably reconstruct which emoji it was, so remove it
        // (Better than showing garbage characters)
        return '' // Remove corrupted emoji
      })
    
    // Level 2 patterns (what we're actually seeing in the file):
    // These are UTF-8 bytes that were interpreted as ISO-8859-1 characters directly
    // Fix BOM/zero-width characters
    fixed = fixed.replace(/ï¿¼/g, '') // BOM (U+FEFF) Level 2
    
    // Fix Level 2 emoji corruption: ðŸŸ¢ should be 🟢
    // The bytes [F0, 9F, 9F, A2] when interpreted as ISO-8859-1 become:
    // F0 (240) → ð (U+00F0)
    // 9F (159) → but 159 is not a valid ISO-8859-1 character!
    // Actually, when bytes are read incorrectly, 9F might map to Ÿ (U+0178 = 376)
    // This suggests the corruption is more complex - the bytes might have been
    // transformed through multiple encoding steps
    // 
    // For now, try to fix known patterns:
    // ðŸŸ¢ → 🟢 (green circle)
    // We'll use a more aggressive approach: try to decode the entire string as if
    // each character code < 256 is a byte value, then decode as UTF-8
    
    // Fix Level 2 emoji patterns - these are UTF-8 bytes interpreted as ISO-8859-1
    // Example: 🟢 (U+1F7E2) in UTF-8 is bytes [F0, 9F, 9F, A2]
    // When interpreted as ISO-8859-1, these become: ð (240), Ÿ (376), Ÿ (376), ¢ (162)
    // BUT: 9F (159) is not a valid ISO-8859-1 character, so Ÿ (376 = 0x178) suggests
    // the corruption went through multiple encoding steps or the byte mapping is non-linear
    
    // Try aggressive byte-level decoding: treat ALL characters < 256 as byte values
    // This is a best-effort approach that may fix some corruption
    try {
      const byteArray = []
      let hasNonByteChars = false
      for (let i = 0; i < fixed.length; i++) {
        const charCode = fixed.charCodeAt(i)
        if (charCode < 256) {
          // Character code < 256, treat as byte value
          byteArray.push(charCode)
        } else {
          // Character >= 256 - this shouldn't happen in corrupted text
          // Extract low byte as fallback
          byteArray.push(charCode & 0xFF)
          hasNonByteChars = true
        }
      }
      
      // Only try TextDecoder if we have mostly byte-like characters
      // (some non-byte chars are OK, but if too many, the approach won't work)
      if (typeof TextDecoder !== 'undefined' && byteArray.length > 0 && !hasNonByteChars) {
        const bytes = new Uint8Array(byteArray)
        const decoder = new TextDecoder('utf-8', { fatal: false })
        const decoded = decoder.decode(bytes)
        
        // Check if decoding improved things (fewer corruption patterns)
        const beforeCount = (fixed.match(/[ðôï¿â€Ã]/g) || []).length
        const afterCount = (decoded.match(/[ðôï¿â€Ã]/g) || []).length
        
        // Also check if we got valid Unicode characters (emojis, proper quotes, etc.)
        const hasValidUnicode = /[\u{1F300}-\u{1F9FF}]/u.test(decoded) || 
                                decoded.includes('—') || 
                                decoded.includes('"') ||
                                decoded.includes('"')
        
        if (afterCount < beforeCount || (beforeCount > 0 && afterCount === 0) || hasValidUnicode) {
          fixed = decoded
          // Log success for debugging
          if (typeof console !== 'undefined' && console.log) {
            console.log(`[encodingFix] Method 2 (aggressive byte decode) improved: before=${beforeCount}, after=${afterCount}`)
          }
        }
      }
    } catch (e) {
      // Byte-level decoding failed, continue with pattern replacements
      if (typeof console !== 'undefined' && console.log) {
        console.log(`[encodingFix] Method 2 (aggressive byte decode) failed: ${e.message}`)
      }
    }
    
    // Final pattern-based fixes for specific known corruption sequences
    // These handle cases where byte-level decoding didn't work
    // ðŸŸ¢ → 🟢 (if the corruption is at Level 2)
    // Note: This is a heuristic and may not always work correctly
    fixed = fixed.replace(/ðŸŸ¢/g, '🟢') // Try to fix green circle emoji at Level 2
    
    // Final cleanup: remove any remaining BOM/zero-width characters
    fixed = fixed.replace(/ï¿¼/g, '')
    
    return fixed
  } catch (error) {
    // If fixing fails, return original
    return str
  }
}

