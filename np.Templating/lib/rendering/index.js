// @flow
/**
 * @fileoverview Main export file for the rendering module.
 * This file exports all public functions from the rendering module.
 */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// Import and re-export from templateProcessor.js
export {
  preProcessTags,
  preProcessNote,
  preProcessCalendar,
  processFrontmatterTags,
  render,
  renderTemplate,
  importTemplates,
  execute,
  findCursors,
  processStatementForAwait,
  frontmatterError,
  removeWhitespaceFromCodeBlocks,
} from './templateProcessor'

// Import and re-export from other rendering modules
export { removeEJSDocumentationNotes, validateTemplateTags, getErrorContextString } from './templateValidator'
export { templateErrorMessage } from './errorHandler'
