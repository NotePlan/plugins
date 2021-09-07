// @flow

/**
 * # How Flow Definitions work:
 *
 * ## The `+` before keys within object types means that key is read-only.
 * - Flow editor plug-ins should give autocomplete for various keys.
 * - Some editor plugins should also show you documentation during autocomplete
 *
 * ## Declaring Global Variables
 * - Every `declare var` declares a variable that is available globally
 * - Every `type` declaration defines that type to be used globally as well.
 * - The `.eslintrc` will also need to be updated to ignore these globals
 *
 * ## Unique Names
 * Variables and Types *must* have unique names from each other. So when there
 * is a collision, the type names is prefixed with a `T`.
 * e.g. `Editor` and `TEditor`.
 *
 * Read More at https://flow.org/en/docs/libdefs/creation/
 *
 */

/**
 * This refers to the markdown editor and the currently opened note.
 * You can access the text directly from here, change the selection and even
 * highlight parts.
 *
 * However, be careful about character positions, because NotePlan hides
 * Markdown characters and replaces whole parts of text such as the URL in
 * Markdown links or folded text with a single symbol. This can make
 * calculating character positions and changing the text a bit tricky. Prefer
 * working with the paragraph objects instead to modify text directly.
 *
 * Here are the available functions you can call with the Editor object:
 */
