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
    return "".concat(year, "-").concat(month < 10 ? '0' : '').concat(month, "-").concat(date < 10 ? '0' : '').concat(date);
  }
  function filenameDateString(dateObj) {
    const {
      year,
      month,
      date
    } = getYearMonthDate(dateObj);
    return "".concat(year).concat(month < 10 ? '0' : '').concat(month).concat(date < 10 ? '0' : '').concat(date);
  }

  async function chooseOption(title, options, defaultValue) {
    var _options$index$value, _options$index;

    const {
      index
    } = await CommandBar.showOptions(options.map(option => option.label), title);
    return (_options$index$value = (_options$index = options[index]) === null || _options$index === void 0 ? void 0 : _options$index.value) !== null && _options$index$value !== void 0 ? _options$index$value : defaultValue;
  }
  async function showMessage(title, okLabel = 'OK') {
    await CommandBar.showOptions([okLabel], title);
  }

  async function sweepProjectNote(note, withUserConfirm = true, afterHyphenatedDate = '0000-00-00', notifyNoChanges = true) {
    const paragraphs = note.paragraphs;
    const todayDateString = hyphenatedDateString(new Date());
    const overdueTasks = paragraphs.filter(p => p.type == 'open' && p.date != null && hyphenatedDateString(p.date) < todayDateString && hyphenatedDateString(p.date) >= afterHyphenatedDate);
    const numTasksToUpdate = overdueTasks.length;

    if (numTasksToUpdate > 0) {
      let confirmed = true;
      const pluralTask = numTasksToUpdate != 1 ? 'tasks' : 'task';

      if (withUserConfirm) {
        var _note$title;

        Editor.openNoteByFilename(note.filename);
        const yesLabel = "\uD83D\uDD17 Yes, reschedule (update '>date') ".concat(numTasksToUpdate, " ").concat(pluralTask, " to today");
        confirmed = await chooseOption("\uD83E\uDDF9 Ready to sweep '".concat((_note$title = note.title) !== null && _note$title !== void 0 ? _note$title : 'Untitled', "'?"), [{
          label: yesLabel,
          value: true
        }, {
          label: '❌ Skip this note',
          value: false
        }], false);
      }

      if (confirmed) {
        overdueTasks.forEach(para => {
          if (para.type === 'open' && para.date != null) {
            const paraDateString = hyphenatedDateString(para.date);
            para.content = para.content.replace(paraDateString, todayDateString);

            if (Editor.filename == note.filename) {
              Editor.updateParagraph(para);
            } else {
              note.updateParagraph(para);
            }
          }
        });
      }
    } else {
      if (notifyNoChanges && withUserConfirm) {
        await showMessage('Everything is already up to date here!');
      }
    }
  }

  async function sweepCalendarNote(note, withUserConfirm = true, notifyNoChanges = true) {
    const paragraphs = note.paragraphs;
    const paragraphsToMove = [];
    const paragraphsToRemove = [];
    const moveableTypes = ['open', 'title'];
    const mainItemTypes = ['open'];
    const nonMovableTypes = ['scheduled', 'cancelled', 'done'];
    const resetTypes = ['title', 'empty'];
    let lastRootItem = null;
    paragraphs.forEach(p => {
      if (nonMovableTypes.includes(p.type)) {
        return;
      } // Remember the last item which is not indented and open, or a bullet


      if (mainItemTypes.includes(p.type) && p.indents === 0) {
        lastRootItem = p;
      } // Reset the root item to null if a heading comes in between


      if (resetTypes.includes(p.type) && p.indents === 0) {
        lastRootItem = null;
      } // Either all movable types, or anything indented, if the parent is indented as well.


      if (moveableTypes.includes(p.type) || (p.indents > 0 || p.type === 'empty') && lastRootItem != null) {
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
      return;
    }

    const numTasksToMove = paragraphsToMove.filter(p => p.type === 'open').length;

    if (numTasksToMove > 0) {
      let rescheduleTasks = 'move';

      if (withUserConfirm) {
        Editor.openNoteByFilename(note.filename);
        rescheduleTasks = await chooseOption('🧹 Ready to sweep?', [{
          label: "\u2702\uFE0F Move (cut & paste) ".concat(numTasksToMove, " task(s) to today"),
          value: 'move'
        }, {
          label: "\uD83D\uDDD3 Reschedule (copy) ".concat(numTasksToMove, " task(s) to today"),
          value: 'reschedule'
        }, {
          label: '❌ Cancel',
          value: false
        }], false);
      }

      if (rescheduleTasks === 'move') {
        // Add Tasks to Today
        todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphsToMove];
        paragraphsToRemove.forEach(para => {
          if (Editor.filename === note.filename) {
            Editor.removeParagraph(para);
          } else {
            note.removeParagraph(para);
          }
        });
      }

      if (rescheduleTasks === 'reschedule') {
        const noteDate = note.date;
        const dateTag = noteDate != null ? " <".concat(hyphenatedDateString(noteDate)) : '';
        const paragraphsWithDateTag = paragraphsToMove.map(para => {
          const paraClone = para.duplicate();

          if (para.type === 'open') {
            paraClone.content = removeDateTags(paraClone.content) + dateTag;
          }

          return paraClone;
        });
        todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphsWithDateTag];
        paragraphsToRemove.forEach(para => {
          para.type = 'scheduled';
          para.content = "".concat(removeDateTags(para.content), " >").concat(hyphenatedDateString(today));

          if (Editor.filename == note.filename) {
            Editor.updateParagraph(para);
          } else {
            note.updateParagraph(para);
          }
        });
      }
    } else {
      if (notifyNoChanges && withUserConfirm) {
        await CommandBar.showInput('There are no open tasks to move in this note.', "OK, I'll open another date.");
      }
    }
  }

  function removeDateTags(content) {
    return content.replace(/<\d{4}-\d{2}-\d{2}/g, '').replace(/>\d{4}-\d{2}-\d{2}/g, '').trim();
  }

  async function sweepFile() {
    const type = Editor.type;
    const note = Editor.note;

    if (note == null) {
      return;
    }

    if (type === 'Calendar') {
      const todayNoteFileName = filenameDateString(new Date()) + '.' + DataStore.defaultFileExtension;

      if (Editor.filename == todayNoteFileName) {
        await CommandBar.showInput('Open a different note than today', 'OK');
        return;
      }

      return await sweepCalendarNote(note);
    } else {
      return await sweepProjectNote(note);
    }
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
  /**
   * TODO:
   * 1. Add option to move all tasks silently
   * 2. Add option to reschedule instead of move Calendar notes
   * 3. Add option to change target date from "Today" to something you can choose
   *  */

  async function sweepAll() {
    const {
      unit,
      num
    } = await chooseOption('🧹 Reschedule tasks to today of the last...', OPTIONS, DEFAULT_OPTION);

    if (num === 0) {
      // User canceled, return here, so no additional messages are shown
      await showMessage("Cancelled! No changes made.");
      return;
    }

    const afterDate = Calendar.addUnitToDate(new Date(), unit, -num);
    const afterDateFileName = filenameDateString(Calendar.addUnitToDate(new Date(), unit, -num));
    const re1 = await CommandBar.showOptions(['✅ OK', '❌ Skip'], '📙 Processing with your Project Notes first...');

    if (re1.index == 0) {
      for (const note of DataStore.projectNotes) {
        await sweepProjectNote(note, true, hyphenatedDateString(afterDate), false);
      }
    }

    const re2 = await CommandBar.showOptions(['✅ OK', '❌ Skip'], '🗓 Now processing your Daily Notes...');

    if (re2.index === 0) {
      const todayFileName = filenameDateString(new Date());
      const recentCalNotes = DataStore.calendarNotes.filter(note => note.filename < todayFileName && note.filename >= afterDateFileName);

      for (const note of recentCalNotes) {
        await sweepCalendarNote(note, true, false);
      }
    }

    await showMessage("All Done!");
  }

  exports.sweepAll = sweepAll;
  exports.sweepFile = sweepFile;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

}({}));
Object.assign(globalThis, exports)
