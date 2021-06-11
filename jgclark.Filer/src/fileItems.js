// @flow
// -----------------------------------------------------------------------------
// Plugin to help move selected pargraphs to other notes
// Jonathan Clark
// v0.3.3, 11.6.2021
// -----------------------------------------------------------------------------

import { rangeToString, displayTitle } from '../../np.statistics/src/statsHelpers'

// Preference that needs to get added when there is a proper config system
const pref_addDateBacklink = true

// -----------------------------------------------------------------------------
// Helper Functions

// Return list of all notes, sorted by changed date (newest to oldest)
function allNotesSortedByChanged() {
  const projectNotes = DataStore.projectNotes.slice()
  const calendarNotes = DataStore.calendarNotes.slice()
  const allNotes = projectNotes.concat(calendarNotes)
  const allNotesSortedByDate = allNotes.sort(
    (first, second) =>
      second.changedDate - first.changedDate) // most recent first
  return allNotesSortedByDate
}

// Convert paragraph(s) to single raw text string
function parasToText(paras) {
  // console.log('parasToText: starting with ' + paras.length + ' paragraphs')
  let text = ''
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i]
    // paraDetails(p)
    text += `${p.rawContent}\n`
  }
  const parasAsText = text.trimEnd() // remove extra newline not wanted after last line
  return parasAsText
}

// -----------------------------------------------------------------------------