declare var Editor: TEditor
type TEditor = {
  /**
   * Also all the keys from this object
   */
  ...TParagaraphBridge,
  /**
   * Get the note object of the opened note in the editor
   */
  +note: ?TNote,
  /**
   * Get or set the markdown text of the note (will be saved to file directly)
   */
  content: ?string,
  /**
   * Get title of the note (first line)
   */
  +title: ?string,
  /**
   * Get the type of the note (indicates also where it is saved)
   */
  +type: ?NoteType,
  /**
   * Get the filename of the **note**
   */
  +filename: ?string,
  /**
   * Get or set the array of paragraphs contained in this note, such as tasks,
   * bullets, etc. If you set the paragraphs, the content of the note will be
   * updated.
   */
  paragraphs: $ReadOnlyArray<TParagraph>,
  /**
   * Get an array of selected lines. The cursor doesn't have to select the full
   * line, NotePlan returns all complete lines the cursor "touches".
   */
  +selectedLinesText: $ReadOnlyArray<string>,
  /**
   * Get an array of selected paragraphs. The cursor doesn't have to select the
   * full paragraph, NotePlan returns all complete paragraphs the cursor
   * "touches".
   */
  +selectedParagraphs: $ReadOnlyArray<TParagraph>,
  /**
   * Get the raw selection range (hidden Markdown is considered).
   */
  +selection: ?Range,
  /**
   * Get the rendered selection range (hidden Markdown is NOT considered).
   */
  +renderedSelection: ?Range,
  /**
   * Get the selected text.
   */
  +selectedText: ?string,

  /**
   * Inserts the given text at the given character position (index)
   * @param text 	  - Text to insert
   * @param index   - Position to insert at (you can get this using 'renderedSelection' for example)
   */
  insertTextAtCharacterIndex(text: string, index: number): void,

  /**
   * Inserts the given text at the current cursor position
   * @param text - Text to insert
   */
  insertTextAtCursor(text: string): void,
  /**
   * Inserts a plain paragrah before the selected paragraph (or the paragraph the cursor is currently positioned)
   * @param name - Text of the paragraph
   * @param type - paragraph type
   * @param indents - How much it should be indented
   */
  insertParagraphAtCursor(name: string,
    type: ParagraphType,
    indents: number
  ): void,
  /**
   * Replaces the current cursor selection with the given text
   * @param text - Text to insert
   */
  replaceSelectionWithText(text: string): void,
  /**
   * Opens a note using the given filename
   */
  openNoteByFilename(
    filename: string,
    newWindow?: boolean,
    highlightStart?: number,
    highlightEnd?: number,
  ): Promise<TNote>,
  /**
   * Opens a note by searching for the give title (first line of the note)
   */
  openNoteByTitle(
    title: string,
    newWindow?: boolean,
    highlightStart?: number,
    highlightEnd?: number,
  ): Promise<TNote>,
  /**
   * Opens a note by searching for the give title (first line of the note)
   */
  openNoteByTitleCaseInsensitive(
    title: string,
    newWindow?: boolean,
    caseSensitive?: boolean,
    highlightStart?: number,
    highlightEnd?: number,
  ): Promise<TNote>,
  /**
   * Opens a calendar note by the given date
   */
  openNoteByDate(
    date: Date,
    newWindow?: boolean,
    highlightStart?: number,
    highlightEnd?: number,
  ): Promise<TNote>,
  /**
   * Opens a calendar note by the given date string
   */
  openNoteByDateString(
    filename: string,
    newWindow?: boolean,
    highlightStart?: number,
    highlightEnd?: number,
  ): Promise<TNote | void>,
  /**
   * (Raw) select text in the editor
   * (like select 10 characters = length fromposition 2 = start)
   *
   * Raw means here that the position is calculated with the Markdown revealed,
   * including Markdown links and folded text.
   */
  select(start: number, length: number): void,
  /**
   * (Rendered) select text in the editor
   * (like select 10 characters = length from position 2 = start)
   *
   * Rendered means here that the position is calculated with the Markdown
   * hidden, including Markdown links and folded text.
   */
  renderedSelect(start: number, length: number): void,
  /**
   * Scrolls to and highlights the given paragraph. If the paragraph is folded,
   * it will be unfolded.
   */
  highlight(paragraph: TParagraph): void,
  /**
   * Scrolls to and highlights the given range. If the paragraph is folded, it
   * will be unfolded.
   */
  highlightByRange(range: Range): void,
  /**
   * NOTE: Available from v3.0.23+ (Mac: Build 636+, iOS: Build 562+)
   * Scrolls to and highlights the given range defined by the character index and the character length it should cover. If the paragraph is folded, it will be unfolded.
   */
  highlightByIndex(index: number, length: number): void,
  /**
  * Note: Available from v3.0.26
  * Shows or hides a window with a loading indicator or a progress ring (if progress is defined) and an info text (optional).
  * `text` is optional, if you define it, it will be shown below the loading indicator.
  * `progress` is also optional. If it's defined, the loading indicator will change into a progress ring. Use float numbers from 0-1 to define how much the ring is filled.
  * When you are done, call `showLoading(false)` to hide the window.
  * @param {Bool}
  * @param {String?}
  * @param {Float?}
  */
  showLoading(visible: boolean, text?: ?string, progress?: number): void,
  /**
  * Note: Available from v3.0.26
  * If you call this, anything after `await CommandBar.onAsyncThread()` will run on an asynchronous thread.
  * Use this together with `showLoading`, so that the work you do is not blocking the user interface.
  * Otherwise the loading window will be also blocked.
  *
  * Warning: Don't use any user interface calls (other than showLoading) on an asynchronous thread. The app might crash.
  * You need to return to the main thread before you change anything in the window (such as Editor functions do).
  * Use `onMainThread()` to return to the main thread.
  * @return {Promise}
  */
  onAsyncThread(): Promise<void>,
  /**
  * Note: Available from v3.0.26
  * If you call this, anything after `await CommandBar.onMainThread()` will run on the main thread.
  * Call this after `onAsyncThread`, once your background work is done.
  * It is safe to call Editor and other user interface functions on the main thread.
  * @return {Promise}
  */
  onMainThread(): Promise<void>,
  /**
  * Note: Available from NotePlan v3.1+
  * Get the names of all supported themes (including custom themes imported into the Theme folder).
  * Use together with `.setTheme(name)`
  * @return {[String]}
  */
  availableThemes(): $ReadOnlyArray<string>,
  /**
  * Note: Available from NotePlan v3.1+
  * Change the current theme. Get all available theme names using `.availableThemes`. Custom themes are also supported. Use the filename in this case.
  * @param {String}
  */
  setTheme(name: string): void,
}

/**
 * With DataStore you can query, create and move notes which are cached by
 * NotePlan. It allows you to query a set of user preferences, too.
 */
