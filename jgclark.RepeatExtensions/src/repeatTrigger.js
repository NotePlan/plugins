// @flow
//-----------------------------------------------------------------------
// Trigger function for Repeat Extensions plugin for NotePlan
// Jonathan Clark
// last updated 2025-01-27, for v0.9.0
//-----------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { RE_EXTENDED_REPEAT, } from './repeatHelpers'
import { generateRepeats } from "./repeatMain"
import { RE_DONE_DATE_TIME, } from "@helpers/dateTime"
import { logDebug, logError } from "@helpers/dev"
import { selectedLinesIndex } from "@helpers/NPParagraph"

/**
 * Respond to onEditorWillSave trigger for the currently open note. 
 * Will fire generateRepeats() if the a changed text region includes '@done(...) and @repeat(...)'
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
        changedExtent += Editor.paragraphs[i].content
      }

      if (changedExtent.match(RE_DONE_DATE_TIME) && changedExtent.match(RE_EXTENDED_REPEAT)) {
        logDebug('repeatExtensions/onEditorWillSave', `Found @done(...) so will call generatedRepeats ...`)
        const res = await generateRepeats(true)
      }
    } else {
      throw new Error("Cannot get Editor details. Is there a note open in the Editor?")
    }
  } catch (error) {
    logError(pluginJson, error.message)
  }
} 