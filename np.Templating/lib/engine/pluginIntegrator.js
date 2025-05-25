// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

/**
 * Integrates custom plugins into the render data context.
 * @param {Object} renderData - The render context data to enhance
 * @param {Array<{name: string, method: Function}>} templatePlugins - Array of registered template plugins
 * @returns {Object} Enhanced render data with plugin methods
 */
export function integratePlugins(renderData: Object, templatePlugins: Array<{ name: string, method: Function }>): Object {
  // Include any custom plugins
  templatePlugins.forEach((item) => {
    renderData[item.name] = item.method
  })

  return renderData
}
