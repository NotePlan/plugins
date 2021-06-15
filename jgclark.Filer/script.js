var exports = (function (exports) {
  'use strict';

  new Date().toISOString().slice(0, 10);
  function getYearMonthDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const date = dateObj.getDate();
    return {
      year,
      month,
      date
    };
  }
  function unhyphenatedDate(dateObj) {
    const {
      year,
      month,
      date
    } = getYearMonthDate(dateObj);
    return `${year}${month < 10 ? '0' : ''}${month}${date < 10 ? '0' : ''}${date}`;
  }
  // console.log(withinDateRange(unhyphenateDate('2021-04-24'), '20210501', '20210531')) // false
  // console.log(withinDateRange(unhyphenateDate('2021-05-01'), '20210501', '20210531')) // true
  // console.log(withinDateRange(unhyphenateDate('2021-05-24'), '20210501', '20210531')) // true
  // console.log(withinDateRange(unhyphenateDate('2021-05-31'), '20210501', '20210531')) // true
  // console.log(withinDateRange(unhyphenateDate('2021-06-24'), '20210501', '20210531')) // false
  // Pretty print range information

  function rangeToString(r) {
    if (r == null) {
      return 'Range is undefined!';
    }

    return `range: ${r.start}-${r.end}`;
  } // return title of note useful for display, even for calendar notes (the YYYYMMDD)

  function displayTitle(n) {
    if (n.type === 'Calendar') {
      return unhyphenatedDate(n.date);
    } else {
      return n.title ?? '';
    }
  } // Print out all data for a paragraph (borrowed from EM)

  // @ flow
  // Helper Functions
  // Return list of all notes, sorted by changed date (newest to oldest)

  function allNotesSortedByChanged() {
    const projectNotes = DataStore.projectNotes.slice();
    const calendarNotes = DataStore.calendarNotes.slice();
    const allNotes = projectNotes.concat(calendarNotes);
    const allNotesSortedByDate = allNotes.sort((first, second) => second.changedDate - first.changedDate); // most recent first

    return allNotesSortedByDate;
  } // Convert paragraph(s) to single raw text string


  function parasToText(paras) {
    // console.log('parasToText: starting with ' + paras.length + ' paragraphs')
    let text = '';

    for (let i = 0; i < paras.length; i++) {
      const p = paras[i]; // paraDetails(p)

      text += `${p.rawContent}\n`;
    }

    const parasAsText = text.trimEnd(); // remove extra newline not wanted after last line

    return parasAsText;
  } // -----------------------------------------------------------------------------


  async function fileParas() {
    // identify out what we're moving (in priority order):
    // - current selection
    // - current heading + its following section
    // - current line
    // - current line (plus any indented paragraphs)
    const {
      content,
      selectedParagraphs,
      note
    } = Editor;

    if (content == null || selectedParagraphs == null || note == null) {
      // No note open, or no paragraph selection (perhaps empty note), so don't do anything.
      console.log('fileParse: warning: No note open.');
      return;
    }

    const allParas = Editor.paragraphs;
    const selection = Editor.selection;

    if (selection == null) {
      return;
    }

    const range = Editor.paragraphRangeAtCharacterIndex(selection.start); // const firstSelPara = selectedParagraphs[0]; // needed?

    console.log(`\nfileParse: selection ${rangeToString(range)}`); // Work out what paragraph number this selected para is

    let firstSelParaIndex = 0;

    for (let i = 0; i < allParas.length; i++) {
      const p = allParas[i];

      if (p.contentRange?.start === range.start) {
        firstSelParaIndex = i;
        break;
      }
    }

    console.log(`  First para index: ${firstSelParaIndex}`);
    let parasToMove = [];

    if (selectedParagraphs.length > 1) {
      // we have a selection of paragraphs, so use them
      parasToMove = selectedParagraphs;
      console.log(`  Found ${parasToMove.length} selected paras`);
    } else {
      // we have just one paragraph selected -- the current one
      const para = selectedParagraphs[0]; // paraDetails(para)

      console.log(`  Para '${para.content}' type: ${para.type}, index: ${firstSelParaIndex}`); // if this is a heading, find the rest of the sections

      if (para.type === 'title') {
        // includes all heading levels
        const thisHeadingLevel = para.headingLevel;
        console.log(`  Found heading level ${thisHeadingLevel}`);
        parasToMove.push(para); // make this the first line to move
        // Work out how far this section extends. (NB: headingRange doesn't help us here.)

        for (let i = firstSelParaIndex + 1; i < allParas.length; i++) {
          const p = allParas[i];

          if (p.type === 'title' && p.headingLevel <= thisHeadingLevel) {
            break;
          } // stop as new heading of same or higher level


          parasToMove.push(p);
        }

        console.log(`  Found ${parasToMove.length} heading section lines`);
      } else {
        // This isn't a heading.
        // Now see if there are following indented lines to move as well
        const startingIndentLevel = para.indents;
        console.log(`  Found single line with indent level ${startingIndentLevel}`);
        parasToMove.push(para);

        for (let i = firstSelParaIndex + 1; i < allParas.length; i++) {
          const p = allParas[i];

          if (p.indents <= startingIndentLevel) {
            // stop as this para is same or less indented than the starting line
            break;
          }

          parasToMove.push(p);
        }

        console.log(`  Found ${parasToMove.length - 1} indented paras`);
      }
    } // If this is a calendar note we've moving from, and the user wants to
    // create a date backlink, then append backlink to the first para in parasToMove


    if (note.type === 'Calendar') {
      const todaysDate = new Date().toISOString().slice(0, 10);
      parasToMove[0].content = `${parasToMove[0].content} >${todaysDate}`;
    } // There's no API function to work on multiple paragraphs,
    // or one to insert an indented paragraph, so we need to convert the paragraphs
    // to a raw text version which we can include


    const parasAsText = parasToText(parasToMove); // Decide where to move to
    // Ask for the note we want to add the paras

    const notes = allNotesSortedByChanged();
    let res = await CommandBar.showOptions(notes.map(n => displayTitle(n)), `Select note to move ${parasToMove.length} lines to`);
    const noteToMoveTo = notes[res.index];
    console.log(`  Moving to note: ${displayTitle(noteToMoveTo)}`); // ask to which heading to add the paras

    let headingStrings = [];
    const headingParas = noteToMoveTo.paragraphs.filter(p => p.type === 'title'); // = all headings, not just the top 'title'
    // console.log(headingParas.length);

    if (headingParas.length > 0) {
      headingStrings = headingParas.map(p => {
        let prefix = '';

        for (let i = 1; i < p.headingLevel; i++) {
          prefix += '    ';
        }

        return prefix + p.content;
      });
    } else {
      // Cope with case where there are no headings or titles, pointed out by @dwertheimer
      headingStrings = ['(top of note)'];
    } // and add a bottom of note option
    // headingStrings.unshift('(top of note)'); // add at start


    headingStrings.push('(bottom of note)'); // add at end

    res = await CommandBar.showOptions(headingStrings, `Select a heading from note '${noteToMoveTo.title ?? 'Untitled'}' to move after`);
    const headingToFind = headingStrings[res.index].trim();
    console.log(`    under heading: ${headingToFind}`); // Add to new location
    // Currently there's no API function to deal with multiple paragraphs, but we can
    // insert a raw text string
    // Add text directly under the heading in the note
    // note.addParagraphBelowHeadingTitle(parasToMove, 'empty', heading.content, false, false);

    const destParas = noteToMoveTo.paragraphs;
    let insertionIndex = null;

    if (headingToFind === '(top of note)') {
      insertionIndex = 0;
    } else if (headingToFind === '(bottom of note)') {
      insertionIndex = destParas.length + 1;
    } else {
      for (let i = 0; i < destParas.length; i++) {
        const p = destParas[i];

        if (p.content === headingToFind && p.type === 'title') {
          insertionIndex = i + 1;
          break;
        }
      }
    }

    if (insertionIndex === null) {
      return;
    }

    console.log(`  Inserting at index ${insertionIndex}`);
    await noteToMoveTo.insertParagraph(parasAsText, insertionIndex, 'empty'); // delete from existing location
    // TODO: waiting for a fix to the preferred .removeParagraph call
    // but this alternative works.
    // In r634 "fixed removeParagraph. It will now look for the paragraph first at the lineIndex,
    // and if not found it will look for a paragraph with the same the content and indentation and
    // type. Additionally, I have added removeParagraphs(arrayOfParagraphs), to make this a bit safer."

    for (let i = firstSelParaIndex + parasToMove.length - 1; i >= firstSelParaIndex; i--) {
      console.log(`  Remove original para # ${i}`);
      note.removeParagraphAtIndex(i);
    }
  } // globalThis.fileParas = fileParas

  //------------------------------------------------------------------

  async function showMessage(message, confirmTitle = 'OK') {
    return await CommandBar.showOptions([confirmTitle], message);
  } // Show feedback Yes/No Question via Command Bar (@dwertheimer)

  async function showMessageYesNo(message, choicesArray = ['Yes', 'No']) {
    const answer = await CommandBar.showOptions(choicesArray, message);
    return choicesArray[answer.index];
  }
  async function noteOpener(fullPath, desc, useProjNoteByFilename = true) {
    console.log(`\tAbout to open filename: "${fullPath}" (${desc}) using ${useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'}`);
    const newNote = (await useProjNoteByFilename) ? DataStore.projectNoteByFilename(fullPath) : DataStore.noteByFilename(fullPath, 'Notes');

    if (newNote) {
      console.log(`\t\tOpened ${fullPath} (${desc} version) `);
    } else {
      console.log(`\t\tDidn't work! ${useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'} returned ${newNote}`);
    }

    return newNote;
  } // Find a unique note title/filename so backlinks can work properly (@dwertheimer)
  // Keep adding numbers to the end of a filename (if already taken) until it works

  function getUniqueNoteTitle(title) {
    let i = 0,
        res = [],
        newTitle = title;

    while (++i === 1 || res.length > 0) {
      newTitle = i === 1 ? title : `${title} ${i}`;
      res = DataStore.projectNoteByTitle(newTitle, true, false);
    }

    return newTitle;
  }
  async function chooseFolder(msg) {
    let currentFolder;
    const folders = DataStore.folders; // excludes Trash and Archive

    if (folders.length > 0) {
      const re = await CommandBar.showOptions(folders, msg);
      currentFolder = folders[re.index];
    } else {
      // no Folders so go to root
      currentFolder = '/';
    }

    console.log(`\tcurrentFolder=${currentFolder}`);
    return currentFolder;
  }

  // @ flow
  async function newNoteFromSelection() {
    const version = `0.4.0`;
    console.log(`Running v${version}`);
    const {
      selectedLinesText,
      selectedText,
      selectedParagraphs
    } = Editor;
    console.log(`\nnewNoteFromSelection (running v${version}) ${selectedParagraphs.length} selected:`);

    if (selectedLinesText.length && selectedText !== '') {
      // Get title for this note
      console.log(`\t1st Para Type = ${selectedParagraphs[0].type} = "${selectedParagraphs[0].content}"`);
      const isTextContent = ['title', 'text', 'empty'].indexOf(selectedParagraphs[0].type) >= 0;
      const strippedFirstLine = selectedParagraphs[0].content;
      let title = await CommandBar.showInput('Title of new note ([enter] to use text below)', strippedFirstLine); // If user just hit [enter], then use the first line as suggested

      if (!title) {
        title = strippedFirstLine;

        if (isTextContent) {
          selectedLinesText.shift();
        }
      }

      const movedText = selectedLinesText.join('\n');
      const uniqueTitle = getUniqueNoteTitle(title);

      if (title !== uniqueTitle) {
        await showMessage(`Title exists. Using "${uniqueTitle}" instead`);
        title = uniqueTitle;
      }

      const currentFolder = await chooseFolder('Select folder to add note in:');

      if (title) {
        // Create new note in the specific folder
        const origFile = Editor.note.title || Editor.note.filename; // Calendar notes have no title
        // const origFileType = Editor.note.type //either "Notes" or "Calendar"

        console.log(`\torigFile:${origFile}`);
        const filename = (await DataStore.newNote(title, currentFolder)) ?? '';
        console.log(`\tnewNote returned Filename:${filename}`);
        const fullPath = `${currentFolder !== '/' ? `${currentFolder}/` : ''}${filename}`; // This question needs to be here after newNote and before noteOpener
        // to force a cache refresh after newNote. This API bug will eventually be fixed.

        const iblq = await CommandBar.showOptions(['Yes', 'No'], 'Insert link to new file where selection was?');
        const newNote = await noteOpener(fullPath, 'no leading slash');

        if (newNote) {
          console.log(`\tnewNote=${newNote}\n\t${newNote.title}`);
          console.log(`\tcontent=${newNote.content}`);
          const insertBackLink = iblq.index === 0;

          if (Editor.replaceSelectionWithText) {
            // for compatibility, make sure the function exists
            if (insertBackLink) {
              Editor.replaceSelectionWithText(`[[${title}]]`);
            } else {
              Editor.replaceSelectionWithText(``);
            }
          }

          newNote.appendParagraph(movedText, 'empty');

          if (insertBackLink) {
            newNote.appendParagraph(`^^^ Moved from [[${origFile}]]:`, 'text');
          }

          if ((await showMessageYesNo('New Note created. Open it now?')) === 'Yes') {
            await Editor.openNoteByFilename(fullPath);
          }
        } else {
          console.log(`\tCould not open file: "${fullPath}"`);
          showMessage(`\tCould not open file ${fullPath}`);
        }
      } else {
        console.log('\tError: undefined or empty title');
      }
    } else {
      showMessage('No text was selected. Nothing to do.', "OK, I'll try again!");
    }

    console.log('\nnewNoteFromSelection (finished)');
  }
  globalThis.newNoteFromSelection = newNoteFromSelection;

  exports.fileParas = fileParas;
  exports.newNoteFromSelection = newNoteFromSelection;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

}({}));
Object.assign(globalThis, exports)
