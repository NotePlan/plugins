// @flow
//-----------------------------------------------------------------------------
// Add (or update) a body H1 from the frontmatter title: field
// Jonathan Clark
// Last updated 2026-08-18 for v1.4.0, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getRegularNotesInFolder } from '@helpers/folders'
import { displayTitle, getTagParamsFromString } from '@helpers/general'
import { endOfFrontmatterLineIndex, getFrontmatterAttribute } from '@helpers/NPFrontMatter'
import { parseTeamspaceFilename } from '@helpers/teamspace'
import { chooseFolder, showMessage, showMessageYesNo } from '@helpers/userInput'
import { parseFoldersToIgnore } from './helpers/parseFoldersToIgnore'
import { getSettings } from './noteHelpers'

export type BodyH1Action = 'add' | 'update'

export type BodyH1Plan = {
  title: string,
  insertionIndex: number,
  action: BodyH1Action,
  existingH1Content: string | null,
  h1LineIndex: number | null,
}

/**
 * Normalize a frontmatter title value: coerce to string, trim, and strip optional YAML quotes.
 * @author @jgclark
 * @param {mixed} raw
 * @returns {string}
 */
export function normalizeFrontmatterTitle(raw: mixed): string {
  if (raw == null) {
    return ''
  }
  const asString = typeof raw === 'string' ? raw : String(raw)
  return asString.trim().replace(/^["'](.*)["']$/, '$1').trim()
}

/**
 * Find the first H1 in the note body (after frontmatter, if present).
 * @author @jgclark
 * @param {TNote} note
 * @returns {?TParagraph}
 */
export function findFirstBodyH1(note: TNote): ?TParagraph {
  const paras = note.paragraphs ?? []
  const endOfFM = endOfFrontmatterLineIndex(note) || 0
  const startIndex = endOfFM > 0 ? endOfFM + 1 : 0
  for (let i = startIndex; i < paras.length; i += 1) {
    const p = paras[i]
    if (p && p.type === 'title' && p.headingLevel === 1) {
      return p
    }
  }
  return null
}

/**
 * Decide whether this note needs a body H1 added or an existing H1 updated from frontmatter title:.
 * Returns null when there is no title: field, no detectable frontmatter block, or the first body H1 already matches.
 * @author @jgclark
 * @param {TNote} note
 * @returns {BodyH1Plan | null}
 */
export function getBodyH1Plan(note: TNote): BodyH1Plan | null {
  const title = normalizeFrontmatterTitle(getFrontmatterAttribute(note, 'title'))
  if (title === '') {
    return null
  }

  const endOfFM = endOfFrontmatterLineIndex(note) || 0
  if (endOfFM === 0) {
    return null
  }

  const insertionIndex = endOfFM + 1
  const firstH1 = findFirstBodyH1(note)
  if (!firstH1) {
    return {
      title,
      insertionIndex,
      action: 'add',
      existingH1Content: null,
      h1LineIndex: null,
    }
  }

  if (firstH1.content.trim() !== title) {
    return {
      title,
      insertionIndex: firstH1.lineIndex,
      action: 'update',
      existingH1Content: firstH1.content,
      h1LineIndex: firstH1.lineIndex,
    }
  }

  return null
}

/**
 * Apply a planned H1 add or update to a note.
 * @author @jgclark
 * @param {TNote} note
 * @param {BodyH1Plan} plan
 * @returns {boolean} true if the note was changed
 */
export function applyBodyH1FromFrontmatter(note: TNote, plan: BodyH1Plan): boolean {
  try {
    if (plan.action === 'add') {
      note.insertHeading(plan.title, plan.insertionIndex, 1)
      return true
    }
    if (plan.action === 'update' && plan.h1LineIndex != null) {
      const p = note.paragraphs[plan.h1LineIndex]
      if (!p) {
        logWarn('applyBodyH1FromFrontmatter', `No paragraph at line ${String(plan.h1LineIndex)} in '${displayTitle(note)}'`)
        return false
      }
      p.content = plan.title
      note.updateParagraph(p)
      return true
    }
    return false
  } catch (error) {
    logError('applyBodyH1FromFrontmatter', JSP(error))
    return false
  }
}

/**
 * Add (or update) a body H1 from the frontmatter title: field, for regular notes in a folder and its subfolders.
 * Optional folderToStart from params (e.g. template/callback); if missing, prompts user to choose folder.
 * Skips Calendar and Teamspace notes. Dry-runs first: logs planned changes (with a warning for H1 updates) and asks for confirmation.
 * @author @jgclark
 * @param {string} params - Optional JSON string with folderToStart and/or runSilently
 */
export async function addTitleToNoteBody(params: string = ''): Promise<void> {
  try {
    const config = await getSettings()
    const foldersToIgnore: Array<string> = parseFoldersToIgnore(config?.foldersToIgnore)

    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)

    let folderToStart = await getTagParamsFromString(params ?? '', 'folderToStart', '')
    if (folderToStart && typeof folderToStart === 'string') {
      folderToStart = decodeURIComponent(folderToStart)
    }
    if (!folderToStart || folderToStart === '') {
      if (runSilently) {
        logWarn(pluginJson, 'addTitleToNoteBody(): No folderToStart param and runSilently is true, so cannot prompt. Stopping.')
        return
      }
      logDebug(pluginJson, 'addTitleToNoteBody(): No folder param, asking user')
      folderToStart = await chooseFolder('Choose folder to add titles to note bodies in (includes subfolders)', false, false, '', true, true)
    }
    if (!folderToStart || folderToStart === '') {
      logWarn(pluginJson, 'addTitleToNoteBody(): No folder chosen. Stopping.')
      return
    }

    logDebug(pluginJson, `addTitleToNoteBody(): folder: ${folderToStart}`)

    CommandBar.showLoading(true, `Finding notes missing a matching H1 ...`)
    await CommandBar.onAsyncThread()

    const notes = getRegularNotesInFolder(folderToStart, true, foldersToIgnore)
    const toProcess = notes.filter((n) => {
      if (n.type === 'Calendar') return false
      const { isTeamspace } = parseTeamspaceFilename(n.filename)
      return !isTeamspace
    })

    const planned: Array<{ note: TNote, plan: BodyH1Plan }> = []
    for (const n of toProcess) {
      const plan = getBodyH1Plan(n)
      if (plan) {
        planned.push({ note: n, plan })
      }
    }

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    if (planned.length === 0) {
      logInfo('addTitleToNoteBody', `No notes in '${folderToStart}' need a body H1 added or updated from frontmatter title:.`)
      if (!runSilently) {
        await showMessage('No notes in that folder and subfolders need a body H1 added or updated from the frontmatter title: field.', 'OK', 'Add title to note body')
      }
      return
    }

    const addCount = planned.filter((item) => item.plan.action === 'add').length
    const updateCount = planned.filter((item) => item.plan.action === 'update').length

    logInfo('addTitleToNoteBody', `List of ${String(planned.length)} notes that will get a body H1 from frontmatter title: (${String(addCount)} add, ${String(updateCount)} update):`)
    if (updateCount > 0) {
      logWarn('addTitleToNoteBody', `WARNING: ${String(updateCount)} note(s) already have an H1 that does not match the frontmatter title: field. Those existing H1s will be UPDATED to match title:.`)
    }
    for (const { note, plan } of planned) {
      if (plan.action === 'add') {
        logInfo('addTitleToNoteBody', `- ADD '# ${plan.title}' to {${note.filename}}`)
      } else {
        logWarn('addTitleToNoteBody', `- UPDATE H1 '${plan.existingH1Content ?? ''}' -> '${plan.title}' in '${displayTitle(note)}' in {${note.filename}}`)
      }
    }

    if (!runSilently) {
      const summaryLines = [`I found ${String(planned.length)} note(s) in this folder that need a body H1 from the frontmatter 'title' field:`]
      if (addCount > 0) {
        summaryLines.push(`- ${String(addCount)} missing an H1 (will add one)`)
      }
      if (updateCount > 0) {
        summaryLines.push(`- ${String(updateCount)} with an H1 that does not match title: (will UPDATE the existing H1)`)
      }
      if (updateCount > 0) {
        summaryLines.push('')
        summaryLines.push('WARNING: updating an existing H1 changes the visible heading in those notes. The full list is in the Plugin Console.')
      } else {
        summaryLines.push('')
        summaryLines.push('See the Plugin Console for a full list.')
      }
      summaryLines.push('')
      summaryLines.push('Do you want to continue?')

      const res = await showMessageYesNo(summaryLines.join('\n'), ['Yes', 'No'], 'Add title to note body')
      if (res !== 'Yes') {
        logInfo('addTitleToNoteBody', 'User cancelled operation')
        return
      }
    }

    CommandBar.showLoading(true, `Adding titles to note bodies ...`)
    await CommandBar.onAsyncThread()

    let numChanged = 0
    for (const { note, plan } of planned) {
      const changed = applyBodyH1FromFrontmatter(note, plan)
      if (changed) {
        numChanged += 1
        DataStore.updateCache(note, true)
        if (plan.action === 'add') {
          logInfo('addTitleToNoteBody', `- added '# ${plan.title}' to '${displayTitle(note)}'`)
        } else {
          logInfo('addTitleToNoteBody', `- updated H1 to '${plan.title}' in '${displayTitle(note)}'`)
        }
      } else {
        logWarn('addTitleToNoteBody', `- failed to change '${displayTitle(note)}'`)
      }
    }

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    const doneMsg = `Added or updated the body H1 in ${String(numChanged)} note(s), and cache updated.`
    logInfo('addTitleToNoteBody', doneMsg)
    if (!runSilently) {
      await showMessage(doneMsg, 'OK', 'Add title to note body')
    }
  } catch (err) {
    logError(pluginJson, `addTitleToNoteBody(): ${JSP(err)}`)
  }
}
