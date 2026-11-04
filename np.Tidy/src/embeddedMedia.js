// @flow
//-----------------------------------------------------------------------------
// List embedded media problems
// Jonathan Clark
// Last updated 2026-11-03 for v1.22.0, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSettings, runHeavySyncWork } from './tidyHelpers'
import { JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { getFolderListMinusExclusions, getProjectNotesInFolder } from '@helpers/folders'
import {
  createOpenOrDeleteNoteCallbackUrl,
  createPrettyRunPluginLink,
  displayFolderAndTitle,
  getTagParamsFromString,
} from '@helpers/general'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { noteOpenInEditor } from '@helpers/NPEditor'
import { isTeamspaceNoteFromFilename } from '@helpers/teamspace'
import { showMessage, showMessageYesNo } from '@helpers/userInput'
import {
  absoluteAttachmentFolder,
  classifyEmbeddedMedia,
  fileUrlForAbsoluteFolder,
  storageRootFromAbsoluteMedia,
  stripLocalMediaLink,
  type BrokenMediaLink,
  type MediaScanNote,
  type UnusedAttachmentFolder,
} from '@helpers/NPEmbeddedMedia'

//----------------------------------------------------------------------------
// Constants

const OUTPUT_TITLE = 'Embedded media problems'
const FALLBACK_OUTPUT_FILENAME = 'Embedded Media Problems.md'
const COMMAND_NAME = 'List embedded media problems'

const MISSING_HEADING = 'Links whose media is missing'
const FOLDER_HEADING = 'Attachment folders with no working link'

const SHARED_INTRO = [
  'Please take a backup of your notes before removing links or folders, just in case.',
  'Please be aware of the limits of the API available to this command:',
  '- Folders left behind after their note was deleted can\'t be found or listed.',
  '- Orphaned media files can\'t be found or listed.',
  '- Teamspace folders can\'t be scanned.',
].join('\n')

const MISSING_INTRO = 'This is where there\'s a local `![image](...)` or `![file](...)` link whose file is not next to the note. Web images are ignored. **Remove link** deletes that link text, or you can **Show in Finder**.'

const FOLDER_INTRO = 'This is where the note\'s `{name}_attachments` folder exists, and no note in that same folder has a link that resolves to a file inside it. That covers an empty folder and a folder full of files that are no longer linked. The plugin cannot list the files inside a folder, so it cannot tell those apart or name the files. **Remove folder** moves the whole folder to the trash, including anything inside it. Calendar folders use the same button.'

//----------------------------------------------------------------------------

type ScanResult = {|
  brokenLinks: Array<BrokenMediaLink>,
  unusedFolders: Array<UnusedAttachmentFolder>,
  storageRoot: ?string,
  notesByKey: { [string]: TNote },
|}

/**
 * @param {string} noteType
 * @param {string} filename
 * @returns {string}
 */
function noteKey(noteType: string, filename: string): string {
  return `${noteType}\n${filename}`
}

/**
 * Remove one local media link and log the exact text taken out of the note.
 * @param {TNote} note
 * @param {string} rawTarget
 */
function removeLoggedMediaLink(note: TNote, rawTarget: string): void {
  const host: CoreNoteFields = Editor?.note && Editor.note.filename === note.filename && Editor.type === note.type ? Editor : note
  const paragraphs = host.paragraphs || []
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    const original = para.content || ''
    const next = stripLocalMediaLink(original, rawTarget)
    if (next === original) continue
    const links = original.match(/!\[(?:image|file)\]\((?:<)?[^)\n]+(?:>)?\)/g) || []
    for (const form of links) {
      if (stripLocalMediaLink(form, rawTarget) === '') logDebug(pluginJson, `Removing "${form}" from '${note.filename}'`)
    }
    para.content = next
    host.updateParagraph(para)
  }
}

/**
 * @param {TNote} note
 * @returns {boolean}
 */
