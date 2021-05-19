// @flow strict

import { filenameDateString } from './dateHelpers';
import sweepCalendarNote from './sweepCalendarNote';
import sweepProjectNote from './sweepProjectNote';

const OPTIONS = [
  { label: '7 days', value: 7, unit: 'day' },
  { label: '14 days', value: 14, unit: 'day' },
  { label: '21 days', value: 21, unit: 'day' },
  { label: '1 month', value: 1, unit: 'month' },
  { label: '3 months', value: 3, unit: 'month' },
  { label: '6 months', value: 6, unit: 'month' },
  { label: '1 year', value: 1, unit: 'year' },
  { label: '❌ Cancel', value: 0, unit: 'day' },
];
const DEFAULT_OPTION = { unit: 'day', value: 0 };

export default async function sweepAll(): Promise<void> {
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