declare var DataStore: TDataStore
type TDataStore = {
  /**
   * Get the preference for the default file (note) extension,
   * such as "txt" or "md".
   */
  +defaultFileExtension: string,
  /**
   * Get all folders as array of strings. Including the root "/" and exluding
   * folders from Archive or Trash.
   */
  +folders: $ReadOnlyArray<string>,
  /**
   * Get all calendar notes.
   */
  +calendarNotes: $ReadOnlyArray<TNote>,
  /**
   * Get all regular, project notes.
   */
  +projectNotes: $ReadOnlyArray<TNote>,

  // `DataStorePreference` is a function that takes a string and returns
  // different values based on what the string is.
  // Think of `&` as Function Overloading.
  /**
   * Returns the value of a given preference.
   * Available keys:
   * "themeLight"              // theme used in light mode
   * "themeDark"               // theme used in dark mode
   * "fontDelta"               // delta to default font size
   * "firstDayOfWeek"          // first day of calendar week
   * "isAgendaVisible"         // only iOS, indicates if the calendar and note below calendar are visible
   * "isAgendaExpanded"        // only iOS, indicates if calendar above note is shown as week (true) or month (false)
   * "isAsteriskTodo"          // "Recognize * as todo" = checked in markdown preferences
   * "isDashTodo"              // "Recognize - as todo" = checked in markdown preferences
   * "isNumbersTodo"           // "Recognize 1. as todo" = checked in markdown preferences
   * "defaultTodoCharacter"    // returns * or -
   * "isAppendScheduleLinks"   // "Append links when scheduling" checked in todo preferences
   * "isAppendCompletionLinks" // "Append completion date" checked in todo preferences
   * "isCopyScheduleGeneralNoteTodos" // "Only add date when scheduling in notes" checked in todo preferences
   * "isSmartMarkdownLink"     // "Smart Markdown Links" checked in markdown preferences
   * "fontSize"                // Font size defined in editor preferences (might be overwritten by custom theme)
   * "fontFamily"              // Font family defined in editor preferences (might be overwritten by custom theme)
   */
  +preference: ((key: 'themeLight') => ?string) &
    ((key: 'themeDark') => ?string) &
    ((key: 'fontDelta') => number) &
    ((key: 'firstDayOfWeek') => number) &
    ((key: 'isAgendaVisible') => ?boolean) &
    ((key: 'isAgendaExpanded') => ?boolean) &
    ((key: 'isAsteriskTodo') => ?boolean) &
    ((key: 'isDashTodo') => ?boolean) &
    ((key: 'isNumbersTodo') => ?boolean) &
    ((key: 'defaultTodoCharacter') => '*' | '-') &
    ((key: 'isAppendScheduleLinks') => ?boolean) &
    ((key: 'isAppendCompletionLinks') => ?boolean) &
    ((key: 'isCopyScheduleGeneralNoteTodos') => ?boolean) &
    ((key: 'isSmartMarkdownLink') => ?boolean) &
    ((key: 'fontSize') => number) &
    ((key: 'fontFamily') => string),

  /**
   * Returns the calendar note for the given date
   * (can be undefined, if the daily note was not created yet)
   */
  calendarNoteByDate(date: Date): ?TNote,
  /**
   * Returns the calendar note for the given date string
   * (can be undefined, if the daily note was not created yet)
   *
   * Use following format: "YYYYMMDD", example: "20210410"
   */
  calendarNoteByDateString(filename: string): ?TNote,
  /**
   * Returns all regular notes with the given title (first line in editor).
   * Since multiple notes can have the same title, an array is returned.
   * Use 'caseSensitive' (default = false) to search for a note ignoring
   * the case and set 'searchAllFolders' to true if you want to look for
   * notes in trash and archive as well.
   * By default NotePlan won't return notes in trash and archive.
   */
  projectNoteByTitle(
    title: string,
    caseInsensitive: boolean,
    searchAllFolders?: boolean,
  ): ?$ReadOnlyArray<TNote>,
  /**
   * Returns all regular notes with the given case insenstivie title
   * (first line in editor).
   *
   * Since multiple notes can have the same title, an array is returned.
   */
  projectNoteByTitleCaseInsensitive(title: string): ?$ReadOnlyArray<TNote>,
  /**
   * Returns the regular note with the given filename with file-extension
   * (including folders if any, don't add "/" for root, though).
   */
  projectNoteByFilename(filename: string): ?TNote,
  /**
   * Returns a regular or calendar note with the given filename.
   * Type can be "Notes" or "Calendar". Including the file extension.
   *
   * Use "YYYYMMDD.ext" for calendar notes, like "20210503.txt".
   */
  noteByFilename(filename: string, type: NoteType): ?TNote,
  /**
   * Move a regular note using the given filename (with extension) to another
   * folder. Use "/" for the root folder.
   *
   * Returns the final filename
   * (if the there is a duplicate, it will add a number).
   */
  moveNote(noteName: string, folder: string): ?string,
  /**
   * Creates a regular note using the given title and folder.
   * Use "/" for the root folder.
   * It will write the given title as "# title" into the new file.
   *
   * Returns the final filename
   * (if the there is a duplicate, it will add a number).
   */
  newNote(noteTitle: string, folder: string): ?string,
}

/**
 * Use CommandBar to get user input. Either by asking the user to type in a
 * free-form string, like a note title, or by giving him a list of choices.
 * This list can be "fuzzy-search" filtered by the user. So, it's fine to show
 * a long list of options, like all folders or notes or tasks in a note.
 */
