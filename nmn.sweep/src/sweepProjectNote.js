// @flow

import { hyphenatedDateString } from './dateHelpers';

export default async function sweepProjectNote(
  note: TNote,
  withUserConfirm: boolean = true,
  afterDateFileName: string = '0000-00-00',
  notifyNoChanges: boolean = true,
): Promise<void> {
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
    let re = { index: 0 };

    if (withUserConfirm) {
      Editor.openNoteByFilename(note.filename);
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
    if (notifyNoChanges && withUserConfirm) {
      await CommandBar.showInput(
        'Everything is up to date here!',
        "OK, I'll open another note.",
      );
    }
  }
}
