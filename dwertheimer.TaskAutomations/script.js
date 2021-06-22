var exports = (function (exports) {
  'use strict';

  // @ flow
  //--------------------------------------------------------------------------------------------------------------------
  // Note Helpers plugin for NotePlan
  // Jonathan Clark & Eduard Metzger
  // /nns by @dwertheimer
  // v0.9.2, 1.6.2021
  //--------------------------------------------------------------------------------------------------------------------
  // Globals
  // eslint-disable-next-line no-unused-vars
  new Date().toISOString().slice(0, 10); // eslint-disable-next-line no-unused-vars

  DataStore.preference('defaultTodoCharacter') !== undefined ? DataStore.preference('defaultTodoCharacter') : '*'; //------------------------------------------------------------------
  // Helper functions
  //------------------------------------------------------------------

  function printNote(note) {
    if (note == null) {
      console.log('Note not found!');
      return;
    }

    if (note.type === 'Notes') {
      console.log(`title: ${note.title ?? ''}\n\tfilename: ${note.filename ?? ''}\n\thashtags: ${note.hashtags?.join(',') ?? ''}\n\tmentions: ${note.mentions?.join(',') ?? ''}\n\tcreated: ${String(note.createdDate) ?? ''}\n\tchanged: ${String(note.changedDate) ?? ''}`);
    } else {
      console.log(`date: ${String(note.createdDate) ?? ''}\n\tfilename: ${note.filename ?? ''}\n\thashtags: ${note.hashtags?.join(',') ?? ''}\n\tmentions: ${note.mentions?.join(',') ?? ''}`);
    }
  }

  async function selectFolder() {
    if (Editor.type === 'Notes') {
      // [String] list of options, placeholder text, callback function with selection
      const folder = await CommandBar.showOptions(DataStore.folders, `Select new folder for '${Editor.title ?? ''}'`);
      moveNote(folder.value);
    } else {
      console.log("\tWarning: I can't move calendar notes.");
      CommandBar.hide();
    }
  }

  globalThis.selectFolder = selectFolder; // Show feedback message using Command Bar (@dwertheimer)

  async function showMessage(message, confirmTitle = 'OK') {
    return await CommandBar.showOptions([confirmTitle], message);
  } // Show feedback Yes/No Question via Command Bar (@dwertheimer)

  async function showMessageYesNo(message, choicesArray = ['Yes', 'No']) {
    const answer = await CommandBar.showOptions(choicesArray, message);
    return choicesArray[answer.index];
  } // Find a unique note title/filename so backlinks can work properly (@dwertheimer)

  function getUniqueNoteTitle(title) {
    let i = 0,
        res = [],
        newTitle = title;

    while (++i === 1 || res.length > 0) {
      newTitle = i === 1 ? title : `${title} ${i}`;
      res = DataStore.projectNoteByTitle(newTitle, true, false);
    }

    return newTitle;
  } //------------------------------------------------------------------
  // Command from Eduard to move a note to a different folder


  function moveNote(selectedFolder) {
    const {
      title,
      filename
    } = Editor;

    if (title == null || filename == null) {
      // No note open, so don't do anything.
      console.log('moveNote: warning: No note open.');
      return;
    }

    console.log(`move ${title} (filename = ${filename}) to ${selectedFolder}`);
    const newFilename = DataStore.moveNote(filename, selectedFolder);

    if (newFilename != null) {
      Editor.openNoteByFilename(newFilename);
      console.log('\tmoving note was successful');
    } else {
      console.log('\tmoving note was NOT successful');
    }
  } //------------------------------------------------------------------
  // Jumps the cursor to the heading of the current note that the user selects
  // NB: need to update to allow this to work with sub-windows, when EM updates API


  async function jumpToHeading() {
    const paras = Editor?.paragraphs;

    if (paras == null) {
      // No note open
      return;
    }

    const headingParas = paras.filter(p => p.type === 'title'); // = all headings, not just the top 'title'

    const headingValues = headingParas.map(p => {
      let prefix = '';

      for (let i = 1; i < p.headingLevel; i++) {
        prefix += '    ';
      }

      return prefix + p.content;
    }); // Present list of headingValues for user to choose from

    if (headingValues.length > 0) {
      const re = await CommandBar.showOptions(headingValues, 'Select heading to jump to:');
      Editor.highlight(headingParas[re.index]);
    } else {
      console.log('Warning: No headings found in this note');
    }
  }

  globalThis.jumpToHeading = jumpToHeading; //------------------------------------------------------------------
  // Jump cursor to the '## Done' heading in the current file
  // NB: need to update to allow this to work with sub-windows, when EM updates API

  function jumpToDone() {
    const paras = Editor?.paragraphs;

    if (paras == null) {
      // No note open
      return;
    }

    const paraCount = paras.length; // Find the line of interest from all the paragraphs

    for (let i = 0; i < paraCount; i++) {
      const p = paras[i];

      if ((p.content === 'Done' || p.content === 'Done …') && p.headingLevel === 2) {
        // jump cursor to that paragraph
        Editor.highlight(p);
        break;
      }
    }

    console.log("Warning: Couldn't find a ## Done section");
  }

  globalThis.jumpToDone = jumpToDone; //------------------------------------------------------------------
  // Set the title of a note from YAML, rather than the first line.
  // NOTE: not currently working because of lack of API support yet (as of release 628)
  // TODO: add following back into plugin.json to active this again:
  // {
  //   "name": "Set title from YAML",
  //     "description": "Set the note's title from the YAML or frontmatter block, not the first line",
  //       "jsFunction": "setTitleFromYAML"
  // },

  function setTitleFromYAML() {
    const {
      note,
      content
    } = Editor;

    if (note == null || content == null) {
      // no note open.
      return;
    }

    console.log(`setTitleFromYAML:\n\told title = ${note.title ?? ''}`);
    const lines = content.split('\n');
    let n = 0;
    let newTitle = '';

    while (n < lines.length) {
      if (lines[n].match(/^[Tt]itle:\s*.*/)) {
        const rer = lines[n].match(/^[Tt]itle:\s*(.*)/);
        newTitle = rer?.[1] ?? '';
      }

      if (lines[n] === '' || lines[n] === '...') {
        break;
      }

      n += 1;
    }

    console.log(`\tnew title = ${newTitle}`);

    if (newTitle !== '') {
      note.title = newTitle; // TODO: setter not available not yet available (last checked on release 628)
    }

    printNote(Editor.note);
  }

  globalThis.setTitleFromYAML = setTitleFromYAML; // Start Testing/debugging here

  async function noteOpener(fullPath, desc, useProjNoteByFilename = true) {
    console.log(`\tAbout to open filename: "${fullPath}" (${desc}) using ${useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'}`);
    const newNote = (await useProjNoteByFilename) ? DataStore.projectNoteByFilename(fullPath) : DataStore.noteByFilename(fullPath, 'Notes');

    if (newNote) {
      console.log(`\t\tWorked! ${fullPath} (${desc} version) `);
    } else {
      console.log(`\t\tDidn't work! ${useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'} returned ${newNote}`);
    }

    return newNote;
  } //------------------------------------------------------------------
  // @dwertheimer based on @jgclark's newNote
  // Create new note from currently selected text
  // and (optionally) leave backlink to it where selection was


  async function newNoteFromSelection() {
    const version = `0.9.2`;
    console.log(`Running v${version}`);
    const {
      selectedLinesText,
      selectedText,
      selectedParagraphs
    } = Editor;
    console.log(`\nnewNoteFromSelection (running v${version}) ${selectedParagraphs.length} selected:`);
    let currentFolder = '';

    if (selectedLinesText.length && selectedText !== '') {
      // Get title for this note
      console.log(`\t1st Para Type = ${selectedParagraphs[0].type} = "${selectedParagraphs[0].content}"`); // const stripHashes = /^\s*(#)* *(.*)/
      // const firstLineArray = stripHashes.exec(selectedLinesText[0])
      // const strippedFirstLine =
      //   firstLineArray.length === 3 ? firstLineArray[2] : ''

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

      const folders = DataStore.folders; // excludes Trash and Archive

      if (folders.length > 0) {
        const re = await CommandBar.showOptions(folders, 'Select folder to add note in:');
        currentFolder = folders[re.index];
      } else {
        // no Folders so go to root
        currentFolder = '/';
      }

      console.log(`\tcurrentFolder=${currentFolder}`);

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

  // File from nmn.sweep
  // edited by dbw to add functions
  function getYearMonthDate(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const date = dateObj.getDate();
    return {
      year,
      month,
      date
    };
  }
  function hyphenatedDateString(dateObj) {
    const {
      year,
      month,
      date
    } = getYearMonthDate(dateObj);
    return `${year}-${month < 10 ? '0' : ''}${month}-${date < 10 ? '0' : ''}${date}`;
  }

  /* eslint-disable max-len */
  const HASHTAGS = /\B#([a-zA-Z0-9]+\b)/g;
  const MENTIONS = /\B@([a-zA-Z0-9]+\b)/g;
  const EXCLAMATIONS = /\B(!+\B)/g;
  const PARENS_PRIORITY = /^\s*\(([a-zA-z])\)\B/g; // must be at start of content

  const TASK_TYPES = ['open', 'scheduled', 'done', 'cancelled'];

  function getElementsFromTask(content, reSearch) {
    const found = [];
    let matches = reSearch.exec(content);

    do {
      if (matches?.length > 1) {
        found.push(matches[1].trim());
      }
    } while ((matches = reSearch.exec(content)) !== null);

    return found;
  }
  /*
   * Get numeric priority level based on !!! or (B)
   */


  function getNumericPriority(item) {
    let prio = -1;

    if (item.exclamations[0]) {
      prio = item.exclamations[0].length;
    } else if (item.parensPriority[0]) {
      prio = item.parensPriority[0].charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    } else {
      prio = -1;
    }

    return prio;
  } // is value an array? if so, return its first value in lowercase for sorting


  const ia = val => {
    const retVal = Array.isArray(val) ? val[0] : val;
    return typeof retVal === 'string' ? retVal.toLowerCase() : retVal;
  };
  /*
   * Multi-key sorting
   * @param field list - property array
   * @example const sortedHomes = homes.sort(fieldSorter(['state', '-price'])); //the - in front of name is DESC
   */


  const fieldSorter = fields => (a, b) => fields.map(o => {
    let dir = 1;

    if (o[0] === '-') {
      dir = -1;
      o = o.substring(1);
    }

    if (ia(a[o]) === undefined) return dir;
    if (ia(b[o]) === undefined) return -dir;
    return ia(a[o]) > ia(b[o]) ? dir : ia(a[o]) < ia(b[o]) ? -dir : 0;
  }).reduce((p, n) => p ? p : n, 0);
  /*
   * @param array of task items
   * @param pass in field names to sort by -- either a single string or an array of strings/sort-order
   * @return the sorted task list
   */


  function sortListBy(list, fields) {
    const sortBy = typeof fields === 'string' ? [fields] : fields;
    list.sort(fieldSorter(sortBy)); // console.log('** LIST AFTER fieldSorter SORT:')
    // console.log(JSON.stringify(list))

    return list; // return list.sort(fieldSorterOptimized(sortBy))
  } // Note: nmn.sweep limits how far back you look with: && hyphenatedDateString(p.date) >= afterHyphenatedDate,
  /*
   * @param Paragraphs array
   * @return tasks object of tasks by type {'open':[], 'scheduled'[], 'done':[], 'cancelled':[]}
   */

  function getTasksByType(paragraphs) {
    const tasks = {}; // * @type {"open", "done", "scheduled", "cancelled", "title", "quote", "list" (= bullet), "empty" (no content) or "text" (= plain text)}

    TASK_TYPES.forEach(t => tasks[t] = []);
    paragraphs.forEach((para, index) => {
      if (TASK_TYPES.indexOf(para.type) >= 0) {
        const content = para.content; // console.log(`${index}: ${para.type}: ${para.content}`)

        try {
          const hashtags = getElementsFromTask(content, HASHTAGS);
          const mentions = getElementsFromTask(content, MENTIONS);
          const exclamations = getElementsFromTask(content, EXCLAMATIONS);
          const parensPriority = getElementsFromTask(content, PARENS_PRIORITY);
          const task = {
            content: para.content,
            index,
            raw: para.rawContent,
            hashtags,
            mentions,
            exclamations,
            parensPriority
          };
          task.priority = getNumericPriority(task);
          tasks[para.type].push(task);
        } catch (error) {
          console.log(error, para.content, index);
        }
      }
    });
    console.log(`Tasks:${tasks.open.length} returning from getTasksByType`);
    return tasks;
  }

  /* eslint-disable no-unused-vars */
  const SORT_ORDERS = [{
    sortFields: ['-priority', 'content'],
    name: 'Priority (!!! and (A))'
  }, {
    sortFields: ['mentions', '-priority', 'content'],
    name: 'By first @Person in task, then by priority'
  }, {
    sortFields: ['hashtags', '-priority', 'content'],
    name: 'By first #tag in task, then by priority'
  }];
  /**
   *
   * @param {*} todos
   * @param {*} heading
   * @returns {int} next line number
   */

  function insertTodos(note, todos, heading = null, separator = '') {
    // THE API IS SUPER SLOW TO INSERT TASKS ONE BY ONE
    // let currentLine = startingLine ? startingLine : heading ? 1 : 2
    // if (heading) {
    //   Editor.insertParagraph(heading, 1, 'text')
    //   currentLine++
    // }
    // for (let i = todos.length - 1; i >= 0; i--) {
    //   Editor.insertTodo(todos[i].content, currentLine++)
    // }
    // return currentLine
    // SO INSTEAD, JUST PASTE THEM ALL IN ONE BIG STRING
    const headingStr = heading ? `${heading}\n` : '';
    const contentStr = todos.map(t => t.raw).join(`\n`);
    console.log(`inserting tasks: \n${JSON.stringify(todos)}`);
    note.insertParagraph(`${headingStr}${contentStr}${separator ? `\n${separator}` : ''}`, 1, 'text');
  }
  /**
   *  @param {TNote} the note
   *  @param {array} sort fields order
   *  sortOrder can be an array-order of:
   *        content,
   *        priority,
   *        index,
   *        raw,
   *        hashtags,
   *        mentions,
   *        exclamations,
   *        parensPriority,
   *  any item can be in DESC order by placing a minus in front, e.g. "-priority"
   *  @returns the a sorted list of the tasks from the note
   */


  function sortTasksInNote(note, sortOrder = ['priority']) {
    const sortedList = {};

    if (note) {
      const paragraphs = note.paragraphs;
      console.log(`\t${paragraphs.length} total lines in note`);

      if (paragraphs.length) {
        const taskList = getTasksByType(paragraphs);
        console.log(`Open Tasks:${taskList.open.length}`);

        for (const ty of TASK_TYPES) {
          // TASK_TYPES.forEach((ty) => {
          sortedList[ty] = sortListBy(taskList[ty], sortOrder); // sortedList[ty] = sortListBy(taskList[ty], ['hashtags'])
        }

        console.log(`After Sort - Open Tasks:${sortedList.open.length}`);
      }
    } else {
      console.log(`sorttasksInNote: no note to sort`);
    } // console.log(JSON.stringify(sortedList))


    return sortedList;
  }

  async function getUserSort(sortChoices = SORT_ORDERS) {
    // [String] list of options, placeholder text, callback function with selection/
    const choice = await CommandBar.showOptions(sortChoices.map(a => a.name), `Select sort order:`);
    return sortChoices[choice.index].sortFields;
  }

  function findRawParagraph(note, content) {
    const found = note.paragraphs.filter(p => p.rawContent === content);

    if (found && found.length > 1) {
      console.log(`Found ${found.length} identical occurrences for "${content}". Deleting the first.`);
    }

    return found[0] || null;
  } //TODO: this does not work. creates 4 copies of the file but does not save the tasks
  // seems like somewheer there's not an await where there should be


  async function saveBackup(taskList) {
    const backupPath = `@Trash`;
    const backupTitle = `_Task-sort-backup`;
    const backupFilename = `${backupPath}/${backupTitle}.${DataStore.defaultFileExtension}`;
    console.log(`\tBackup filename: ${backupFilename}`);
    let notes = await DataStore.projectNoteByTitle(backupTitle, false, true);
    console.log(`\tGot note back: ${notes}`);

    if (!notes || !notes.length) {
      console.log(`\tsaveBackup: no note named ${backupFilename}`);
      const filename = await DataStore.newNote(`_Task-sort-backup`, `@Trash`); // TODO: There's a bug in API where filename is not correct and the file is not in cache unless you open a command bar
      // remove all this:

      await CommandBar.showOptions(['OK'], `Backing up todos in Trash/${backupTitle}`); //

      console.log(`\tCreated ${filename} for backups`);
      notes = await DataStore.projectNoteByTitle(backupTitle, false, true); // note = await DataStore.projectNoteByFilename(backupFilename)

      console.log(`backup file contents:\n${JSON.stringify(notes)}`);
    }

    if (notes && notes[0]) {
      notes[0].insertParagraph(`---`, 2, 'text');
      console.log(`BACKUP`);
      await insertTodos(notes[0], taskList);
    }
  }

  async function deleteExistingTasks(note, tasks, shouldBackupTasks = true) {
    for (const typ of TASK_TYPES) {
      console.log(`Deleting ${tasks[typ].length} ${typ} tasks from note`); // Have to find all the paragraphs again

      if (shouldBackupTasks) {
        await saveBackup(tasks[typ]);
      }

      try {
        const taskList = tasks[typ].map(t => findRawParagraph(note, t.raw));
        Editor.note.removeParagraphs(taskList);
      } catch (e) {
        console.log(JSON.stringify(e));
      }
    } //   tasks[typ]
    //     .slice()
    //     .reverse()
    //     .forEach((t) => Editor.removeParagraphAtIndex(t.index))
    // })
    //  removeParagraphAtIndex(lineIndex: number): void,

  }

  async function writeOutTasks(note, tasks, drawSeparators = true) {
    // tasks.forEach((cat) => {})
    const headings = {
      open: 'Open Tasks',
      scheduled: 'Scheduled Tasks',
      done: 'Completed Tasks',
      cancelled: 'Cancelled Tasks'
    };
    TASK_TYPES.slice().reverse().forEach(async (ty, i) => {
      if (tasks[ty].length) {
        console.log(`EDITOR_FILE TASK_TYPE=${ty}`);

        try {
          await insertTodos(note, tasks[ty], `### ${headings[ty]}:`, `${i === tasks[ty].length - 1 ? '---' : ''}`);
        } catch (e) {
          console.log(JSON.stringify(e));
        }
      }
    });
  }

  async function sortTasks() {
    console.log('\nStarting sortTasks():');
    const sortOrder = await getUserSort();
    console.log(`\tFinished getUserSort, now sortTasksInNote`);
    const sortedTasks = sortTasksInNote(Editor.note, sortOrder);
    console.log(`\tFinished sortTasksInNote, now deleteExistingTasks`); // console.log(`\t${JSON.stringify(tasks)}`)
    // console.log(
    //   `.OPEN Tasks: Priority | Content (sorted by ${JSON.stringify(sortOrder)})`,
    // )
    // tasks.open.forEach((t) => {
    //   console.log(
    //     `${t.priority}: # ${t.hashtags} || @ ${t.mentions} || ${t.content} `,
    //   )
    // })

    await deleteExistingTasks(Editor.note, sortedTasks); // need to do this before adding new lines to preserve line numbers

    console.log(`\tFinished deleteExistingTasks, now writeOutTasks`);
    await writeOutTasks(Editor.note, sortedTasks);
    console.log(`\tFinished writeOutTasks, now finished`);
    console.log('Finished sortTasks()!');
  }

  const nowISO = () => new Date().toISOString();

  const dateTime = () => {
    const today = new Date();
    const date = hyphenatedDateString;
    const time = `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`;
    return `${date} ${time}`;
  };

  function insertDate() {
    Editor.insertTextAtCursor(hyphenatedDateString());
  }
  function insertISODate() {
    Editor.insertTextAtCursor(nowISO());
  }
  function insertDateTime() {
    Editor.insertTextAtCursor(dateTime());
  }
  function insertCalendarNoteLink() {
    Editor.insertTextAtCursor(`[[${hyphenatedDateString()}]]`);
  }

  exports.insertCalendarNoteLink = insertCalendarNoteLink;
  exports.insertDate = insertDate;
  exports.insertDateTime = insertDateTime;
  exports.insertISODate = insertISODate;
  exports.sortTasks = sortTasks;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

}({}));
Object.assign(globalThis, exports)