declare var CommandBar: TCommandBar
type TCommandBar = {
  /**
   * Get or set the current text input placeholder (what you can read when no
   * input is typed in) of the Command Bar.
   */
  placeholder: string,
  /**
   * Get or set the current text input content of the Command Bar
   * (what the user normally types in).
   */
  searchText: string,
  /**
   * Hides the Command Bar
   */
  hide(): void,
  // show(): void,
  /**
   * Display an array of choices as a list (only strings) which the user can
   * "fuzzy-search" filter by typing something.
   *
   * The user selection is returned as a Promise.
   * So use it with `await CommandBar.showOptions(...)`.
   *
   * The result is a CommandBarResultObject (as Promise success result), which
   * has `.value` and `.index`.
   *
   * It only supports a string array as input for the options, so you might
   * need to map your list first to `Array<string>`.
   *
   * Use the `.index` attribute to refer back to the selected item in the
   * original array.
   */
  showOptions<TOption: string = string>(
    options: $ReadOnlyArray<TOption>,
    placeholder: string,
  ): Promise<{ +index: number, +value: TOption }>,
  /**
   * Asks the user to enter something into the CommandBar.
   *
   * Use the "placeholder" value to display a question,
   * like "Type the nameof the task".
   *
   * Use the "submitText" to describe what happens with the selection,
   * like "Create task named '%@'".
   *
   * The "submitText" value supports the variable "%@" in the string, that
   * NotePlan autofills with the typed text.
   *
   * It returns a Promise, so you can wait (using "await...") for the user
   * input with the entered text as success result.
   */
  showInput(placeholder: string, submitText: string): Promise < string >,
  /**
  * Note: Available from v3.0.26
  * Shows or hides a window with a loading indicator or a progress ring (if progress is defined) and an info text (optional).
  * `text` is optional, if you define it, it will be shown below the loading indicator.
  * `progress` is also optional. If it's defined, the loading indicator will change into a progress ring. Use float numbers from 0-1 to define how much the ring is filled.
  * When you are done, call `showLoading(false)` to hide the window.
  * @param {Bool}
  * @param {String?}
  * @param {Float?}
  */
  showLoading(visible: boolean, text?: string, progress?: number): void,
  /**
  * Note: Available from v3.0.26
  * If you call this, anything after `await CommandBar.onAsyncThread()` will run on an asynchronous thread.
  * Use this together with `showLoading`, so that the work you do is not blocking the user interface.
  * Otherwise the loading window will be also blocked.
  *
  * Warning: Don't use any user interface calls (other than showLoading) on an asynchronous thread. The app might crash.
  * You need to return to the main thread before you change anything in the window (such as Editor functions do).
  * Use `onMainThread()` to return to the main thread.
  */
  onAsyncThread(): Promise <void>,
  /**
  * Note: Available from v3.0.26
  * If you call this, anything after `await CommandBar.onMainThread()` will run on the main thread.
  * Call this after `onAsyncThread`, once your background work is done.
  * It is safe to call Editor and other user interface functions on the main thread.
  */
  onMainThread(): Promise <void>,
}

/**
 * Use Calendar to create events, reminders, and to parse dates, like
 * - "tomorrow at 8am to 10am"
 * - "today"
 * - "1st May"
 *
 * See also `CalendarItem` if you want to create an event or reminder.
 */
