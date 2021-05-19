(function () {
  'use strict';

  function getYearMonthDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const date = dateObj.getDate();
    return {
      year,
      month,
      date,
    };
  }
  function hyphenatedDateString(dateObj) {
    const { year, month, date } = getYearMonthDate(dateObj);
    return `${year}-${month < 10 ? '0' : ''}${month}-${
      date < 10 ? '0' : ''
    }${date}`;
  }
  function filenameDateString(dateObj) {
    const { year, month, date } = getYearMonthDate(dateObj);
    return `${year}${month < 10 ? '0' : ''}${month}${
      date < 10 ? '0' : ''
    }${date}`;
  }

  async function sweepProjectNote(
    note,
    withUserConfirm = true,
    afterDateFileName = '0000-00-00',
  ) {
    const paragraphs = note.paragraphs;
    const todayDateString = hyphenatedDateString(new Date());
    const numTasksToUpdate = paragraphs.filter(
      (p) =>
        p.type == 'open' &&
        p.date != null &&
        hyphenatedDateString(p.date) < todayDateString &&
        hyphenatedDateString(p.date) >= afterDateFileName,
    ).length;

    if (numTasksToUpdate > 0) {
      let re = {
        index: 0,
      };

      if (withUserConfirm) {
        re = await CommandBar.showOptions(
          [
            `🔗 Yes, Reschedule (update '>date') ${numTasksToUpdate} task${
              numTasksToUpdate != 1 ? 's' : ''
            } to today`,
            '❌ No, Cancel',
          ],
          '🧹 Ready to sweep?',
        );
      }

      if (re.index == 0) {
        paragraphs.forEach((para) => {
          if (para.type === 'open' && para.date != null) {
            const paraDateString = hyphenatedDateString(para.date);

            if (
              paraDateString < todayDateString &&
              paraDateString >= afterDateFileName
            ) {
              para.content = para.content.replace(
                paraDateString,
                todayDateString,
              );
            }
          }
        });

        if (Editor.filename == note.filename) {
          Editor.paragraphs = paragraphs;
        } else {
          note.paragraphs = paragraphs;
        }
      }
    } else {
      if (withUserConfirm) {
        await CommandBar.showInput(
          'Everything is up to date here!',
          "OK, I'll open another note.",
        );
      }
    }
  }

  async function sweepCalendarNote(note, withUserConfirm = true) {
    const paragraphs = note.paragraphs;
    const paragraphsToMove = [];
    const paragraphsToRemove = [];
    const moveableTypes = ['open', 'title'];
    const mainItemTypes = ['open'];
    const nonMovableTypes = ['scheduled', 'cancelled', 'done'];
    const resetTypes = ['title', 'empty'];
    let lastRootItem = null;
    paragraphs.forEach((p, _index) => {
      if (nonMovableTypes.includes(p.type)) {
        return;
      } // Remember the last item which is not indented and open, or a bullet

      if (mainItemTypes.includes(p.type) && p.indents == 0) {
        lastRootItem = p;
      } // Reset the root item to null if a heading comes in between

      if (resetTypes.includes(p.type) && p.indents == 0) {
        lastRootItem = null;
      } // Either all movable types, or anything indented, if the parent is indented as well.

      if (
        moveableTypes.includes(p.type) ||
        ((p.indents > 0 || p.type == 'empty') && lastRootItem != null)
      ) {
        paragraphsToMove.push(p);

        if (!['title', 'empty'].includes(p.type)) {
          paragraphsToRemove.push(p);
        }
      }
    }); // TODO: Match existing headings
    // TODO: Add back non-todo main types if it has indented todos
    // TODO: Filter out "empty" headings
    // TODO: Don't remove root tasks or bullets, if they have at least one closed item below, indented as child. Rather, check it off

    const todayNote = DataStore.calendarNoteByDate(new Date());

    if (todayNote == null) {
      return;
    }

    const numTasksToMove = paragraphsToMove.filter(
      (p) => p.type == 'open',
    ).length;

    if (numTasksToMove > 0) {
      let re = {
        index: 0,
      };

      if (withUserConfirm) {
        re = await CommandBar.showOptions(
          [
            '✂️ Move (cut & paste) ' + numTasksToMove + ' task(s) to today',
            '❌ Cancel',
          ],
          '🧹 Ready to sweep?',
        );
      }

      if (re.index == 0) {
        // Add Tasks to Today
        todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphsToMove]; // Remove Tasks from the open day. Use 'Editor', since we apply this to the opened note (or day). Then you can use undo to revert changes.

        if (Editor.filename == note.filename) {
          Editor.paragraphs = note.paragraphs.filter(
            (_, index) =>
              !paragraphsToRemove.map((p) => p.lineIndex).includes(index),
          );
        } else {
          note.paragraphs = note.paragraphs.filter(
            (_, index) =>
              !paragraphsToRemove.map((p) => p.lineIndex).includes(index),
          );
        }
      }
    } else {
      if (withUserConfirm) {
        await CommandBar.showInput(
          'There are no open tasks to move in this note.',
          "OK, I'll open another date.",
        );
      }
    }
  }

  async function sweepFile() {
    const type = Editor.type;
    const note = Editor.note;

    if (type === 'Calendar') {
      const todayNoteFileName =
        filenameDateString(new Date()) + '.' + DataStore.defaultFileExtension;

      if (Editor.filename == todayNoteFileName) {
        await CommandBar.showInput('Open a different note than today', 'OK');
        return;
      }

      return await sweepCalendarNote(note);
    } else {
      return await sweepProjectNote(note);
    }
  }

  const OPTIONS = [
    {
      label: '7 days',
      value: 7,
      unit: 'day',
    },
    {
      label: '14 days',
      value: 14,
      unit: 'day',
    },
    {
      label: '21 days',
      value: 21,
      unit: 'day',
    },
    {
      label: '1 month',
      value: 1,
      unit: 'month',
    },
    {
      label: '3 months',
      value: 3,
      unit: 'month',
    },
    {
      label: '6 months',
      value: 6,
      unit: 'month',
    },
    {
      label: '1 year',
      value: 1,
      unit: 'year',
    },
    {
      label: '❌ Cancel',
      value: 0,
      unit: 'day',
    },
  ];
  const DEFAULT_OPTION = {
    unit: 'day',
    value: 0,
  };
  async function sweepAll() {
    const { index } = await CommandBar.showOptions(
      OPTIONS.map((option) => option.label),
      '🧹 Reschedule tasks to today of the last...',
    );

    if (index < 0 || index >= 7) {
      // Invalid option
      return;
    }

    const { unit, value } = OPTIONS[index] ?? DEFAULT_OPTION;
    const afterDateFileName = filenameDateString(
      Calendar.addUnitToDate(new Date(), unit, -value),
    );
    await Promise.all(
      DataStore.projectNotes.map((n) =>
        sweepProjectNote(n, false, afterDateFileName),
      ),
    );
    const todayFileName = filenameDateString(new Date());
    await Promise.all(
      DataStore.calendarNotes
        .filter(
          (note) =>
            note.filename < todayFileName && note.filename >= afterDateFileName,
        )
        .map((n) => sweepCalendarNote(n, false)),
    );
  }

  globalThis.sweepAll = sweepAll;
  globalThis.sweepFile = sweepFile;
})();
