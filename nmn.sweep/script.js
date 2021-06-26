var exports = (function (exports) {
  'use strict';

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
  function hyphenatedDateString(dateObj) {
    const {
      year,
      month,
      date
    } = getYearMonthDate(dateObj);
    return `${year}-${month < 10 ? '0' : ''}${month}-${date < 10 ? '0' : ''}${date}`;
  }
  function filenameDateString(dateObj) {
    const {
      year,
      month,
      date
    } = getYearMonthDate(dateObj);
    return `${year}${month < 10 ? '0' : ''}${month}${date < 10 ? '0' : ''}${date}`;
  }
  function removeDateTags(content) {
    return content.replace(/<\d{4}-\d{2}-\d{2}/g, '').replace(/>\d{4}-\d{2}-\d{2}/g, '').trim();
  }

  async function chooseOption(title, options, defaultValue) {
    const {
      index
    } = await CommandBar.showOptions(options.map(option => option.label), title);
    return options[index]?.value ?? defaultValue;
  }
  async function showMessage(title, okLabel = 'OK') {
    await CommandBar.showOptions([okLabel], title);
  }

  /* eslint-disable no-unused-vars */
  async function sweepNote(note, withUserConfirm = true, notifyNoChanges = true, overdueOnly = false, isProjectNote = false) {
    const paragraphs = note.paragraphs;
    const paragraphsToMove = [];
    const paragraphsToRemove = [];
    const moveableTypes = ['open', 'title'];
    const mainItemTypes = ['open'];
    const nonMovableTypes = ['scheduled', 'cancelled', 'done'];
    const resetTypes = ['title', 'empty'];
    let lastRootItem = null;
    paragraphs.forEach(p => {
      // console.log(`type:${p.type} indents:${p.indents} "${p.content}"`)
      // ['scheduled', 'cancelled', 'done']
      if (nonMovableTypes.includes(p.type)) {
        return;
      } // Remember the last item which is not indented and open, or a bullet
      // ['open']


      if (mainItemTypes.includes(p.type) && p.indents === 0) {
        lastRootItem = p;
      } // Reset the root item to null if a heading comes in between
      // ['title', 'empty']


      if (resetTypes.includes(p.type) && p.indents === 0) {
        lastRootItem = null;
      } // Either all movable types, or anything indented, if the parent is indented as well.


      if ( // ['open', 'title']
      moveableTypes.includes(p.type) || (p.indents > 0 || p.type === 'empty') && lastRootItem != null) {
        paragraphsToMove.push(p);

        if (!['title', 'empty'].includes(p.type)) {
          paragraphsToRemove.push(p);
        }
      }
    }); // TODO: Match existing headings
    // TODO: Add back non-todo main types if it has indented todos
    // TODO: Filter out "empty" headings
    // TODO: Don't remove root tasks or bullets, if they have at least one closed item below, indented as child. Rather, check it off

    const today = new Date();
    const todayNote = DataStore.calendarNoteByDate(today);

    if (todayNote == null) {
      console.log(`Couldn't open Today's Calendar Note`);
      return {
        status: 'error',
        msg: `Couldn't open Today's Calendar Note`
      };
    }

    const numTasksToMove = paragraphsToMove.filter(p => p.type === 'open').length;

    if (numTasksToMove > 0) {
      console.log(`\t\t${note.filename} has ${numTasksToMove} open tasks`);
      let rescheduleTasks = isProjectNote ? 'reschedule' : 'move';

      if (withUserConfirm) {
        Editor.openNoteByFilename(note.filename);
        rescheduleTasks = await chooseOption(`Move or Copy ${numTasksToMove} open task(s) to TODAY?`, [{
          label: `✂️ Move (cut & paste) task(s) to today's Calendar Note`,
          value: 'move'
        }, {
          label: `🗓 Leave original here and copy/link to Calendar Note`,
          value: 'reschedule'
        }, {
          label: '❌ Cancel',
          value: false
        }], false);
      }

      if (rescheduleTasks === 'move') {
        // Add Tasks to Today
        todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphsToMove]; // paragraphsToRemove.forEach((para) => {

        if (Editor.filename === note.filename) {
          Editor.removeParagraphs(paragraphsToRemove);
        } else {
          note.removeParagraphs(paragraphsToRemove);
        } // })

      }

      if (rescheduleTasks === 'reschedule') {
        const noteDate = note.date;
        const dateTag = noteDate != null ? ` <${hyphenatedDateString(noteDate)}` : '';
        const projNote = note.title ?? '';
        const link = isProjectNote ? ` <[[${projNote}]]` : dateTag;
        const paragraphsWithDateTag = paragraphsToMove.map(para => {
          const paraClone = para.duplicate();

          if (para.type === 'open') {
            paraClone.content = removeDateTags(paraClone.content) + link;
          }

          return paraClone;
        });
        todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphsWithDateTag];
        paragraphsToRemove.forEach(para => {
          para.type = 'scheduled';
          para.content = `${removeDateTags(para.content)} >${hyphenatedDateString(today)}`;

          if (Editor.filename === note.filename) {
            Editor.updateParagraph(para);
          } else {
            note.updateParagraph(para);
          }
        });
      }

      console.log(`\t\t${rescheduleTasks}-ing  ${paragraphsToMove.length} paragraphs; ${numTasksToMove} tasks`);
    } else {
      if (notifyNoChanges && withUserConfirm) {
        await CommandBar.showInput('There are no open tasks to move in this note.', "OK, I'll open another date.");
        return {
          status: 'error',
          msg: 'There are no open tasks to move in this note.'
        };
      }
    }

    return {
      status: 'ok',
      msg: `Moved ${numTasksToMove}`,
      tasks: numTasksToMove
    };
  }

  async function sweepFile() {
    const type = Editor.type;
    const note = Editor.note;

    if (note == null) {
      return;
    }

    console.log(`Starting sweepFile`);

    if (type === 'Calendar') {
      const todayNoteFileName = `${filenameDateString(new Date())}.${DataStore.defaultFileExtension}`;

      if (Editor.filename === todayNoteFileName) {
        await CommandBar.showInput(`Open a different note for a different day (can't sweep today)`, 'OK');
        return;
      }

      await sweepNote(note, true, true, false, false);
    } else {
      await sweepNote(note, true, true, false, true);
    }

    console.log(`Finished sweepFile`);
  }

  const OPTIONS = [{
    label: '7 days',
    value: {
      num: 7,
      unit: 'day'
    }
  }, {
    label: '14 days',
    value: {
      num: 14,
      unit: 'day'
    }
  }, {
    label: '21 days',
    value: {
      num: 21,
      unit: 'day'
    }
  }, {
    label: '1 month',
    value: {
      num: 1,
      unit: 'month'
    }
  }, {
    label: '3 months',
    value: {
      num: 3,
      unit: 'month'
    }
  }, {
    label: '6 months',
    value: {
      num: 6,
      unit: 'month'
    }
  }, {
    label: '1 year',
    value: {
      num: 1,
      unit: 'year'
    }
  }, {
    label: 'All Time',
    value: {
      num: 99,
      unit: 'year'
    }
  }, {
    label: '❌ Cancel',
    value: {
      num: 0,
      unit: 'day'
    }
  }];
  const DEFAULT_OPTION = {
    unit: 'day',
    num: 0
  };
  async function sweep7() {
    sweepAll(false, false, {
      num: 7,
      unit: 'day'
    });
  }
  /**
   * TODO:
   * 1. Add option to move all tasks silently
   * - Implement sweepOverdue
   * 2. Add option to reschedule instead of move Calendar notes
   * 3. Add option to change target date from "Today" to something you can choose
   *  */

  async function sweepAll(overdueOnly = false, requireUserAction = true, periodToCheck = DEFAULT_OPTION) {
    let {
      unit,
      num
    } = periodToCheck;
    console.log(`Starting sweepAll overdueOnly:${String(overdueOnly)} requireUserAction:${String(requireUserAction)} periodToCheck:${JSON.stringify(periodToCheck)}`);

    if (requireUserAction) {
      const setPeriod = await chooseOption('🧹 Reschedule tasks to today from the last...', OPTIONS, DEFAULT_OPTION);

      if (setPeriod.num === 0) {
        // User canceled, return here, so no additional messages are shown
        await showMessage(`Cancelled! No changes made.`);
        return;
      } else {
        unit = setPeriod.unit;
        num = setPeriod.num;
      }
    }

    let res = {},
        withUserConfirm = requireUserAction;

    if (withUserConfirm) {
      res = await CommandBar.showOptions(['✅ Yes', '❌ No (Reschedule Silently)'], '📙 Want to approve each note during sweep?');
      withUserConfirm = res.index === 0;
    }

    const afterDate = Calendar.addUnitToDate(new Date(), unit, -num);
    const afterDateFileName = filenameDateString(Calendar.addUnitToDate(new Date(), unit, -num));
    const count = {
      files: 0,
      tasks: 0
    };

    const processResult = res => {
      if (res.status === 'ok') {
        if (res.tasks) {
          count.files += 1;
          count.tasks += res.tasks;
        }
      } else {
        console.log(`Error: ${res.msg}`);
      }
    }; // PROJECT NOTES FIRST


    if (withUserConfirm) {
      res = await CommandBar.showOptions(['✅ OK', '❌ Skip'], `📙 Scan for Tasks in Project Notes?`);
    } // Narrow project note search to notes edited in last N days


    if (!withUserConfirm || typeof res.index !== 'undefined' && res.index === 0) {
      const recentProjNotes = DataStore.projectNotes.filter(note => note.changedDate >= afterDate);
      console.log(`\tProject Notes to search: ${recentProjNotes.length}`);

      for (const note of recentProjNotes) {
        processResult(await sweepNote(note, withUserConfirm, false, overdueOnly, true));
      }
    } //  CALENDAR NOTES


    if (withUserConfirm) {
      res = await CommandBar.showOptions(['✅ OK', '❌ Skip'], `Done. Now Scan Daily Calendar Notes 🗓?`);
    }

    if (!withUserConfirm || typeof res.index !== 'undefined' && res.index === 0) {
      const todayFileName = filenameDateString(new Date());
      const recentCalNotes = DataStore.calendarNotes.filter(note => note.filename < todayFileName && note.filename >= afterDateFileName);
      console.log(`\tCalendar Notes to search: ${recentCalNotes.length}`);

      for (const note of recentCalNotes) {
        processResult(await sweepNote(note, withUserConfirm, false));
      }
    }

    const msg = count.tasks > 0 ? `Moved ${count.tasks} tasks from ${count.files} files.` : ``;
    await showMessage(`All Done! ${msg}`);
    await Editor.openNoteByDate(new Date());
    console.log(`Finished sweepAll`);
  }

  exports.sweep7 = sweep7;
  exports.sweepAll = sweepAll;
  exports.sweepFile = sweepFile;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

}({}));
Object.assign(globalThis, exports)