declare var Calendar: TCalendar
type CalendarDateUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'
type DateRange = {
  /**
   * The start date of the parsed date text.
   */
  +start: Date,
  /**
   * The end date of the parsed date text. This might not be defined in the
   * date text. Then the end date = start date.
   *
   * If two time or dates are mentioned in the input string of
   * `Calendar.parseDateText(...)`, then the start and end dates will have the
   * respective times and dates set.
   */
  +end: Date,
}
type TCalendar = {
  /**
   * Get all available date units: "year", "month", "day", "hour", "minute", "second"
   */
  +dateUnits: $ReadOnlyArray<CalendarDateUnit>,
  /**
   * Create an event or reminder based on the given CalendarItem.
   * Returns the created CalendarItem with the assigned id, so you can
   * reference it later. If it failed, undefined is returned.
   */
  add(item: TCalendarItem): TCalendarItem | void,
  /**
   * Parses a text describing a text as natural language input into a date.
   * Such as "today", "next week", "1st May", "at 5pm to 6pm", etc.
   *
   * Returns and array with possible results (usually one), the most likely at
   * the top.
   *
   * Access the dates in this array using ".start" and ".end".
   */
  parseDateText(text: string): $ReadOnlyArray<DateRange>,
  /**
   * Create a date object from parts. Like year could be 2021 as a number.
   */
  dateFrom(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
  ): Date,
  /**
   * Add a unit to an existing date. Look up all unit types using `dateUnits`.
   * For example, to add 10 days, use num = 10 and type = "day"
   */
  addUnitToDate(date: Date, unit: CalendarDateUnit, num: number): Date,
  /**
   * Returns the integer of a unit like "year" (should be this year's number).
   * Look up all unit types using `dateUnits`.
   */
  unitOf(date: Date, type: CalendarDateUnit): number,
  /**
   * Returns a description of how much time has past between the date and
   * today = now.
   */
  timeAgoSinceNow(date: Date): string,
  /**
   * Returns the amount of units between the given date and now. Look up all
   * unit types using `dateUnits`.
   */
  unitsUntilNow(date: Date, type: CalendarDateUnit): number,
  /**
   * Returns the amount of units from now and the given date. Look up all unit
   * types using `dateUnits`.
   */
  unitsAgoFromNow(date: Date, type: CalendarDateUnit): number,
  /**
   * Returns the amount of units between the first and second date. Look up all
   * unit types using `dateUnits`.
   */
  unitsBetween(date1: Date, date2: Date, type: CalendarDateUnit): number,
  /**
  * Note: Available from v3.0.25
  * Returns all events between the `startDate` and `endDate`. Use `filter` to search for specific events (keyword in the title).
  * This function fetches events asynchronously, so use async/await.
  * @param {Date}
  * @param {Date}
  * @param {String?}
  * @return {Promise}
  */
  eventsBetween(
    startDate: Date,
    endDate: Date,
    filter?: ?string
  ): Promise<Array<TCalendarItem>>,
  /**
  * Note: Available from v3.0.25
  * Returns all reminders between the `startDate` and `endDate`. Use `filter` to search for specific reminders (keyword in the title).
  * This function fetches reminders asynchronously, so use async/await.
  * @param {Date}
  * @param {Date}
  * @param {String?}
  * @return {Promise}
  */
  remindersBetween(
    startDate: Date,
    endDate: Date,
    filter?: ?string
  ): Promise<Array<TCalendarItem>>,
  /**
  * Note: Available from v3.0.25
  * Returns all events for today. Use `filter` to search for specific events (keyword in the title).
  * This function fetches events asynchronously, so use async/await.
  * @param {String?}
  * @return {Promise}
  */
  eventsToday(filter: ?string): Promise<Array<TCalendarItem>>,
  /**
  * Note: Available from v3.0.25
  * Returns all reminders between for today. Use `filter` to search for specific reminders (keyword in the title).
  * This function fetches reminders asynchronously, so use async/await.
  * @param {String?}
  * @return {Promise}
  */
  remindersToday(filter: ?string): Promise<Array<TCalendarItem>>,
  /**
  * Note: Available from v3.0.26
  * Updates an event or reminder based on the given CalendarItem, which needs to have an ID. 
  * A CalendarItem has an ID, when you have used `.add(...)` and saved the return value or when you query 
  * the event using `eventsBetween(...)`, `remindersBetween(...)`, `eventByID(...)`, `reminderByID(...)`, etc.
  * Returns a promise, because it needs to fetch the original event objects first in the background, 
  * then updates it. Use it with `await`.
  * @param {CalendarItem} 
  * @return {Promise}
  */
  update(calendarItem: TCalendarItem): Promise<void>,
  /**
  * Note: Available from v3.0.26
  * Removes an event or reminder based on the given CalendarItem, which needs to have an ID. 
  * A CalendarItem has an ID, when you have used `.add(...)` and saved the return value or when you query 
  * the event using `eventsBetween(...)`, `remindersBetween(...)`, `eventByID(...)`, `reminderByID(...)`, etc.
  * Returns a promise, because it needs to fetch the original event objects first in the background, 
  * then updates it. Use it with `await`.
  * @param {CalendarItem} 
  * @return {Promise}
  */
  remove(calendarItem: TCalendarItem): Promise<void>,
  /**
  * Note: Available from v3.0.26
  * Returns the event by the given ID. You can get the ID from a CalendarItem, which you got from using `.add(...)` (the return value is a CalendarItem with ID) or when you query the event using `eventsBetween(...)`, `eventByID(...)`, etc.
  * This function fetches reminders asynchronously, so use async/await.
  * @param {String} 
  * @return {Promise(CalendarItem)}
  */
  eventByID(id: string): Promise<Array<TCalendarItem>>,
  /**
  * Note: Available from v3.0.26
  * Returns the reminder by the given ID. You can get the ID from a CalendarItem, which you got from using `.add(...)` (the return value is a CalendarItem with ID) or when you query the event using `remindersBetween(...)`, `reminderByID(...)`, etc.
  * Use with async/await.
  * @param {String} 
  * @return {Promise(CalendarItem)}
  */
  reminderByID(id: string): Promise<Array<TCalendarItem>>,
}

