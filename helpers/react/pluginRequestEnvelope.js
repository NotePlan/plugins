// @flow
//--------------------------------------------------------------------------
// Plugin REQUEST → RESPONSE envelope (shared by all HTML/WebView bridges)
//
// Wire payload (from sendToHTMLWindow / routerUtils) uses:
//   { correlationId, success, data, message?, error? }
// where `error` is legacy (same meaning as message when success is false).
//
// Every WebView `requestFromPlugin` implementation MUST resolve with the object
// returned from pluginEnvelopeFromResponsePayload() so callers can rely on:
//   - success: boolean
//   - data: handler payload (or null)
//   - message: string (required when success is false; optional success copy when true)
//
// Reject the promise only for timeouts, unmount, or missing correlation — not for
// handler-level success: false (so structured failures like submitForm stay inspectable).
//--------------------------------------------------------------------------

/**
 * Successful plugin request result (normalized on the React side).
 * @template T
 */
export type PluginRequestSuccess<T = mixed> = {|
  success: true,
  data: T,
  message?: string,
|}

/**
 * Failed plugin request result (handler returned success: false, or bridge caught an exception).
 * @template T
 */
export type PluginRequestFailure<T = mixed> = {|
  success: false,
  data: T | null,
  message: string,
|}

/**
 * Normalized result of a plugin REQUEST/RESPONSE round-trip.
 * @template T
 * @template F
 */
export type PluginRequestEnvelope<T = mixed, F = mixed> = PluginRequestSuccess<T> | PluginRequestFailure<F>

/**
 * Build the envelope every WebView should pass to `pending.resolve` for a RESPONSE payload.
 * Accepts legacy `error` when `message` is absent.
 *
 * @param {any} payload - event.data.payload from RESPONSE
 * @returns {PluginRequestEnvelope<mixed, mixed>}
 */
export function pluginEnvelopeFromResponsePayload(payload: any): PluginRequestEnvelope<mixed, mixed> {
  const success = payload != null && payload.success === true
  const data = payload != null && typeof payload === 'object' && 'data' in payload ? payload.data : null
  const messageFromMessage = payload?.message != null && String(payload.message) !== '' ? String(payload.message) : ''
  const messageFromError = payload?.error != null && String(payload.error) !== '' ? String(payload.error) : ''
  const message = messageFromMessage || messageFromError

  if (success) {
    return {
      success: true,
      data,
      message: message || undefined,
    }
  }

  return {
    success: false,
    data: data != null ? data : null,
    message: message || 'Request failed',
  }
}

/**
 * Return `data` when the envelope indicates success; otherwise throw `Error(message)`.
 * Do not use for calls where failure carries structured fields you must merge (e.g. `submitForm`).
 *
 * @template T
 * @param {PluginRequestEnvelope<T, mixed>} envelope
 * @returns {T}
 */
export function unwrapPluginRequestData<T>(envelope: PluginRequestEnvelope<T, mixed>): T {
  if (envelope.success) {
    return envelope.data
  }
  throw new Error(envelope.message)
}
