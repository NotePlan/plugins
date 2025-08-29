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

/**
 * Converts EJS closing tags from %> to -%> only for specific opening tag patterns (e.g. <% and <%#)
 * So putting a code tag <% or <%# in a template will not result in extra newlines
 * @param {string} templateData - The template data to process
 * @returns {string} The template with converted closing tags
 */
export const convertEJSClosingTags = (templateData: string): string => {
  if (DataStore?.settings?.autoSlurpingCodeTags === false || !templateData) return templateData

  // Only convert %> to -%> when the opening tag is <% (with space) or <%# (comment with space)
  // This regex looks for <% or <%# followed by a space, then finds its matching %>
  // But don't convert if the tag already ends with -%>
  return templateData.replace(/(<%(?:#)?\s[^%]*?)(?<!-)%>/g, '$1-%>')
}