/**
 * You can get paragraphs from `Editor` or `Note`.
 * They represent blocks or lines of text (delimited by linebreaks = \n).
 * A task for example is a paragraph, a list item (bullet), heading, etc.
 */
declare var Paragraph: TParagraph
type TParagraph = {
  /**
   * Get or set the type of the paragraph
   */
  type: ParagraphType,
  /**
   * Get or set the content of the paragraph
   * (without the Markdown 'type' prefix, such as '* [ ]' for open task)
   */
  content: string,
  /**
   * Get the content of the paragraph
   * (with the Markdown 'type' prefix, such as '* [ ]' for open task)
   */
  +rawContent: string,
  /**
   * Get the Markdown prefix of the paragraph (like '* [ ]' for open task)
   */
  +prefix: string,
  /**
   * Get the range of the paragraph.
   */
  +contentRange: Range | void,
  /**
   * Get the line index of the paragraph.
   */
  +lineIndex: number,
  /**
   * Get the date of the paragraph, if any (in case of scheduled tasks).
   */
  +date: Date | void,
  /**
   * Get the heading of the paragraph (looks for a previous heading paragraph).
   */
  +heading: string,
  /**
   * Get the heading range of the paragraph
   * (looks for a previous heading paragraph).
   */
  +headingRange: Range | void,
  /**
   * Get the heading level of the paragraph ('# heading' = level 1).
   */
  +headingLevel: number,
  /**
   * If the task is a recurring one (contains '@repeat(...)')
   */
  +isRecurring: boolean,
  /**
   * Get the amount of indentations.
   */
  +indents: number,
  /**
   * Get the filename of the note this paragraph was loaded from
   */
  +filename: ?string,
  /**
   * Get the note type of the note this paragraph was loaded from.
   */
  +noteType: ?NoteType,
  /**
   * Get the linked note titles this paragraph contains,
   * such as '[[Note Name]]' (will return names without the brackets).
   */
  +linkedNoteTitles: $ReadOnlyArray<string>,
  /**
   * Creates a duplicate object, so you can change values without affecting the
   * original object
   */
  duplicate(): TParagraph,
}

type NoteType = 'Calendar' | 'Notes'
/**
 * Notes can be queried by DataStore. You can change the complete text of the
 * note, which will be saved to file or query, add, remove, or modify
 * particular paragraphs (a paragraph is a task for example). See more
 * paragraph editing examples under Editor. NoteObject and Editor both
 * inherit the same paragraph functions.
 */
type TNote = {
  // All the keys from TParagraphBridge
  ...TParagaraphBridge,
  /**
   * Relative path of the note, so folder/filename including.
   */
  +filename: string,
  /**
   * Type of the note, either "Notes" or "Calendar".
   */
  +type: NoteType,
  /**
   * Title = first line of the note.
   */
  +title: string | void,
  /**
   * Optional date if it's a calendar note
   */
  +date: Date | void,
  /**
   * Date and time when the note was last modified.
   */
  +changedDate: Date,
  /**
   * Date and time of the creation of the note.
   */
  +createdDate: Date,
  /**
   * All #hashtags contained in this note.
   */
  +hashtags: $ReadOnlyArray<string>,
  /**
   * All @mentions contained in this note.
   */
  +mentions: $ReadOnlyArray<string>,
  /**
   * Get or set the raw text of the note
   * (means there is no hidden or rendered Markdown).
   *
   * If you set the content, NotePlan will write it immediately to file.
   * If you get the content, it will be read directly from the file.
   */
  content: string | void,
  /**
   * Get or set paragraphs contained in this note
   * (these can be tasks, plain text, headings...).
   *
   * If you set the paragraph array, it will join them and save the new content
   * to file.
   */
  paragraphs: $ReadOnlyArray<TParagraph>,
}

/**
 * Ranges are used when you deal with selections or need to know where a
 * paragraph is in the complete text.
 */
type Range = {
  /**
   * Character start index of the range.
   */
  +start: number,
  /**
   * Character end index of the range.
   */
  +end: number,
  /**
   * Character length of the range (end - start).
   */
  +length: number,
}