function includeNote(note: TNote, filenamesToSkip: Array<string>): boolean {
  if (!note || !note.filename) return false
  if (filenamesToSkip.includes(note.filename)) return false
  if (isTeamspaceNoteFromFilename(note.filename)) return false
  return true
}

/**
 * Learn the on-disk storage root from the first note whose media links NotePlan can rewrite to absolute paths.
 * @param {TNote} note
 * @param {?string} found
 * @returns {?string}
 */
function storageRootFromNote(note: TNote, found: ?string): ?string {
  if (found) return found
  const content = note.content || ''
  if (!/!\[(image|file)\]/.test(content)) return found
  try {
    const absolute = note.contentWithAbsoluteAttachmentPaths
    return storageRootFromAbsoluteMedia(absolute || '') || found
  } catch (err) {
    logDebug(pluginJson, `storageRootFromNote: ${JSP(err)}`)
    return found
  }
}

/**
 * Synchronous scan. Safe for runOnAsyncThread (read-only; showLoading allowed).
 * @param {Array<string>} foldersToExclude
 * @param {Array<string>} filenamesToSkip
 * @param {boolean} showProgress
 * @returns {ScanResult}
 */
function findEmbeddedMediaProblems(foldersToExclude: Array<string> = [], filenamesToSkip: Array<string> = [], showProgress: boolean = false): ScanResult {
  const empty: ScanResult = { brokenLinks: [], unusedFolders: [], storageRoot: null, notesByKey: {} }
  try {
    const relevantFolderList = getFolderListMinusExclusions(foldersToExclude, false, false)
    const folderCount = relevantFolderList.length
    let projectNotes: Array<TNote> = []
    for (let f = 0; f < folderCount; f++) {
      if (showProgress && f % 5 === 0) {
        CommandBar.showLoading(true, `Initial scan for notes (folder ${String(f + 1)} of ${String(folderCount)})...`, (f / Math.max(folderCount, 1)) * 0.4)
      }
      const folder = relevantFolderList[f]
      if (!folder || folder === '(error)') continue
      projectNotes = projectNotes.concat(getProjectNotesInFolder(folder))
    }
    const calendarNotes: Array<TNote> = (DataStore.calendarNotes || []).slice()
    const allNotes: Array<TNote> = projectNotes.concat(calendarNotes)
    const scanNotes: Array<MediaScanNote> = []
    const notesByKey: { [string]: TNote } = {}
    let storageRoot: ?string = null
    const total = allNotes.length
    for (let i = 0; i < total; i++) {
      if (showProgress && i % 50 === 0) {
        CommandBar.showLoading(true, `Looking for embedded media problems in note ${String(i)} of ${String(total)}...`, 0.4 + (i / Math.max(total, 1)) * 0.5)
      }
      const note = allNotes[i]
      if (!includeNote(note, filenamesToSkip)) continue
      storageRoot = storageRootFromNote(note, storageRoot)
      const scanNote: MediaScanNote = {
        filename: note.filename,
        type: note.type || 'Notes',
        content: note.content || '',
      }
      scanNotes.push(scanNote)
      notesByKey[noteKey(scanNote.type, scanNote.filename)] = note
    }
    const classified = classifyEmbeddedMedia(scanNotes, (path) => DataStore.fileExists(path))
    logDebug(pluginJson, `findEmbeddedMediaProblems: ${String(classified.brokenLinks.length)} broken links, ${String(classified.unusedFolders.length)} unused folders`)
    return {
      brokenLinks: classified.brokenLinks,
      unusedFolders: classified.unusedFolders,
      storageRoot,
      notesByKey,
    }
  } catch (err) {
    logError(pluginJson, `findEmbeddedMediaProblems() ${JSP(err)}`)
    return empty
  }
}

/**
 * @param {TNote} note
 * @param {string} checkedAt
 */
function stampResultsNote(note: TNote, checkedAt: string): void {
  const fm = note.frontmatterAttributes || {}
  fm.title = OUTPUT_TITLE
  fm.icon = 'paperclip'
  fm['icon-color'] = 'yellow-600'
  fm.updated = checkedAt
  note.frontmatterAttributes = fm
}

