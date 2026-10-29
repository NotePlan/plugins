// @flow
//-----------------------------------------------------------------------------
// Jonathan Clark
// Last updated 2026-10-24 for v1.21.1 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSettings, runHeavySyncWork } from './tidyHelpers'
import { JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import {
  getFolderListMinusExclusions,
  getProjectNotesInFolder,
} from '@helpers/folders'
import {
  createOpenOrDeleteNoteCallbackUrl,
  createPrettyRunPluginLink,
  displayFolderAndTitle,
  getTagParamsFromString,
} from '@helpers/general'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { noteOpenInEditor } from '@helpers/NPEditor'
import { showMessage } from '@helpers/userInput'

//----------------------------------------------------------------------------
// Constants

const OUTPUT_TITLE = 'Title problems'
const FALLBACK_OUTPUT_FILENAME = 'Title Problems.md'
const PREVIEW_LINE_COUNT = 12

//----------------------------------------------------------------------------
// Type definitions

export type TitleProblemKind = 'dash-title' | 'title-mismatch' | 'pipe-title'

const PIPE_TITLE_INTRO = "In NP note titles the character '`|`' isn't invalid but it is problematic, as it denotes an alternative title when used in a note link. The fix offered here is to replace '`|`' characters with '`-`'."

export type TitleProblem = {
  kind: TitleProblemKind,
  frontmatterTitle: ?string,
  h1Title: ?string,
  preview: ?string,
}

type noteTitleProblems = {
  note: TNote,
  problems: Array<TitleProblem>,
}

//----------------------------------------------------------------------------
// Pure checks (no NotePlan API)

/**
 * Split note file text into lines, accepting LF or CRLF.
 * @param {string} content
 * @returns {Array<string>}
 */
export function linesOfFile(content: string): Array<string> {
  return (content ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

/**
 * First `count` lines of a note file, including any frontmatter.
 * @param {string} content
 * @param {number} count
 * @returns {string}
 */
export function firstFileLines(content: string, count: number): string {
  return linesOfFile(content).slice(0, count).join('\n')
}

/**
 * Wrap text in a fence long enough that backticks inside the text stay literal.
 * @param {string} text
 * @returns {string}
 */
export function fencedBlock(text: string): string {
  let longestRun = 0
  for (const line of text.split('\n')) {
    const match = line.match(/^`+/)
    if (match) longestRun = Math.max(longestRun, match[0].length)
  }
  const fence = '`'.repeat(Math.max(3, longestRun + 1))
  return `${fence}\n${text}\n${fence}`
}

/**
 * Parsed frontmatter `title` value, or null when the field is missing or blank.
 * Strips one layer of matching YAML quotes.
 * @param {?Object} attributes
 * @returns {?string}
 */
export function frontmatterTitleText(attributes: ?Object): ?string {
  if (!attributes || typeof attributes !== 'object') return null
  const raw = attributes.title
  if (raw == null) return null
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  let text = String(raw).trim()
  const quoted = (text.startsWith('"') && text.endsWith('"') && text.length >= 2)
    || (text.startsWith("'") && text.endsWith("'") && text.length >= 2)
  if (quoted) text = text.slice(1, -1).trim()
  return text === '' ? null : text
}

/**
 * H1 text on the first line of the note body, when that line is an ATX H1.
 * Body line 0 is the first line after a closing frontmatter fence, or line 0 when there is no opening fence.
 * Returns null when that line is not an H1 (including when it is a deeper heading).
 * @param {string} content
 * @returns {?string}
 */
export function h1TextOnBodyLine0(content: string): ?string {
  const lines = linesOfFile(content)
  let bodyLine = lines[0] ?? ''
  if (bodyLine.trim() === '---') {
    let closeAt = -1
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        closeAt = i
        break
      }
    }
    if (closeAt < 0) return null
    bodyLine = lines[closeAt + 1] ?? ''
  }
  if (bodyLine.trim().startsWith('##')) return null
  const match = bodyLine.match(/^#\s+(\S.*?)\s*$/)
  if (!match) return null
  const text = match[1].trim()
  return text === '' ? null : text
}

/**
 * True when the H1 contains a NotePlan template tag (`<% ... %>`, including `<%-` and `<%=`).
 * Those headings are filled in when the template runs, so they are not a title mismatch.
 * @param {string} h1Title
 * @returns {boolean}
 */
export function h1HasTemplateTag(h1Title: string): boolean {
  return h1Title.includes('<%')
}

/**
 * Replace the H1 on body line 0 with `# ${newTitle}`.
 * Returns null when that line is not an ATX H1.
 * @param {string} content - raw file text, including frontmatter when the file has it
 * @param {string} newTitle - heading text, without the leading `#`
 * @returns {?string}
 */
export function replaceBodyLine0(content: string, newTitle: string): ?string {
  const lines = linesOfFile(content)
  let index = 0
  if ((lines[0] ?? '').trim() === '---') {
    let closeAt = -1
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        closeAt = i
        break
      }
    }
    if (closeAt < 0) return null
    index = closeAt + 1
  }
  if (index >= lines.length) return null
  if (!/^#\s+\S/.test(lines[index])) return null
  lines[index] = `# ${newTitle}`
  return lines.join('\n')
}

/**
 * Quote a title for a single bullet line. Internal double quotes are escaped.
 * @param {string} value
 * @returns {string}
 */
export function quoteTitleForBullet(value: string): string {
  const oneLine = value.replace(/\r?\n/g, ' ').replace(/"/g, '\\"')
  return `"${oneLine}"`
}

/**
 * Replace every `|` in a title with `-`.
 * `|` is allowed in a NotePlan title, but in a note link it starts an alternative title.
 * @param {string} title
 * @returns {string}
 */
export function replacePipesInTitle(title: string): string {
  return title.replace(/\|/g, '-')
}

/**
 * Index of the first ATX H1 at or after `start`, or -1 when there is none.
 * `##` and deeper headings are not H1s.
 * @param {Array<string>} lines
 * @param {number} start
 * @returns {number}
 */
function firstH1LineIndex(lines: Array<string>, start: number): number {
  for (let i = start; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (/^#\s+\S/.test(line) && !line.trim().startsWith('##')) return i
  }
  return -1
}

/**
 * Replace `|` in the frontmatter `title:` line and in the first H1 in the body.
 * The H1 does not have to be the first body line.
 * Returns null when neither of those contains `|`.
 * One string so the caller can write the note once. A later frontmatterAttributes
 * write rebuilds the note from a stale body and puts the old H1 back.
 * @param {string} content
 * @returns {?string}
 */
export function contentWithPipesReplaced(content: string): ?string {
  const lines = linesOfFile(content)
  let changed = false
  let bodyStart = 0
  if ((lines[0] ?? '').trim() === '---') {
    let closeAt = -1
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        closeAt = i
        break
      }
    }
    if (closeAt > 0) {
      for (let i = 1; i < closeAt; i++) {
        if (/^title:\s*/.test(lines[i]) && lines[i].includes('|')) {
          lines[i] = lines[i].replace(/\|/g, '-')
          changed = true
        }
      }
      bodyStart = closeAt + 1
    }
  }
  const h1Index = firstH1LineIndex(lines, bodyStart)
  if (h1Index >= 0) {
    const bodyLine = lines[h1Index] ?? ''
    const h1Match = bodyLine.match(/^#\s+(\S.*?)\s*$/)
    if (h1Match != null && h1Match[1].includes('|')) {
      lines[h1Index] = `# ${replacePipesInTitle(h1Match[1].trim())}`
      changed = true
    }
  }
  if (!changed) return null
  return lines.join('\n')
}

/**
 * Editor pane showing this filename, if any.
 * @param {string} filename
 * @returns {?any}
 */
function openEditorForFilename(filename: string): ?any {
  const editors = NotePlan?.editors ?? []
  for (const editor of editors) {
    if (editor?.filename === filename) return editor
  }
  return null
}

/**
 * Write pipe replacements onto a note or Editor.
 * When the text already contains the frontmatter block, only `content` is set.
 * Setting frontmatterAttributes after content rewrites the note from the old body, so the H1 change is lost until a second click.
 * @param {any} target
 * @returns {boolean} whether a title field changed
 */
function applyPipeReplacement(target: any): boolean {
  const content: string = target?.content ?? ''
  const fmTitle = frontmatterTitleText(target?.frontmatterAttributes)
  const hasFrontmatter = (linesOfFile(content)[0] ?? '').trim() === '---'
  const updated = contentWithPipesReplaced(content)
  let changed = false
  // Attributes only when the file text has no frontmatter block. Set them before content so a following body write is the last write.
  if (!hasFrontmatter && fmTitle != null && fmTitle.includes('|')) {
    const fm = target.frontmatterAttributes || {}
    fm.title = replacePipesInTitle(fmTitle)
    target.frontmatterAttributes = fm
    changed = true
  }
  if (updated != null) {
    target.content = updated
    changed = true
  }
  return changed
}

/**
 * Two bullets: each value is followed by the button that copies it onto the other field.
 * @param {string} frontmatterTitle
 * @param {string} h1Title
 * @param {string} useTitleButton - markdown link
 * @param {string} useH1Button - markdown link
 * @returns {Array<string>}
 */
export function mismatchBulletLines(frontmatterTitle: string, h1Title: string, useTitleButton: string, useH1Button: string): Array<string> {
  return [
    `\t- title: ${quoteTitleForBullet(frontmatterTitle)} ${useTitleButton}`,
    `\t- H1 ${quoteTitleForBullet(h1Title)} ${useH1Button}`,
  ]
}

/**
 * Title problems for one note.
 * A title of `---` is reported on its own (often invalid frontmatter).
 * A frontmatter `title` that differs from an H1 on body line 0 is reported separately.
 * An H1 that contains a template tag is not a mismatch.
 * A title that contains `|` is reported on its own. `|` is valid, but in a note link it starts an alternative title.
 * @param {?string} title - note.title
 * @param {string} content - raw file text, including frontmatter
 * @param {?Object} frontmatterAttributes
 * @returns {Array<TitleProblem>}
 */
export function findProblemsInNote(title: ?string, content: string, frontmatterAttributes: ?Object): Array<TitleProblem> {
  const problems: Array<TitleProblem> = []
  if ((title ?? '').trim() === '---') {
    problems.push({
      kind: 'dash-title',
      frontmatterTitle: null,
      h1Title: null,
      preview: firstFileLines(content, PREVIEW_LINE_COUNT),
    })
  }
  const fmTitle = frontmatterTitleText(frontmatterAttributes)
  const h1Title = h1TextOnBodyLine0(content)
  if (fmTitle != null && h1Title != null && fmTitle !== h1Title && !h1HasTemplateTag(h1Title)) {
    problems.push({
      kind: 'title-mismatch',
      frontmatterTitle: fmTitle,
      h1Title,
      preview: null,
    })
  }
  if ((title ?? '').includes('|')) {
    problems.push({
      kind: 'pipe-title',
      frontmatterTitle: fmTitle,
      h1Title,
      preview: null,
    })
  }
  return problems
}

//----------------------------------------------------------------------------

/**
 * Scan project notes for title problems.
 * Ignores folders in `foldersToExclude`, plus Trash, and any filenames in `filenamesToSkip`.
 * Synchronous. Safe for runOnAsyncThread (read-only; showLoading allowed).
 * @param {Array<string>} foldersToExclude
 * @param {Array<string>} filenamesToSkip
 * @param {boolean} showProgress - when true, update CommandBar.showLoading during the scan
 * @returns {Array<noteTitleProblems>}
 */
function findTitleProblems(foldersToExclude: Array<string> = [], filenamesToSkip: Array<string> = [], showProgress: boolean = false): Array<noteTitleProblems> {
  try {
    logDebug(pluginJson, `findTitleProblems() starting`)

    const relevantFolderList = getFolderListMinusExclusions(foldersToExclude, false, false)
    const folderCount = relevantFolderList.length
    logDebug('findTitleProblems', `- Found ${String(folderCount)} folders to check`)
    let notes: Array<TNote> = []
    for (let f = 0; f < folderCount; f++) {
      if (showProgress && f % 5 === 0) {
        CommandBar.showLoading(true, `Looking for title problems (folder ${String(f + 1)} of ${String(folderCount)})...`, (f / folderCount) * 0.3)
      }
      notes = notes.concat(getProjectNotesInFolder(relevantFolderList[f]))
    }

    const output: Array<noteTitleProblems> = []
    const total = notes.length
    for (let i = 0; i < total; i++) {
      if (showProgress && i % 25 === 0) {
        CommandBar.showLoading(true, `Looking for title problems in note ${String(i)} of ${String(total)}...`, 0.3 + (i / total) * 0.7)
      }
      if (i > 0 && i % 250 === 0) {
        logDebug('findTitleProblems', `- checked ${String(i)}/${String(total)} notes, found ${String(output.length)} with problems so far`)
      }
      const note = notes[i]
      if (filenamesToSkip.includes(note.filename)) continue
      const problems = findProblemsInNote(note.title, note.content ?? '', note.frontmatterAttributes)
      if (problems.length > 0) {
        output.push({ note, problems })
      }
    }
    output.sort((a, b) => (a.note.filename || '').localeCompare(b.note.filename || ''))
    logDebug('findTitleProblems', `- finished: ${String(output.length)} notes with problems from ${String(total)} notes`)
    return output
  } catch (err) {
    logError(pluginJson, 'findTitleProblems() ' + JSP(err))
    return []
  }
}

/**
 * Write frontmatter on the results note so its title matches the H1, and stamp the check time.
 * @param {TNote} note
 * @param {string} checkedAt
 */
function stampResultsNote(note: TNote, checkedAt: string): void {
  const fm = note.frontmatterAttributes || {}
  fm.title = OUTPUT_TITLE
  fm.icon = 'heading'
  fm['icon-color'] = 'orange-500'
  fm.updated = checkedAt
  note.frontmatterAttributes = fm
}

/**
 * One results section, or [] when that kind was not found.
 * @param {string} heading
 * @param {Array<noteTitleProblems>} rows
 * @param {TitleProblemKind} kind
 * @returns {Array<string>}
 */
function sectionLines(heading: string, rows: Array<noteTitleProblems>, kind: TitleProblemKind): Array<string> {
  const lines: Array<string> = []
  let i = 0
  for (const row of rows) {
    const problem = row.problems.find((p) => p.kind === kind)
    if (!problem) continue
    i++
    const n = row.note
    const openMe = createOpenOrDeleteNoteCallbackUrl(n.filename, 'filename', '', 'splitView', false)
    const where = displayFolderAndTitle(n, false)
    const openButton = `[Open note](${openMe})`
    if (kind === 'pipe-title') {
      const fixButton = createPrettyRunPluginLink('Fix', 'np.Tidy', 'fixTitlePipes', [n.filename])
      lines.push(`${String(i)}. ${where}.  ${openButton} ${fixButton}`)
    } else {
      lines.push(`${String(i)}. ${where}.  ${openButton}`)
    }
    if (kind === 'dash-title') {
      lines.push(fencedBlock(problem.preview ?? ''))
    } else if (kind === 'title-mismatch') {
      const useTitleButton = createPrettyRunPluginLink('Use title', 'np.Tidy', 'useFrontmatterTitle', [n.filename])
      const useH1Button = createPrettyRunPluginLink('Use H1', 'np.Tidy', 'useH1Title', [n.filename])
      lines.push(...mismatchBulletLines(problem.frontmatterTitle ?? '', problem.h1Title ?? '', useTitleButton, useH1Button))
    }
  }
  if (i === 0) return []
  if (kind === 'pipe-title') {
    const fixAllButton = createPrettyRunPluginLink('Fix all notes', 'np.Tidy', 'fixAllTitlePipes', [])
    return [`## ${heading}`, PIPE_TITLE_INTRO + ' ' + fixAllButton, '', ...lines, '']
  }
  return [`## ${heading}`, ...lines, '']
}

/**
 * Command to list title problems in a NotePlan note (replacing any earlier version).
 * @param {string?} params
 */
export async function listTitleProblems(params: string = ''): Promise<void> {
  let runSilently: boolean = false
  try {
    logDebug(pluginJson, `listTitleProblems: Starting with params '${params}'`)
    const config = await getSettings()
    const outputFilename = config.titleProblemsNoteFilename ?? FALLBACK_OUTPUT_FILENAME
    runSilently = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('listTitleProblems', `runSilently = ${String(runSilently)}`)

    if (!runSilently) {
      CommandBar.showLoading(true, `Looking for title problems`)
    }
    const startTime = new Date()
    let holder: ?Array<noteTitleProblems> = null
    /**
     * Synchronous title scan. Safe for runOnAsyncThread (read-only; showLoading allowed).
     * @returns {true}
     */
    const syncFindTitleProblems = (): true => {
      holder = findTitleProblems(config.listFoldersToExclude, [outputFilename], !runSilently)
      return true
    }
    await runHeavySyncWork('listTitleProblems', syncFindTitleProblems)
    if (holder == null) {
      logWarn('listTitleProblems', `async scan result missing; scanning on main thread`)
      syncFindTitleProblems()
    }
    const found: Array<noteTitleProblems> = holder ?? []
    if (!runSilently) {
      CommandBar.showLoading(false)
    }

    const problemCount = found.reduce((sum, row) => sum + row.problems.length, 0)
    if (problemCount === 0) {
      logTimer('listTitleProblems', startTime, `No title problems found`)
      if (!runSilently) {
        await showMessage(`No title problems found! 🥳`)
      }
      const res = DataStore.moveNote(outputFilename, '@Trash')
      if (res) {
        logInfo('listTitleProblems', `Moved existing title-problems note '${outputFilename}' to @Trash.`)
      }
      return
    }
    logTimer('listTitleProblems', startTime, `Found ${problemCount} title problems in ${found.length} notes`)

    const checkedAt = nowLocaleShortDateTime()
    const xCallbackRefreshButton = createPrettyRunPluginLink('🔄 Click to refresh', 'np.Tidy', 'List title problems', [])
    const summary = problemCount === 1 ? '1 note with a title problem' : `${problemCount} notes with title problems`
    const outputArray = [
      `# ${OUTPUT_TITLE}`,
      `Found ${summary} at ${checkedAt}. ${xCallbackRefreshButton}`,
      '',
      ...sectionLines('Title is `---`', found, 'dash-title'),
      ...sectionLines('Frontmatter title does not match H1', found, 'title-mismatch'),
      ...sectionLines('Titles with | characters', found, 'pipe-title'),
    ]

    const outputText = outputArray.join('\n')
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
  } catch (err) {
    if (!runSilently) {
      try {
        CommandBar.showLoading(false)
      } catch (_) {
        // ignore cleanup failures
      }
    }
    logError('listTitleProblems', JSP(err))
  }
}

/**
 * Load the project note named by an x-callback filename argument.
 * @param {string} filename
 * @returns {?TNote}
 */
function noteFromCallbackFilename(filename: string): ?TNote {
  const name = filename ?? ''
  if (name === '') return null
  return DataStore.projectNoteByFilename(name)
}

/**
 * x-callback: copy the frontmatter title onto the H1 on body line 0.
 * @param {string} filename
 */
export async function useFrontmatterTitle(filename: string): Promise<void> {
  try {
    CommandBar.showLoading(true, 'Updating the H1')
    logDebug('useFrontmatterTitle', `starting for '${filename}'`)
    const note = noteFromCallbackFilename(filename)
    if (!note) {
      CommandBar.showLoading(false)
      await showMessage(`Couldn't find note '${filename}'`)
      return
    }
    const fmTitle = frontmatterTitleText(note.frontmatterAttributes)
    if (fmTitle == null) {
      CommandBar.showLoading(false)
      await showMessage(`Note '${filename}' has no frontmatter title. I will re-run the command.`)
      // Re-run the command to update the results note.
      await listTitleProblems('runSilently')
      return
    }
    const updated = replaceBodyLine0(note.content ?? '', fmTitle)
    if (updated == null) {
      CommandBar.showLoading(false)
      await showMessage(`Couldn't find an H1 on the first line of '${filename}'. I will re-run the command.`)
      // Re-run the command to update the results note.
      await listTitleProblems('runSilently')
      return
    }
    note.content = updated
    CommandBar.showLoading(false)
  } catch (err) {
    CommandBar.showLoading(false)
    logError('useFrontmatterTitle', JSP(err))
  }
}

/**
 * x-callback: copy the H1 on body line 0 onto the frontmatter title.
 * @param {string} filename
 */
export async function useH1Title(filename: string): Promise<void> {
  try {
    CommandBar.showLoading(true, 'Updating the frontmatter title')
    logDebug('useH1Title', `starting for '${filename}'`)
    const note = noteFromCallbackFilename(filename)
    if (!note) {
      CommandBar.showLoading(false)
      await showMessage(`Couldn't find note '${filename}'. I will re-run the command.`)
      // Re-run the command to update the results note.
      await listTitleProblems('runSilently')
      return
    }
    const h1Title = h1TextOnBodyLine0(note.content ?? '')
    if (h1Title == null) {
      CommandBar.showLoading(false)
      await showMessage(`Couldn't find an H1 on the first line of '${filename}'. I will re-run the command.`)
      // Re-run the command to update the results note.
      await listTitleProblems('runSilently')
      return
    }
    const fm = note.frontmatterAttributes || {}
    fm.title = h1Title
    note.frontmatterAttributes = fm
    CommandBar.showLoading(false)
  } catch (err) {
    CommandBar.showLoading(false)
    logError('useH1Title', JSP(err))
  }
}

/**
 * x-callback: replace `|` with `-` in the frontmatter title and in the first H1, where either contains `|`.
 * @param {string} filename
 */
export async function fixTitlePipes(filename: string): Promise<void> {
  try {
    CommandBar.showLoading(true, 'Replacing | in the title')
    logDebug('fixTitlePipes', `starting for '${filename}'`)
    const note = noteFromCallbackFilename(filename)
    if (!note) {
      CommandBar.showLoading(false)
      await showMessage(`Couldn't find note '${filename}'`)
      // Re-run the command to update the results note.
      await listTitleProblems('runSilently')
      return
    }
    // Prefer the open editor so its buffer cannot save the old H1 back over the file.
    const editor = openEditorForFilename(note.filename)
    const changed = applyPipeReplacement(editor ?? note)
    if (!changed) {
      CommandBar.showLoading(false)
      await showMessage(`Couldn't find a title containing | in '${filename}'`)
      // Re-run the command to update the results note.
      await listTitleProblems('runSilently')
      return
    }
    CommandBar.showLoading(false)
  } catch (err) {
    CommandBar.showLoading(false)
    logError('fixTitlePipes', JSP(err))
  }
}

/**
 * x-callback: replace `|` with `-` in every listed note title.
 * Starts and finishes with a synchronous scan, the last time to update the results note.
 */
export async function fixAllTitlePipes(): Promise<void> {
  try {
    CommandBar.showLoading(true, 'Replacing | in titles')
    logDebug('fixAllTitlePipes', 'starting')
    const config = await getSettings()
    const outputFilename = config.titleProblemsNoteFilename ?? FALLBACK_OUTPUT_FILENAME
    let holder: ?Array<noteTitleProblems> = null
    /**
     * Synchronous title scan. Safe for runOnAsyncThread (read-only).
     * @returns {true}
     */
    const syncFindTitleProblems = (): true => {
      holder = findTitleProblems(config.listFoldersToExclude, [outputFilename], true)
      return true
    }
    await runHeavySyncWork('fixAllTitlePipes', syncFindTitleProblems)
    if (holder == null) {
      logWarn('fixAllTitlePipes', 'async scan result missing; scanning on main thread')
      syncFindTitleProblems()
    }
    const found = (holder ?? []).filter((row) => row.problems.some((problem) => problem.kind === 'pipe-title'))
    let fixed = 0
    for (let index = 0; index < found.length; index++) {
      const row = found[index]
      CommandBar.showLoading(true, `Replacing '|' in title ${String(index + 1)} of ${String(found.length)}`, (index + 1) / found.length)
      const editor = openEditorForFilename(row.note.filename)
      if (applyPipeReplacement(editor ?? row.note)) fixed++
    }
    CommandBar.showLoading(false)
    logInfo('fixAllTitlePipes', `Replaced | in ${String(fixed)} of ${String(found.length)} notes`)

    // Re-run the command to update the results note.
    await listTitleProblems('')
  } catch (err) {
    CommandBar.showLoading(false)
    logError('fixAllTitlePipes', JSP(err))
  }
}
