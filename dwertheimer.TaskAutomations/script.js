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
   * Helper function to show a simple yes/no (could be OK/Cancel, etc.) dialog using CommandBar
   * @param {string} message - text to display to user
   * @param {Array<string>} - an array of the choices to give (default: ['Yes', 'No'])
   * @returns {string} - returns the user's choice - the actual *text* choice from the input array provided
   */

  async function showMessageYesNo(message, choicesArray = ['Yes', 'No']) {
    const answer = await CommandBar.showOptions(choicesArray, message);
    return choicesArray[answer.index];
  } //-------------------------------------------------------------------------------

  new Date().toISOString().slice(0, 10); // TODO: make a friendlier string

  new Date().toISOString().slice(0, 16);
  new Date().toLocaleString(); // @nmn
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
  // Misc functions for NP

  DataStore.defaultFileExtension != null ? DataStore.defaultFileExtension : 'md'; // Pretty print range information (@EduardMe)

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
      var _matches;

      if (((_matches = matches) === null || _matches === void 0 ? void 0 : _matches.length) > 1) {
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

    for (let index = 0; index < paragraphs.length; index++) {
      const para = paragraphs[index];

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
    }

    console.log("\tgetTasksByType Open Tasks:".concat(tasks.open.length, " returning from getTasksByType"));
    return tasks;
  }

  /* es lint-disable no-unused-vars */
  // But the functions exist to look for open items with a date that is less than today

  const SORT_ORDERS = [{
    sortFields: ['-priority', 'content'],
    name: 'By Priority (!!! and (A)) then by content'
  },
  /* FIXME non-priority fields not working yet */
  {
    sortFields: ['mentions', '-priority', 'content'],
    name: 'By @Person in task, then by priority'
  }, {
    sortFields: ['hashtags', '-priority', 'content'],
    name: 'By #tag in task, then by priority'
  }, {
    sortFields: ['content', '-priority'],
    name: 'Alphabetical, then by priority'
  }];
  async function sortTasksByPerson() {
    console.log('Person!');
    await sortTasks(false, ['mentions', '-priority', 'content'], true, true);
  }
  async function sortTasksByTag() {
    await sortTasks(false, ['hashtags', '-priority', 'content'], true, true);
  }
  const DEFAULT_SORT_INDEX = 0;
  const MAKE_BACKUP = true;
  /**
   *
   * @param {TNote} note
   * @param {array} todos
   * @param {string} heading
   * @param {string} separator
   * @param {string} subHeadingCategory
   * @returns {int} next line number
   */

  function insertTodos(note, todos, heading = '', separator = '', subHeadingCategory = '') {
    // THE API IS SUPER SLOW TO INSERT TASKS ONE BY ONE
    // let currentLine = startingLine ? startingLine : heading ? 1 : 2
    // if (heading) {
    //   Editor.insertParagraph(heading, 1, 'text')
    //   currentLine++
    // }
    // for (let i = todos.length - 1; i >= 0; i--) {
    //   Editor.insertTodo(todos].content, currentLine++)
    // }
    // return currentLine
    // SO INSTEAD, JUST PASTE THEM ALL IN ONE BIG STRING
    console.log("\tInsertTodos: subHeadingCategory=".concat(String(subHeadingCategory), " ").concat(todos.length, " todos"));
    let todosWithSubheadings = [];
    const headingStr = heading ? "".concat(heading, "\n") : '';

    if (subHeadingCategory) {
      const leadingDigit = {
        hashtags: '#',
        mentions: '@',
        priority: '',
        content: ''
      };
      let lastSubcat = '';

      for (const lineIndex in todos) {
        const subCat = // $FlowIgnore - complaining about -priority being missing.
        (leadingDigit[subHeadingCategory] ? leadingDigit[subHeadingCategory] : '') + todos[lineIndex][subHeadingCategory][0] || todos[lineIndex][subHeadingCategory] || ''; // console.log(
        //   `lastSubcat[${subHeadingCategory}]=${subCat} check: ${JSON.stringify(
        //     todos[lineIndex],
        //   )}`,
        // )

        if (lastSubcat !== subCat) {
          lastSubcat = subCat;
          todosWithSubheadings.push({
            raw: "#### ".concat(subCat)
          });
        }

        todosWithSubheadings.push(todos[lineIndex]);
      }
    } else {
      todosWithSubheadings = todos;
    }

    const contentStr = todosWithSubheadings.map(t => t.raw).join("\n");
    console.log("Inserting tasks into Editor"); // console.log(`inserting tasks: \n${JSON.stringify(todosWithSubheadings)}`)

    note.insertParagraph("".concat(headingStr).concat(contentStr).concat(separator ? "\n".concat(separator) : ''), 1, 'text');
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


  function sortTasksInNote(note, sortOrder = SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields) {
    const sortedList = {};

    if (note) {
      const paragraphs = note.paragraphs;
      console.log("\t".concat(paragraphs.length, " total lines in note"));

      if (paragraphs.length) {
        const taskList = getTasksByType(paragraphs);
        console.log("\tOpen Tasks:".concat(taskList.open.length));

        for (const ty of TASK_TYPES) {
          sortedList[ty] = sortListBy(taskList[ty], sortOrder);
        }

        console.log("\tAfter Sort - Open Tasks:".concat(sortedList.open.length));
      }
    } else {
      console.log("\tsorttasksInNote: no note to sort");
    } // console.log(JSON.stringify(sortedList))


    return sortedList;
  }

  async function getUserSort(sortChoices = SORT_ORDERS) {
    console.log("\tgetUserSort(".concat(JSON.stringify(sortChoices))); // [String] list of options, placeholder text, callback function with selection/

    const choice = await CommandBar.showOptions(sortChoices.map(a => a.name), "Select sort order:");
    console.log("\tgetUserSort returning ".concat(JSON.stringify(sortChoices[choice.index].sortFields)));
    return sortChoices[choice.index].sortFields;
  }

  function findRawParagraph(note, content) {
    if (content) {
      const found = note.paragraphs.filter(p => p.rawContent === content);

      if (found && found.length > 1) {
        console.log("** Found ".concat(found.length, " identical occurrences for \"").concat(content, "\". Deleting the first."));
      }

      return found[0] || null;
    } else {
      return null;
    }
  } //TODO: this does not work. creates 4 copies of the file but does not save the tasks
  // seems like somewheer there's not an await where there should be


  async function saveBackup(taskList) {
    const backupPath = "@Trash";
    const backupTitle = "_Task-sort-backup";
    const backupFilename = "".concat(backupPath, "/").concat(backupTitle, ".").concat(DataStore.defaultFileExtension);
    console.log("\tBackup filename: ".concat(backupFilename));
    let notes = await DataStore.projectNoteByTitle(backupTitle, false, true);
    console.log("\tGot note back: ".concat(notes ? JSON.stringify(notes) : ''));

    if (!notes || !notes.length) {
      console.log("\tsaveBackup: no note named ".concat(backupFilename));
      const filename = await DataStore.newNote("_Task-sort-backup", "@Trash"); // TODO: There's a bug in API where filename is not correct and the file is not in cache unless you open a command bar
      // remove all this:

      await CommandBar.showOptions(['OK'], "\tBacking up todos in @Trash/".concat(backupTitle)); //

      console.log("\tCreated ".concat(filename ? filename : '', " for backups"));
      notes = await DataStore.projectNoteByTitle(backupTitle, false, true); // note = await DataStore.projectNoteByFilename(backupFilename)

      console.log("\tbackup file contents:\n".concat(notes ? JSON.stringify(notes) : ''));
    }

    if (notes && notes[0]) {
      notes[0].insertParagraph("---", 2, 'text');
      console.log("\tBACKUP Saved to ".concat(backupTitle));
      await insertTodos(notes[0], taskList);
    }
  }

  async function deleteExistingTasks(note, tasks, shouldBackupTasks = true) {
    for (const typ of TASK_TYPES) {
      console.log("\tDeleting ".concat(tasks[typ].length, " ").concat(typ, " tasks from note")); // Have to find all the paragraphs again

      if (shouldBackupTasks) {
        await saveBackup(tasks[typ]);
      }

      try {
        const taskList = tasks[typ].map(note ? t => findRawParagraph(note, t.raw || null) : false); //$FlowIgnore

        Editor.note.removeParagraphs(taskList);
      } catch (e) {
        console.log("**** ERROR deleting ".concat(typ, " ").concat(JSON.stringify(e)));
      }
    }
  }
  /**
   * Write the tasks list back into the top of the document
   * @param {TNote} note
   * @param {any} tasks list
   * @param {any} drawSeparators=false
   * @param {any} withHeadings=false
   * @param {any} withSubheadings=null
   */


  async function writeOutTasks(note, tasks, drawSeparators = false, withHeadings = false, withSubheadings = null) {
    const headings = {
      open: 'Open Tasks',
      scheduled: 'Scheduled Tasks',
      done: 'Completed Tasks',
      cancelled: 'Cancelled Tasks'
    };
    const tasksTypesReverse = TASK_TYPES.slice().reverse();

    for (let i = 0; i < tasksTypesReverse.length; i++) {
      const ty = tasksTypesReverse[i];

      if (tasks[ty].length) {
        console.log("\tEDITOR_FILE TASK_TYPE=".concat(ty, " -- withHeadings=").concat(String(withHeadings)));

        try {
          note ? await insertTodos(note, tasks[ty], withHeadings ? "### ".concat(headings[ty], ":") : '', drawSeparators ? "".concat(i === tasks[ty].length - 1 ? '---' : '') : '', withSubheadings) : null;
        } catch (e) {
          console.log(JSON.stringify(e));
        }
      }
    }
  }

  async function wantHeadings() {
    return await chooseOption("Include Task Type headings in the output?", [{
      label: 'Yes',
      value: true
    }, {
      label: 'No',
      value: false
    }], true);
  }

  async function wantSubHeadings() {
    return (await showMessageYesNo("Include sort field subheadings in the output?")) === 'Yes';
  }
  async function sortTasks(withUserInput = true, sortFields = SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields, withHeadings = null, withSubHeadings = null) {
    console.log("\n\nStarting sortTasks(".concat(String(withUserInput), ",").concat(JSON.stringify(sortFields), ",").concat(String(withHeadings), "):"));
    const sortOrder = withUserInput ? await getUserSort() : sortFields;
    console.log("\tUser specified sort=".concat(JSON.stringify(sortOrder)));
    console.log("\tFinished getUserSort, now running wantHeadings");
    const printHeadings = withHeadings === null ? await wantHeadings() : withHeadings;
    console.log("\tFinished wantHeadings()=".concat(String(printHeadings), ", now running wantSubHeadings"));
    const sortField1 = sortOrder[0][0] === '-' ? sortOrder[0].substring(1) : sortOrder[0];
    const printSubHeadings = ['hashtags', 'mentions'].indexOf(sortField1) !== -1 ? withSubHeadings === null ? await wantSubHeadings() : true : false;
    console.log("\twithSubHeadings=".concat(String(withSubHeadings), " printSubHeadings=").concat(String(printSubHeadings), "  cat=").concat(printSubHeadings ? sortField1 : ''));
    console.log("\tFinished wantSubHeadings()=".concat(String(printSubHeadings), ", now running sortTasksInNote"));
    const sortedTasks = sortTasksInNote(Editor.note, sortOrder);
    console.log("\tFinished sortTasksInNote, now running deleteExistingTasks");
    await deleteExistingTasks(Editor.note, sortedTasks, MAKE_BACKUP); // need to do this before adding new lines to preserve line numbers

    console.log("\tFinished deleteExistingTasks, now running writeOutTasks");
    await writeOutTasks(Editor.note, sortedTasks, false, printHeadings, printSubHeadings ? sortField1 : '');
    console.log("\tFinished writeOutTasks, now finished");
    console.log('Finished sortTasks()!');
  }

  async function setTasks(dir) {
    const paragraphs = Editor.paragraphs;
    console.log("setTasks: ".concat(String(paragraphs.length || 'zero'), " paragraphs"));
    console.log("setTasks; setting to: ".concat(dir || 'null'));
    let find, setVal;

    if (dir === 'open') {
      find = 'done';
      setVal = 'open';
    } else {
      // dir === 'done'
      find = 'open';
      setVal = 'done';
    }

    paragraphs.forEach((para, i) => {
      console.log("".concat(i, ": ").concat(para.type, " ").concat(para.content, " ").concat(para.type === find ? ">> SETTING TO: ".concat(setVal) : ''));
      if (para.type === find) para.type = setVal;
      Editor.updateParagraph(para);
    });
  }

  async function markTasks(mark, withConfirmation = true) {
    console.log("Starting markTasks(markDone=".concat(mark || 'null', ")")); //   modifyExistingParagraphs()
    //   return

    let dir = null;

    if (!mark) {
      dir = await chooseOption("Mark all tasks in note as:", [{
        label: 'Open',
        value: 'open'
      }, {
        label: 'Completed',
        value: 'done'
      }, {
        label: 'Cancel',
        value: null
      }], 'Cancel');
    }

    if (dir === 'Cancel') {
      console.log("User chose Cancel");
      return;
    } else {
      const message = "Confirm: Mark ALL ".concat(dir === 'open' ? 'Completed' : 'Open', " tasks as ").concat(dir === 'open' ? 'Open' : 'Completed', "?");

      if (withConfirmation) {
        const res = await showMessageYesNo(message);
        console.log("User said: ".concat(res));
        if (res === 'No') return;
      }
    }

    await setTasks(dir);
  }

  exports.markTasks = markTasks;
  exports.sortTasks = sortTasks;
  exports.sortTasksByPerson = sortTasksByPerson;
  exports.sortTasksByTag = sortTasksByTag;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

}({}));
Object.assign(globalThis, exports)
