<<<<<<< HEAD
// @flow

/*
TODO:
- [ ] If the file exists already, replace heading content
- [ ] Add settings for: the instructions at the bottom, maybe customize the link or heading 
*/

import pluginJson from '../plugin.json'
import { sortListBy } from '../../helpers/sorting'
import { getTasksByType } from './taskHelpers'
import { clo, JSP, log, logError, copyObject } from '@helpers/dev'
import { inFolderList } from '@helpers/general'
import { removeDuplicateSyncedLines } from '@helpers/paragraph'
import { getSyncedCopiesAsList } from '@helpers/NPSyncedCopies'
import { replaceContentUnderHeading } from '@helpers/NPParagraph'

// eslint-disable-next-line max-len
export async function searchForTasks(searchString: string, types: Array<string>, inFolders: Array<string>, notInFolders: Array<string>): Promise<$ReadOnlyArray<TParagraph>> {
  const data = await DataStore.search(searchString)
  // FIXME: when @eduard fixes the API, can use the following line (needs testing)
  // const data = await DataStore.search(searchString, types.length ? types : ['calendar', 'notes'], inFolders.length ? inFolders : null, notInFolders.length ? notInFolders : null)
  return data
}

/**
 * Create synced tasks in a document per params passed
 * @param {string} searchFor - search string
 * @param {string} searchInTypesStr - type of notes to search in (['calendar', 'notes'])
 * @param {string} includeTaskTypesStr - types of tasks to include (['open', 'scheduled', 'done', 'cancelled'])
 * @param {string} sortByFieldsStr - fields to sort by (['date', '-priority', 'title']) (minus at front for descending order)
 * @param {string} outputFilename - filename to save the output to (with or without the file extension)
 * @param {string} inFoldersStr - folders to look in
 * @param {string} notInFoldersStr - folder to ignore
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
    const inFolders = inFoldersStr.split(',')
    const notInFolders = notInFoldersStr.split(',')
    const filename = /.txt|.md/.test(outputFilename) ? outputFilename : `${outputFilename}.${DataStore.defaultFileExtension}`

    // $FlowIgnore
    log(
      pluginJson,
      `Running: searchFor="${searchFor}" searchInTypes=[${String(searchInTypes)}] includeTaskTypes=[${String(includeTaskTypes)}] sortByFields=[${String(
        sortByFields,
      )}] outputFilename="${String(outputFilename)}" inFolders:[${String(inFolders)}] notInFolders: [${String(notInFolders)}] headings="${headings}"`,
    )
    // search for tasks
    const tasks = await searchForTasks(searchFor, searchInTypes, inFolders, notInFolders)
    log(pluginJson, `Found: ${tasks.length} results`)
    let filteredTasks = includeTaskTypes.length ? tasks.filter((task) => includeTaskTypes.includes(task.type)) : tasks
    log(pluginJson, `Found: ${filteredTasks.length} results of type [${String(includeTaskTypes)}]`)
    if (inFolders?.length) {
      filteredTasks = filteredTasks.filter((f) => inFolderList(f.filename, inFolders))
      log(pluginJson, `Found: ${filteredTasks.length} after inFolderList: [${String(inFolders)}]`)
    }
    if (notInFolders?.length) {
      filteredTasks = filteredTasks.filter((f) => !inFolderList(f.filename, notInFolders))
      log(pluginJson, `Found: ${filteredTasks.length} after notInFolders: [${String(notInFolders)}]`)
    }
    // filter out items in this file (on re-runs)
    filteredTasks = filteredTasks.filter((f) => f.filename !== filename)
    // filteredTasks.forEach((t) => {
    //   console.log(`${t.type} ${t.filename} ${t.content}`)
    // })

    // filter out duplicate tasks (esp synced lines)
    const uniqueTasks = removeDuplicateSyncedLines(filteredTasks)
    // filter for task types
    log(pluginJson, `Found: ${uniqueTasks.length} unduplicated (non-synced) results of type [${String(includeTaskTypes)}]`)

    // sort tasks
    const tasksByType = getTasksByType(uniqueTasks)
    let consolidatedTasks = []
    Object.keys(tasksByType).forEach((type) => {
      consolidatedTasks = [...consolidatedTasks, ...tasksByType[type]]
    })
    log(pluginJson, `Found: ${consolidatedTasks.length} unsorted consolidated tasks [${String(includeTaskTypes)}]`)
    const sortedTasks = sortByFields?.length ? sortListBy(consolidatedTasks, sortByFields) : consolidatedTasks
    log(pluginJson, `Found: ${sortedTasks.length} sorted results of consolidated types [${String(includeTaskTypes)}]`)
    const sortedParas = sortedTasks.map((t) => t.paragraph)
    // sortedParas.forEach((t) => {
    //   console.log(`sorted: ${t.type} ${t.filename} ${t.content}`)
    // })
    // create synced copies
    const syncedCopyList = getSyncedCopiesAsList(sortedParas, includeTaskTypes)
    // open or create file
    const { includeInstructions } = DataStore.settings
    const instructions = includeInstructions
      ? `\n> *Clicking the title link will refresh the items underneath the heading. You can edit lines and they will be synced/update; however, if you want to add lines, you must do that below the synced lines block.*`
      : ''
    const link = `[Open Tasks](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=task%20sync&arg0=${encodeURIComponent(
      searchFor,
    )}&arg1=${encodeURIComponent(searchInTypesStr)}&arg2=${encodeURIComponent(includeTaskTypesStr)}&arg3=${encodeURIComponent(sortByFieldsStr)}&arg4=${encodeURIComponent(
      outputFilename,
    )}&arg5=${encodeURIComponent(inFoldersStr)}&arg6=${encodeURIComponent(notInFoldersStr)}&arg7=${encodeURIComponent(headings)})`
    const body = `${syncedCopyList.join('\n')}`
    log(pluginJson, `Opening file: ${filename} with content:\n${body}`)

    //FIXME: this is not working due to API bug, but it will be fixed in the next release
    log(pluginJson, `Before open note: filename is: "${filename}"`)
    let note
    if (Editor.filename === filename) {
      log(pluginJson, `We are in Editor; File open already: Editor.filename is: "${Editor.filename}"`)
      note = Editor.note
    } else {
      note = await Editor.openNoteByFilename(filename, false, 0, 0, true, true)
      // note = Editor
      if (!note) log(pluginJson, `Failed to open note: ${filename}`)
      log(pluginJson, `After open note: Editor.filename is: "${Editor.filename}"`)
      clo(note, `note`)
      // log(pluginJson, `After open note: note.filename is: "${note.filename}"`)
      // const note = await DataStore.noteByFilename(filename, 'Notes')
    }
    if (note) {
      log(pluginJson, `Found existing note: length is: ${note.content.length}`)
      if (note.content?.length > 2) {
        log(pluginJson, `Found existing note, replacing content under ${link}`)
        await replaceContentUnderHeading(note, link, body, false, 2)
      } else {
        log(pluginJson, `Note did not exist, adding content`)
        note.content = `# ${searchFor}\n## ${link}\n${body}---${instructions}\n`
        log(pluginJson, `After setting note.content, the filename is: "${Editor.filename}"`)
      }
      // note ? (note.content = content) : ''
    } else {
      log(pluginJson, `Could not open note: "${filename}" Command returned ${note}`)
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
||||||| merged common ancestors
=======
// @flow

/*
TODO:
- [ ] Add settings for: the instructions at the bottom, maybe customize the link or heading 
*/

