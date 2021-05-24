// @flow
// -----------------------------------------------------------------------------
// Plugin to help move selected pargraphs to other notes
// Jonathan Clark
// v0.2.0, 25.5.2021
// -----------------------------------------------------------------------------

function projectNotesSortedByChanged() {
  return DataStore.projectNotes.sort(
    (first, second) => first.changedDate < second.changedDate,
  );
}

// Pretty print range information
function rangeToString(r) {
  if (r == undefined) {
    return 'Range is undefined!'
  }
  return 'range: ' + r.start + '-' + r.end
}

// Print out paragraph details
function paraDetails(p) {
  console.log(
    "Para content: " + p.content +
    "\n\trawContent: " + p.rawContent +
    "\n\tlineIndex: " + p.lineIndex +
    "\ttype: " + p.type +
    "\tindents: " + p.indents + // NB only counts tabs not spaces
    "\tprefix: " + p.prefix)
  if (p.headingRange != undefined) {console.log('\theadingRange from '+p.headingRange.start+' len '+p.headingRange.length)}
}

// Convert paragraph(s) to single raw text string
function parasToText(paras) {
  // console.log('parasToText: starting with ' + paras.length + ' paragraphs')
  let text = ''
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i]
    // paraDetails(p)
    text += p.rawContent + '\n'
  }
  const parasAsText = text.trimEnd() // remove extra newline not wanted after last line
  return parasAsText
}

async function fileParas() {
  // identify out what we're moving (in priority order):
  // - current selection
  // - current heading + its following section
  // - current line
  // - TODO: current line (plus any indented paragraphs)
  const { content, selectedParagraphs } = Editor
  if (content == null || selectedParagraphs == null) {
    // No note open, or no paragraph selection (perhaps empty note), so don't do anything.
    console.log('fileParse: warning: No note open.')
    return;
  }
  const allParas = Editor.paragraphs
  const selection = Editor.selection
  const range = Editor.paragraphRangeAtCharacterIndex(selection.start)
  const firstSelPara = selectedParagraphs[0] // needed?
  console.log('\nfileParse: selection ' + rangeToString(range))

  // Work out what paragraph number this selected para is
  let firstSelParaIndex = 0
  for (let i = 0; i < allParas.length; i++) {
    let p = allParas[i]
    if (p.contentRange.start === range.start) {
      firstSelParaIndex = i
      break
    }
  }
  console.log("  First para index: " + firstSelParaIndex)
  
  let parasToMove = []
  if (selectedParagraphs.length > 1) {
    // we have a selection of paragraphs, so use them
    parasToMove = selectedParagraphs
    console.log("  Found " + parasToMove.length + " selected paras")
  } else {
    // we have just one paragraph selected -- the current one
    const para = selectedParagraphs[0]
    // paraDetails(para)
    console.log("  Para '" + para.content + "' type: "+para.type+", index: " + firstSelParaIndex)
    // if this is a heading, find the rest of the sections
    if (para.type === 'title') { // includes all heading levels
      const thisHeadingLevel = para.headingLevel
      console.log("  Found heading level " + thisHeadingLevel)
      parasToMove.push(para) // make this the first line to move
      // Work out how far this section extends.
      // NB: headingRange doesn't help us here
      for (let i = firstSelParaIndex + 1; i < allParas.length; i++) {
        let p = allParas[i]
        if ((p.type === 'title') && (p.headingLevel <= thisHeadingLevel)) { break } // stop as new heading of same or higher level
        parasToMove.push(p)
      }
      console.log("  Found " + parasToMove.length + " heading section lines")
    } else {
      // this isn't a heading. Now see if there are following indented lines
      console.log("  Found single line with indent level " + para.indents)
      parasToMove.push(para)
      // TODO following indented lines
      console.log("  Found " + parasToMove.length + " indented paras")
    }
  }

  // There's no API function to work on multiple paragraphs, 
  // or one to insert an indented paragraph, so we need to convert the paragraphs
  // to a raw text version which we can include
  let parasAsText = parasToText(parasToMove)
    
  // Decide where to move to
  // Ask for the note we want to add the paras
  const notes = projectNotesSortedByChanged()
  let res = await CommandBar.showOptions(
    notes.map((n) => n.title),
    "Select project note to move " + parasToMove.length + " to"
  );
  const noteToMoveTo = notes[res.index]
  console.log("  Moving to note: " + noteToMoveTo.title)
  // ask to which heading to add the paras
  const headings = noteToMoveTo.paragraphs.filter((p) => p.type === "title");
  res = await CommandBar.showOptions(
    headings.map((p) => p.prefix + p.content),
    "Select a heading from note '" + noteToMoveTo.title + "' to move after"
  );
  const headingToFind = headings[res.index].content
  console.log("    under heading: " + headingToFind)

  // Add to new location
  // Currently there's no API function to deal with multiple paragraphs, but we can
  // insert a raw text string
  // Add text directly under the heading in the note
  // note.addParagraphBelowHeadingTitle(parasToMove, 'empty', heading.content, false, false);
  const destParas = noteToMoveTo.paragraphs;
  let headingIndex = null
  for (let i = 0; i < destParas.length; i++) {
    const p = destParas[i];
    if (p.content == headingToFind && p.type === 'title') {
      headingIndex = i
      break
    }
  }
  console.log('  This heading is at index ' + headingIndex)
  await noteToMoveTo.insertParagraph(parasAsText, headingIndex + 1, "empty")

  // delete from existing location
  // TODO: waiting for a fix to the preferred .removeParagraph call
  // for (let i = firstSelParaIndex; i < (firstSelParaIndex + parasToMove.length); i++) {
  //   // console.log('  About to remove selected para # ' + i)
  //   // Editor.removeParagraph(parasToMove[i])
  // }

  // So instead, we need to work on the underlying lines system
  const allLines = Editor.content.split("\n")
  console.log('  Preparing to delete: in ' + parasToMove.length + ' lines starting line ' + firstSelParaIndex)
  allLines.splice(firstSelParaIndex, parasToMove.length)
  Editor.content = allLines.join('\n')

  // TODO: Check that when I can go back to the .removeParagraph that it doesn't move around the cursor unhelpfully
}

globalThis.fileParas = fileParas