/**
 * @param {string} noteType
 * @param {string} filename
 * @returns {?TNote}
 */
function noteByFilenameAndType(filename: string, noteType: string): ?TNote {
  if (!filename) return null
  if (noteType === 'Calendar') {
    const dateStr = filename.replace(/\.[^/.]+$/, '')
    return DataStore.calendarNoteByDateString(dateStr)
  }
  return DataStore.projectNoteByFilename(filename)
}

/**
 * @param {?string} storageRoot
 * @param {string} noteType
 * @param {string} filename
 * @param {boolean} folderExists
 * @returns {string}
 */
function finderButton(storageRoot: ?string, noteType: string, filename: string, folderExists: boolean): string {
  if (!folderExists || !storageRoot) return ''
  if (NotePlan?.environment?.platform !== 'macOS') return ''
  const absPath = absoluteAttachmentFolder(storageRoot, noteType, filename)
  return `[Show in Finder](${fileUrlForAbsoluteFolder(absPath)})`
}

/**
 * @param {ScanResult} found
 * @returns {Array<string>}
 */
function brokenLinkLines(found: ScanResult): Array<string> {
  if (found.brokenLinks.length === 0) return []
  const removeAll = createPrettyRunPluginLink('Remove all links', 'np.Tidy', 'removeAllBrokenMediaLinks', [])
  const lines = [
    `## ${MISSING_HEADING}`,
    `${MISSING_INTRO} ${removeAll}`,
    '',
  ]
  found.brokenLinks.forEach((link, index) => {
    const note = found.notesByKey[noteKey(link.noteType, link.filename)]
    const where = note ? displayFolderAndTitle(note, false) : link.filename
    const openMe = createOpenOrDeleteNoteCallbackUrl(link.filename, 'filename', '', 'splitView', false)
    const openButton = `[Open note](${openMe})`
    const showFinder = finderButton(found.storageRoot, link.noteType, link.filename, link.folderExists)
    const remove = createPrettyRunPluginLink('Remove link', 'np.Tidy', 'removeBrokenMediaLink', [link.filename, link.noteType, link.rawTarget])
    const buttons = [openButton, showFinder, remove].filter((part) => part !== '').join(' ')
    lines.push(`${String(index + 1)}. ${where}  ${buttons}`)
    lines.push(`    \`${link.decodedPath}\``)
  })
  lines.push('')
  return lines
}

/**
 * @param {ScanResult} found
 * @returns {Array<string>}
 */
function unusedFolderLines(found: ScanResult): Array<string> {
  if (found.unusedFolders.length === 0) return []
  const lines = [
    `## ${FOLDER_HEADING}`,
    FOLDER_INTRO,
    '',
  ]
  found.unusedFolders.forEach((row, index) => {
    const note = found.notesByKey[noteKey(row.noteType, row.filename)]
    const where = note ? displayFolderAndTitle(note, false) : row.filename
    const openMe = createOpenOrDeleteNoteCallbackUrl(row.filename, 'filename', '', 'splitView', false)
    const openButton = `[Open note](${openMe})`
    const showFinder = finderButton(found.storageRoot, row.noteType, row.filename, true)
    const remove = createPrettyRunPluginLink('Remove folder', 'np.Tidy', 'removeUnusedAttachmentFolder', [row.noteType, row.folderPath])
    const buttons = [openButton, showFinder, remove].filter((part) => part !== '').join(' ')
    lines.push(`${String(index + 1)}. ${where}  ${buttons}`)
    lines.push(`    \`${row.folderPath}\``)
  })
  lines.push('')
  return lines
}

/**
 * @param {string} outputFilename
 * @param {string} outputText
 * @param {string} checkedAt
 */
