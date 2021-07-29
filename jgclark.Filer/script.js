var exports = (function (exports) {
  'use strict';

  //-------------------------------------------------------------------------------
  // Input functions
  // (from @nmn / nmn.sweep)
  // (from @nmn / nmn.sweep)
  async function chooseOption(title, options, defaultValue) {
    var _options$index$value, _options$index;

    const {
      index
    } = await CommandBar.showOptions(options.map(option => option.label), title);
    return (_options$index$value = (_options$index = options[index]) === null || _options$index === void 0 ? void 0 : _options$index.value) !== null && _options$index$value !== void 0 ? _options$index$value : defaultValue;
  } // (from @nmn / nmn.sweep)
  /**
   * Show a single-button dialog-box like message (modal) using CommandBar
   * @author @dwertheimer, updating @nmn
   * @param {string} message - text to display to user
   * @param {string} confirmTitle - the "button" (option) text (default: 'OK')
   */

  async function showMessage(message, confirmTitle = 'OK') {
    await CommandBar.showOptions([confirmTitle], message);
  }
  /**
   * Helper function to show a simple yes/no (could be OK/Cancel, etc.) dialog using CommandBar
   * @param {string} message - text to display to user
   * @param {Array<string>} - an array of the choices to give (default: ['Yes', 'No'])
   * @returns {string} - returns the user's choice - the actual *text* choice from the input array provided
   */

  async function showMessageYesNo(message, choicesArray = ['Yes', 'No']) {
    const answer = await CommandBar.showOptions(choicesArray, message);
    return choicesArray[answer.index];
  }
  /**
   * Let user pick from a nicely-indented list of available folders (or return / for root)
   * @author @jgclark
   * @param {string} message - text to display to user
   * @returns {string} - returns the user's folder choice (or / for root)
   */

  async function chooseFolder(msg) {
    let folder;
    const folders = DataStore.folders; // excludes Trash and Archive

    if (folders.length > 0) {
      // make a slightly fancy list with indented labels, different from plain values
      const folderOptionList = [];

      for (const f of folders) {
        if (f !== '/') {
          const folderParts = f.split('/');

          for (let i = 0; i < folderParts.length - 1; i++) {
            folderParts[i] = '     ';
          }

          folderParts[folderParts.length - 1] = "\uD83D\uDCC1 ".concat(folderParts[folderParts.length - 1]);
          const folderLabel = folderParts.join('');
          console.log(folderLabel);
          folderOptionList.push({
            label: folderLabel,
            value: f
          });
        } else {
          // deal with special case for root folder
          folderOptionList.push({
            label: '📁 /',
            value: '/'
          });
        }
      } // const re = await CommandBar.showOptions(folders, msg)


      const re = await chooseOption(msg, folderOptionList, '/');
      folder = re;
    } else {
      // no Folders so go to root
      folder = '/';
    }

    console.log("\tfolder=".concat(folder));
    return folder;
  } //-------------------------------------------------------------------------------

  new Date().toISOString().slice(0, 10); // TODO: make a friendlier string

  new Date().toISOString().slice(0, 16);
  new Date().toLocaleString(); // @nmn

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
  function hyphenatedDate(dateObj) {
    const {
      year,
      month,
      date
    } = getYearMonthDate(dateObj);
    return "".concat(year, "-").concat(month < 10 ? '0' : '').concat(month, "-").concat(date < 10 ? '0' : '').concat(date);
  }
  // console.log(`\ntesting relativeDate`)
  // console.log(`-14 -> ${relativeDateFromNumber(-14)}`)
  // console.log(`-7 -> ${relativeDateFromNumber(-7)}`)
  // console.log(`-2 -> ${relativeDateFromNumber(-2)}`)
  // console.log(`-1 -> ${relativeDateFromNumber(-1)}`)
  // console.log(`0 -> ${relativeDateFromNumber(0)}`)
  // console.log(`1 -> ${relativeDateFromNumber(1)}`)
  // console.log(`2 -> ${relativeDateFromNumber(2)}`)
  // console.log(`7 -> ${relativeDateFromNumber(7)}`)
  // console.log(`14 -> ${relativeDateFromNumber(14)}`)
  // console.log(`29 -> ${relativeDateFromNumber(29)}`)
  // console.log(`30 -> ${relativeDateFromNumber(30)}`)
  // console.log(`31 -> ${relativeDateFromNumber(31)}`)
  // console.log(`123 -> ${relativeDateFromNumber(123)}`)
  // console.log(`264 -> ${relativeDateFromNumber(264)}`)
  // console.log(`364 -> ${relativeDateFromNumber(364)}`)
  // console.log(`365 -> ${relativeDateFromNumber(365)}`)
  // console.log(`366 -> ${relativeDateFromNumber(366)}`)
  //-------------------------------------------------------------------------------
  // Paragraph-level Functions
  // Convert paragraph(s) to single raw text string

  function parasToText(paras) {
    // console.log('parasToText: starting with ' + paras.length + ' paragraphs')
    let text = '';

    for (let i = 0; i < paras.length; i++) {
      const p = paras[i]; // paraDetails(p)

      text += "".concat(p.rawContent, "\n");
    }

    const parasAsText = text.trimEnd(); // remove extra newline not wanted after last line

    return parasAsText;
  }
  /**
   * Works out which line to insert at top of file. Rather than just after title line,
   * go after any YAML frontmatter or a metadata line (= starts with a hashtag).
   * @author @jgclark
   * @param {TNote} note - the note of interest
   * @return {number} line - the calculated line to insert/prepend at
   */

  function calcSmartPrependPoint(note) {
    var _note$content$split, _note$content;

    const lines = (_note$content$split = (_note$content = note.content) === null || _note$content === void 0 ? void 0 : _note$content.split('\n')) !== null && _note$content$split !== void 0 ? _note$content$split : ['']; // By default we prepend at line 1, i.e. right after the Title line

    let insertionLine = 1; // If we have any content, check for these special cases

    if (lines.length > 0) {
      if (lines[0] === '---') {
        // console.log(`YAML start found. Will check ${lines.length} lines`)
        // We (probably) have a YAML block
        // Find end of YAML/frontmatter
        // TODO(@jgclark): check my ruby code to see what I did here
        for (let i = 1; i < lines.length; i++) {
          if (lines[i] === '---' || lines[i] === '...') {
            // console.log(`YAML end at ${i}`)
            insertionLine = i + 1;
            break;
          }
        }

        if (insertionLine === 1) {
          // If we get here we haven't found an end to the YAML block.
          console.log("Warning: couldn't find end of YAML frontmatter in note ".concat(displayTitle(note))); // It's not clear what to do at this point, so will leave insertion point as is
        }
      } else if (lines[1].match(/^#[A-z]/)) {
        // We have a hashtag at the start of the line, making this a metadata line
        // Move insertion point to after the next blank line, or before the next 
        // heading line, whichever is sooner.
        // console.log(`Metadata line found`)
        for (let i = 2; i < lines.length; i++) {
          // console.log(`${i}: ${lines[i]}`)
          if (lines[i].match(/^#{1,5}\s/)) {
            // console.log(`  Heading at ${i}`)
            insertionLine = i + 1;
            break;
          } else if (lines[i] === '') {
            // console.log(`  Blank line at ${i}`)
            insertionLine = i + 1;
            break;
          }
        }
      }
    } // Return the smarter insertionLine number


    return insertionLine;
  }
  /**
   * Open a note using whatever method works (open by title, filename, etc.)
   * Note: this function was used to debug/work-around API limitations. Probably not necessary anymore
   * Leaving it here for the moment in case any plugins are still using it
   * @author @dwertheimer
   * @param {string} fullPath
   * @param {string} desc
   * @param {boolean} useProjNoteByFilename (default: true)
   * @returns {any} - the note that was opened
   */

  async function noteOpener(fullPath, desc, useProjNoteByFilename = true) {
    console.log("\tAbout to open filename: \"".concat(fullPath, "\" (").concat(desc, ") using ").concat(useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'));
    const newNote = useProjNoteByFilename ? await DataStore.projectNoteByFilename(fullPath) : await DataStore.noteByFilename(fullPath, 'Notes');

    if (newNote != null) {
      console.log("\t\tOpened ".concat(fullPath, " (").concat(desc, " version) "));
      return newNote;
    } else {
      console.log("\t\tDidn't work! ".concat(useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename', " returned ").concat(newNote));
    }
  }
  /**
   * Find a unique note title for the given text (e.g. "Title", "Title 01" (if Title exists, etc.))
   * Keep adding numbers to the end of a filename (if already taken) until it works
   * @author @dwertheimer
   * @param {string} title - the name of the file
   * @returns {string} the title (not filename) that was created
   */

  function getUniqueNoteTitle(title) {
    let i = 0,
        res = [],
        newTitle = title;

    while (++i === 1 || res.length > 0) {
      newTitle = i === 1 ? title : "".concat(title, " ").concat(i);
      res = DataStore.projectNoteByTitle(newTitle, true, false);
    }

    return newTitle;
  } // Return list of all notes, sorted by changed date (newest to oldest)

  function allNotesSortedByChanged() {
    const projectNotes = DataStore.projectNotes.slice();
    const calendarNotes = DataStore.calendarNotes.slice();
    const allNotes = projectNotes.concat(calendarNotes);
    const allNotesSorted = allNotes.sort((first, second) => second.changedDate - first.changedDate); // most recent first

    return allNotesSorted;
  } // Return list of calendar notes, sorted by changed date (newest to oldest)
  // Misc functions for NP

  DataStore.defaultFileExtension != null ? DataStore.defaultFileExtension : 'md'; // Pretty print range information (@EduardMe)
  // (@jgclark)

  function displayTitle(n) {
    if (n.type === 'Calendar' && n.date != null) {
      return hyphenatedDate(n.date);
    } else {
      var _n$title;

      return (_n$title = n.title) !== null && _n$title !== void 0 ? _n$title : '';
    }
  }

  // -----------------------------------------------------------------------------

  /**
   * identify what we're moving (in priority order):
   * - current selection
   * - current heading + its following section
   * - current line
   * - current line (plus any indented paragraphs)
   * @author @jgclark
   */

  async function fileParas() {
    var _noteToMoveTo$title, _noteToMoveTo$title2;

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

    console.log("\nfileParse: selection ".concat(JSON.stringify(range))); // Work out what paragraph number this selected para is

    let firstSelParaIndex = 0;

    for (let i = 0; i < allParas.length; i++) {
      var _p$contentRange;

      const p = allParas[i];

      if (((_p$contentRange = p.contentRange) === null || _p$contentRange === void 0 ? void 0 : _p$contentRange.start) === range.start) {
        firstSelParaIndex = i;
        break;
      }
    }

    console.log("  First para index: ".concat(firstSelParaIndex));
    let parasToMove = [];

    if (selectedParagraphs.length > 1) {
      // we have a selection of paragraphs, so use them
      parasToMove = [...selectedParagraphs];
      console.log("  Found ".concat(parasToMove.length, " selected paras"));
    } else {
      // we have just one paragraph selected -- the current one
      const para = selectedParagraphs[0]; // paraDetails(para)

      console.log("  Para '".concat(para.content, "' type: ").concat(para.type, ", index: ").concat(firstSelParaIndex)); // if this is a heading, find the rest of the sections

      if (para.type === 'title') {
        // includes all heading levels
        const thisHeadingLevel = para.headingLevel;
        console.log("  Found heading level ".concat(thisHeadingLevel));
        parasToMove.push(para); // make this the first line to move
        // Work out how far this section extends. (NB: headingRange doesn't help us here.)

        for (let i = firstSelParaIndex + 1; i < allParas.length; i++) {
          const p = allParas[i];

          if (p.type === 'title' && p.headingLevel <= thisHeadingLevel) {
            break;
          } // stop as new heading of same or higher level


          parasToMove.push(p);
        }

        console.log("  Found ".concat(parasToMove.length, " heading section lines"));
      } else {
        // This isn't a heading.
        // Now see if there are following indented lines to move as well
        const startingIndentLevel = para.indents;
        console.log("  Found single line with indent level ".concat(startingIndentLevel));
        parasToMove.push(para);

        for (let i = firstSelParaIndex + 1; i < allParas.length; i++) {
          const p = allParas[i];

          if (p.indents <= startingIndentLevel) {
            // stop as this para is same or less indented than the starting line
            break;
          }

          parasToMove.push(p);
        }

        console.log("  Found ".concat(parasToMove.length - 1, " indented paras"));
      }
    } // If this is a calendar note we've moving from, and the user wants to
    // create a date backlink, then append backlink to the first para in parasToMove


    if (note.type === 'Calendar') {
      const todaysDate = new Date().toISOString().slice(0, 10);
      parasToMove[0].content = "".concat(parasToMove[0].content, " >").concat(todaysDate);
    } // There's no API function to work on multiple paragraphs,
    // or one to insert an indented paragraph, so we need to convert the paragraphs
    // to a raw text version which we can include


    const parasAsText = parasToText(parasToMove); // Decide where to move to
    // Ask for the note we want to add the paras

    const notes = allNotesSortedByChanged();
    let res = await CommandBar.showOptions(notes.map(n => {
      var _n$title;

      return (_n$title = n.title) !== null && _n$title !== void 0 ? _n$title : 'untitled';
    }), "Select note to move ".concat(parasToMove.length, " lines to"));
    const noteToMoveTo = notes[res.index];
    console.log("  Moving to note: ".concat((_noteToMoveTo$title = noteToMoveTo.title) !== null && _noteToMoveTo$title !== void 0 ? _noteToMoveTo$title : 'untitled')); // ask to which heading to add the paras

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
    } // Ensure we can always add at top and bottom of note


    headingStrings.unshift('(top of note)'); // add at start

    headingStrings.push('(bottom of note)'); // add at end

    res = await CommandBar.showOptions(headingStrings, "Select a heading from note '".concat((_noteToMoveTo$title2 = noteToMoveTo.title) !== null && _noteToMoveTo$title2 !== void 0 ? _noteToMoveTo$title2 : 'Untitled', "' to move after"));
    const headingToFind = headingStrings[res.index].trim();
    console.log("    under heading: ".concat(headingToFind)); // Add to new location
    // Currently there's no API function to deal with multiple paragraphs, but we can
    // insert a raw text string
    // Add text directly under the heading in the note
    // note.addParagraphBelowHeadingTitle(parasToMove, 'empty', heading.content, false, false);

    const destParas = noteToMoveTo.paragraphs;
    let insertionIndex = null;

    if (headingToFind === '(top of note)') {
      insertionIndex = calcSmartPrependPoint(noteToMoveTo);
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

    console.log("  Inserting at index ".concat(insertionIndex));
    await noteToMoveTo.insertParagraph(parasAsText, insertionIndex, 'empty'); // delete from existing location

    console.log("  About to remove ".concat(parasToMove.length, " paras (parasToMove)"));
    note.removeParagraphs(parasToMove);
  }

  //------------------------------------------------------------------
  async function newNoteFromSelection() {
    const version = "0.4.1";
    const {
      selectedLinesText,
      selectedText,
      selectedParagraphs,
      note
    } = Editor;

    if (note != null && selectedLinesText.length && selectedText !== '') {
      console.log("\nnewNoteFromSelection (running v".concat(version, ") ").concat(selectedParagraphs.length, " selected:")); // console.log(
      //   `\t1st Para Type = ${selectedParagraphs[0].type} = "${selectedParagraphs[0].content}"`,
      // )
      // Get title for this note

      const isTextContent = ['title', 'text', 'empty'].indexOf(selectedParagraphs[0].type) >= 0;
      const strippedFirstLine = selectedParagraphs[0].content;
      let title = await CommandBar.showInput('Title of new note ([enter] to use text below)', strippedFirstLine); // If user just hit [enter], then use the first line as suggested

      if (!title) {
        title = strippedFirstLine;

        if (isTextContent) {
          // the types don't allow you to mutate selectedLinesText. Should this change?
          // $FlowFixMe
          selectedLinesText.shift();
        }
      }

      const movedText = selectedLinesText.join('\n');
      const uniqueTitle = getUniqueNoteTitle(title);

      if (title !== uniqueTitle) {
        await showMessage("Title exists. Using \"".concat(uniqueTitle, "\" instead"));
        title = uniqueTitle;
      }

      const currentFolder = await chooseFolder('Select folder to add note in:');

      if (title) {
        var _await$DataStore$newN;

        // Create new note in the specific folder
        const origFile = displayTitle(note); // Calendar notes have no title, so need to make one

        console.log("\torigFile: ".concat(origFile));
        const filename = (_await$DataStore$newN = await DataStore.newNote(title, currentFolder)) !== null && _await$DataStore$newN !== void 0 ? _await$DataStore$newN : '';
        console.log("\tnewNote() -> filename: ".concat(filename)); // The following was duplicating the path, in at least some cases. Removed all fullPath references ...
        // const fullPath = `${
        //   currentFolder !== '/' ? `${currentFolder}/` : ''
        // }${filename}`
        // This question needs to be here after newNote and before noteOpener
        // to force a cache refresh after newNote. This API bug will eventually be fixed.

        const iblq = await CommandBar.showOptions(['Yes', 'No'], 'Insert link to new file where selection was?'); // const newNote = await noteOpener(fullPath, 'no leading slash')

        const newNote = await noteOpener(filename, 'using filename');

        if (newNote) {
          console.log("\tnewNote's title: ".concat(String(newNote.title)));
          console.log("\tnewNote's content: ".concat(String(newNote.content), " ..."));
          const insertBackLink = iblq.index === 0;

          if (Editor.replaceSelectionWithText) {
            // for compatibility, make sure the function exists
            if (insertBackLink) {
              Editor.replaceSelectionWithText("[[".concat(title, "]]"));
            } else {
              Editor.replaceSelectionWithText("");
            }
          }

          newNote.appendParagraph(movedText, 'empty');

          if (insertBackLink) {
            newNote.appendParagraph("^^^ Moved from [[".concat(origFile, "]]:"), 'text');
          }

          if ((await showMessageYesNo('New Note created. Open it now?')) === 'Yes') {
            // await Editor.openNoteByFilename(fullPath)
            await Editor.openNoteByFilename(filename);
          }
        } else {
          // console.log(`\tCould not open file: "${fullPath}"`)
          // showMessage(`\tCould not open file ${fullPath}`)
          console.log("\tCould not open new note: ".concat(filename));
          showMessage("Could not open new note ".concat(filename));
        }
      } else {
        console.log('\tError: undefined or empty title');
      }
    } else {
      console.log('\tNo text was selected, so nothing to do.');
      showMessage('No text was selected, so nothing to do.', "OK, I'll try again!");
    }

    console.log('newNoteFromSelection (finished)');
  }
  globalThis.newNoteFromSelection = newNoteFromSelection;

  exports.fileParas = fileParas;
  exports.newNoteFromSelection = newNoteFromSelection;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

}({}));
Object.assign(globalThis, exports)
