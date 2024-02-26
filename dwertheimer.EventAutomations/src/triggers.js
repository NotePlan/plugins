// @flow

import pluginJson from '../plugin.json'
import { shouldRunCheckedItemChecksOriginal, getConfig } from './timeblocking-shared'
import { isTriggerLoop } from '@helpers/NPFrontMatter'
import { log, logError, logDebug, timer, clo, clof, JSP } from '@helpers/dev'
import { getBlockUnderHeading } from '@helpers/NPParagraph'

/**
 * onEditorWillSave - look for timeblocks that were marked done and remove them
 * Plugin entrypoint for command: "/onEditorWillSave" (trigger)
 * @author @dwertheimer
 * @param {*} incoming
 */
export async function onEditorWillSave(incoming: string | null = null) {
  try {
    if (Editor?.note && isTriggerLoop(Editor.note)) return
    const completedTypes = ['done', 'scheduled', 'cancelled', 'checklistDone', 'checklistScheduled', 'checklistCancelled']
    logDebug(pluginJson, `onEditorWillSave running with incoming:${String(incoming)}`)
    const config = await getConfig()
    const { timeBlockHeading } = config
    // check for today note? -- if (!editorIsOpenToToday())
    if (shouldRunCheckedItemChecksOriginal(config)) {
      // get character block
      const updatedParasInTodayNote = []
      const timeBlocks = getBlockUnderHeading(Editor, timeBlockHeading, false)
      if (timeBlocks?.length) {
        // only try to mark items that are completed and were created by this plugin
        const checkedItems = timeBlocks.filter((f) => completedTypes.indexOf(f.type) > -1 && f.content.indexOf(config.timeBlockTag) > -1)
        if (checkedItems?.length) {
          clo(checkedItems, `onEditorWillSave found:${checkedItems?.length} checked items`)
          const todayTodos = getTodaysFilteredTodos(config)
          // clo(todayTodos, `onEditorWillSave ${todayTodos?.length} todayTodos`)
          checkedItems.forEach((item, i) => {
            const referenceID = item.content.match(/noteplan:\/\/.*(\%5E.*)\)/)?.[1].replace('%5E', '^') || null
            logDebug(pluginJson, `onEditorWillSave: item[${i}] content="${item.content}" blockID="${referenceID}"`)
            const todo = todayTodos.find((f) => (referenceID ? f.blockId === referenceID : cleanTimeBlockLine(item.content, config) === cleanTimeBlockLine(f.content, config)))
            if (todo) {
              clo(todo, `onEditorWillSave: found todo for item[${i}] blockID="${referenceID}" content=${todo.content} in file ${todo.filename || ''} | now updating`)
              const isEditor = Editor.filename === todo.filename
              const note = isEditor ? Editor : todo.note
              todo.type = 'done'
              note?.updateParagraph(todo)
              logDebug(pluginJson, `onEditorWillSave: found todo for item[${i}] blockID="${referenceID}" content=${todo.content} in file ${todo.filename || ''} | now updating`)
              if (!isEditor) {
                DataStore.updateCache(note)
              } else {
                logDebug(pluginJson, `onEditorWillSave: checked off item: "${item.content}" but manual refresh of TimeBlocks will be required`)
                updatedParasInTodayNote.push(Editor.paragraphs[todo.lineIndex])
              }
            } else {
              logDebug(pluginJson, `onEditorWillSave: no todo found for item[${i}] blockID="${referenceID}" cleanContent="${cleanTimeBlockLine(item.content, config)}"`)
            }
          })
          // re-run /atb - but is it safe within a hook?
          await createTimeBlocksForTodaysTasks(config, updatedParasInTodayNote)
        } else {
          logDebug(pluginJson, `onEditorWillSave: no checked items found; nothing to do; exiting gracefully.`)
        }
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