export async function fileParas() {
  // identify out what we're moving (in priority order):
  // - current selection
  // - current heading + its following section
  // - current line
  // - current line (plus any indented paragraphs)
  const { content, selectedParagraphs, note } = Editor
  if (content == null || selectedParagraphs == null || note == null) {
    // No note open, or no paragraph selection (perhaps empty note), so don't do anything.
    console.log('fileParse: warning: No note open.')
    return
  }
  const allParas = Editor.paragraphs
  const selection = Editor.selection
  if (selection == null) {
    return
  }
  const range = Editor.paragraphRangeAtCharacterIndex(selection.start)
  // const firstSelPara = selectedParagraphs[0]; // needed?
  console.log(`\nfileParse: selection ${rangeToString(range)}`)

  // Work out what paragraph number this selected para is
  let firstSelParaIndex = 0
  for (let i = 0; i < allParas.length; i++) {
    const p = allParas[i]
    if (p.contentRange?.start === range.start) {
      firstSelParaIndex = i
      break
    }
  }
  console.log(`  First para index: ${firstSelParaIndex}`)

  let parasToMove = []
  if (selectedParagraphs.length > 1) {
    // we have a selection of paragraphs, so use them
    parasToMove = selectedParagraphs
    console.log(`  Found ${parasToMove.length} selected paras`)
  } else {
    // we have just one paragraph selected -- the current one
    const para = selectedParagraphs[0]
    // paraDetails(para)
    console.log(
      `  Para '${para.content}' type: ${para.type}, index: ${firstSelParaIndex}`,
    )
    // if this is a heading, find the rest of the sections
    if (para.type === 'title') {
      // includes all heading levels
      const thisHeadingLevel = para.headingLevel
      console.log(`  Found heading level ${thisHeadingLevel}`)
      parasToMove.push(para) // make this the first line to move
      // Work out how far this section extends. (NB: headingRange doesn't help us here.)
      for (let i = firstSelParaIndex + 1; i < allParas.length; i++) {
        const p = allParas[i]
        if (p.type === 'title' && p.headingLevel <= thisHeadingLevel) {
          break
        } // stop as new heading of same or higher level
        parasToMove.push(p)
      }
      console.log(`  Found ${parasToMove.length} heading section lines`)
    } else {
      // This isn't a heading.
      // Now see if there are following indented lines to move as well
      const startingIndentLevel = para.indents
      console.log(
        `  Found single line with indent level ${startingIndentLevel}`,
      )
      parasToMove.push(para)
      for (let i = firstSelParaIndex + 1; i < allParas.length; i++) {
        const p = allParas[i]
        if (p.indents <= startingIndentLevel) {
          // stop as this para is same or less indented than the starting line
          break
        }
        parasToMove.push(p)
      }
      console.log(`  Found ${parasToMove.length-1} indented paras`)
    }
  }

  // If this is a calendar note we've moving from, and the user wants to
  // create a date backlink, then append backlink to the first para in parasToMove
  if (pref_addDateBacklink && note.type === 'Calendar') {
    const todaysDate = new Date().toISOString().slice(0, 10)
    parasToMove[0].content = `${parasToMove[0].content} >${todaysDate}`
  }

  // There's no API function to work on multiple paragraphs,
  // or one to insert an indented paragraph, so we need to convert the paragraphs
  // to a raw text version which we can include
  const parasAsText = parasToText(parasToMove)

  // Decide where to move to
  // Ask for the note we want to add the paras
  const notes = allNotesSortedByChanged()

  let res = await CommandBar.showOptions(
    notes.map((n) => displayTitle(n)),
    `Select note to move ${parasToMove.length} lines to`,
  )
  const noteToMoveTo = notes[res.index]
  console.log(`  Moving to note: ${displayTitle(noteToMoveTo)}`)

  // ask to which heading to add the paras
  let headingStrings = []
  const headingParas = noteToMoveTo.paragraphs.filter((p) => p.type === 'title') // = all headings, not just the top 'title'
  // console.log(headingParas.length);
  if (headingParas.length > 0) {
    headingStrings = headingParas.map((p) => {
      let prefix = ''
      for (let i = 1; i < p.headingLevel; i++) {
        prefix += '    '
      }
      return prefix + p.content
    })
  } else {
    // Cope with case where there are no headings or titles, pointed out by @dwertheimer
    headingStrings = ['(top of note)']
  }
  // and add a bottom of note option
  // headingStrings.unshift('(top of note)'); // add at start
  headingStrings.push('(bottom of note)') // add at end
  res = await CommandBar.showOptions(
    headingStrings,
    `Select a heading from note '${
      noteToMoveTo.title ?? 'Untitled'
    }' to move after`,
  )
  const headingToFind = headingStrings[res.index].trim()
  console.log(`    under heading: ${headingToFind}`)

  // Add to new location
  // Currently there's no API function to deal with multiple paragraphs, but we can
  // insert a raw text string
  // Add text directly under the heading in the note
  // note.addParagraphBelowHeadingTitle(parasToMove, 'empty', heading.content, false, false);
  const destParas = noteToMoveTo.paragraphs
  let insertionIndex = null
  if (headingToFind === '(top of note)') {
    insertionIndex = 0
  } else if (headingToFind === '(bottom of note)') {
    insertionIndex = destParas.length + 1
  } else {
    for (let i = 0; i < destParas.length; i++) {
      const p = destParas[i]
      if (p.content === headingToFind && p.type === 'title') {
        insertionIndex = i + 1
        break
      }
    }
  }
  if (insertionIndex === null) {
    return
  }
  console.log(`  Inserting at index ${insertionIndex}`)
  await noteToMoveTo.insertParagraph(parasAsText, insertionIndex, 'empty')

  // delete from existing location
  // TODO: waiting for a fix to the preferred .removeParagraph call
  // but this alternative works.
  // In r634 "fixed removeParagraph. It will now look for the paragraph first at the lineIndex,
  // and if not found it will look for a paragraph with the same the content and indentation and
  // type. Additionally, I have added removeParagraphs(arrayOfParagraphs), to make this a bit safer."
  for (
    let i = firstSelParaIndex + parasToMove.length - 1;
    i >= firstSelParaIndex;
    i--
  ) {
    console.log(`  Remove original para # ${i}`)
    note.removeParagraphAtIndex(i)
  }
}

// globalThis.fileParas = fileParas
