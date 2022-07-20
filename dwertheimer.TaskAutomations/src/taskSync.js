/*eslint no-unused-vars: [2, {"args": "all", "varsIgnorePattern": "clo|timer|log|logError|JSP"}]*/
// @flow

/*
TODO:
*/

import pluginJson from '../plugin.json'
import { sortListBy } from '../../helpers/sorting'
import { getTasksByType } from './taskHelpers'

import { clo, JSP, log, logError, timer } from '@helpers/dev'
import { inFolderList } from '@helpers/general'
import { selectFirstNonTitleLineInEditor } from '@helpers/NPNote'
import { removeDuplicateSyncedLines } from '@helpers/paragraph'
import { getSyncedCopiesAsList } from '@helpers/NPSyncedCopies'
import { replaceContentUnderHeading } from '@helpers/NPParagraph'

// eslint-disable-next-line max-len
export async function searchForTasks(searchString: string, types: Array<string>, inFolders: Array<string>, notInFolders: Array<string>): Promise<$ReadOnlyArray<TParagraph>> {
  log(pluginJson, `${String(searchString)} ${String(types)} ${String(inFolders)} ${String(notInFolders)}`)
  const data = await DataStore.search(searchString)
  log(pluginJson, `Found: ${data.length} results`)
  // FIXME: when @eduard fixes the API, can use the following line (needs testing)
  // const data = await DataStore.search(searchString, types.length ? types : ['calendar', 'notes'], inFolders.length ? inFolders : null, notInFolders.length ? notInFolders : null)
  return data
}

function filterTasks(
  tasksIn: $ReadOnlyArray<TParagraph>,
  includeTaskTypes: Array<string>,
  inFolders: Array<string>,
  notInFolders: Array<string>,
  filename: string,
): Array<TParagraph> {
  const tasks = [...tasksIn]
  log(pluginJson, `Filtering ${tasksIn.length} tasks; sliced: ${tasks.length} t0content="${tasks[0].content}"`)
  let filteredTasks = includeTaskTypes.length ? tasks.filter((task) => includeTaskTypes.includes(task.type)) : tasks
  log(pluginJson, `Found: ${filteredTasks.length} results of type [${String(includeTaskTypes)}]`)
  if (inFolders?.length) {
    filteredTasks = filteredTasks.filter((f) => f.filename?.length && inFolderList(f.filename, inFolders))
    log(pluginJson, `Found: ${filteredTasks.length} after inFolderList: [${String(inFolders)}]`)
  }
  if (notInFolders?.length) {
    filteredTasks = filteredTasks.filter((f) => f.filename && !inFolderList(f.filename, notInFolders))
    log(pluginJson, `Found: ${filteredTasks.length} after notInFolders: [${String(notInFolders)}]`)
  }
  // filter out items in this file (on re-runs)
  filteredTasks = filename !== '' ? filteredTasks.filter((f) => f.filename !== filename) : filteredTasks
  // filteredTasks.forEach((t) => {
  //   console.log(`${t.type} ${t.filename} ${t.content}`)
  // })
  // filter out duplicate tasks (esp synced lines)
  filteredTasks = [...removeDuplicateSyncedLines(filteredTasks)]
  // filter for task types
  log(pluginJson, `Found: ${filteredTasks.length} unduplicated (non-synced) results of type [${String(includeTaskTypes)}]`)
  return filteredTasks
}

/**
 * Create synced tasks in a document per params passed
 * @param {string} searchFor - search string
 * @param {string} searchInTypesStr - type of notes to search in (['calendar', 'notes'])
 * @param {string} includeTaskTypesStr - types of tasks to include (['open', 'scheduled', 'done', 'cancelled'])
 * @param {string} sortByFieldsStr - fields to sort by (['date', '-priority', 'title']) (minus at front for descending order)
 * @param {string} outputFilename - filename to save the output to (with or without the file extension) (* for auto-generated name)
 * @param {string} inFoldersStr - folders to look in (* for all)
 * @param {string} notInFoldersStr - folder to ignore (* for ignore none)
 * @param {string} headings - TBD
 */