type CalenderItemType = 'event' | 'reminder'
/**
 * The CalendarItem is used in combination with
 * [Calendar](https://help.noteplan.co/article/70-javascript-plugin-api#calendar)
 * to create events or reminders.
 */
declare var CalendarItem: TCalendarItem
type TCalendarItem = {
  /**
   * The ID of the event or reminder after it has been created by
   * `Calendar.add(calendarItem)`.
   *
   * The ID is not set in the original CalendarItem, you need to use the return
   * value of `Calendar.add(calendarItem)` to get it.
   *
   * Use the ID later to refer to this event (to modify or delete).
   */
  +id: string | void,
  /**
   * The title of the event or reminder.
   */
  +title: string,
  /**
   * The date (with time) of the event or reminder.
   */
  +date: Date,
  /**
   * The endDate (with time) of the event (reminders have no endDate).
   * So, this can be optional.
   */
  +endDate: ?Date,
  /**
   * The type of the calendar item, either "event" or "reminder".
   */
  +type: CalenderItemType,
  /**
   * If the calendar item is all-day, means it has no specific time.
   */
  +isAllDay: boolean,
  /**
  * Text saved in the "Notes" field of the event or reminder.
  * Note: Available from v3.0.26
  */
  +notes: string,  
  /**
  * URL saved with the event or reminder.
  * Note: Available from v3.0.26
  */
  +url: string,
  /**
   * Creates a CalendarItem. The .endDate is optional, but recommended for events.
   * Reminders don't use this field.
   *
   * The type can be "event" or "reminder". And isAllDay can be used if you
   * don't want to define a specific time, like holidays.
   */
  create(
    title: string,
    date: Date,
    endDate: Date | void,
    type: CalenderItemType,
    isAllDay: boolean,
  ): TCalendarItem,
}

/**
 * Access and set the data inside the current clipboard.
 */
declare var Clipboard: {
  /**
   * Get or set the current text of the clipboard.
   */
  string: string,
  /**
   * Returns a list of types.
   */
  +types: $ReadOnlyArray<string>,
  /**
   * Set the text of the clipboard using a specific type.
   */
  setStringForType(string: string, type: string): void,
  /**
   * Get the text in the clipboard accessing a specific type.
   */
  stringForType(type: string): ?string,
  /**
   * Get the data in the clipboard accessing a specific type.
   */
  dataForType(type: string): mixed,
  /**
   * Set the data in the clipboard for a specific type.
   */
  setDataForType(data: mixed, type: string): void,
  /**
   * Clears the contents of the clipboard.
   */
  clearContents(): void,
  /**
   * Pass in the types you are interested in and get the available type back.
   */
  availableType(fromTypes: $ReadOnlyArray<string>): ?string,
}

type ParagraphType =
  | 'open'
  | 'done'
  | 'scheduled'
  | 'cancelled'
  | 'title'
  | 'quote'
  | 'list'
  | 'empty'
  | 'text'

