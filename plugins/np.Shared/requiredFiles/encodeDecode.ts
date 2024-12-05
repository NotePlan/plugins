/**
 * encode/decode scripts to embed in HTML views.
 * Originals in @helpers/stringTransforms.js, but with
 * flow typing and 'export's removed.
 */

function encodeRFC3986URIComponent(input) {
  // special case that appears in innerHTML
  const dealWithSpecialCase = input
    .replace(/&amp;/g, '&')
    .replace(/&amp%3B/g, '&')
    .replace(/%26amp;/g, '&')
    .replace(/%26amp%3B/g, '&')
  return encodeURIComponent(dealWithSpecialCase)
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
    .replace(/!/g, '%21')
    .replace(/'/g, "%27")
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

function decodeRFC3986URIComponent(input) {
  const decodedSpecials = input
    .replace(/%5B/g, '[')
    .replace(/%5D/g, ']')
    .replace(/%21/g, '!')
    .replace(/%27/g, "'")
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%2A/g, '*')
  return decodeURIComponent(decodedSpecials)
}