import pluginJson from '../plugin.json'
import { sortListBy } from '../../helpers/sorting'
import { getTasksByType } from './taskHelpers'
import { clo, JSP, log, logError } from '@helpers/dev'
import { inFolderList } from '@helpers/general'
import { removeDuplicateSyncedLines } from '@helpers/paragraph'
import { getSyncedCopiesAsList } from '@helpers/NPSyncedCopies'
import { replaceContentUnderHeading } from '@helpers/NPParagraph'

// eslint-disable-next-line max-len
export async function searchForTasks(searchString: string, types: Array<string>, inFolders: Array<string>, notInFolders: Array<string>): Promise<$ReadOnlyArray<TParagraph>> {
  const data = await DataStore.search(searchString)
  // FIXME: when @eduard fixes the API, can use the following line (needs testing)
  // const data = await DataStore.search(searchString, types.length ? types : ['calendar', 'notes'], inFolders.length ? inFolders : null, notInFolders.length ? notInFolders : null)
  return data
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

    // $FlowIgnore
    log(
      pluginJson,
      `Running: searchFor="${searchFor}" searchInTypes=[${String(searchInTypes)}] includeTaskTypes=[${String(includeTaskTypes)}] sortByFields=[${String(
        sortByFields,
      )}] outputFilename="${String(outputFilename)}" inFolders:[${String(inFolders)}] notInFolders: [${String(notInFolders)}] headings="${headings}"`,
    )
    // search for tasks
    CommandBar.showLoading(true, `Searching for:\n"${searchFor}"...`)
    await CommandBar.onAsyncThread()
    const tasks = await searchForTasks(searchFor, searchInTypes, inFolders, notInFolders)

    log(pluginJson, `Found: ${tasks.length} results`)
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
    const uniqueTasks = removeDuplicateSyncedLines(filteredTasks)
    // filter for task types
    log(pluginJson, `Found: ${uniqueTasks.length} unduplicated (non-synced) results of type [${String(includeTaskTypes)}]`)

    // sort tasks
    const tasksByType = getTasksByType(uniqueTasks)
    let consolidatedTasks = []
    Object.keys(tasksByType).forEach((type) => {
      consolidatedTasks = [...consolidatedTasks, ...tasksByType[type]]
    })
    log(pluginJson, `Found: ${consolidatedTasks.length} unsorted consolidated tasks [${String(includeTaskTypes)}]`)
    const sortedTasks = sortByFields?.length ? sortListBy(consolidatedTasks, sortByFields) : consolidatedTasks
    log(pluginJson, `Found: ${sortedTasks.length} sorted results of consolidated types [${String(includeTaskTypes)}]`)
    // $FlowIgnore
    const sortedParas = sortedTasks.map((t) => t.paragraph)
    // sortedParas.forEach((t) => {
    //   console.log(`sorted: ${t.type} ${t.filename} ${t.content}`)
    // })
    // create synced copies
    const syncedCopyList = getSyncedCopiesAsList(sortedParas, includeTaskTypes)
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

    log(pluginJson, `Opening file: ${filename} with content:\n${body}`)

    //FIXME: this is not working due to API bug, but it will be fixed in the next release
    log(pluginJson, `Before open note: filename is: "${filename}"`)
    let note
    const generatedFilename = filename === '' ? `${defaultFolderName}/${searchFor.replace('/', '-')}` : filename

    if (Editor.filename === generatedFilename) {
      log(pluginJson, `We are in Editor; File open already: Editor.filename is: "${Editor.filename}"`)
      note = Editor.note
    } else {
      if (filename !== '') {
        note = await Editor.openNoteByFilename(filename, false, 0, 0, true, true)
      } else {
        note = await Editor.openNoteByFilename(generatedFilename, false, 0, 0, true, true)
      }
      // note = Editor
      if (!note) log(pluginJson, `Failed to open note: ${filename}`)
      log(pluginJson, `After open note: Editor.filename is: "${Editor.filename}"`)
      clo(note, `note`)
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
        log(pluginJson, `note.content set to: >>>\n# ${searchFor}\n## ${link}\n${body}---${instructions}\n<<<`)
      }
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
>>>>>>> feat-taskSync
