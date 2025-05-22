// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import pluginJson from '../../plugin.json'
import { logDebug, logWarn } from '@helpers/dev'
import { isPromptTag } from '../support/modules/prompts/PromptRegistry'

/**
 * Defines comment patterns that, if found within a fenced code block,
 * will cause the NPTemplating system to ignore that block during processing.
 * These are typically used for code examples in documentation that should not be executed.
 * @const {Array<string>} CODE_BLOCK_COMMENT_TAGS
 */
export const CODE_BLOCK_COMMENT_TAGS: Array<string> = ['/* template: ignore */', '// template: ignore']

/**
 * List of available template modules. Used to determine if a tag is a module call.
 * If a new module is added, it must be added to this list.
 * @const {Array<string>} TEMPLATE_MODULES
 */
export const TEMPLATE_MODULES: Array<string> = ['calendar', 'date', 'frontmatter', 'note', 'system', 'time', 'user', 'utility', 'tasks']

/**
 * Checks if a given template tag is an EJS comment tag.
 * EJS comment tags start with '<%#' and their content is not rendered or executed.
 * @param {string} [tag=''] - The template tag string to check.
 * @returns {boolean} True if the tag is a comment tag, false otherwise.
 */
export const isCommentTag = (tag: string = ''): boolean => {
  // Check if the tag string includes the EJS comment opening delimiter
  return tag.includes('<%#')
}

/**
 * Checks if a given fenced code block contains a "template: ignore" comment.
 * These comments are used to explicitly prevent the NPTemplating system from
 * processing or executing the content of a code block.
 * @param {string} [codeBlock=''] - The string content of the fenced code block.
 * @returns {boolean} True if the code block contains one of the defined ignore comments, false otherwise.
 */
export const codeBlockHasComment = (codeBlock: string = ''): boolean => {
  // Defines specific comment strings that signify a code block should be ignored by the templating engine.
  const IGNORE_PATTERNS = ['template: ignore', 'template:ignore']
  // Check if any of the ignore patterns are present in the code block string.
  return IGNORE_PATTERNS.some((ignorePattern) => codeBlock.includes(ignorePattern))
}

/**
 * Determines if a fenced code block is specifically marked as a "templatejs" block.
 * "templatejs" blocks are intended to contain JavaScript code that can be executed
 * by the templating engine.
 * @param {string} [codeBlock=''] - The string content of the fenced code block.
 * @returns {boolean} True if the code block is a "templatejs" block, false otherwise.
 */
export const blockIsJavaScript = (codeBlock: string = ''): boolean => {
  // Check if the code block's language identifier is 'templatejs'.
  // This was changed from 'js' or 'javascript' to avoid conflicts and be specific to template execution.
  return codeBlock.includes('```templatejs')
}

/**
 * Extracts all fenced code blocks (content surrounded by ```) from a given template string.
 * @param {string} [templateData=''] - The template string to parse for code blocks.
 * @returns {Array<string>} An array of strings, where each string is a complete fenced code block
 *                          (including the ``` fences). Returns an empty array if no blocks are found.
 */
export const getCodeBlocks = (templateData: string = ''): Array<string> => {
  const CODE_BLOCK_TAG = '```' // Delimiter for fenced code blocks
  let codeBlocks: Array<string> = [] // Array to store extracted code blocks

  let blockStart = templateData.indexOf(CODE_BLOCK_TAG) // Find the start of the first code block

  // Loop through the template data to find all code blocks
  while (blockStart >= 0) {
    // Find the end of the current code block
    // Search for the closing ``` starting after the opening ```
    let blockEnd = templateData.indexOf(CODE_BLOCK_TAG, blockStart + CODE_BLOCK_TAG.length)

    // If a closing ``` is not found, assume the block extends to the end of the template data
    if (blockEnd === -1) {
      blockEnd = templateData.length
    }

    // Extract the complete fenced code block, including the fences
    const fencedCodeBlock = templateData.substring(blockStart, blockEnd + CODE_BLOCK_TAG.length)

    // Add the extracted block to the array if it's not empty
    if (fencedCodeBlock.length > 0) {
      codeBlocks.push(fencedCodeBlock)
    }

    // Find the start of the next code block, searching after the current block's end
    blockStart = templateData.indexOf(CODE_BLOCK_TAG, blockEnd + CODE_BLOCK_TAG.length)
  }

  return codeBlocks
}

/**
 * Extracts all fenced code blocks from template data that contain an "ignore" comment.
 * These are blocks that should not be processed or executed by the templating engine.
 * @param {string} [templateData=''] - The template string to parse.
 * @returns {Array<string>} An array of ignored fenced code block strings.
 */
export const getIgnoredCodeBlocks = (templateData: string = ''): Array<string> => {
  let ignoredCodeBlocks: Array<string> = [] // Initialize array for ignored blocks
  const allCodeBlocks = getCodeBlocks(templateData) // Get all code blocks first

  // Iterate through all found code blocks
  allCodeBlocks.forEach((codeBlock) => {
    // If a code block contains an ignore comment, add it to the list
    if (codeBlockHasComment(codeBlock)) {
      ignoredCodeBlocks.push(codeBlock)
    }
  })

  return ignoredCodeBlocks
}

/**
 * Converts ```templatejs fenced code blocks into EJS scriptlet tags (<% ... %>).
 * This conversion only happens if the block does not already contain EJS tags (<%)
 * and is not marked with an "ignore" comment. The purpose is to allow users to write
 * JavaScript within markdown-style code fences and have it treated as executable
 * EJS scriptlet code.
 * @param {string} [templateData=''] - The template string containing potential ```templatejs blocks.
 * @returns {string} The modified template data with ```templatejs blocks (if eligible)
 *                   converted to EJS scriptlet tags.
 */
