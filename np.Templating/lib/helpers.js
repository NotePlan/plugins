/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

/**
 * Execute `fetch` calls with timeout
 * @author @codedungeon
 * @param {string} resource
 * @param {any} options
 * @returns {any}
 */
export async function fetchWithTimeout(resource: string, options: any = {}): Promise<any> {
  // default timeout 10 seconds
  const { timeout = 10000 } = options

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  })
  clearTimeout(id)

  return response
}
