// @flow strict

export default async function sweepCalendarNote(
  note: TNote,
  withUserConfirm: boolean = true,
  notifyNoChanges: boolean = true,
): Promise<void> {
  const paragraphs = note.paragraphs;

  const paragraphsToMove: Array<TParagraph> = [];
  const paragraphsToRemove: Array<TParagraph> = [];

  const moveableTypes = ['open', 'title'];
  const mainItemTypes = ['open'];
  const nonMovableTypes = ['scheduled', 'cancelled', 'done'];
  const resetTypes = ['title', 'empty'];
  let lastRootItem: ?TParagraph = null;

  paragraphs.forEach((p, _index) => {
    if (nonMovableTypes.includes(p.type)) {
      return;
    }

    // Remember the last item which is not indented and open, or a bullet
    if (mainItemTypes.includes(p.type) && p.indents == 0) {
      lastRootItem = p;
    }

    // Reset the root item to null if a heading comes in between
    if (resetTypes.includes(p.type) && p.indents == 0) {
      lastRootItem = null;
    }

    // Either all movable types, or anything indented, if the parent is indented as well.
    if (
      moveableTypes.includes(p.type) ||
      ((p.indents > 0 || p.type == 'empty') && lastRootItem != null)
    ) {
      paragraphsToMove.push(p);

      if (!['title', 'empty'].includes(p.type)) {
        paragraphsToRemove.push(p);
      }
    }
  });

  // TODO: Match existing headings
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
    let re = { index: 0 };
    if (withUserConfirm) {
      Editor.openNoteByFilename(note.filename);
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
      todayNote.paragraphs = [...todayNote.paragraphs, ...paragraphsToMove];

      // Remove Tasks from the open day. Use 'Editor', since we apply this to the opened note (or day). Then you can use undo to revert changes.
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
    if (notifyNoChanges && withUserConfirm) {
      await CommandBar.showInput(
        'There are no open tasks to move in this note.',
        "OK, I'll open another date.",
      );
    }
  }
}
