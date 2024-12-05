// @flow

/**
 * TODO:
 * - Prompt for nulls
 */
import pluginJson from '../plugin.json'
import { sortListBy, getTasksByType } from '@np/helpers/sorting'

import { clo, JSP, log, logError, logDebug, timer } from '@np/helpers/dev'
import { inFolderList } from '@np/helpers/general'
import { selectFirstNonTitleLineInEditor } from '@np/helpers/NPnote'
import { removeDuplicateSyncedLines, isTermInURL, isTermInMarkdownPath } from '@np/helpers/paragraph'
import { getInput, showMessage } from '@np/helpers/userInput'
import { getSyncedCopiesAsList } from '@np/helpers/NPSyncedCopies'
import { replaceContentUnderHeading } from '@np/helpers/NPParagraph'
import { getFolderFromFilename } from '@np/helpers/folders'

// eslint-disable-next-line max-len
export async function searchForTasks(searchString: string, types: Array<string>, inFolders: Array<string>, notInFolders: Array<string>): Promise<ReadonlyArray<TParagraph>> {
  logDebug(pluginJson, `${String(searchString)} ${String(types)} ${String(inFolders)} ${String(notInFolders)}`)
  const data = await DataStore.search(searchString)
  logDebug(pluginJson, `Found: ${data.length} results`)
  // FIXME: when @eduard fixes the API, can use the following line (needs testing)
  // const data = await DataStore.search(searchString, types.length ? types : ['calendar', 'notes'], inFolders.length ? inFolders : null, notInFolders.length ? notInFolders : null)
  return data
}