async function writeResultsNote(outputFilename: string, outputText: string, checkedAt: string): Promise<void> {
  let noteToUse: ?TNote
  if (!noteOpenInEditor(outputFilename)) {
    noteToUse = await Editor.openNoteByFilename(outputFilename, false, 0, 0, true, true, outputText)
  } else {
    noteToUse = DataStore.projectNoteByFilename(outputFilename)
    if (noteToUse) noteToUse.content = outputText
  }
  if (!noteToUse) {
    throw new Error(`Couldn't find note '${outputFilename}' to write to`)
  }
  stampResultsNote(noteToUse, checkedAt)
}

/**
 * Command to list embedded media problems in a NotePlan note (replacing any earlier version).
 * @param {string?} params
 */
export async function listEmbeddedMediaProblems(params: string = ''): Promise<void> {
  let runSilently: boolean = false
  try {
    logDebug(pluginJson, `listEmbeddedMediaProblems: Starting with params '${params}'`)
    const config = await getSettings()
    const outputFilename = config.embeddedMediaProblemsNoteFilename || FALLBACK_OUTPUT_FILENAME
    const silentParam = await getTagParamsFromString(params ?? '', 'runSilently', false)
    runSilently = silentParam === true
    if (!runSilently) {
      CommandBar.showLoading(true, 'Looking for embedded media problems')
    }
    const startTime = new Date()
    let holder: ?ScanResult = null
    /**
     * @returns {true}
     */
    const syncFind = (): true => {
      holder = findEmbeddedMediaProblems(config.listFoldersToExclude || [], [outputFilename], !runSilently)
      return true
    }
    await runHeavySyncWork('listEmbeddedMediaProblems', syncFind)
    if (holder == null) {
      logWarn('listEmbeddedMediaProblems', 'async scan result missing; scanning on main thread')
      syncFind()
    }
    const found: ScanResult = holder ?? { brokenLinks: [], unusedFolders: [], storageRoot: null, notesByKey: {} }
    if (!runSilently) {
      CommandBar.showLoading(false)
    }
    const problemCount = found.brokenLinks.length + found.unusedFolders.length
    if (problemCount === 0) {
      logTimer('listEmbeddedMediaProblems', startTime, 'No embedded media problems found')
      if (!runSilently) {
        await showMessage('No embedded media problems found!')
      }
      const res = DataStore.moveNote(outputFilename, '@Trash')
      if (res) {
        logInfo('listEmbeddedMediaProblems', `Moved existing embedded-media note '${outputFilename}' to @Trash.`)
      }
      return
    }
    logTimer('listEmbeddedMediaProblems', startTime, `Found ${problemCount} embedded media problems`)
    const checkedAt = nowLocaleShortDateTime()
    const refresh = createPrettyRunPluginLink('🔄 Click to refresh', 'np.Tidy', COMMAND_NAME, [])
    const summary = problemCount === 1 ? '1 problem' : `${problemCount} problems`
    const contents = ['### Contents']
    if (found.brokenLinks.length > 0) contents.push(`- [[${OUTPUT_TITLE}#${MISSING_HEADING}|${MISSING_HEADING}]]`)
    if (found.unusedFolders.length > 0) contents.push(`- [[${OUTPUT_TITLE}#${FOLDER_HEADING}|${FOLDER_HEADING}]]`)
    const outputArray = [
      `# ${OUTPUT_TITLE}`,
      `Found ${summary} with embedded media in notes at ${checkedAt}. ${refresh}`,
      '',
      SHARED_INTRO,
      '',
      ...contents,
      '',
      ...brokenLinkLines(found),
      ...unusedFolderLines(found),
    ]
    await writeResultsNote(outputFilename, outputArray.join('\n'), checkedAt)
  } catch (err) {
    if (!runSilently) {
      try {
        CommandBar.showLoading(false)
      } catch (_) {
        // ignore cleanup failures
      }
    }
    logError('listEmbeddedMediaProblems', JSP(err))
  }
}

/**
 * x-callback: delete one broken media link from a note. Does not rebuild the results list.
 * @param {string} filename
 * @param {string} noteType
 * @param {string} rawTarget
 */
