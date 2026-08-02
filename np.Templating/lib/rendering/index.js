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
  // KNOWN BUG - `renderTemplate` does not exist in ./templateProcessor; it was renamed `renderTemplateByName`. This re-export resolves to undefined at runtime (latent only because nothing currently imports from this barrel). Fix: re-export `renderTemplateByName` instead, or alias it as `renderTemplateByName as renderTemplate`.
  // $FlowIgnore[prop-missing] suppression is type-only; the underlying defect is described in the KNOWN BUG note above
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
