// @flow

import pluginJson from '../../plugin.json'
import type { JSONClickData } from './AIFlowTypes'
import { logDebug, logError, JSP, clo } from '@np/helpers/dev'

/**
 * For Research Commands:
 * Get data file name based on Editor.filename
 * @returns {string} filename
 */
export function getDataFileName(note: CoreNoteFields = Editor): string {
  if (!note) throw 'getDataFileName: note is undefined. Cannot load data file.'
  if (!note.filename) throw 'getDataFileName: note.filename is undefined. Cannot load data file.'
  return `Query Data/${note.filename}.data.json`
}

/**
 * Load the data JSON file for the document in the Editor
 * @returns
 */
export function loadDataFile(_filename?: string): JSONClickData {
  const filename = _filename ?? getDataFileName()
  return DataStore.loadJSON(filename)
}

/**
 * Save the data JSON file for the document in the Editor
 * @param {any} json to save
 * @returns write result (true if successful)
 */
export function saveDataFile(json: JSONClickData, _filename?: string): boolean {
  const filename = _filename ?? getDataFileName()
  return DataStore.saveJSON(json, filename)
}

/**
 * Generative Research Tree by loading or creating the JSON file
 * @param {string} jsonData - the JSON data to save to the file.
 * @returns {*}
 */
export function initializeData(query?: string): JSONClickData {
  const filename = getDataFileName()
  logDebug(pluginJson, `initializeData: Will look for filename="${filename}"`)
  let loadedJSON = loadDataFile()
  if (!loadedJSON) {
    logDebug(pluginJson, `initializeData JSON did not exist (as we expected) for "${filename || ''}". Creating file from template.`)
    if (query) {
      const newJSON = {
        initialSubject: query,
        unclickedLinks: [],
        clickedLinks: [],
        remixes: [],
        totalTokensUsed: 0,
      }
      clo(newJSON, `initializeData saving JSON to: ${filename}`)
      saveDataFile(newJSON)
      loadedJSON = newJSON
    }
  } else {
    clo(loadedJSON, `${filename} JSON existed. Will use it:`)
    // logDebug(pluginJson, `\n----\n-----initializeData-----\nLoaded!\n\n----\n`)
  }
  return loadedJSON
}

/**
 * Load the stored JSON file and update it with the clicked link
 * @param {string} clickedLink - the link that was clicked
 * @returns {void}
 */
export function updateClickedLinksJsonData(clickedLink: string): void {
  if (Editor.title) {
    // const filename = getDataFileName()
    const loadedJSON = loadDataFile()
    if (!loadedJSON['clickedLinks'].includes(clickedLink)) {
      const updatedJSON = saveClickedLink(loadedJSON, clickedLink.trim())
      clo(updatedJSON, `updateClickedLinksJsonData saving JSON`)
      saveDataFile(updatedJSON)
    }
  }
}

/**
 * Update the data.json object, moving a clicked link from unclickedLinks to clickedLinks
 * @param {JSONData} json data object
 * @param {string} linkToMove
 * @returns {JSONData} the updated JSON data object
 */
export function saveClickedLink(json: JSONClickData, linkToMove: string): JSONClickData {
  const { unclickedLinks, clickedLinks } = json
  const newUnclickedLinks = unclickedLinks.filter((link) => link !== linkToMove)
  const newClickedLinks = [...clickedLinks, linkToMove]
  return { ...json, unclickedLinks: newUnclickedLinks, clickedLinks: newClickedLinks }
}

// export function saveTokenCountJsonData(tokenCount: number) {
//   if (Editor.title) {
//     const filename = `Query Data/${Editor.title}/data.json`
//     const loadedJSON = DataStore.loadJSON(filename)

//     clo(loadedJSON, `saved json before update`)
//     const updatedJSON = updateTokenCount(loadedJSON, tokenCount)
//     clo(updatedJSON, `new json that will be saved`)
//     // loadedJSON['totalTokensUsed'] = Number(loadedJSON['totalTokensUsed'] += tokenCount)
//     // logDebug(pluginJson, `\n\n updatedJson=${updatedJSON}\n\n`)
//     logDebug(pluginJson, `>>saving json to filename=${filename}`)
//     clo(updatedJSON, `updatedJSON`)
//     if (!updatedJSON.totalTokensUsed) throw 'saveTokenCountJsonData No total tokens used found in JSON data'
//     const val = DataStore.saveJSON(updatedJSON, filename)
//     // DELETE TEST CODE BELOW THIS LINE
//     logDebug(pluginJson, `>>save json to filename=${filename} returned:${val}; loading again to check it.`)
//     // DataStore.saveJSON(loadedJSON, filename)
//     const loadedJSON2 = DataStore.loadJSON(filename)
//     clo(loadedJSON2, `JSON loaded from disk after the save`)

//     // logDebug(pluginJson, `\n\n Saved Json=${updatedJSON}\n\n`)
//   }
// }

// /**
//  * Update the data.json object, moving a clicked link from unclickedLinks to clickedLinks
//  * @param {JSONData} json data object
//  * @param {number} tokensUsed
//  * @returns {JSONData} the updated JSON data object
//  */
// export function updateTokenCount(json: JSONData, tokensUsed: number): JSONData {
//   const { totalTokensUsed } = json
//   logDebug(pluginJson, `\n\n incomingTokensUsed=${tokensUsed}: ${typeof tokensUsed}\n\n`)
//   logDebug(pluginJson, `\n\n totalTokensUsed=${totalTokensUsed}: ${typeof totalTokensUsed}\n\n`)

//   const newTotalTokensUsed = totalTokensUsed + tokensUsed
//   logDebug(pluginJson, `\n\n newTotalTokensUsed=${newTotalTokensUsed}: ${typeof newTotalTokensUsed}\n\n`)
//   return { ...json, totalTokensUsed: newTotalTokensUsed }
// }
