// @flow

import { hyphenatedDateString } from './dateHelpers';
import { chooseOption, showMessage } from './userInput';

// TODO make afterHyphenatedDate take a regular date instead
export default async function sweepProjectNote(
  note: TNote,
  withUserConfirm: boolean = true,
  afterHyphenatedDate: string = '0000-00-00',
  notifyNoChanges: boolean = true,
): Promise<void> {
  const paragraphs = note.paragraphs;
  const todayDateString = hyphenatedDateString(new Date());

  const overdueTasks = paragraphs.filter(
    (p) =>
      p.type == 'open' &&
      p.date != null &&
      hyphenatedDateString(p.date) < todayDateString &&
      hyphenatedDateString(p.date) >= afterHyphenatedDate,
  );

  const numTasksToUpdate = overdueTasks.length;

  if (numTasksToUpdate > 0) {
    let confirmed = true;
    const pluralTask = numTasksToUpdate != 1 ? 'tasks' : 'task';

    if (withUserConfirm) {
      Editor.openNoteByFilename(note.filename);
      const yesLabel = `🔗 Yes, reschedule (update '>date') ${numTasksToUpdate} ${pluralTask} to today`;
      confirmed = await chooseOption<boolean>(
        `🧹 Ready to sweep '${note.title ?? 'Untitled'}'?`,
        [
          { label: yesLabel, value: true },
          { label: '❌ Skip this note', value: false },
        ],
        false,
      );
    }

    if (confirmed) {
      overdueTasks.forEach((para) => {
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
