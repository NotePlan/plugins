// @flow
//-----------------------------------------------------------------------
// Trigger function for Repeat Extensions plugin for NotePlan
// Jonathan Clark
// last updated 2026-10-19, for v1.2.1
//-----------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getRepeatSettings, RE_CANCELLED_TASK, RE_EXTENDED_REPEAT, type RepeatConfig } from './repeatHelpers'
import { recordRepeatHeading, resolveLiveRepeatParagraph, runTaskSorterAfterRepeats } from './repeatMain'
import { generateRepeatForCancelledPara, generateRepeatForPara } from './repeatPara'
import { RE_DONE_DATE_TIME } from "@helpers/dateTime"
import { logDebug, logError, logInfo } from "@helpers/dev"
import { makeBasicParasFromContent, selectedLinesIndex } from "@helpers/NPParagraph"

type PendingRepeat = {
  kind: 'done' | 'cancelled',
  para: TParagraph,
  lineIndex: number,
}

/**
 * Respond to onEditorWillSave trigger for the currently open note. 
 * Will generate repeats (and run task sorter when configured) if a changed text region includes @repeat(...) with extended interval syntax, and:
 * - either @done(...) with a datetime tag
 * - or a newly cancelled task.
 */
export async function onEditorWillSave(): Promise<void> {
  try {
    if (Editor.content && Editor.note) {
      const latestContent = Editor.content ?? ''
      const noteReadOnly: CoreNoteFields = Editor.note
      const versions = noteReadOnly.versions
      if (!versions || versions.length === 0 || versions[0] == null || typeof versions[0].content !== 'string') {
        logDebug('repeatExtensions/onEditorWillSave', 'No previous note version to diff; stopping')
        return
      }
      const previousContent = versions[0].content

      const config: RepeatConfig = await getRepeatSettings()
      if (config == null) {
        throw new Error("Cannot get Repeat Extensions plugin settings. Stopping.")
      }

      const ranges = NotePlan.stringDiff(previousContent, latestContent)
      if (!ranges || ranges.length === 0) {
        return
      }
      const earliestStart = ranges[0].start
      const latestEnd = ranges[ranges.length - 1].end
      const overallRange: TRange = Range.create(earliestStart, latestEnd)

      let changedExtent = ''
      const [startParaIndex, endParaIndex] = selectedLinesIndex(overallRange, Editor.paragraphs)
      for (let i = startParaIndex; i <= endParaIndex; i++) {
        changedExtent += Editor.paragraphs[i].rawContent
      }
      logDebug('repeatExtensions/onEditorWillSave', `startParaIndex: ${String(startParaIndex)} / endParaIndex: ${String(endParaIndex)} / changedExtent: ${changedExtent}`)

      if (changedExtent.match(RE_EXTENDED_REPEAT)) {
        let repeatCount = 0
        let lastHeading = ''
        const headingList: Array<string> = []
        // Collect before any insert. Each new line shifts later indexes, so a top-down walk
        // sees the line just inserted and skips the next completed task.
        const pending: Array<PendingRepeat> = []

        if (changedExtent.match(RE_DONE_DATE_TIME)) {
          for (let i = startParaIndex; i <= endParaIndex; i++) {
            const origPara = Editor.paragraphs[i]
            if (!origPara || typeof origPara.content !== 'string') {
              continue
            }
            const content = origPara.content
            if (RE_EXTENDED_REPEAT.test(content) && RE_DONE_DATE_TIME.test(content)) {
              pending.push({ kind: 'done', para: origPara, lineIndex: i })
            }
          }
        }

        // For cancelled tasks, check line-by-line against previous content.
        // Matching the whole changedExtent string can miss the actual state transition.
        if (config.allowRepeatsInCancelledParas) {
          const previousBasicParas = makeBasicParasFromContent(previousContent)
          const latestBasicParas = makeBasicParasFromContent(latestContent)

          for (let i = startParaIndex; i <= endParaIndex; i++) {
            const latestPara = latestBasicParas[i]
            const prevPara = previousBasicParas[i]
            if (!latestPara || !prevPara) {
              continue
            }

            const latestIsCancelled = latestPara.type === 'cancelled' || latestPara.type === 'checklistCancelled' || RE_CANCELLED_TASK.test(latestPara.rawContent)
            const prevIsCancelled = prevPara.type === 'cancelled' || prevPara.type === 'checklistCancelled' || RE_CANCELLED_TASK.test(prevPara.rawContent)
            if (latestIsCancelled && !prevIsCancelled && latestPara.content.match(RE_EXTENDED_REPEAT)) {
              const origPara = Editor.paragraphs[i]
              if (origPara) {
                pending.push({ kind: 'cancelled', para: origPara, lineIndex: i })
              }
            }
          }
        }

        pending.sort((a, b) => b.lineIndex - a.lineIndex)

        for (const job of pending) {
          const origPara = resolveLiveRepeatParagraph(Editor, job.para)
          if (!origPara) {
            logError(pluginJson, `onEditorWillSave: could not find paragraph at line ${String(job.lineIndex)} after earlier inserts`)
            continue
          }
          if (job.kind === 'done') {
            logDebug('repeatExtensions/onEditorWillSave', `Found @done(...) at line ${String(job.lineIndex)}; calling generateRepeatForPara() (skipEditorSave)`)
            const newPara = await generateRepeatForPara(origPara, Editor, config, true, true)
            if (newPara) {
              repeatCount++
              if (config.runTaskSorter) {
                lastHeading = recordRepeatHeading(headingList, lastHeading, Editor, origPara)
              }
              logDebug('repeatExtensions/onEditorWillSave', `New repeat generated: {${newPara.content}} at line ${String(job.lineIndex)}`)
            } else {
              logError(pluginJson, `No new repeat generated from completed task at line ${String(job.lineIndex)}`)
            }
          } else {
            logDebug('repeatExtensions/onEditorWillSave', `Found newly cancelled extended repeat at line ${String(job.lineIndex)} so will call generateRepeatForCancelledPara() ...`)
            const newPara = await generateRepeatForCancelledPara(origPara, noteReadOnly, true, config)
            if (newPara) {
              repeatCount++
              if (config.runTaskSorter) {
                lastHeading = recordRepeatHeading(headingList, lastHeading, Editor, origPara)
              }
              logDebug('repeatExtensions/onEditorWillSave', `New repeat generated: {${newPara.content}} at line ${String(job.lineIndex)}`)
            } else {
              logError(pluginJson, `No new repeat generated from cancelled task at line ${String(job.lineIndex)}`)
            }
          }
        }

        if (repeatCount > 0) {
          logInfo(
            'repeatExtensions/onEditorWillSave',
            `Generated ${String(repeatCount)} repeat(s); runTaskSorter=${String(config.runTaskSorter)} headings=[${headingList.join(', ')}]`,
          )
          // Defer: sortTasksUnderHeading calls Editor.save() at start; must not run mid-onEditorWillSave.
          await runTaskSorterAfterRepeats(headingList, Editor, config, true)
        }
      }
    } else {
      throw new Error("Cannot get Editor details. Is there a note open in the Editor?")
    }
  } catch (error) {
    logError(pluginJson, error.message)
  }
} 