function filterTasks(
  tasksIn: ReadonlyArray<TParagraph>,
  includeTaskTypes: Array<string>,
  inFolders: Array<string>,
  notInFolders: Array<string>,
  filename: string,
): Array<TParagraph> {
  const tasks = [...tasksIn]
  if (tasks.length) {
    logDebug(pluginJson, `Filtering ${tasksIn.length} tasks`)
  }
  // tasks.forEach((t) => logDebug(`Before Filtering for ${String(includeTaskTypes)}: ${t.type} | ${t.content}`))
  let filteredTasks = includeTaskTypes.length && includeTaskTypes !== ['*'] ? tasks.filter((task) => includeTaskTypes.includes(task.type)) : tasks
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
    logDebug(pluginJson, `${tasksByType && tasksByType[type]?.length ? tasksByType[type].length : 0} tasks before consolidating | ${consolidatedTasks.length} tasks `)
    consolidatedTasks = [...consolidatedTasks, ...(tasksByType && tasksByType[type] ? tasksByType[type] : [])]
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

/**
 * Create note content, link, instructions etc for the found tasks
 * @param {*} syncedCopyList - list of tasks
 * @param {*} callbackArgs - { searchFor, searchInTypesStr, includeTaskTypesStr, sortByFieldsStr, inFoldersStr, notInFoldersStr, outputFilename, headings }
 * @returns object - { link, body, instructions, whatFolders, title }
 */
function getNoteOutput(syncedCopyList: Array<string>, callbackArgs: any) {
  const { searchFor, searchInTypesStr, includeTaskTypesStr, sortByFieldsStr, inFoldersStr, notInFoldersStr, outputFilename, headings } = callbackArgs
  const { includeInstructions } = DataStore.settings
  const instructions = includeInstructions
    ? `\n## Non-Synced Notes:\n*Clicking the "Tasks" header will refresh the items underneath the heading. You can edit lines and they will be synced/update; however, if you want to add lines, you must do that below the synced lines block, because everything under the heading gets wiped out and replaced when the tasks are refreshed.*`
    : ''
  const link = `[Tasks (Synced Lines)](noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.TaskAutomations&command=Task%20Sync&arg0=${encodeURIComponent(
    searchFor,
  )}&arg1=${encodeURIComponent(searchInTypesStr)}&arg2=${encodeURIComponent(includeTaskTypesStr)}&arg3=${encodeURIComponent(sortByFieldsStr)}&arg4=${encodeURIComponent(
    outputFilename,
  )}&arg5=${encodeURIComponent(inFoldersStr)}&arg6=${encodeURIComponent(notInFoldersStr)}&arg7=${encodeURIComponent(headings)})`
  const body = syncedCopyList.length ? `${syncedCopyList.join('\n')}` : `No results found.`
  const whatFolders = inFoldersStr === '*' ? '' : ` (in folders: [${inFoldersStr}])`
  const title = `${searchFor}`
  return { link, body, instructions, whatFolders, title }
}

async function openSyncedTasksNoteInEditor(filename: string, searchFor: string, outputVars: any) {
  const { link, body, instructions, whatFolders, title } = outputVars

  //FIXME: this is not working due to API bug, but it will be fixed in the next release
  logDebug(pluginJson, `openSyncedTasksNoteInEditor Before open note: filename is: "${filename}"`)
  let note
  const { defaultFolderName } = DataStore.settings
  const generatedFilename = (filename === '' ? `${defaultFolderName}/${searchFor.replace('/', '-')}.${DataStore.defaultFileExtension}` : filename)
    .replace('//', '/')
    .replace(' ', '_')
    .replace(':', '-')
  const folder = getFolderFromFilename(generatedFilename)
  const genFileNameOnly = generatedFilename.replace(`${folder}/`, '')
  logDebug(pluginJson, `Opening file: ${generatedFilename} with content`)

  if (Editor.filename === generatedFilename) {
    logDebug(pluginJson, `We are in Editor; File open already: Editor.filename is: "${Editor.filename}"`)
    note = Editor
  } else {
    logDebug(pluginJson, `Opening filename: "${generatedFilename}"`)
    note = await Editor.openNoteByFilename(generatedFilename, false, 0, 0, true, false)
    clo(note, `After open note: filename is: "${note?.filename || ''}"`)
  }
  const noteContent = `# ${title}${whatFolders}\n## ${link}\n${body}\n---${instructions}\n`
  if (!note) {
    logDebug(pluginJson, `Failed to open note: ${generatedFilename} (probably didn't exist yet)`)
    // did not exist, so let's create it
    logDebug(pluginJson, `openSyncedTasksNoteInEditor will try to create note in folder:"${folder}" filename:"${genFileNameOnly}" with content`)
    const newNoteFilename = await DataStore.newNoteWithContent(noteContent, folder, genFileNameOnly)
    if (generatedFilename !== newNoteFilename) {
      await showMessage(`Could not create file named ${genFileNameOnly} in folder ${folder}. Note created was: ${newNoteFilename} instead.`)
      return
    } else {
      note = await Editor.openNoteByFilename(generatedFilename, false, 0, 0, true, false)
    }
  }
  logDebug(pluginJson, `After open note: Editor.filename is: "${Editor.filename}"`)
  //logDebug(pluginJson, `After open note: note.filename is: "${note.filename}"`)
  // const note = await DataStore.noteByFilename(filename, 'Notes')

  if (note) {
    logDebug(pluginJson, `Found existing note: length is: ${String(note?.content?.length)}`)
    if (note?.content?.length && note?.content?.length > 2) {
      logDebug(pluginJson, `Found existing note with content, replacing content under ${link}`)
      await replaceContentUnderHeading(note, link, body, false, 2)
    } else {
      logDebug(pluginJson, `Note exists but had no content ("${String(note?.content) || ''}"), adding content`)
      note.content =
        //logDebug(pluginJson, `note.content set to: >>>\n# ${searchFor}\n## ${link}\n${body}---${instructions}\n<<<`)
        logDebug(pluginJson, `note.content set. note.content.length is now: ${(note?.content && note.content.split('\n').length) || 0} lines`)
    }
    selectFirstNonTitleLineInEditor()
    // note ? (note.content = content) : ''
  } else {
    logDebug(pluginJson, `Could not open note: "${filename}" Command returned ${String(note) || ''}`)
  }
}

/**
 * Interactively ask user for missing parameters to include in search
 * @param {*} args - searchFor, searchInTypesStr, includeTaskTypesStr, sortByFieldsStr, outputFilename, inFoldersStr, notInFoldersStr, headings
 * @returns array of all the variable strings filled in or false if cancelled, stop execution
 */
async function fillInMissingArguments(args): any {
  let [searchFor, searchInTypesStr, includeTaskTypesStr, sortByFieldsStr, outputFilename, inFoldersStr, notInFoldersStr, headings] = args
  searchFor = searchFor == null ? (await getInput(`Search for:\n(cannot be blank)`, `Submit`, `Search`, '')) || '' : searchFor
  if (!searchFor) return false
  searchInTypesStr =
    searchInTypesStr == null
      ? await getInput(
          `Note Types to search in -- \ncalendar,notes\n (or both, separated by comma)\nLeave blank for all types of notes (calendar and notes)`,
          `Submit`,
          `Task Types`,
          'calendar, notes',
        )
      : searchInTypesStr
  if (!searchInTypesStr) return false
  includeTaskTypesStr =
    includeTaskTypesStr == null
      ? await getInput(
          `Task Types to search for -- multiple types can be separated by commas, e.g.\nopen,done,scheduled,cancelled\nLeave blank for all types of tasks`,
          `Submit`,
          `Task Types`,
          `open`,
        )
      : includeTaskTypesStr
  if (!includeTaskTypesStr) return false
  sortByFieldsStr =
    sortByFieldsStr == null
      ? await getInput(
          `Sort resulting tasks by field (put a minus in front for high-to-low sort; can be multi-level sort with comma separated variables), e.g.\n-priority,content\nLeave blank for default search (-priority,content)`,
          `Submit`,
          `Sort Tasks`,
          '-priority,content',
        )
      : sortByFieldsStr
  if (!sortByFieldsStr) return false
  outputFilename =
    outputFilename == null
      ? await getInput(
          `What should be the filename (including folders) of the results note?\nLeave blank for automatic naming based on search criteria in default folder (in preferences)`,
          `Submit`,
          `Results File Name`,
          ``,
        )
      : outputFilename
  if (outputFilename === false) return false
  if (outputFilename === '') outputFilename = '*'
  inFoldersStr =
    inFoldersStr == null
      ? await getInput(
          `Folders to restrict search to?\nLeave blank to search all folders (except for the ones you specify to skip in the next step)`,
          `Submit`,
          `Folders to Search`,
          '',
        )
      : inFoldersStr
  if (inFoldersStr === false) return false
  if (inFoldersStr === '') inFoldersStr = '*'
  notInFoldersStr =
    notInFoldersStr == null ? await getInput(`Folders to not search in?\nLeave blank to not restrict the search`, `Submit`, `Folders to Not Search`, '') : notInFoldersStr
  if (notInFoldersStr === false) return false
  if (notInFoldersStr === '') notInFoldersStr = '*'
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
    const newArgs = await fillInMissingArguments(args)
    if (!newArgs) {
      logDebug(pluginJson, `Cancelled by user in fillInMissingArguments() flow`)
      return
    }
    const [searchFor, searchInTypesStr, includeTaskTypesStr, sortByFieldsStr, outputFilename, inFoldersStr, notInFoldersStr, headings] = newArgs
    // logDebug(`searchInTypesStr=${searchInTypesStr} typeof searchInTypesStr=${typeof searchInTypesStr} length=${searchInTypesStr?.length} BEFORE`)
    const searchInTypes = searchInTypesStr?.length ? searchInTypesStr.split(',').map((m) => m.trim()) : ['calendar', 'notes']
    // logDebug(`searchInTypes=${searchInTypes.toString()} AFTER`)
    logDebug(`includeTaskTypesStr=${includeTaskTypesStr.toString()}`)
    const includeTaskTypes = includeTaskTypesStr?.length ? includeTaskTypesStr.split(',').map((m) => m.trim()) : ['open']
    const sortByFields = sortByFieldsStr?.length ? sortByFieldsStr.split(',').map((m) => m.trim()) : ['-priority', 'content']
    const inFolders = inFoldersStr?.length ? (inFoldersStr === '*' ? [] : inFoldersStr.split(',').map((m) => m.trim())) : []
    const notInFolders = notInFoldersStr?.length ? (notInFoldersStr === '*' ? [] : notInFoldersStr.split(',').map((m) => m.trim())) : []
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
    //
    CommandBar.showLoading(true, `Searching for:\n"${searchFor}"...`)
    await CommandBar.onAsyncThread()

    // search for tasks
    const tasks = await searchForTasks(searchFor, searchInTypes, inFolders, notInFolders)
    // filter the tasks down to the right types/locations (and not this file)
    let filteredTasks = filterTasks(tasks, includeTaskTypes, inFolders, notInFolders, filename)
    // filter out items where the search term is simply in a URL or wikilink (thx @jgclark)
    filteredTasks = filteredTasks.filter((f) => !isTermInURL(searchFor, f.content)).filter((f) => !isTermInMarkdownPath(searchFor, f.content))
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
    await openSyncedTasksNoteInEditor(filename, searchFor, outputVars) // does not work on first open (API bug)

    // work-around for API bug //FIXME: hopefully can be removed at some point
    // clo(Editor, 'taskSync Editor at end')
    //if Editor document is empty after content is added, then try to run the plugin again to force it to write
    if (Editor.content === '# ') {
      const urlMatch = /(noteplan:.*)(\))/g.exec(outputVars.link)
      if (urlMatch && urlMatch.length > 2) {
        logDebug(pluginJson, `As a hack-workaround for the API openNoteByFilename bug, opening document a second time: "${urlMatch[1]}"`)
        await NotePlan.openURL(urlMatch[1])
      }
    } else {
      logDebug(`Not executing workaround, Editor.content: "${String(Editor.content)}"`)
    }
    // FIXME: end work-around
  } catch (error: any) {
    logError(pluginJson, JSP(error))
  }
}
