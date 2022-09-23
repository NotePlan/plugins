// @flow

/**
 * TODO:
 * - Prompt for nulls
 */
import pluginJson from '../plugin.json'
import { sortListBy, getTasksByType } from '@helpers/sorting'

import { clo, JSP, log, logError, logDebug, timer } from '@helpers/dev'
import { inFolderList } from '@helpers/general'
import { selectFirstNonTitleLineInEditor } from '@helpers/NPnote'
import { removeDuplicateSyncedLines } from '@helpers/paragraph'
import { getInput } from '@helpers/userInput'
import { getSyncedCopiesAsList } from '@helpers/NPSyncedCopies'
import { replaceContentUnderHeading } from '@helpers/NPParagraph'
// import type { ExtendedParagraph } from '../../dwertheimer.EventAutomations/src/timeblocking-helpers'

// eslint-disable-next-line max-len
export async function searchForTasks(searchString: string, types: Array<string>, inFolders: Array<string>, notInFolders: Array<string>): Promise<$ReadOnlyArray<TParagraph>> {
  logDebug(pluginJson, `${String(searchString)} ${String(types)} ${String(inFolders)} ${String(notInFolders)}`)
  const data = await DataStore.search(searchString)
  logDebug(pluginJson, `Found: ${data.length} results`)
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
  logDebug(pluginJson, `Filtering ${tasksIn.length} tasks; sliced: ${tasks.length} t0content="${tasks[0].content}"`)
  // tasks.forEach(t => logDebug(`Before Filtering for ${includeTaskTypes}: ${t.type} | ${t.content}`))
  let filteredTasks = includeTaskTypes.length ? tasks.filter((task) => includeTaskTypes.includes(task.type)) : tasks
  logDebug(pluginJson, `Found: ${filteredTasks.length} results of type [${String(includeTaskTypes)}]`)
  filteredTasks.forEach((t) => logDebug(`After Filtering for ${includeTaskTypes.toString()}: ${t.type} | ${t.content}`))
  if (inFolders?.length) {
    filteredTasks = filteredTasks.filter((f) => f.filename?.length && inFolderList(f.filename, inFolders))
    logDebug(pluginJson, `Found: ${filteredTasks.length} after inFolderList: [${String(inFolders)}]`)
  }
  filteredTasks.forEach((t) => logDebug(`After inFolders: ${t.type} | ${t.content}`))
  if (notInFolders?.length) {
    filteredTasks = filteredTasks.filter((f) => f.filename && !inFolderList(f.filename, notInFolders))
    logDebug(pluginJson, `Found: ${filteredTasks.length} after notInFolders: [${String(notInFolders)}]`)
  }
  filteredTasks.forEach((t) => logDebug(`After notInFolders: ${t.type} | ${t.filename || ''} ${t.content}`))

  // filter out items in this file (on re-runs)
  filteredTasks = filename !== '' ? filteredTasks.filter((f) => f.filename !== filename) : filteredTasks
  logDebug(pluginJson, `After notThisFile (filename) filter -- filteredTasks.length=${filteredTasks.length}`)
  filteredTasks.forEach((t) => logDebug(`After Filter for this filename: ${t.type} | ${t.filename || ''} ${t.content}`))
  // filter out duplicate tasks (esp synced lines)
  filteredTasks = [...removeDuplicateSyncedLines(filteredTasks)]
  filteredTasks.forEach((t) => logDebug(`After removeDuplicateSyncedLines: ${t.type} | ${t.filename || ''} ${t.content}`))
  // filter for task types
  logDebug(pluginJson, `Found: ${filteredTasks.length} unduplicated (non-synced) results of type [${String(includeTaskTypes)}]`)
  return filteredTasks
}

function sortTasks(filteredTasks: Array<TParagraph>, includeTaskTypes: Array<string>, sortByFields: Array<string>): Array<TParagraph> {
  const tasksByType = getTasksByType(filteredTasks) //FIXME: need to check getTasksbyType -- numbers are wrong
  let consolidatedTasks = []
  // Object.keys(tasksByType).forEach((type) => {
  //   consolidatedTasks = [...consolidatedTasks, ...tasksByType[type]]
  // })
  includeTaskTypes.forEach((type) => {
    logDebug(pluginJson, `${tasksByType[type].length} tasks before consolidating | ${consolidatedTasks.length} tasks `)
    consolidatedTasks = [...consolidatedTasks, ...tasksByType[type]]
  })
  logDebug(pluginJson, `Found: ${consolidatedTasks.length} unsorted consolidated tasks [${String(includeTaskTypes)}]`)
  const sortedTasks = sortByFields?.length ? sortListBy(consolidatedTasks, sortByFields) : consolidatedTasks
  logDebug(pluginJson, `Found: ${sortedTasks.length} sorted results of consolidated types [${String(includeTaskTypes)}]`)
  const sortedParas = sortedTasks?.length ? sortedTasks.map((t) => t.paragraph ?? null).filter(Boolean) : []
  // sortedParas.forEach((t) => {
  //   logDebug(`sorted: ${t.type} ${t.filename} ${t.content}`)
  // })
  return sortedParas || []
}