export const convertTemplateJSBlocksToControlTags = (templateData: string = ''): string => {
  let result = templateData // Start with the original template data
  const codeBlocks = getCodeBlocks(templateData) // Find all ```...``` blocks

  codeBlocks.forEach((codeBlock) => {
    // Check if the block is a 'templatejs' block and is not marked for ignore
    if (!codeBlockHasComment(codeBlock) && blockIsJavaScript(codeBlock)) {
      // Define the start and end fence markers for templatejs
      const templateJsStartFence = '```templatejs'
      const endFence = '```'

      // Calculate start and end indices for the content within the fences
      const contentStartIndex = codeBlock.indexOf(templateJsStartFence) + templateJsStartFence.length
      const contentEndIndex = codeBlock.lastIndexOf(endFence)

      // Ensure both indices are valid
      if (contentStartIndex < contentEndIndex) {
        const jsBlockContent = codeBlock.substring(contentStartIndex, contentEndIndex)

        // Only proceed if the block doesn't already use EJS tags internally
        if (!jsBlockContent.includes('<%')) {
          // Extract the pure JS code, trim whitespace
          const jsContent = jsBlockContent.trim()

          // Wrap the entire extracted JS content in a single EJS scriptlet tag.
          // Using <% ... %> ensures it's a scriptlet (code to be executed, not output).
          // The trailing '-%>' chomp cleans up trailing newline after the scriptlet.
          const newEjsBlock = `<%\n${jsContent}\n-%>`
          result = result.replace(codeBlock, newEjsBlock) // Replace the original block with the EJS tag
        }
      }
    }
  })
  return result
}

/**
 * Gets all EJS template tags from a template string.
 * @param {string} [templateData=''] - The template data to search
 * @param {string} [startTag='<%'] - The opening tag delimiter
 * @param {string} [endTag='%>'] - The closing tag delimiter
 * @returns {Promise<Array<string>>} A promise that resolves to an array of found tags
 */
export const getTags = async (templateData: string = '', startTag: string = '<%', endTag: string = '%>'): Promise<any> => {
  if (!templateData) return []
  const TAGS_PATTERN = /<%.*?%>/gi
  const items = templateData.match(TAGS_PATTERN)
  return items || []
}

/**
 * Determines if a template tag contains executable JavaScript code that should receive an 'await' prefix
 * This includes function calls, variable declarations, and certain template-specific syntax
 * @param {string} tag - The template tag to analyze
 * @returns {boolean} - Whether the tag should be treated as code
 */
export const isCode = (tag: string): boolean => {
  let result = false

  // Empty or whitespace-only tags are not code
  if (!tag || tag.trim().length <= 3) {
    return false
  }

  // Check for empty tags like '<% %>' or '<%- %>' or tags with only whitespace
  if (
    tag
      .replace(/<%(-|=|~)?/, '')
      .replace(/%>/, '')
      .trim().length === 0
  ) {
    return false
  }

  // Only consider it a function call if there's a word character followed by parentheses
  // This regex handles whitespace between function name and parentheses
  if (/\w\s*\(/.test(tag) && tag.includes(')')) {
    result = true
  }

  // The original check for spacing (relevant for other basic JS, e.g. <% )
  // Only apply if the tag has more content than just whitespace
  if (
    tag.length >= 3 &&
    tag
      .replace(/<%(-|=|~)?/, '')
      .replace(/%>/, '')
      .trim().length > 0
  ) {
    if (tag[2] === ' ') {
      result = true
    }
  }

  // Prompts have their own processing, so don't process them as code
  if (isPromptTag(tag)) {
    result = false
  }

  // Variable declarations are code
  if (tag.includes('let ') || tag.includes('const ') || tag.includes('var ')) {
    result = true
  }

  // Template-specific syntax
  if (tag.includes('<%~')) {
    result = true
  }

  return result
}

/**
 * Checks if a tag is a template module tag (referring to a built-in template module).
 * @param {string} [tag=''] - The tag to check
 * @returns {boolean} True if the tag is a template module tag, false otherwise
 */
export const isTemplateModule = (tag: string = ''): boolean => {
  const tagValue = tag.replace('<%=', '').replace('<%-', '').replace('%>', '').trim()
  const pos = tagValue.indexOf('.')
  if (pos >= 0) {
    const moduleName = tagValue.substring(0, pos)
    return TEMPLATE_MODULES.indexOf(moduleName) >= 0
  }
  return false
}

/**
 * Checks if a tag is a variable declaration tag.
 * @param {string} [tag=''] - The tag to check
 * @returns {boolean} True if the tag is a variable declaration, false otherwise
 */
export const isVariableTag = (tag: string = ''): boolean => {
  // @TODO: @codedungeon the following line had a search for "." in it. This was causing prompts with a period like "e.g." to fail
  // But looking at this code, wouldn't a prompt with a {question: "foo"} also fail because of the loose search for "{"?
  return tag.indexOf('<% const') > 0 || tag.indexOf('<% let') > 0 || tag.indexOf('<% var') > 0 || tag.indexOf('{') > 0 || tag.indexOf('}') > 0
}

/**
 * Checks if a tag is a method call.
 * @param {string} [tag=''] - The tag to check
 * @param {any} [userData=null] - User data containing methods
 * @returns {boolean} True if the tag is a method call, false otherwise
 */
export const isMethod = (tag: string = '', userData: any = null): boolean => {
  const methods = userData?.hasOwnProperty('methods') ? Object.keys(userData?.methods) : []

  return tag.indexOf('(') > 0 || tag.indexOf('@') > 0 || tag.indexOf('prompt(') > 0
}
