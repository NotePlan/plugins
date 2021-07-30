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

  const nowShortDateTime = new Date().toISOString().slice(0, 16);
  new Date().toLocaleString(); // @nmn
  // Note-level Functions

  function printNote(note) {
    if (note == null) {
      console.log('Note not found!');
      return;
    }

    if (note.type === 'Notes') {
      var _note$title, _note$filename, _String, _String2, _note$hashtags$join, _note$hashtags, _note$mentions$join, _note$mentions;

      console.log("title: ".concat((_note$title = note.title) !== null && _note$title !== void 0 ? _note$title : '', "\n\tfilename: ").concat((_note$filename = note.filename) !== null && _note$filename !== void 0 ? _note$filename : '', "\n\tcreated: ").concat((_String = String(note.createdDate)) !== null && _String !== void 0 ? _String : '', "\n\tchanged: ").concat((_String2 = String(note.changedDate)) !== null && _String2 !== void 0 ? _String2 : '', "\n\thashtags: ").concat((_note$hashtags$join = (_note$hashtags = note.hashtags) === null || _note$hashtags === void 0 ? void 0 : _note$hashtags.join(',')) !== null && _note$hashtags$join !== void 0 ? _note$hashtags$join : '', "\n\tmentions: ").concat((_note$mentions$join = (_note$mentions = note.mentions) === null || _note$mentions === void 0 ? void 0 : _note$mentions.join(',')) !== null && _note$mentions$join !== void 0 ? _note$mentions$join : ''));
    } else {
      var _note$filename2, _String3, _String4, _note$hashtags$join2, _note$hashtags2, _note$mentions$join2, _note$mentions2;

      console.log("filename: ".concat((_note$filename2 = note.filename) !== null && _note$filename2 !== void 0 ? _note$filename2 : '', "\n\tcreated: ").concat((_String3 = String(note.createdDate)) !== null && _String3 !== void 0 ? _String3 : '', "\n\tchanged: ").concat((_String4 = String(note.changedDate)) !== null && _String4 !== void 0 ? _String4 : '', "\n\thashtags: ").concat((_note$hashtags$join2 = (_note$hashtags2 = note.hashtags) === null || _note$hashtags2 === void 0 ? void 0 : _note$hashtags2.join(',')) !== null && _note$hashtags$join2 !== void 0 ? _note$hashtags$join2 : '', "\n\tmentions: ").concat((_note$mentions$join2 = (_note$mentions2 = note.mentions) === null || _note$mentions2 === void 0 ? void 0 : _note$mentions2.join(',')) !== null && _note$mentions$join2 !== void 0 ? _note$mentions$join2 : ''));
    }
  }

  function projectNotesSortedByChanged() {
    return DataStore.projectNotes.slice().sort((first, second) => second.changedDate - first.changedDate);
  } // Return list of project notes, sorted by title (ascending)

  function notesInFolderSortedByName(folder) {
    let notesInFolder; // If folder given (not empty) then filter using it

    if (folder !== '') {
      notesInFolder = DataStore.projectNotes.slice().filter(n => getFolderFromFilename(n.filename) === folder);
    } else {
      notesInFolder = DataStore.projectNotes.slice();
    } // Sort alphabetically on note's title


    const notesSortedByName = notesInFolder.sort((first, second) => {
      var _first$title2, _second$title2;

      return ((_first$title2 = first.title) !== null && _first$title2 !== void 0 ? _first$title2 : '').localeCompare((_second$title2 = second.title) !== null && _second$title2 !== void 0 ? _second$title2 : '');
    });
    return notesSortedByName;
  } //-------------------------------------------------------------------------------
  // Misc functions for NP

  const defaultFileExt = DataStore.defaultFileExtension != null ? DataStore.defaultFileExtension : 'md'; // Pretty print range information (@EduardMe)

  function titleAsLink(note) {
    var _note$title2;

    return note.title !== undefined ? "[[".concat((_note$title2 = note.title) !== null && _note$title2 !== void 0 ? _note$title2 : '', "]]") : '(error)';
  } // Get the folder name from the full NP (project) note filename

  function getFolderFromFilename(fullFilename) {
    const filenameParts = fullFilename.split('/'); // console.log(filenameParts)

    return filenameParts.slice(0, filenameParts.length - 1).join('/');
  } // Tests for gFFF function above
  // console.log(`gFFF('one/two/three/four.txt') -> ${getFolderFromFilename('one/two/three/four.txt')}`)
  // console.log(`gFFF('one/two/three/four and a bit.md') -> ${getFolderFromFilename('one/two/three/four and a bit.md')}`)
  // console.log(`gFFF('one/two or three/fifteen.txt') -> ${getFolderFromFilename('one/two or three/fifteen.txt')}`)
  // console.log(`gFFF('/sixes and sevenses/calm one.md') -> ${getFolderFromFilename('sixes and sevenses/calm one.md')}`)

  //--------------------------------------------------------------------------------------------------------------------
  // Command from Eduard to move a note to a different folder

  async function moveNote() {
    const {
      title,
      filename
    } = Editor;

    if (title == null || filename == null) {
      // No note open, so don't do anything.
      console.log('moveNote: warning: No note open.');
      return;
    }

    const selectedFolder = await chooseFolder("Select a folder for '".concat(title, "'"));
    console.log("move ".concat(title, " (filename = ").concat(filename, ") to ").concat(selectedFolder));
    const newFilename = DataStore.moveNote(filename, selectedFolder);

    if (newFilename != null) {
      Editor.openNoteByFilename(newFilename);
      console.log('\tmoving note was successful');
    } else {
      console.log('\tmoving note was NOT successful');
    }
  } //------------------------------------------------------------------
  // Open a user-selected note in a new window.

  async function openNoteNewWindow() {
    // Ask for the note we want to add the task
    const notes = projectNotesSortedByChanged();
    const re = await CommandBar.showOptions(notes.map(n => n.title).filter(Boolean), 'Select note to open in new window');
    const note = notes[re.index];
    const filename = note.filename;
    await Editor.openNoteByFilename(filename, true);
  } //------------------------------------------------------------------
  // Jumps the cursor to the heading of the current note that the user selects
  // NB: need to update to allow this to work with sub-windows, when EM updates API

  async function jumpToHeading() {
    var _Editor;

    const paras = (_Editor = Editor) === null || _Editor === void 0 ? void 0 : _Editor.paragraphs;

    if (paras == null) {
      // No note open
      return;
    } // TODO: it would be a good learning exercise to work out how to combine
    // the following two variables into a single map -> showOptions


    const headingParas = paras.filter(p => p.type === 'title'); // = all headings, not just the top 'title'

    const headingValues = headingParas.map(p => {
      let prefix = '';

      for (let i = 1; i < p.headingLevel; i++) {
        prefix += '    ';
      }

      return "".concat(prefix).concat(p.content);
    }); // Present list of headingValues for user to choose from

    if (headingValues.length > 0) {
      var _headingParas$re$inde, _headingParas$re$inde2;

      const re = await CommandBar.showOptions(headingValues, 'Select heading to jump to:'); // find out position of this heading, ready to set insertion point

      const startPos = (_headingParas$re$inde = (_headingParas$re$inde2 = headingParas[re.index].contentRange) === null || _headingParas$re$inde2 === void 0 ? void 0 : _headingParas$re$inde2.start) !== null && _headingParas$re$inde !== void 0 ? _headingParas$re$inde : 0; // console.log(startPos)

      Editor.renderedSelect(startPos, 0);
      CommandBar.hide(); // shouldn't be needed, but seems to...
      // Editor.select(startPos, 0)
      // Earlier version:
      // Editor.highlight(headingParas[re.index])
    } else {
      console.log('Warning: No headings found in this note');
    }
  } //------------------------------------------------------------------
  // Jumps the cursor to the heading of the current note that the user selects
  // NB: need to update to allow this to work with sub-windows, when EM updates API

  async function jumpToNoteHeading() {
    // first jump to the note of interest, then to the heading
    const notesList = projectNotesSortedByChanged();
    const re = await CommandBar.showOptions(notesList.map(n => {
      var _n$title;

      return (_n$title = n.title) !== null && _n$title !== void 0 ? _n$title : 'untitled';
    }), 'Select note to jump to');
    const note = notesList[re.index]; // Open the note in the Editor

    if (note != null && note.title != null) {
      await Editor.openNoteByTitle(note.title);
    } else {
      console.log("\terror: couldn't open selected note");
      return;
    } // Now jump to the heading


    await jumpToHeading();
  } //------------------------------------------------------------------
  // Jump cursor to the '## Done' heading in the current file
  // NB: need to update to allow this to work with sub-windows, when EM updates API

  function jumpToDone() {
    var _Editor2;

    const paras = (_Editor2 = Editor) === null || _Editor2 === void 0 ? void 0 : _Editor2.paragraphs;

    if (paras == null) {
      // No note open
      return;
    } // Find the 'Done' heading of interest from all the paragraphs


    const matches = paras.filter(p => p.headingLevel === 2).filter(q => q.content.startsWith('Done'));

    if (matches != null) {
      var _matches$0$contentRan, _matches$0$contentRan2;

      const startPos = (_matches$0$contentRan = (_matches$0$contentRan2 = matches[0].contentRange) === null || _matches$0$contentRan2 === void 0 ? void 0 : _matches$0$contentRan2.start) !== null && _matches$0$contentRan !== void 0 ? _matches$0$contentRan : 0;
      Editor.renderedSelect(startPos, 0); // Editor.select(startPos, 0)
      // Earlier version
      // Editor.highlight(p)
    } else {
      console.log("Warning: Couldn't find a '## Done' section");
    }
  } //------------------------------------------------------------------
  // Set the title of a note from YAML, rather than the first line.
  // NOTE: not currently working because of lack of API support yet (as of release 636)
  // TODO: add following back into plugin.json to active this again:
  // {
  //   "name": "Set title from YAML",
  //     "description": "Set the note's title from the YAML or frontmatter block, not the first line",
  //       "jsFunction": "setTitleFromYAML"
  // },

  function setTitleFromYAML() {
    var _note$title;

    const {
      note,
      content
    } = Editor;

    if (note == null || content == null) {
      // no note open.
      return;
    }

    console.log("setTitleFromYAML:\n\told title = ".concat((_note$title = note.title) !== null && _note$title !== void 0 ? _note$title : ''));
    const lines = content.split('\n');
    let n = 0;
    let newTitle = '';

    while (n < lines.length) {
      if (lines[n].match(/^[Tt]itle:\s*.*/)) {
        var _rer$;

        const rer = lines[n].match(/^[Tt]itle:\s*(.*)/);
        newTitle = (_rer$ = rer === null || rer === void 0 ? void 0 : rer[1]) !== null && _rer$ !== void 0 ? _rer$ : '';
      }

      if (lines[n] === '' || lines[n] === '...') {
        break;
      }

      n += 1;
    }

    console.log("\tnew title = ".concat(newTitle));

    if (newTitle !== '') {
      note.title = newTitle; // TODO: when setter available
    }

    printNote(note);
  }

  //--------------------------------------------------------------------------------------------------------------------
  // Command to calculate the index of a specified folder.
  // Input is folder name (without trailling /)
  // Returns an array of strings, one for each output line.

  function makeFolderIndex(folder, includeSubfolders) {
    console.log("\nmakeFolderIndex for '".concat(folder, "' (").concat(includeSubfolders ? 'with' : 'without', " subfolders)"));
    let noteCount = 0;
    const outputArray = [];
    let folderList = []; // if we want a to include any subfolders, create list of folders

    if (includeSubfolders) {
      folderList = DataStore.folders.filter(f => f.startsWith(folder));
    } else {
      // otherwise use a single folder
      folderList = [folder];
    }

    console.log("\tFound ".concat(folderList.length, " matching folder(s)")); // Iterate over the folders
    // A for-of loop is cleaner and less error prone than a regular for-loop

    for (const f of folderList) {
      const notes = notesInFolderSortedByName(f); // console.log(notes.length)

      if (notes.length > 0) {
        // If this is a sub-folder level, then prefix with ### for a 3rd level heading,
        // otherwise leave blank, as a suitable header gets added elsewhere.
        outputArray.push(noteCount > 0 ? "### ".concat(f, " Index") : "_index ".concat(f));
        outputArray.push("(".concat(notes.length, " notes, last updated: ").concat(nowShortDateTime, ")")); // iterate over this folder's notes

        for (const note of notes) {
          outputArray.push(titleAsLink(note));
        }

        outputArray.push('');
        noteCount += notes.length;
      }
    }

    return outputArray;
  } //----------------------------------------------------------------
  // Command to index folders, creating list of note links
  // Options:
  // 1. This folder only (insert into current note)
  // 2. This folder only (add/update to _index note)
  // 3. This folder + subfolders (add/update into single _index note)
  // 4. TODO: This folder + subfolders (add/update into _index notes in each subfolder)


  async function indexFolders() {
    var _Editor$filename;

    // To start with just operate on current note's folder
    const fullFilename = (_Editor$filename = Editor.filename) !== null && _Editor$filename !== void 0 ? _Editor$filename : undefined; // const currentNote = Editor.note ?? undefined

    let thisFolder;
    let outputArray = [];

    if (fullFilename === undefined) {
      console.log("  Info: No current filename (and therefore folder) found, so will ask instead.");
      thisFolder = await chooseFolder("Please pick folder to index");
    } else {
      thisFolder = getFolderFromFilename(fullFilename);
    }

    console.log("\nindexFolders from folder ".concat(thisFolder));
    const option = await chooseOption('Create index for which folder(s)?', [{
      label: "This folder only (insert into current note)",
      value: 'one-to-current'
    }, {
      label: "This folder only (add/update to _index note)",
      value: 'one-to-index'
    }, {
      label: "This folder and sub-folders (add/update to single _index note)",
      value: 'all-to-one-index'
    }, {
      label: "(NOT YET WORKING) This folder and sub-folders (add/update to _index notes)",
      value: 'all-to-many-index'
    }, {
      label: '❌ Cancel',
      value: false
    }], false);

    if (!option) {
      return;
    }

    console.log("  option: ".concat(option));

    if (option.startsWith('one')) {
      outputArray = makeFolderIndex(thisFolder, false);
    } else if (option.startsWith('all')) {
      outputArray = makeFolderIndex(thisFolder, true);
    }

    const outString = outputArray.join('\n');
    console.log("  -> ".concat(outString));

    if (option.endsWith('index')) {
      // write out to index file(s)
      let outputFilename = "".concat(thisFolder, "/_index.").concat(defaultFileExt); // see if we already have an _index file in this folder

      let outputNote = DataStore.projectNoteByFilename(outputFilename);

      if (outputNote == null) {
        // make a new note for this
        outputFilename = await DataStore.newNote('_index', thisFolder);
        console.log("\tnewNote filename: ".concat(String(outputFilename))); // outputFilename = `${pref_folderToStore}/${String(outputFilename)}` ?? '(error)'
        // NB: filename here = folder + filename

        if (outputFilename == null) {
          return;
        }

        outputNote = await DataStore.projectNoteByFilename(outputFilename);
        console.log("\twriting results to the new note '".concat(outputFilename, "'"));
      }

      if (outputNote != null) {
        outputNote.content = "# ".concat(outString); // overwrite what was there before
      } else {
        console.log('error after newNote(): no valid note to write to');
        return;
      }
    } else if (option.endsWith('current')) {
      // write out to the current file
      Editor.insertTextAtCursor("".concat(outString));
    }

    console.log("\nFinished indexFolders.");
  }

  exports.indexFolders = indexFolders;
  exports.jumpToDone = jumpToDone;
  exports.jumpToHeading = jumpToHeading;
  exports.jumpToNoteHeading = jumpToNoteHeading;
  exports.moveNote = moveNote;
  exports.openNoteNewWindow = openNoteNewWindow;
  exports.setTitleFromYAML = setTitleFromYAML;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

}({}));
Object.assign(globalThis, exports)
