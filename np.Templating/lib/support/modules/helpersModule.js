// @flow
/**
 * @fileoverview Central export module for helper functions used in np.Templating.
 * This module provides access to helper functions through helpers.* in templates.
 * Only includes specific functions that are actually imported in np.Templating.
 * So it does not add any unnecessary dependencies to the plugin.
 */

// Import only the specific functions that are actually imported in np.Templating
import { log, logError, logDebug, logWarn, logInfo, clo, JSP, timer, clof, getAllPropertyNames, overrideSettingsWithStringArgs } from '@helpers/dev'

import {
  showMessage,
  showMessageYesNo,
  chooseOption,
  chooseFolder,
  datePicker,
  askDateInterval,
  chooseNote,
  chooseHeading,
  chooseOptionWithModifiers,
  getInput,
} from '@helpers/userInput'

import { getFormattedTime, getISOWeekAndYear, getISOWeekString, hyphenatedDate, isValidCalendarNoteTitleStr } from '@helpers/dateTime'

import { getNPWeekData } from '@helpers/NPdateTime'

import { parseJSON5, semverVersionToNumber, getRandomUUID } from '@helpers/general'

import { getNote, removeSection } from '@helpers/note'

import { selectFirstNonTitleLineInEditor, getNoteFromIdentifier, getFlatListOfBacklinks, getOrMakeRegularNoteInFolder, getOrMakeCalendarNote, chooseNoteV2 } from '@helpers/NPnote'

import {
  hasFrontMatter,
  updateFrontMatterVars,
  getNoteTitleFromTemplate,
  getNoteTitleFromRenderedContent,
  analyzeTemplateStructure,
  getSanitizedFmParts,
  isValidYamlContent,
  getValuesForFrontmatterTag,
  getFrontmatterAttributes,
} from '@helpers/NPFrontMatter'

import { getSetting, initConfiguration, updateSettingData, pluginUpdated } from '@helpers/NPConfiguration'

import { findStartOfActivePartOfNote, findEndOfActivePartOfNote, smartPrependPara, smartAppendPara } from '@helpers/paragraph'

import { replaceContentUnderHeading, insertContentUnderHeading, getParagraphBlock, getBlockUnderHeading } from '@helpers/NPParagraph'

import { getCodeBlocksOfType } from '@helpers/codeBlocks'

import { parseObjectString, validateObjectString } from '@helpers/stringTransforms'

import { checkAndProcessFolderAndNewNoteTitle } from '@helpers/editor'

import { getOpenTasksAndChildren } from '@helpers/parentsAndChildren'

import { formatWithNotePlanWeeks } from '@helpers/notePlanWeekFormatter'

import { escapeRegExp } from '@helpers/regex'

// Create the main helpers object with only the functions actually imported
const helpers = {
  // Development and debugging helpers
  log,
  logError,
  logDebug,
  logWarn,
  logInfo,
  clo,
  JSP,
  timer,
  clof,
  getAllPropertyNames,
  overrideSettingsWithStringArgs,

  // User input helpers
  showMessage,
  showMessageYesNo,
  chooseOption,
  chooseFolder,
  datePicker,
  askDateInterval,
  chooseNote,
  chooseNoteV2,
  chooseHeading,
  chooseOptionWithModifiers,
  getInput,

  // Date and time helpers
  getFormattedTime,
  getISOWeekAndYear,
  getISOWeekString,
  hyphenatedDate,
  getNPWeekData,

  // General utility helpers
  parseJSON5,
  semverVersionToNumber,
  getRandomUUID,

  // Note-related helpers
  getNote,
  removeSection,
  selectFirstNonTitleLineInEditor,
  getNoteFromIdentifier,
  getFlatListOfBacklinks,
  getOrMakeRegularNoteInFolder,
  getOrMakeCalendarNote,
  isValidCalendarNoteTitleStr,

  // Frontmatter helpers
  hasFrontMatter,
  updateFrontMatterVars,
  getNoteTitleFromTemplate,
  getNoteTitleFromRenderedContent,
  analyzeTemplateStructure,
  getSanitizedFmParts,
  isValidYamlContent,
  getValuesForFrontmatterTag,
  getFrontmatterAttributes,

  // Configuration helpers
  getSetting,
  initConfiguration,
  updateSettingData,
  pluginUpdated,

  // Paragraph helpers
  findStartOfActivePartOfNote,
  findEndOfActivePartOfNote,
  smartPrependPara,
  smartAppendPara,

  // NPParagraph helpers
  replaceContentUnderHeading,
  insertContentUnderHeading,
  getParagraphBlock,
  getBlockUnderHeading,

  // Code and block helpers
  getCodeBlocksOfType,

  // String transformation helpers
  parseObjectString,
  validateObjectString,

  // Editor helpers
  checkAndProcessFolderAndNewNoteTitle,

  // Task relationship helpers
  getOpenTasksAndChildren,

  // Week formatting helpers
  formatWithNotePlanWeeks,

  // Regex helpers
  escapeRegExp,
}

export default helpers
