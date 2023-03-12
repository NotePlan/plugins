// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated 9.3.2023 for v0.3.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { showDashboardHTML } from './dashboardHTML'
import { getNPWeekStr, getTodaysDateUnhyphenated, RE_DATE_TIME } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logWarn, JSP } from '@helpers/dev'
import { sendToHTMLWindow } from '@helpers/HTMLView'
import { getParagraphFromStaticObject, highlightParagraphInEditor } from '@helpers/NPParagraph'

//-----------------------------------------------------------------
// Data types

type MessageDataObject = { itemID: string, type: string, filename: string, rawContent: string }

//-----------------------------------------------------------------

/**
 * Callback function to receive async messages from HTML view
 * Plugin entrypoint for command: "/onMessageFromHTMLView" (called by plugin via sendMessageToHTMLView command)
 * Do not do the processing in this function, but call a separate function to do the work.
 * @author @dwertheimer
 * @param {string} type - the type of action the HTML view wants the plugin to perform
 * @param {any} data - the data that the HTML view sent to the plugin
 */
export function onMessageFromHTMLView(type: string, data: MessageDataObject): any {
  try {
    logDebug(pluginJson, `onMessageFromHTMLView running with args:${JSP(data)}`)
    switch (type) {
      case 'onClickDashboardItem':
        onClickDashboardItem(data) // data is an array and could be multiple items. but in this case, we know we only need the first item which is an object
        break
    }
    return {} // any function called by invoke... should return something (anything) to keep NP from reporting an error in the console
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Somebody clicked on a something in the HTML view
 * @param {MessageDataObject} data - details of the item clicked
 * onClickDashboardItem: invalid data: 
 */
export async function onClickDashboardItem(data: MessageDataObject) {
  const { itemID, type, filename, rawContent } = data
  // logDebug(pluginJson, `Plugin: onClickDashboardItem running with itemID: ${itemID}, type: ${type}, filename: ${filename}, rawContent: '${rawContent}`)
  if (type === 'open') {
    const res = completeItem(filename, rawContent)
    if (res) {
      logDebug(pluginJson, `-> succesful call to completeItem(), so will now attempt to remove the row in the displayed table too`)
      sendToHTMLWindow('completeTask', data)
    } else {
      logWarn(pluginJson, `-> unsuccesful call to completeItem(). Will trigger a refresh of the dashboard.`)
      await showDashboardHTML()
    }
  } else if (type === 'checklist') {
    const res = completeItem(filename, rawContent)
    if (res) {
      logDebug(pluginJson, `-> succesful call to completeItem(), so will now attempt to remove the row in the displayed table too`)
      sendToHTMLWindow('completeChecklist', data)
    } else {
      logWarn(pluginJson, `-> unsuccesful call to completeItem(). Will trigger a refresh of the dashboard.`)
      await showDashboardHTML()
    }
  } else if (type === 'review') {
    // Handle a review call simply by opening the note in the main Editor. Later it might get more interesting!
    const note = await Editor.openNoteByFilename(filename)
    if (note) {
      logDebug(pluginJson, `-> succesful call to open filename ${filename} in Editor`)
    } else {
      logWarn(pluginJson, `-> unsuccesful call to open filename ${filename} in Editor`)
    }
  } else if (type === 'showNoteInEditor') {
    // Handle a show note call simply by opening the note in the main Editor.
    const note = await Editor.openNoteByFilename(filename)
    if (note) {
      logDebug(pluginJson, `-> succesful call to open filename ${filename} in Editor`)
    } else {
      logWarn(pluginJson, `-> unsuccesful call to open filename ${filename} in Editor`)
    }
  } else if (type === 'showLineInEditor') {
    // Handle a show line call simply by opening the note in the main Editor, and then finding and highlighting the line.
    const note = await Editor.openNoteByFilename(filename)
    if (note) {
      const res = highlightParagraphInEditor(data)
      logDebug(pluginJson, `-> succesful call to open filename ${filename} in Editor, followed by ${res ? 'succesful' : 'unsuccesful'} call to highlight the paragraph in the editor`)
    } else {
      logWarn(pluginJson, `-> unsuccesful call to open filename ${filename} in Editor`)
    }
  } else {
    logWarn(pluginJson, `onClickDashboardItem: can't yet handle type ${type}`)
  }

  // Other info from DW:
  // const para = getParagraphFromStaticObject(data, ['filename', 'lineIndex'])
  // if (para) {
  //   // you can do whatever you want here. For example, you could change the status of the paragraph
  //   // to done depending on whether it was an open task or a checklist item
  //   para.type = statusWas === 'open' ? 'done' : 'checklistDone'
  //   para.note?.updateParagraph(para)
  //   const newDivContent = `<td>"${para.type}"</td><td>Paragraph status was updated by the plugin!</td>`
  //   sendToHTMLWindow('updateDiv', { divID: lineID, html: newDivContent, innerText: false })
  //   // NOTE: in this particular case, it might have been easier to just call the refresh-page command, but I thought it worthwhile
  //   // to show how to update a single div in the HTML view
  // } else {
  //   logError(pluginJson, `onClickStatus: could not find paragraph for filename:${filename}, lineIndex:${lineIndex}`)
  // }
}

/**
 * Complete a task/checklist item.
 * Designed to be called when you're not in an Editor (e.g. an HTML Window)
 * @param {string} noteTitle
 * @param {string} paraContent
 */
export function completeItem(filenameIn: string, rawContent: string): boolean {
  try {
    logDebug('completeItem', `starting with filename: ${filenameIn}, rawContent: ${rawContent}`)
    let filename = filenameIn
    if (filenameIn === 'today') {
      filename = getTodaysDateUnhyphenated()
    } else if (filenameIn === 'thisweek') {
      filename = getNPWeekStr(new Date())
    }
    // Long-winded way to get note title, as we don't have TNote, but do have note's filename
    // $FlowIgnore[incompatible-type]
    const thisNote: TNote = DataStore.projectNoteByFilename(filename) ?? DataStore.calendarNoteByDateString(filename)

    if (thisNote) {
      if (thisNote.paragraphs.length > 0) {
        let foundParaIndex = NaN
        let c = 0
        for (const para of thisNote.paragraphs) {
          if (para.rawContent === rawContent) {
            logDebug('completeItem', `found matching para ${c} of type ${para.type}: ${rawContent}`)
            if (para.type === 'open') {
              para.type = 'done'
              thisNote.updateParagraph(para)
              logDebug('completeItem', `updated para ${c}`)
              return true
            }
            else if (para.type === 'checklist') {
              para.type = 'checklistDone'
              thisNote.updateParagraph(para)
              logDebug('completeItem', `updated para ${c}`)
              return true
            }
            else {
              logInfo('completeItem', `unexpected para type ${para.type}, so won't continue`)
              return false
            }
          }
          c++
        }
        logWarn('completeItem', `Couldn't find paragraph '${rawContent}' to complete`)
        return false
      } else {
        logInfo('completeItem', `Note '${filename}' appears to be empty?`)
        return false
      }
    } else {
      logWarn('completeItem', `Can't find note '${filename}'`)
      return false
    }
  }
  catch (error) {
    logError('completeItem', `${error.message} for note '${filenameIn}'`)
    return false
  }
}

// TODO: remove these in time --------------------------------------------------

export function testCompleteItem(): void {
  let testNoteTitle = 'today'
  let testRawContent = '+ not present'
  let res = completeItem(testNoteTitle, testRawContent)
  logDebug('testCompleteItem', `- ${String(res)} for ${testNoteTitle} / ${testRawContent}`)

  testNoteTitle = 'today'
  testRawContent = '* ! Use Holiday templates'
  res = completeItem(testNoteTitle, testRawContent)
  logDebug('testCompleteItem', `- ${String(res)} for ${testNoteTitle} / ${testRawContent}`)

  testNoteTitle = 'thisweek'
  testRawContent = '- not present item'
  res = completeItem(testNoteTitle, testRawContent)
  logDebug('testCompleteItem', `- ${String(res)} for ${testNoteTitle} / ${testRawContent}`)

  testNoteTitle = 'not-a-note'
  testRawContent = '* item not present'
  res = completeItem(testNoteTitle, testRawContent)
  logDebug('testCompleteItem', `- ${String(res)} for ${testNoteTitle} / ${testRawContent}`)
}
