// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import FrontmatterModule from '../support/modules/FrontmatterModule'
import ejs from '../support/ejs'

/**
 * Processes frontmatter in template data, extracting attributes and body content.
 * @param {string} templateData - The template string that may contain frontmatter
 * @param {Object} renderData - The render context data
 * @returns {Promise<{processedTemplateData: string, frontmatterData: Object}>} Processed template and frontmatter data
 */
export async function processFrontmatter(templateData: string, renderData: Object): Promise<{ processedTemplateData: string, frontmatterData: Object }> {
  let processedTemplateData = templateData
  let frontmatterData = {}

  // Check if templateData contains frontmatter
  let frontmatterBlock = new FrontmatterModule().getFrontmatterBlock(processedTemplateData)

  if (frontmatterBlock.length > 0) {
    // Process template first to see if frontmatter block has template variables
    processedTemplateData = await ejs.render(processedTemplateData, renderData, {
      async: true,
      openDelimiter: '{',
      closeDelimiter: '}',
    })

    frontmatterBlock = new FrontmatterModule().getFrontmatterBlock(processedTemplateData)
    const parsedFrontmatter = new FrontmatterModule().parse(frontmatterBlock)

    if (parsedFrontmatter.hasOwnProperty('attributes') && parsedFrontmatter.hasOwnProperty('body')) {
      if (Object.keys(parsedFrontmatter.attributes).length > 0) {
        frontmatterData = { ...parsedFrontmatter.attributes }
      }
      if (parsedFrontmatter.body.length > 0) {
        processedTemplateData = parsedFrontmatter.body
      }
    }
  }

  return { processedTemplateData, frontmatterData }
}

/**
 * Integrates frontmatter data into the render context.
 * @param {Object} renderData - The render context data to enhance
 * @param {Object} frontmatterData - The frontmatter attributes to integrate
 * @returns {Object} Enhanced render data with frontmatter attributes
 */
export function integrateFrontmatterData(renderData: Object, frontmatterData: Object): Object {
  if (Object.keys(frontmatterData).length > 0) {
    // If frontmatter already exists (as a FrontmatterModule instance), merge the attributes into it
    // Otherwise, just add the frontmatter data
    if (renderData.frontmatter && typeof renderData.frontmatter === 'object' && typeof renderData.frontmatter.getValuesForKey === 'function') {
      // frontmatter is a FrontmatterModule instance - merge attributes as properties
      Object.assign(renderData.frontmatter, frontmatterData)
    } else {
      // No existing frontmatter module, just use the attributes
      renderData.frontmatter = { ...frontmatterData }
    }
  }
  return renderData
}