declare var ParagaraphBridge: TParagaraphBridge
type TParagaraphBridge = {
  /**
   * Returns a range object of the full paragraph of the given character
   * position.
   */
  paragraphRangeAtCharacterIndex(characterPosition: number): Range,

  /**
   * Inserts a plain paragrah at the given line index
   */
  insertParagraph(name: string, lineIndex: number, type: ParagraphType): void,

  /**
   * Inserts a todo at the given line index
   */
  insertTodo(name: string, lineIndex: number): void,

  /**
   * Inserts a completed todo at the given line index
   */
  insertCompletedTodo(name: string, lineIndex: number): void,

  /**
   * Inserts a cancelled todo at the given line index
   */
  insertCancelledTodo(name: string, lineIndex: number): void,

  /**
   * Inserts a scheduled todo at the given line index
   */
  insertScheduledTodo(name: string, lineIndex: number, date: Date): void,

  /**
   * Inserts a quote at the given line index
   */
  insertQuote(name: string, lineIndex: number): void,

  /**
   * Inserts a list (bullet) item at the given line index
   */
  insertList(name: string, lineIndex: number): void,

  /**
   * Inserts a heading at the given line index
   */
  insertHeading(
    name: string,
    lineIndex: number,
    level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
  ): void,

  /**
   * Appends a todo at the end of the note
   */
  appendTodo(title: string): void,

  /**
   * Prepends a todo at the beginning of the note (after the title heading)
   */
  prependTodo(title: string): void,

  /**
   * Appends a paragraph at the end of the note
   */
  appendParagraph(title: string, type: ParagraphType): void,

  /**
   * Prepends a paragraph at the beginning of the note (after the title heading)
   */
  prependParagraph(title: string, type: ParagraphType): void,

  /**
   * Inserts a todo below the given title of a heading
   * (at the beginning or end of existing text)
   * @param title - Text of the todo
   * @param headingTitle - Title of the heading (without '#  Markdown)
   * @param shouldAppend - If the todo should be appended at the bottom of existing text
   * @param shouldCreate - If the heading should be created if non-existing
   */
  addTodoBelowHeadingTitle(
    title: string,
    headingTitle: string,
    shouldAppend: boolean,
    shouldCreate: boolean,
  ): void,

  /**
   * Inserts a paragraph below the given title of a heading (at the beginning or end of existing text)
   * @param title - Text of the paragraph
   * @param paragraphType
   * @param headingTitle - Title of the heading (without '#  Markdown)
   * @param shouldAppend - If the todo should be appended at the bottom of existing text
   * @param shouldCreate - If the heading should be created if non-existing
   */
  addParagraphBelowHeadingTitle(
    title: string,
    paragraphType: ParagraphType,
    headingTitle: string,
    shouldAppend: boolean,
    shouldCreate: boolean,
  ): void,

  /**
   * Appends a todo below the given heading index (at the end of existing text)
   * @param title - Text of the todo
   * @param headinLineIndex - Line index of the heading (get the line index from a paragraph object)
   */
  appendTodoBelowHeadingLineIndex(title: string, headinLineIndex: number): void,

  /**
   * Appends a paragraph below the given heading index (at the end of existing text)
   * @param title - Text of the paragraph
   * @param paragraphType
   * @param headinLineIndex - Line index of the heading (get the line index from a paragraph object)
   */
  appendParagraphBelowHeadingLineIndex(
    title: string,
    paragraphType: ParagraphType,
    headinLineIndex: number,
  ): void,

  /**
   * Inserts a todo after a given paragraph
   * @param title - Text of the paragraph
   * @param otherParagraph - Another paragraph, get it from `.paragraphs`
   */
  insertTodoAfterParagraph(title: string, otherParagraph: TParagraph): void,

  /**
   * Inserts a todo before a given paragraph
   * @param title - Text of the paragraph
   * @param otherParagraph - Another paragraph, get it from `.paragraphs`
   */
  insertTodoBeforeParagraph(title: string, otherParagraph: TParagraph): void,

  /**
   * Inserts a paragraph after a given paragraph
   * @param title - Text of the paragraph
   * @param otherParagraph - Another paragraph, get it from `.paragraphs`
   * @param paragraphType
   */
  insertParagraphAfterParagraph(
    title: string,
    otherParagraph: TParagraph,
    paragraphType: ParagraphType,
  ): void,

  /**
   * Inserts a paragraph before a given paragraph
   * @param title - Text of the paragraph
   * @param otherParagraph - Another paragraph, get it from `.paragraphs`
   * @param paragraphType
   */
  insertParagraphBeforeParagraph(
    title: string,
    otherParagraph: TParagraph,
    paragraphType: ParagraphType,
  ): void,

  /**
   * Removes a paragraph at a given line index
   * @param lineIndex - Line index of the paragraph
   */
  removeParagraphAtIndex(lineIndex: number): void,

  /**
   * Removes a given paragraph
   * @param paragraph - Paragraph object to remove, get it from `.paragraphs`
   */
  removeParagraph(paragraph: TParagraph): void,

  /**
   * Removes given paragraphs
   * @param paragraphs - Array of Paragraph object to remove, get it from `.paragraphs`
   */
  removeParagraphs(paragraphs: $ReadOnlyArray<TParagraph>): void,

  /**
   * Updates a given paragraph. Get the paragraph, then modify it and update the text in the note or editor using this method.
   * @param {ParagraphObject} paragraph - Paragraph object to update, get it from `.paragraphs`
   */
  updateParagraph(paragraph: TParagraph): void,

  /**
   * Updates an array paragraphs. Get the paragraphs, then modify them and update the text in the note or editor using this method.
   * @param paragraphs - Paragraph objects to update, get it from `.paragraphs`
   */
  updateParagraphs(paragraphs: $ReadOnlyArray<TParagraph>): void,

  /**
   * Replaces the text at the given range with the given text
   * @param text - Text to insert
   * @param location - Position to insert at (you can get this using 'renderedSelection' for example)
   * @param length - Amount of characters to replace from the location
   */
  replaceTextInCharacterRange(
    text: string,
    location: number,
    length: number,
  ): void,
}

// Every function made available must be assigned to `globalThis`
// This type ensures that only functions are made available as plugins
declare var globalThis: { [string]: () => mixed }