function getSyncedCopies(sortedTasks: Array<TParagraph>, includeTaskTypes: Array<string>): Array<string> {
  let syncedCopyList = []
  syncedCopyList = sortedTasks && sortedTasks.length ? getSyncedCopiesAsList(sortedTasks, includeTaskTypes) : []
  return syncedCopyList
}

function getNoteOutput(syncedCopyList: Array<string>, callbackArgs: any) {
  const { searchFor, searchInTypesStr, includeTaskTypesStr, sortByFieldsStr, inFoldersStr, notInFoldersStr, outputFilename, headings } = callbackArgs
  const { includeInstructions } = DataStore.settings
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
  return { link, body, instructions, whatFolders, title }
}

async function openSyncedTasksNoteInEditor(filename: string, searchFor: string, outputVars: any) {
  const { link, body, instructions, whatFolders, title } = outputVars
  logDebug(pluginJson, `Opening file: ${filename} with content`)

  //FIXME: this is not working due to API bug, but it will be fixed in the next release
  logDebug(pluginJson, `Before open note: filename is: "${filename}"`)
  let note
  const { defaultFolderName } = DataStore.settings
  const generatedFilename = filename === '' ? `${defaultFolderName}/${searchFor.replace('/', '-')}` : filename

  if (Editor.filename === generatedFilename) {
    logDebug(pluginJson, `We are in Editor; File open already: Editor.filename is: "${Editor.filename}"`)
    note = Editor
  } else {
    logDebug(pluginJson, `Opening filename: "${generatedFilename}"`)
    note = await Editor.openNoteByFilename(generatedFilename, false, 0, 0, true, true)
    // note = Editor
    if (!note) logDebug(pluginJson, `Failed to open note: ${filename}`)
    logDebug(pluginJson, `After open note: Editor.filename is: "${Editor.filename}"`)
    //logDebug(pluginJson, `After open note: note.filename is: "${note.filename}"`)
    // const note = await DataStore.noteByFilename(filename, 'Notes')
  }
  if (note) {
    logDebug(pluginJson, `Found existing note: length is: ${String(note?.content?.length)}`)
    if (note?.content?.length && note?.content?.length > 2) {
      logDebug(pluginJson, `Found existing note with content, replacing content under ${link}`)
      await replaceContentUnderHeading(note, link, body, false, 2)
    } else {
      logDebug(pluginJson, `Note exists but had no content ("${String(note?.content) || ''}"), adding content`)
      note.content = `# ${title}${whatFolders}\n## ${link}\n${body}\n---${instructions}\n`
      //logDebug(pluginJson, `note.content set to: >>>\n# ${searchFor}\n## ${link}\n${body}---${instructions}\n<<<`)
      logDebug(pluginJson, `note.content set. note.content.length is now: ${note.content.split('\n').length} lines`)
    }
    selectFirstNonTitleLineInEditor()
    // note ? (note.content = content) : ''
  } else {
    logDebug(pluginJson, `Could not open note: "${filename}" Command returned ${String(note) || ''}`)
  }
}

async function fillInMissingArguments(args) {
  let [searchFor, searchInTypesStr, includeTaskTypesStr, sortByFieldsStr, outputFilename, inFoldersStr, notInFoldersStr, headings] = args
  searchFor = searchFor == null ? (await getInput(`Search for:`, `Submit`, `Search`)) || '' : searchFor
  searchInTypesStr =
    searchInTypesStr == null
      ? ((await getInput(
          `Note Types to search in -- calendar,notes or both (separated by comma)\nLeave blank for all types of notes (calendar and notes)`,
          `Submit`,
          `Task Types`,
        )) || '',
        'calendar,notes')
      : searchInTypesStr
  includeTaskTypesStr =
    includeTaskTypesStr == null
      ? ((await getInput(
          `Task Types to search for -- multiple types can be separated by commas, e.g.\nopen,done,scheduled\nLeave blank for all types of tasks`,
          `Submit`,
          `Task Types`,
        )) || '*',
        '*')
      : includeTaskTypesStr
  sortByFieldsStr =
    sortByFieldsStr == null
      ? ((await getInput(
          `Sort resulting tasks by field (put a minus in front for high-to-low sort; can be multi-level sort with comma separated variables), e.g.\n-priority,content\nLeave blank for default search (-priority,content)`,
          `Submit`,
          `Sort Tasks`,
        )) || '-priority,content',
        '-priority,content')
      : sortByFieldsStr
  outputFilename =
    outputFilename == null
      ? (await getInput(
          `What should be the filename (including folders) of the results note?\nLeave blank for automatic naming based on search criteria in default folder (in preferences)`,
          `Submit`,
          `Results File Name`,
        )) || '*'
      : outputFilename
  inFoldersStr =
    inFoldersStr == null
      ? ((await getInput(
          `Folders to restrict search to?\nLeave blank to search all folders (except for the ones you specify to skip in the next step)`,
          `Submit`,
          `Folders to Search`,
        )) || '*',
        '*')
      : inFoldersStr
  notInFoldersStr =
    notInFoldersStr == null
      ? ((await getInput(`Folders to not search in?\nLeave blank to not restrict the search`, `Submit`, `Folders to Not Search`)) || '*', '*')
      : notInFoldersStr
  headings = String(headings) //TBD
  return [searchFor, searchInTypesStr, includeTaskTypesStr, sortByFieldsStr, outputFilename, inFoldersStr, notInFoldersStr, headings]
}

