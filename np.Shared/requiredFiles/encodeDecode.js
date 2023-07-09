/**
 * encode/decode scripts to embed in HTML views
 * originals in @helpers/stringTransforms.js
 */

function encodeRFC3986URIComponent(input) {
  return encodeURIComponent(input)
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function decodeRFC3986URIComponent(input) {
  return decodeURIComponent(input)
    .replace(/%5B/g, '[')
    .replace(/%5D/g, ']')
    .replace(/%21/g, '!')
    .replace(/%27/g, "'")
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%2A/g, '*')
}
