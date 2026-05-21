// @flow
//-----------------------------------------------------------------------
// Trigger function for Repeat Extensions plugin for NotePlan
// Jonathan Clark
// last updated 2026-03-19, for v1.1.0
//-----------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getRepeatSettings, RE_CANCELLED_TASK, RE_EXTENDED_REPEAT, type RepeatConfig } from './repeatHelpers'
import { recordRepeatHeading, runTaskSorterAfterRepeats } from './repeatMain'
import { generateRepeatForCancelledPara, generateRepeatForPara } from './repeatPara'
import { RE_DONE_DATE_TIME } from "@helpers/dateTime"
import { logDebug, logError, logInfo } from "@helpers/dev"
import { makeBasicParasFromContent, selectedLinesIndex } from "@helpers/NPParagraph"

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
      const previousContent = noteReadOnly.versions[0].content
      const timeSinceLastEdit: number = Date.now() - noteReadOnly.versions[0].date

      if (timeSinceLastEdit <= 2000) {
        return
      }

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

        if (changedExtent.match(RE_DONE_DATE_TIME)) {
          for (let i = startParaIndex; i <= endParaIndex; i++) {
            const origPara = Editor.paragraphs[i]
            if (!origPara || typeof origPara.content !== 'string') {
              continue
            }
            const content = origPara.content
            if (RE_EXTENDED_REPEAT.test(content) && RE_DONE_DATE_TIME.test(content)) {
              logDebug('repeatExtensions/onEditorWillSave', `Found @done(...) at line ${String(i)}; calling generateRepeatForPara() (skipEditorSave)`)
              const newPara = await generateRepeatForPara(origPara, Editor, config, true, true)
              if (newPara) {
                repeatCount++
                if (config.runTaskSorter) {
                  lastHeading = recordRepeatHeading(headingList, lastHeading, Editor, origPara)
                }
                logDebug('repeatExtensions/onEditorWillSave', `New repeat generated: {${newPara.content}} at line ${String(i)}`)
              } else {
                throw new Error(`No new repeat generated from completed task at line ${String(i)}`)
              }
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
              logDebug('repeatExtensions/onEditorWillSave', `Found newly cancelled extended repeat at line ${String(i)} so will call generateRepeatForCancelledPara() ...`)
              const origPara = Editor.paragraphs[i]
              const newPara = await generateRepeatForCancelledPara(origPara, noteReadOnly, true)
              if (newPara) {
                repeatCount++
                if (config.runTaskSorter) {
                  lastHeading = recordRepeatHeading(headingList, lastHeading, Editor, origPara)
                }
                logDebug('repeatExtensions/onEditorWillSave', `New repeat generated: {${newPara.content}} at line ${String(i)}`)
              } else {
                throw new Error(`No new repeat generated from cancelled task at line ${String(i)}`)
              }
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