/**
 * Create synced tasks in a document per params passed
 * @param {string|null} searchFor - search string
 * @param {string|null} searchInTypesStr - type of notes to search in (['calendar', 'notes'])
 * @param {string|null} includeTaskTypesStr - types of tasks to include (['open', 'scheduled', 'done', 'cancelled'])
 * @param {string|null} sortByFieldsStr - fields to sort by (['date', '-priority', 'title']) (minus at front for descending order)
 * @param {string|null} outputFilename - filename to save the output to (with or without the file extension) (* for auto-generated name)
 * @param {string|null} inFoldersStr - folders to look in (* for all)
 * @param {string|null} notInFoldersStr - folder to ignore (* for ignore none)
 * @param {string|null} headings - TBD
 */
export async function taskSync(...args: Array<string>): Promise<void> {
  try {
    // Setting this up this way so that args passing via xcallback ordering can be easily modified later
    const [searchFor, searchInTypesStr, includeTaskTypesStr, sortByFieldsStr, outputFilename, inFoldersStr, notInFoldersStr, headings] = await fillInMissingArguments(args)
    logDebug(`searchInTypesStr=${searchInTypesStr} typeof searchInTypesStr=${typeof searchInTypesStr} length=${searchInTypesStr?.length} BEFORE`)
    const searchInTypes = searchInTypesStr?.length ? searchInTypesStr.split(',') : ['calendar', 'notes']
    logDebug(`searchInTypes=${searchInTypes.toString()} AFTER`)
    const includeTaskTypes = includeTaskTypesStr?.length ? includeTaskTypesStr.split(',') : ['open']
    const sortByFields = sortByFieldsStr?.length ? sortByFieldsStr.split(',') : ['-priority', 'content']
    const inFolders = inFoldersStr?.length ? (inFoldersStr === '*' ? [] : inFoldersStr.split(',')) : []
    const notInFolders = notInFoldersStr?.length ? (notInFoldersStr === '*' ? [] : notInFoldersStr.split(',')) : []
    const filename = outputFilename?.length
      ? outputFilename !== '*'
        ? /.txt|.md/.test(outputFilename)
          ? outputFilename
          : `${outputFilename}.${DataStore.defaultFileExtension}`
        : ''
      : ''
    logDebug(
      pluginJson,
      `Running: searchFor="${searchFor}" searchInTypes=[${String(searchInTypes)}] includeTaskTypes=[${String(includeTaskTypes)}] sortByFields=[${String(
        sortByFields,
      )}] outputFilename="${String(outputFilename)}" inFolders:[${String(inFolders)}] notInFolders: [${String(notInFolders)}] headings="${headings}"`,
    )
    return //FIXME: debugging...stopping here for now
    CommandBar.showLoading(true, `Searching for:\n"${searchFor}"...`)
    await CommandBar.onAsyncThread()

    // search for tasks
    const tasks = await searchForTasks(searchFor, searchInTypes, inFolders, notInFolders)
    // filter the tasks down to the right types/locations (and not this file)
    const filteredTasks = filterTasks(tasks, includeTaskTypes, inFolders, notInFolders, filename)
    // sort tasks
    const sortedTasks = sortTasks(filteredTasks, includeTaskTypes, sortByFields)
    // create synced copies as list of strings
    const syncedCopyList = getSyncedCopies(sortedTasks, includeTaskTypes)
    // build note output
    const callbackArgs = { searchFor, searchInTypesStr, includeTaskTypesStr, sortByFieldsStr, inFoldersStr, notInFoldersStr, outputFilename, headings }
    const outputVars = getNoteOutput(syncedCopyList, callbackArgs)

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    // open or create note in Editor
    await openSyncedTasksNoteInEditor(filename, searchFor, outputVars)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
