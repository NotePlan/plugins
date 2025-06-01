// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

/**
 * @fileoverview Shared template utilities to avoid circular dependencies
 * This module contains utilities that are used by multiple template processing modules.
 */

/**
 * Gets all EJS template tags from a template string.
 * @param {string} [templateData=''] - The template data to search
 * @param {string} [startTag='<%'] - The opening tag delimiter
 * @param {string} [endTag='%>'] - The closing tag delimiter
 * @returns {Promise<Array<string>>} A promise that resolves to an array of found tags
 */
export const getTags = async (templateData: string = '', startTag: string = '<%', endTag: string = '%>'): Promise<any> => {
  if (!templateData) return []
  // Use the 's' flag (dotAll) to make '.' match newline characters, allowing multi-line tags
  const TAGS_PATTERN = /<%.*?%>/gis
  const items = templateData.match(TAGS_PATTERN)
  return items || []
}
