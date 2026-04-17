/**
 * Jest setupFiles (before test files). Helpers such as NPdateTime call getRelativeDates() at module scope;
 * that path expects global DataStore before those modules load. Individual tests may replace global.DataStore.
 */
/* eslint-disable no-undef */
if (typeof global.DataStore === 'undefined' || global.DataStore == null) {
  global.DataStore = {
    settings: { _logLevel: 'none' },
    projectNotes: [],
    calendarNotes: [],
    calendarNoteByDateString: function calendarNoteByDateStringForTests() {
      return null
    },
  }
}