export async function taskSync(
  searchFor: string = '',
  searchInTypesStr: string = '',
  includeTaskTypesStr: string = '',
  sortByFieldsStr: string = '',
  outputFilename: string = '',
  inFoldersStr: string = '',
  notInFoldersStr: string = '',
  headings: string = '',
): Promise<void> {
  try {
    const searchInTypes = searchInTypesStr.split(',')
    const includeTaskTypes = includeTaskTypesStr.split(',')
    const sortByFields = sortByFieldsStr.split(',')
    const inFolders = inFoldersStr === '*' ? [] : inFoldersStr.split(',')
    const notInFolders = notInFoldersStr === '*' ? [] : notInFoldersStr.split(',')
    const filename = outputFilename !== '*' ? (/.txt|.md/.test(outputFilename) ? outputFilename : `${outputFilename}.${DataStore.defaultFileExtension}`) : ''
    log(
      pluginJson,
      `Running: searchFor="${searchFor}" searchInTypes=[${String(searchInTypes)}] includeTaskTypes=[${String(includeTaskTypes)}] sortByFields=[${String(
        sortByFields,
      )}] outputFilename="${String(outputFilename)}" inFolders:[${String(inFolders)}] notInFolders: [${String(notInFolders)}] headings="${headings}"`,
    )
    CommandBar.showLoading(true, `Searching for:\n"${searchFor}"...`)
    await CommandBar.onAsyncThread()
    // search for tasks
    const tasks = await searchForTasks(searchFor, searchInTypes, inFolders, notInFolders)
    // filter the tasks down to the right types/locations (and not this file)
    const filteredTasks = filterTasks(tasks, includeTaskTypes, inFolders, notInFolders, filename)

    // sort tasks
    const tasksByType = getTasksByType(filteredTasks)
    let consolidatedTasks = []
    Object.keys(tasksByType).forEach((type) => {
      consolidatedTasks = [...consolidatedTasks, ...tasksByType[type]]
    })
    log(pluginJson, `Found: ${consolidatedTasks.length} unsorted consolidated tasks [${String(includeTaskTypes)}]`)
    const sortedTasks = sortByFields?.length ? sortListBy(consolidatedTasks, sortByFields) : consolidatedTasks
    log(pluginJson, `Found: ${sortedTasks.length} sorted results of consolidated types [${String(includeTaskTypes)}]`)
    // $FlowIgnore
    const sortedParas = sortedTasks?.length ? sortedTasks.map((t) => t.paragraph).filter : []

    // sortedParas.forEach((t) => {
    //   console.log(`sorted: ${t.type} ${t.filename} ${t.content}`)
    // })
    // create synced copies
    let syncedCopyList = []
    syncedCopyList = sortedParas && sortedParas.length ? getSyncedCopiesAsList(sortedParas, includeTaskTypes) : []
    // open or create file
    const { includeInstructions, defaultFolderName } = DataStore.settings
    const instructions = includeInstructions
      ? `\n*Clicking the "Open Tasks" will refresh the items underneath the heading. You can edit lines and they will be synced/update; however, if you want to add lines, you must do that below the synced lines block.*`
      : ''
    const link = `[Open Tasks](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=task%20sync&arg0=${encodeURIComponent(
      searchFor,
    )}&arg1=${encodeURIComponent(searchInTypesStr)}&arg2=${encodeURIComponent(includeTaskTypesStr)}&arg3=${encodeURIComponent(sortByFieldsStr)}&arg4=${encodeURIComponent(
      outputFilename,
    )}&arg5=${encodeURIComponent(inFoldersStr)}&arg6=${encodeURIComponent(notInFoldersStr)}&arg7=${encodeURIComponent(headings)})`
    const body = syncedCopyList.length ? `${syncedCopyList.join('\n')}` : `No results found.`
    const whatFolders = inFoldersStr === '*' ? '' : ` (in folders: [${inFoldersStr}])`
    const title = `Tasks matching: ${searchFor}`
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    log(pluginJson, `Opening file: ${filename} with content`)

    //FIXME: this is not working due to API bug, but it will be fixed in the next release
    log(pluginJson, `Before open note: filename is: "${filename}"`)
    let note
    const generatedFilename = filename === '' ? `${defaultFolderName}/${searchFor.replace('/', '-')}` : filename

    if (Editor.filename === generatedFilename) {
      log(pluginJson, `We are in Editor; File open already: Editor.filename is: "${Editor.filename}"`)
      note = Editor.note
    } else {
      log(pluginJson, `Opening filename: "${generatedFilename}"`)
      note = await Editor.openNoteByFilename(generatedFilename, false, 0, 0, true, true)
      // note = Editor
      if (!note) log(pluginJson, `Failed to open note: ${filename}`)
      log(pluginJson, `After open note: Editor.filename is: "${Editor.filename}"`)
      // log(pluginJson, `After open note: note.filename is: "${note.filename}"`)
      // const note = await DataStore.noteByFilename(filename, 'Notes')
    }
    if (note) {
      log(pluginJson, `Found existing note: length is: ${String(note?.content?.length)}`)
      if (note?.content?.length && note?.content?.length > 2) {
        log(pluginJson, `Found existing note with content, replacing content under ${link}`)
        await replaceContentUnderHeading(note, link, body, false, 2)
      } else {
        log(pluginJson, `Note exists but had no content ("${String(note?.content) || ''}"), adding content`)
        note.content = `# ${title}${whatFolders}\n## ${link}\n${body}\n---${instructions}\n`
        // log(pluginJson, `note.content set to: >>>\n# ${searchFor}\n## ${link}\n${body}---${instructions}\n<<<`)
        log(pluginJson, `note.content set. note.content.length is now: ${note.content.split('\n').length} lines`)
      }
      selectFirstNonTitleLineInEditor()
      // note ? (note.content = content) : ''
    } else {
      log(pluginJson, `Could not open note: "${filename}" Command returned ${String(note) || ''}`)
    }
    // if (note) {
    //   Editor.content = content
    //   // note.content = content //this should work alsofor (const n of notes) {
    // }
    // clo(note, 'note')
    // if (note) {
    //   note.content = content
    // }
    // write tasks to file
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
