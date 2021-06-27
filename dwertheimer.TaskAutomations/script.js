var exports = (function (exports) {
  'use strict';

  // import {chooseOption,showMessage,getInput} from '../../nmn.sweep/src/userInput.js'
  async function chooseOption(title, options, defaultValue) {
    const {
      index
    } = await CommandBar.showOptions(options.map(option => option.label), title);
    return options[index]?.value ?? defaultValue;
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

    console.log(`Tasks:${tasks.open.length} returning from getTasksByType`);
    return tasks;
  }

  /* eslint-disable no-unused-vars */
  const SORT_ORDERS = [{
    sortFields: ['-priority', 'content'],
    name: 'Priority (!!! and (A))'
  }
  /* FIXME non-priority fields not working yet 
  {
    sortFields: ['mentions', '-priority', 'content'],
    name: 'By first @Person in task, then by priority',
  },
  {
    sortFields: ['hashtags', '-priority', 'content'],
    name: 'By first #tag in task, then by priority',
  }, */
  ];
  const DEFAULT_SORT_INDEX = 0;
  const MAKE_BACKUP = true;
  /**
   *
   * @param {*} todos
   * @param {*} heading
   * @returns {int} next line number
   */

  function insertTodos(note, todos, heading = '', separator = '') {
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
    const headingStr = heading ? `${heading}\n` : '';
    const contentStr = todos.map(t => t.raw).join(`\n`); // console.log(`inserting tasks: \n${JSON.stringify(todos)}`)

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


  function sortTasksInNote(note, sortOrder = SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields) {
    const sortedList = {};

    if (note) {
      const paragraphs = note.paragraphs;
      console.log(`\t${paragraphs.length} total lines in note`);

      if (paragraphs.length) {
        const taskList = getTasksByType(paragraphs);
        console.log(`Open Tasks:${taskList.open.length}`);

        for (const ty of TASK_TYPES) {
          sortedList[ty] = sortListBy(taskList[ty], sortOrder);
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
    console.log(`\tGot note back: ${notes ? JSON.stringify(notes) : ''}`);

    if (!notes || !notes.length) {
      console.log(`\tsaveBackup: no note named ${backupFilename}`);
      const filename = await DataStore.newNote(`_Task-sort-backup`, `@Trash`); // TODO: There's a bug in API where filename is not correct and the file is not in cache unless you open a command bar
      // remove all this:

      await CommandBar.showOptions(['OK'], `Backing up todos in Trash/${backupTitle}`); //

      console.log(`\tCreated ${filename ? filename : ''} for backups`);
      notes = await DataStore.projectNoteByTitle(backupTitle, false, true); // note = await DataStore.projectNoteByFilename(backupFilename)

      console.log(`backup file contents:\n${notes ? JSON.stringify(notes) : ''}`);
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
        const taskList = tasks[typ].map(note ? t => findRawParagraph(note, t.raw) : false);
        Editor.note.removeParagraphs(taskList);
      } catch (e) {
        console.log(JSON.stringify(e));
      }
    }
  }

  async function writeOutTasks(note, tasks, drawSeparators = false, withHeadings) {
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
        console.log(`EDITOR_FILE TASK_TYPE=${ty}`);

        try {
          note ? await insertTodos(note, tasks[ty], withHeadings ? `### ${headings[ty]}:` : '', drawSeparators ? `${i === tasks[ty].length - 1 ? '---' : ''}` : '') : null;
        } catch (e) {
          console.log(JSON.stringify(e));
        }
      }
    }
  }

  async function wantHeadings() {
    return await chooseOption(`Include Task Type headings in the output?`, [{
      label: 'Yes',
      value: true
    }, {
      label: 'No',
      value: false
    }], true);
  }

  async function sortTasks(withUserInput = true, sortFields = SORT_ORDERS[DEFAULT_SORT_INDEX].sortFields, withHeadings = null) {
    console.log('\nStarting sortTasks():');
    const sortOrder = withUserInput ? await getUserSort() : sortFields;
    console.log(`\n`);
    console.log(`\tFinished getUserSort, now sortTasksInNote`);
    const printHeadings = withHeadings === null ? await wantHeadings() : true;
    console.log(`\tFinished wantHeadings()=${String(printHeadings)}, now sortTasksInNote`);
    const sortedTasks = sortTasksInNote(Editor.note, sortOrder);
    console.log(`\tFinished sortTasksInNote, now deleteExistingTasks`);
    await deleteExistingTasks(Editor.note, sortedTasks, MAKE_BACKUP); // need to do this before adding new lines to preserve line numbers

    console.log(`\tFinished deleteExistingTasks, now writeOutTasks`);
    await writeOutTasks(Editor.note, sortedTasks, false, printHeadings);
    console.log(`\tFinished writeOutTasks, now finished`);
    console.log('Finished sortTasks()!');
  }

  exports.sortTasks = sortTasks;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

}({}));
Object.assign(globalThis, exports)