export async function removeBrokenMediaLink(filename: string = '', noteType: string = 'Notes', rawTarget: string = ''): Promise<void> {
  try {
    CommandBar.showLoading(true, 'Removing media link')
    const note = noteByFilenameAndType(filename, noteType)
    if (!note) {
      CommandBar.showLoading(false)
      await showMessage(`Couldn't find note '${filename}'.`)
      return
    }
    if (!rawTarget) {
      CommandBar.showLoading(false)
      await showMessage('No media link was given.')
      return
    }
    removeLoggedMediaLink(note, rawTarget)
    CommandBar.showLoading(false)
  } catch (err) {
    CommandBar.showLoading(false)
    logError('removeBrokenMediaLink', JSP(err))
  }
}

/**
 * x-callback: delete every broken media link from the latest scan, then refresh the list.
 */
export async function removeAllBrokenMediaLinks(): Promise<void> {
  try {
    const config = await getSettings()
    const outputFilename = config.embeddedMediaProblemsNoteFilename || FALLBACK_OUTPUT_FILENAME
    CommandBar.showLoading(true, 'Counting broken media links')
    let found: ?ScanResult = null
    /**
     * @returns {true}
     */
    const syncFind = (): true => {
      found = findEmbeddedMediaProblems(config.listFoldersToExclude || [], [outputFilename], false)
      return true
    }
    await runHeavySyncWork('removeAllBrokenMediaLinks', syncFind)
    if (found == null) syncFind()
    CommandBar.showLoading(false)
    const broken = found ? found.brokenLinks : []
    if (broken.length === 0) {
      await showMessage('No broken media links to remove.')
      return
    }
    const countLabel = broken.length === 1 ? '1 broken media link' : `${String(broken.length)} broken media links`
    const answer = await showMessageYesNo(`Remove ${countLabel} from your notes? Take a backup first if you have not already.`, ['Yes', 'No'], 'Remove all links')
    if (answer !== 'Yes') return
    CommandBar.showLoading(true, 'Removing broken media links')
    const byNote: { [string]: Array<string> } = {}
    for (const link of broken) {
      const key = noteKey(link.noteType, link.filename)
      if (!byNote[key]) byNote[key] = []
      byNote[key].push(link.rawTarget)
    }
    for (const key of Object.keys(byNote)) {
      const parts = key.split('\n')
      const note = noteByFilenameAndType(parts.slice(1).join('\n'), parts[0])
      if (!note) continue
      for (const rawTarget of byNote[key]) removeLoggedMediaLink(note, rawTarget)
    }
    CommandBar.showLoading(false)
    await listEmbeddedMediaProblems('{"runSilently":true}')
  } catch (err) {
    CommandBar.showLoading(false)
    logError('removeAllBrokenMediaLinks', JSP(err))
  }
}

/**
 * x-callback: move an unused attachment folder to the trash. Does not rebuild the results list.
 * Calendar folders need the note type passed to `moveNote`. Checked live: `moveNote('20210107_attachments', '@Trash', 'Calendar')` moved that empty folder to `Notes/@Trash`.
 * @param {string} noteType
 * @param {string} folderPath path relative to the Notes or Calendar root, such as `Projects/Note_attachments` or `20210107_attachments`
 */
export async function removeUnusedAttachmentFolder(noteType: string = 'Notes', folderPath: string = ''): Promise<void> {
  try {
    if (!folderPath) {
      await showMessage('No attachment folder was given.')
      return
    }
    CommandBar.showLoading(true, 'Moving attachment folder to the trash')
    logInfo(pluginJson, `removeUnusedAttachmentFolder: '${folderPath}'`)
    const moved = noteType === 'Calendar' ? DataStore.moveNote(folderPath, '@Trash', 'Calendar') : DataStore.moveNote(folderPath, '@Trash')
    CommandBar.showLoading(false)
    if (!moved) {
      await showMessage(`Couldn't move '${folderPath}' to the trash.`)
    }
  } catch (err) {
    CommandBar.showLoading(false)
    logError('removeUnusedAttachmentFolder', JSP(err))
  }
}
