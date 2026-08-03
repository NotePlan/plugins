// @flow

export type TDynamicDialogButtonClickResult = void | boolean | Promise<void | boolean>

export type TDynamicDialogHandleButtonClick = (key: string, value: any) => TDynamicDialogButtonClickResult

/**
 * Invokes a DynamicDialog button handler, awaiting when it returns a Promise.
 * @param {?TDynamicDialogHandleButtonClick} handler
 * @param {string} key
 * @param {any} value
 * @returns {Promise<boolean>} true when default behavior should continue; false when handler returned false
 */
export async function resolveDynamicDialogButtonClick(handler: ?TDynamicDialogHandleButtonClick, key: string, value: any): Promise<boolean> {
  if (!handler) return true
  const result = handler(key, value)
  const resolved = await Promise.resolve(result)
  return resolved !== false
}
