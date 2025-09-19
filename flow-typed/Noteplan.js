// @flow

/*
 * # How Flow Definitions work:
 *
 * ## The `+` before keys within object types means that key is read-only.
 * - Flow editor plugins should give autocomplete for various keys.
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

/*
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

/**
 * The Editor class. This lets you access the currently opened note.
 */
declare interface TEditor extends CoreNoteFields {
  /**
   * Editor.note
   * Get the note object of the opened note in the editor.
   * WARNING: from @jgclark: since about v3.16.3, Editor operates differently from Note when a note has frontmatter: for the Editor does NOT include frontmatter lines, and they are NOT selectable.
   */
  +note: ?TNote;
  /**
   * Editor.insertTextAtCharacterIndex()
   * Inserts the given text at the given character position (index)
   * @param text 	  - Text to insert
   * @param index   - Position to insert at (you can get this using 'renderedSelection' for example)
   */
  insertTextAtCharacterIndex(text: string, index: number): void;
  /**
   * Editor.selectedLinesText
   * Get an array of selected lines. The cursor doesn't have to select the full
   * line, NotePlan returns all complete lines the cursor "touches".
   */
  +selectedLinesText: $ReadOnlyArray<string>;
  /**
   * Editor.selectedParagraphs
   * Get an array of selected paragraphs. The cursor doesn't have to select the
   * full paragraph, NotePlan returns all complete paragraphs the cursor "touches".
   * Note: not all of the paragraph object data is complete, e.g. "headingLevel", "heading" and other properties may not be set properly.
   * Use the result and a map to get all the correct data, e.g.:
   * const selectedParagraphs = Editor.selectedParagraphs.map((p) => Editor.paragraphs[p.lineIndex])
   * WARNING: remember this will not include the frontmatter lines in the 'lineIndex' count (since ~v3.16.3)
   */
  +selectedParagraphs: $ReadOnlyArray<TParagraph>;
  /**
   * Editor.selection
   * Get the raw selection range (hidden Markdown is considered).
   * Note: frontmatter is not included in the character counts, since ~v3.16.3
   */
  +selection: ?TRange;
  /**
   * Editor.renderedSelection
   * Get the rendered selection range (hidden Markdown is NOT considered).
   */
  +renderedSelection: ?TRange;
  /**
   * Editor.selectedText
   * Get the selected text.
   */
  +selectedText: ?string;

  /**
   * Editor.insertTextAtCursor()
   * Inserts the given text at the current cursor position
   * @param text - Text to insert
   */
  insertTextAtCursor(text: string): void;
  /**
   * Editor.insertParagraphAtCursor()
   * Inserts a plain paragraph before the selected paragraph (or the paragraph the cursor is currently positioned)
   * @param name - Text of the paragraph
   * @param type - paragraph type
   * @param indents - How much it should be indented
   */
  insertParagraphAtCursor(name: string, type: ParagraphType, indents: number): void;
  /**
   * Editor.replaceSelectionWithText()
   * Replaces the current cursor selection with the given text
   * @param text - Text to insert
   */
  replaceSelectionWithText(text: string): void;
  /**
   * Editor.openNoteByFilename()
   * Opens a note using the given filename. Returns the note if it exists or fails, returning null if the file has not been created yet.
   * @param {string} filename - Filename of the note file (can be without extension), but has to include the relative folder such as `folder/filename.txt`. If the note doesn't exist, then returns null
   * @param {boolean?} newWindow - (optional) Open note in new window (default = false)?
   * @param {number?} highlightStart - (optional) Start position of text highlighting
   * @param {number?} highlightEnd - (optional) End position of text highlighting
   * @param {boolean?} splitView - (optional) Open note in a new split view (Note: Available from v3.4)
   * @param {boolean?} createIfNeeded - (optional) Create the note with the given filename if it doesn't exist (only project notes, v3.5.2+)
   * @param {string?} content - (optional) Content to fill the note (replaces contents if the note already existed) (from v3.7.2)
   * @param {boolean?} stayInSpace? - (optional; default = false) Stay in the current Teamspace or Private space for the given filename
   * @return {Promise<TNote>} - When the note has been opened, a promise will be returned (use with await ... or .then())
   * Note: some parameters introduced in v3.4 and v3.5.2
   * Note: stayInSpace parameter available from v3.17.0
   */
  openNoteByFilename(
    filename: string,
    newWindow?: boolean,
    highlightStart?: number,
    highlightEnd?: number,
    splitView?: boolean,
    createIfNeeded?: boolean,
    content?: string,
    stayInSpace?: boolean,
  ): Promise<TNote | void>;
  /**
   * Editor.openNoteByTitle()
   * Opens a note by searching for the give title (first line of the note)
   * Note: 'splitView' parameter available for macOS from v3.4
   * @param {string} title - Title (case sensitive) of the note (first line)
   * @param {boolean} newWindow - (optional) Open note in new window (default = false)?
   * @param {number} highlightStart - (optional) Start position of text highlighting
   * @param {number} highlightEnd - (optional) End position of text highlighting
   * @param {boolean} splitView - (optional) Open note in a new split view
   * @return {Promise<TNote>} - When the note has been opened, a promise will be returned
   */
  openNoteByTitle(title: string, newWindow?: boolean, highlightStart?: number, highlightEnd?: number, splitView?: boolean): Promise<TNote | void>;
  /**
   * Editor.openNoteByTitleCaseInsensitive()
   * Opens a note by searching for the give title (first line of the note)
   * Note: 'splitView' parameter available for macOS from v3.4
   * @param {string} title - Title (case sensitive) of the note (first line)
   * @param {boolean} newWindow - (optional) Open note in new window (default = false)?
   * @param {number} highlightStart - (optional) Start position of text highlighting
   * @param {number} highlightEnd - (optional) End position of text highlighting
   * @param {boolean} splitView - (optional) Open note in a new split view
   * @return {Promise<TNote>} - When the note has been opened, a promise will be returned
   */
  openNoteByTitleCaseInsensitive(
    title: string,
    newWindow?: boolean,
    caseSensitive?: boolean,
    highlightStart?: number,
    highlightEnd?: number,
    splitView?: boolean,
  ): Promise<TNote | void>;
  /**
   * Editor.openNoteByDate()
   * Opens a calendar note by the given date
   * Note: 'splitView' parameter available for macOS from v3.4
   * Note: 'timeframe' parameter available from v3.6
   * Note: 'parent' parameter available from v3.17
   * @param {Date} date - The date that should be opened, this is a normal JavaScript date object
   * @param {boolean?} newWindow - (optional) Open note in new window? (default = false)
   * @param {number?} highlightStart - (optional) Start position of text highlighting
   * @param {number?} highlightEnd - (optional) End position of text highlighting
   * @param {boolean?} splitView - (optional) Open note in a new split view
   * @param {string?} timeframe - (optional) Use "week", "month", "quarter" or "year" to open a calendar note other than a daily one
   * @param {string?} parent - (optional) to specify UUID of Teamspace to look in
   * @return {Promise<TNote>} - When the note has been opened, a promise will be returned
   */
  openNoteByDate(date: Date, newWindow?: boolean, highlightStart?: number, highlightEnd?: number, splitView?: boolean, timeframe?: string, parent?: string): Promise<TNote | void>;
  /**
   * Editor.openNoteByDateString()
   * Opens a calendar note by the given date string.
   * @param {string} dateString - The date string that should be opened, in ISO format ("YYYY-MM-DD") or filename format for days ("YYYYMMDD") or (from v3.6) in "YYYY-Wnn" format for weeks
   * @param {boolean} newWindow - (optional) Open note in new window (default = false)?
   * @param {number} highlightStart - (optional) Start position of text highlighting
   * @param {number} highlightEnd - (optional) End position of text highlighting
   * @param {boolean} splitView - (optional) Open note in a new split view
   * @return {Promise<TNote>} - When the note has been opened, a promise will be returned
   * Note: from v3.6 also accepts weeks in the main parameter
   * Note: ISO Daily dateString available from v3.17.0
   * Note: from v3.17.0, this includes Teamspace calendar notes. Calendar Notes are represented with the ISO date + extension in the path.
   */
  openNoteByDateString(dateString: string, newWindow?: boolean, highlightStart?: number, highlightEnd?: number, splitView?: boolean): Promise<TNote | void>;
  /**
   * Editor.openWeeklyNote()
   * Opens a weekly calendar note by the given year and week number
   * Note: available from v3.6
   * @param {number} year           - The year of the week
   * @param {number} weeknumber     - The number of the week (0-52/53)
   * @param {boolean} newWindow     - (optional) Open note in new window (default = false)?
   * @param {number} highlightStart - (optional) Start position of text highlighting
   * @param {number} highlightEnd   - (optional) End position of text highlighting
   * @param {boolean} splitView     - (optional) Open note in a new split view
   * @return {Promise<void>}        - When the note has been opened, a promise will be returned
   */
  openWeeklyNote(year: number, weeknumber: number, newWindow?: boolean, highlightStart?: number, highlightEnd?: number, splitView?: boolean): Promise<TNote | void>;
  /**
   * Editor.selectAll()
   * Selects the full text in the Editor.
   * Note: Available from v3.2
   * Note: From ~v3.16.3, this does not include the frontmatter lines.
   */
  selectAll(): void;
  /**
   * Editor.select()
   * (Raw) select text in the editor (like select 10 characters = length from position 2 = start)
   * Raw means here that the position is calculated with the Markdown revealed, including Markdown links and folded text.
   * Note: From ~v3.16.3, this does not include the frontmatter lines.
   * @param {number} start - Character start position
   * @param {number} length - Character length
   */
  select(start: number, length: number): void;
  /**
   * Editor.renderedSelect()
   * (Rendered) select text in the editor (like select 10 characters = length from position 2 = start)
   * Rendered means here that the position is calculated with the Markdown hidden, including Markdown links and folded text.
   * Note: From ~v3.16.3, this does not include the frontmatter lines.
   * @param {number} start - Character start position
   * @param {number} length - Character length
   */
  renderedSelect(start: number, length: number): void;
  /**
   * Editor.copySelection()
   * Copies the currently selected text in the editor to the system clipboard.
   * See also Clipboard object.
   * Note: Available from v3.2
   */
  copySelection(): void;
  /**
   * Editor.pasteClipboard()
   * Pastes the current content in the system clipboard into the current selection in the editor.
   * See also Clipboard object.
   * Note: Available from v3.2
   */
  pasteClipboard(): void;
  /**
   * Editor.highlight()
   * Scrolls to and highlights the given paragraph.
   * If the paragraph is folded, it will be unfolded.
   * Note: From ~v3.16.3, this does not include the frontmatter lines.
   * @param {TParagraph} paragraph to highlight
   */
  highlight(paragraph: TParagraph): void;
  /**
   * Editor.highlightByRange()
   * Scrolls to and highlights the given character range.
   * If the range exists in a folded heading, it will be unfolded.
   * Note: From ~v3.16.3, this does not include the frontmatter lines.
   * @param {Range} range
   */
  highlightByRange(range: TRange): void;
  /**
   * Editor.highlightByIndex()
   * Scrolls to and highlights the given range defined by the character index and the character length it should cover.
   * If the paragraph is folded, it will be unfolded.
   * Note: Available from v3.0.23
   * Note: From ~v3.16.3, this does not include the frontmatter lines.
   * @param {number} index
   * @param {number} length
   */
  highlightByIndex(index: number, length: number): void;
  /**
   * Editor.toggleFolding()
   * Folds the given paragraph or unfolds it if its already folded. If the paragraph is not a heading, it will look for the heading this paragraph exists under.
   * Note: Available from v3.6.0
   * @param {TParagraph}
   */
  toggleFolding(paragraph: TParagraph): void;
  /**
   * Editor.isFolded()
   * Checks if the given paragraph is folded or not. If it's not a heading, it will look for the heading this paragraph exists under.
   * Note: Available from v3.6.0
   * @param {TParagraph}
   * @return {boolean}
   */
  isFolded(paragraph: TParagraph): boolean;
  /**
   * Editor.showLoading()
   * Shows or hides a window with a loading indicator or a progress ring (if progress is defined) and an info text (optional).
   * `text` is optional, if you define it, it will be shown below the loading indicator.
   * `progress` is also optional. If it's defined, the loading indicator will change into a progress ring. Use float numbers from 0-1 to define how much the ring is filled.
   * When you are done, call `showLoading(false)` to hide the window.
   * Note: Available from v3.0.26
   * @param {boolean}
   * @param {string?}
   * @param {Float?}
   */
  showLoading(visible: boolean, text?: ?string, progress?: number): void;
  /**
   * Editor.onAsyncThread()
   * If you call this, anything after `await CommandBar.onAsyncThread()` will run on an asynchronous thread.
   * Use this together with `showLoading`, so that the work you do is not blocking the user interface.
   * Otherwise the loading window will be also blocked.
   *
   * Warning: Don't use any user interface calls (including Editor.* calls, other than showLoading) on an asynchronous thread. The app might crash.
   * You need to return to the main thread before you change anything in the window (such as Editor functions do).
   * Use `onMainThread()` to return to the main thread.
   * Note: Available from v3.0.26
   * @return {Promise}
   */
  onAsyncThread(): Promise<void>;
  /**
   * Editor.onMainThread()
   * If you call this, anything after `await CommandBar.onMainThread()` will run on the main thread.
   * Call this after `onAsyncThread`, once your background work is done.
   * It is safe to call Editor and other user interface functions on the main thread.
   * Note: Available from v3.0.26
   * @return {Promise}
   */
  onMainThread(): Promise<void>;
  /**
   * Editor.save()
   * Save content of Editor to file. This can be used before updateCache() to ensure latest changes are available quickly.
   * Warning: beware possiblity of this causing an infinite loop, particularly if used in a function call be an onEditorWillSave trigger.
   * WARNING: from @jgclark and @dwertheimer: use helper editor.js function saveEditorIfNecessary() instead, as too often this silently fails, and stops plugins from running.
   * Note: Available from 3.9.3
   */
  save(): Promise<void>;
  /**
   * Editor.availableThemes
   * Get the names of all supported themes (including custom themes imported into the Theme folder).
   * Use together with `.setTheme(name)`
   * Note: available from v3.6.2, returning array of these objects:
   * {
      "name": String, // name as in the JSON
      "mode": String, // "dark", or "light" = reported value in the json
      "filename": String, // filename.json in the folder
      "values": Object // fully parsed JSON theme file
    }
   * (Originally available from v3.1, returning a read-only array of strings)
   * @return {$ReadOnlyArray<Object>}
   */
  +availableThemes: $ReadOnlyArray<Object>;
  /**
   * Editor.currentTheme
   * Get the current theme name and mode as an object with these keys:
   *  - "name" in the JSON theme
   *  - "filename" of the JSON theme file
   *  - "mode" ("dark" or "light")
   *  - "values" -- all the JSON in the theme
   * Note: Available from NotePlan v3.6.2 (build >847)
   * @return {Object}
   */
  +currentTheme: Object;
  /**
   * Editor.setTheme()
   * Change the current theme.
   * Get all available theme names using `.availableThemes`. Custom themes are also supported.
   * Note: Available from NotePlan v3.1
   * @param {string} name of theme to change to.
   */
  setTheme(name: string): void;
  /**
   * Editor.saveDefaultTheme()
   * Save theme as the default for the specified mode.
   * @param {string} theme_name (already-installed; not filename)
   * @param {string} mode "dark" | "light" | "auto"
   */
  saveDefaultTheme(name: string, mode: string): void;
  /**
   * Editor.addTheme()
   * Add a new theme using the raw json string. It will be added as a custom theme and you can load it right away with `.setTheme(name)` using the filename defined as second parameter. Use ".json" as file extension.
   * It returns true if adding was successful and false if not. An error will be also printed into the console.
   * Adding a theme might fail, if the given json text was invalid.
   * Note: Available from v3.1
   * @param {string} json
   * @param {string} filename
   * @returns {boolean}
   */
  addTheme(json: string, filename: string): boolean;
  /**
   * Editor.currentSystemMode
   * Get the current system mode, either "dark" or "light.
   * Note: Available from NotePlan v3.6.2+
   * @returns {string}
   */
  +currentSystemMode: string;

  /**
   * Editor.id
   * Get a unique ID for the editor to make it easier to identify it later
   * Note: Available from NotePlan v3.8.1 build 973
   * @returns {string}
   */
  +id: string;
  /**
   * Editor.customId
   * Set / get a custom identifier, so you don't need to cache the unique id.
   * Generally speaking you should set (or at least start) this string with the plugin's ID, e.g. pluginJson['plugin.id']
   * Note: Available from NotePlan v3.8.1 build 973
   * @returns {string}
   */
  customId: string;
  /**
   * Editor.windowType
   * Get the type of window where the editor is embedded in.
   * Possible values: main|split|floating|unsupported
   * It's unsupported on iOS at the moment.
   * Note: Available from NotePlan v3.8.1 build 973
   * @returns {string}
   */
  +windowType: string;
  /**
   * Editor.focus()
   * Get the cursor into a specific editor and send the window to the front.
   * Note: Available from NotePlan v3.8.1 build 973
   */
  focus(): void;
  /**
   * Editor.close()
   * Close the split view or window. If it's the main note, it will close the complete main window.
   * Note: Available from NotePlan v3.8.1 build 973
   */
  close(): void;
  /**
   * Editor.windowRect
   * Set / get the position and size of the window that contains the editor. Returns an object with x, y, width, height values.
   * If you want to change the coordinates or size, save the rect in a variable, modify the variable, then assign it to windowRect.
   * The position of the window might not be very intuitive, because the coordinate system of the screen works differently (starts at the bottom left for example). Recommended is to adjust the size and position of the window relatively to it's values or other windows.
   * Example:
   *   const rect = Editor.windowRect
   *   rect.height -= 50
   *   Editor.windowRect = rect
   *
   * Note: from JGC: for split & main windows, x/y returns the position and size of the whole window
   * WARNING: from JGC: for split & main windows, height is reliable, but width doesn't always seem to be consistent.
   * WARNING: from JGC: for floating Editor windows, setting this doesn't seem reliable
   * Note: Available with v3.9.1 build 1020
   */
  windowRect: Rect;
  /**
   * Editor.skipNextRepeatDeletionCheck
   * Prevents the next "Delete future todos" dialog when deleting a line with a @repeat(...) tag. Will be reset automatically.
   * Note: introduced in 3.15 build 1284/1230
   * @param {boolean}
   */
  skipNextRepeatDeletionCheck: boolean;
  /**
   * Editor.setFrontmatterAttribute()
   * Sets a frontmatter attribute with the given key and value.
   * If the key already exists, updates its value. If it doesn't exist, adds a new key-value pair.
   * To set multiple frontmatter attributes, use frontmatterAttributes = key-value object.
   * @param {string} key - The frontmatter key to set
   * @param {string} value - The value to set for the key
   * Note: Available from v3.17 - only for Editor!
   */
  setFrontmatterAttribute(key: string, value: string): void;
}

/**
 * With DataStore you can query, create and move notes which are cached by
 * NotePlan. It allows you to query a set of user preferences, too.
 */
type TDataStore = Class<DataStore>
declare class DataStore {
  // Impossible constructor
  constructor(_: empty): empty;
  /**
   * DataStore.defaultFileExtension
   * Get the preference for the default file (note) extension,
   * such as "txt" or "md".
   */
  static +defaultFileExtension: string;
  /**
   * DataStore.folders
   * Get all folders as array of strings.
   * Note: Includes the root "/" and folders that begin with "@" such as "@Archive" and "@Templates". It excludes the trash folder though.
   * Note: from v3.18.0 v1417, this includes Teamspace root folders.
   */
  static +folders: $ReadOnlyArray<string>;
  /**
   * DataStore.createFolder()
   * Create folder, if it doesn't already exist.
   * e.g. `DataStore.createFolder("test/hello world")`
   * Returns true if created OK (or it already existed) and false otherwise.
   * Note: Available from v3.8.0
   * @param {string} folderPath
   * @returns {boolean} succesful?
   */
  static createFolder(folderPath: string): boolean;
  /**
   * DataStore.calendarNotes
   * Get all calendar notes.
   * Note: from v3.4 this includes all future-referenced dates, not just those with an actual created note.
   * Note: from v3.17.0, this includes Teamspace calendar notes (with the teamspace ID in the filename).
   */
  static +calendarNotes: $ReadOnlyArray<TNote>;
  /**
   * DataStore.projectNotes
   * Get all regular notes (earlier called "project notes").
   * From v3.17.0, this includes Teamspace regular notes. These have as their 'filename' a path represented with an ID, followed by any number of folders, and then a note ID.
   * Example: %%NotePlanCloud%%/275ce631-6c20-4f76-b5fd-a082a9ac5160/Projects/Research/b79735c9-144b-4fbf-8633-eaeb40c182fa
   * Note: This includes notes and templates from folders that begin with "@" such as "@Archive" and "@Templates". It excludes notes in the trash folder though.
   * Note: @jgclark adds that this will return non-note document files (e.g. PDFs) as well as notes.
   */
  static +projectNotes: $ReadOnlyArray<TNote>;
  /**
   * DataStore.hashtags
   * Get all cached hashtags (#tag) that are used across notes.
   * It returns hashtags without leading '#'.
   * @type {Array<string>}
   * Note: Available from v3.6.0
   */
  static +hashtags: $ReadOnlyArray<string>;
  /**
   * DataStore.mentions
   * Get all cached mentions (@name) that are used across notes.
   * It returns mentions without leading '@'.
   * Note: Available from v3.6.0
   * @type {Array<string>}
   */
  static +mentions: $ReadOnlyArray<string>;
  /**
   * DataStore.filters
   * Get list of all filter names
   * Note: Available from v3.6.0
   * @type {Array<string>}
   */
  static +filters: $ReadOnlyArray<string>;
  /**
   * DataStore.settings
   * Get or set settings for the current plugin (as a JavaScript object).
   * Example: settings.shortcutExpenses[0].category
   * Note: Available from v3.3.2
   */
  static settings: Object;
  /**
   * DataStore.teamspaces
   * DataStore.teamspaces returns an array of teamspaces represented as Note Objects with title and filename populated. Example of a filename: %%NotePlanCloud%%/275ce631-6c20-4f76-b5fd-a082a9ac5160
   * Note: No object for private notes is included here.
   * Note: Available from v3.17.0
   */
  static teamspaces: $ReadOnlyArray<TNote>;

  /**
   * DataStore.preference()
   * Returns the value of a given preference.
   * Available keys for built-in NotePlan preferences:
   *   "themeLight"              // theme used in light mode
   *   "themeDark"               // theme used in dark mode
   *   "fontDelta"               // delta to default font size
   *   "firstDayOfWeek"          // first day of calendar week
   *   "isAgendaVisible"         // only iOS, indicates if the calendar and note below calendar are visible
   *   "isAgendaExpanded"        // only iOS, indicates if calendar above note is shown as week (true) or month (false)
   *   "isAsteriskTodo"          // "Recognize * as todo" = checked in markdown preferences
   *   "isDashTodo"              // "Recognize - as todo" = checked in markdown preferences
   *   "isNumbersTodo"           // "Recognize 1. as todo" = checked in markdown preferences
   *   "defaultTodoCharacter"    // returns * or -
   *   "isAppendScheduleLinks"   // "Append links when scheduling" checked in todo preferences
   *   "isAppendCompletionLinks" // "Append completion date" checked in todo preferences
   *   "isCopyScheduleGeneralNoteTodos" // "Only add date when scheduling in notes" checked in todo preferences
   *   "isSmartMarkdownLink"     // "Smart Markdown Links" checked in markdown preferences
   *   "fontSize"                // Font size defined in editor preferences (might be overwritten by custom theme)
   *   "fontFamily"              // Font family defined in editor preferences (might be overwritten by custom theme)
   *   "timeblockTextMustContainString" // Optional text to trigger timeblock detection in a line. JGC notes that this is case sensitive and must match on a whole word.
   *   "openAIKey" // Optional user's openAIKey (from v3.9.3 build 1063)
   * Others can be set by plugins.
   * Note: these keys and values do not sync across a user's devices; they are only local.
   * The keys are case-sensitive (it uses the Apple UserDefaults mechanism).
   */
  static +preference: (key: string) => mixed;
  /**
   * DataStore.setPreference()
   * Change a saved preference or create a new one.
   * It will most likely be picked up by NotePlan after a restart, if you use one of the keys utilized by NotePlan.
   *
   * To change a NotePlan preference, use the keys found in the description of the function `.preference(key)` above.
   * You can also save custom preferences specific to the plugin, if you need any.
   * Note: @jgclark asks you prepend 'key' with the plugin id or similar to avoid collisions with keys from other plugins.
   * Note: these keys and values do not sync across a user's devices; they are only local.
   * Note: Available from v3.1
   * @param {string}
   * @param {any}
   */
  static setPreference(key: string, value: mixed): void;
  /**
   * DataStore.saveJSON()
   * Save a JavaScript object to the Plugins folder as JSON file.
   * This can be used to save preferences or other persistent data.
   * It's saved automatically into a new folder "data" in the Plugins folder.
   * But you can "escape" this folder using relative paths: ../Plugins/<folder or filename>.
   * Note: Available from v3.1
   * @param {Object} jsonData to save
   * @param {string?} filename (defaults to plugin's setting.json file)
   * @param {boolean?} shouldBlockUpdate? (defaults to false)
   * @returns {boolean} success
   */
  static saveJSON(object: Object, filename?: string, shouldBlockUpdate?: boolean): boolean;
  /**
   * DataStore.loadJSON()
   * Load a JavaScript object from a JSON file located (by default) in the <Plugin>/data folder.
   * But you can also use relative paths: ../Plugins/<folder or filename>.
   * Note: this can return a single string within the object, and so may need to be JSON.parse()d.
   * Note: Available from v3.1
   * @param {string} filename (defaults to plugin's setting.json)
   * @returns {Object}
   */
  static loadJSON(filename?: string): Object;
  /**
   * DataStore.saveData()
   * Save data to a file.
   * Can use this with base64 encoding to save arbitary binary data, or with string-based data (using loadAsString flag).
   * The file will be saved under "[NotePlan Folder]/Plugins/data/[plugin-id]/[filename]".
   * If the file already exists, it will be over-written.
   * Returns true if the file could be saved, false if not and prints the error.
   * Note: Available from v3.2.0; loadAsString option only from v3.6.2.
   * @param {string} data to write
   * @param {string} filename to write to
   * @param {boolean} loadAsString?
   * @returns {boolean}
   */
  static saveData(data: string, filename: string, loadAsString: boolean): boolean;
  /**
   * DataStore.loadData()
   * Load data from a file.
   * Can be used with saveData() to save and load binary data from encoded as a base64 string, or string-based data (using loadAsString flag).
   * The file has to be located in "[NotePlan Folder]/Plugins/data/[plugin-id]/[filename]".
   * You can access the files of other plugins as well, if the filename is known using relative paths "../[other plugin-id]/[filename]" or simply go into the "data"'s root directory "../[filename]" to access a global file.
   * Returns undefined if the file couldn't be loaded and prints an error message.
   * Note: Available from v3.2.0; loadAsString option only from v3.6.2.
   * @param {string} filename
   * @param {boolean} loadAsString?
   * @returns {string?}
   */
  static loadData(filename: string, loadAsString: boolean): ?string;
  /**
   * DataStore.listOverdueTasks()
   * Get list of all overdue tasks as paragraphs
   * Note: Available from v3.8.1
   * @type {Array<TParagraph>}
   */
  static listOverdueTasks(): $ReadOnlyArray<TParagraph>;
  /**
   * DataStore.fileExists()
   * Check to see if a file in the available folders exists.
   * It starts in the plugin's own data folder, but can be used to check for files in other folders.
   * Note: Available from v3.8.1
   * @param {string} filename
   * @returns {boolean}
   */
  static fileExists(filename: string): boolean;
  /**
   * DataStore.calendarNoteByDate()
   * Returns the calendar note for the given date and timeframe (optional, the default is "day", see below for more options).
   * Note: from v3.17.0, this includes Teamspace calendar notes. Calendar Notes are represented with the ISO date + extension in the path.
   * Note: 'timeframe' available from v3.6.0
   * Note: 'parent' available from v3.17.0
   * WARNING: @jgclark: I think from use in Dashboard, this is unreliable, but I can't yet prove it. Instead use calendarNoteByDateString() below.
   *
   * @param {Date}
   * @param {string?} timeframe: "day" (default), "week", "month", "quarter" or "year"
   * @param {string?} parent: Teamspace (if relevant) = the ID or filename of the teamspace it belongs to. If left undefined, the private calendar note will be returned as before.
   * @returns {NoteObject}
   */
  static calendarNoteByDate(date: Date, timeframe?: string, parent?: string): ?TNote;
  /**
   * DataStore.calendarNoteByDateString()
   * Returns the calendar note for the given date string (can be undefined, if the calendar note was not created yet). See the date formats below for various types of calendar notes:
   * Daily: "YYYYMMDD", example: "20210410" or "YYYY-MM-DD", example: "2021-04-10"
   * Weekly: "YYYY-Wwn", example: "2022-W24"
   * Quarter: "YYYY-Qq", example: "2022-Q4"
   * Monthly: "YYYY-MM", example: "2022-10"
   * Yearly: "YYYY", example: "2022".
   * Note: from v3.17.0, this includes Teamspace calendar notes. Calendar Notes are represented with the ISO date + extension in the path.
   * Note: ISO Daily dateString available from v3.17.0
   * Note: Some timeframes available from v3.7.2
   * Note: 'parent' available from v3.17.0
   * Note: In response to questions about yet-to-exist future dates, @EM says "The file gets created when you assign content to a future, non-existing note." In this situation when this call is made, note.content will be empty (or undefined?), but can be set).
   * @param {string} dateString
   * @param {TTeamspaceID? | string?} parent: Teamspace (if relevant) = the ID or filename of the teamspace it belongs to. If left undefined, the private calendar note will be returned as before.
   * @returns {NoteObject}
   */
  static calendarNoteByDateString(dateString: string, parent?: TTeamspaceID | string): ?TNote;
  /**
   * DataStore.projectNoteByTitle()
   * Returns all regular notes with the given title.
   * Since multiple notes can have the same title, an array is returned.
   * Use 'caseSensitive' (default = false) to search for a note ignoring
   * the case and set 'searchAllFolders' to true if you want to look for
   * notes in trash and archive as well.
   * By default NotePlan won't return notes in trash and archive.
   */
  static projectNoteByTitle(title: string, caseInsensitive?: boolean, searchAllFolders?: boolean): ?$ReadOnlyArray<TNote>;
  /**
   * DataStore.projectNoteByTitleCaseInsensitive()
   * Returns all regular notes with the given case insensitive title.
   * Note: Since multiple notes can have the same title, an array is returned.
   */
  static projectNoteByTitleCaseInsensitive(title: string): ?$ReadOnlyArray<TNote>;
  /**
   * DataStore.projectNoteByFilename()
   * Returns the regular note with the given filename (including file-extension).
   * The filename has to include the relative folder such as folder/filename.txt` but without leading slash. Use no leading slash if it's in the root folder.
   * WARNING: @jgclark reports that this doesn't work for Teamspace notes.
   */
  static projectNoteByFilename(filename: string): ?TNote;
  /**
   * DataStore.noteByFilename()
   * Returns a regular or calendar note for the given filename. Type can be "Notes" or "Calendar". Include relative folder and file extension (`folder/filename.txt` for example).
   * Use "YYYYMMDD.ext" for calendar notes, like "20210503.txt".
   * Note: 'parent' available from v3.17.0
   * @param {string} filename
   * @param {NoteType} type
   * @param {string?} parent: Teamspace (if relevant) = the ID or filename of the teamspace it belongs to. Applies only to calendar notes.
   * @returns {?TNote}
   */
  static noteByFilename(filename: string, type: NoteType, parent?: string): ?TNote;
  /**
   * DataStore.moveNote()
   * Move a regular note using the given filename (with extension) to another folder. Use "/" for the root folder.
   * Note: Can also move *folders* by specifying its filename (without trailing slash).
   * Note: You can also use this to delete notes or folders by moveNote(filepath, '@Trash'). @jgclark adds that @EM confirmed on 2025-08-05 that this doesn't work for Teamspace notes (at least as of v3.18.1).
   * Note: from v3.9.3 you can also use 'type' set to 'Calendar' to move a calendar note.
   * Returns the final filename; if the there is a duplicate, it will add a number.
   * @param {string} filename of the new note
   * @param {string} folder to move the note to
   * @param {NoteType} type? for note
   * @returns {?string} resulting final filename
   */
  static moveNote(filename: string, folder: string, type?: NoteType): ?string;
  /**
   * DataStore.newNote()
   * Creates a regular note using the given title and folder.
   * Use "/" for the root folder.
   * It will write the given title as "# title" into the new file.
   * Returns the final filename; if the there is a duplicate, it will add a number.
   * Note: @jgclark finds that if 'folder' has different capitalisation than an existing folder, NP gets confused, in a way that reset caches doesn't solve. It needs a restart.
   * @param {string} noteTitle of the new note
   * @param {string} folder to create the note in
   * @returns {?string} resulting final filename
   */
  static newNote(noteTitle: string, folder: string): ?string;
  /**
   * DataStore.newNoteWithContent()
   * Creates a regular note using the given content, folder and filename. Use "/" for the root folder.
   * The content should ideally also include a note title at the top.
   * Returns the final filename with relative folder (`folder/filename.txt` for example).
   * If the there is a duplicate, it will add a number.
   * Alternatively, you can also define the filename as the third optional variable (v3.5.2+)
   * Note: available from v3.5, with 'filename' parameter added in v3.5.2
   * @param {string} content for note
   * @param {string} folder to create the note in
   * @param {string} filename of the new note (optional) (available from v3.5.2)
   * @returns {string}
   */
  static newNoteWithContent(content: string, folder: string, filename?: string): string;

  /**
   * DataStore.referencedBlocks()
   * Returns an array of paragraphs having the same blockID like the given one (which is also part of the return array).
   * Note: @jgclark comments that this use does *not* appear to return the original paragraph in the array. (At least from 2023 to mid 2025.)
   * Or use without an argument to return all paragraphs with blockIDs.
   * You can use `paragraph[0].note` to access the note behind it and make updates via `paragraph[0].note.updateParagraph(paragraph[0])` if you make changes to the content, type, etc (like checking it off as type = "done").
   * Note: Available from v3.5.2
   * @param {TParagraph}
   * @return {Array<TParagraph>}
   */
  static referencedBlocks(): Array<TParagraph>;
  static referencedBlocks(paragraph: TParagraph): Array<TParagraph>;

  /**
   * DataStore.updateCache()
   * Updates the cache, so you can access changes faster.
   * 'shouldUpdateTags' parameter controls whether to update .hashtags and .mentions too.
   * EM also commented "[and] things like .backlinks".
   * If so, the note has to be reloaded for the updated .mentions to be available.
   * EM has also said "It doesn't have to be async, because it runs on the same thread and updates the cache directly, but that has nothing to do with the content of the paragraph or note, that's read directly out of the file again".
   *
   * Note: Available from NotePlan v3.7.1
   * @param {TNote} note to update
   * @param {boolean} shouldUpdateTags?
   * @returns {TNote?} updated note object
   */
  static updateCache(note: TNote, shouldUpdateTags: boolean): TNote | null;

  /**
   * DataStore.listPlugins()
   * Loads all available plugins asynchronously from the GitHub repository and returns a list.
   * Note: Available from NotePlan v3.5.2; 'skipMatchingLocalPlugins' added v3.7.2 build 926
   * @param {boolean} showLoading? - You can show a loading indicator using the first parameter (true) if this is part of some user interaction. Otherwise, pass "false" so it happens in the background.
   * @param {boolean} showHidden? - Set `showHidden` to true if it should also load hidden plugins. Hidden plugins have a flag `isHidden`
   * @param {boolean} skipMatchingLocalPlugins? - Set the third parameter `skipMatchingLocalPlugins` to true if you want to see only the available plugins from GitHub and not merge the data with the locally available plugins. Then the version will always be that of the plugin that is available online.
   * @return {Promise<any>} pluginList
   */
  static listPlugins(showLoading?: boolean, showHidden?: boolean, skipMatchingLocalPlugins?: boolean): Promise<Array<PluginObject>>;
  /**
   * DataStore.installPlugin()
   * Installs a given plugin (load a list of plugins using `.listPlugins` first). If this is part of a user interfaction, pass "true" for `showLoading` to show a loading indicator.
   * Note: Available from v3.5.2
   * @param {PluginObject}
   * @param {boolean}
   * @return {Promise<PluginObject>} the pluginObject of the installed plugin
   */
  static installPlugin(pluginObject: PluginObject, showLoading?: boolean): Promise<PluginObject>;
  /**
   * DataStore.installedPlugins()
   * Returns all installed plugins as PluginObject(s).
   * Note: Available from v3.5.2
   * @return {Array<PluginObject>}
   */
  static installedPlugins(): Array<PluginObject>;
  /**
   * DataStore.invokePluginCommand()
   * Invoke a given command from a plugin (load a list of plugins using `.listPlugins` first, then get the command from the `.commands` list).
   * If the command supports it, you can also pass an array of arguments which can contain any type (object, date, string, integer,...)
   * It returns the particular return value of that command which can be a Promise so you can use it with `await`.
   * You can await for a return value, but even if you plan to ignore the value, the receiving function should return a value (even a blank {}) or you will get an error in the log
   * Note: Available from v3.5.2
   * @param {PluginCommandObject}
   * @param {$ReadOnlyArray<mixed>}
   * @return {any} Return value of the command, like a Promise
   */
  static invokePluginCommand(command: PluginCommandObject, arguments: $ReadOnlyArray<mixed>): Promise<any>;
  /**
   * DataStore.invokePluginCommandByName()
   * Invoke a given command from a plugin using the name and plugin ID, so you don't need to load it from the list.
   * If the command doesn't exist locally null will be returned with a log message.
   * If the command supports it, you can also pass an array of arguments which can contain any type (object, date, string, integer,...)
   * You can await for a return value, but even if you plan to ignore the value, the receiving function should return a value (even a blank {}) or you will get an error in the log
   * Note: Available from v3.5.2
   * @param {string} - commandName - the NAME field from the command in plugin.json (not the jsFunction!)
   * @param {string}
   * @param {$ReadOnlyArray<mixed>}
   * @return {any} Return value of the command, like a Promise
   */
  static invokePluginCommandByName(commandName: string, pluginID: string, arguments?: $ReadOnlyArray<mixed>): Promise<any>;
  /**
   * DataStore.isPluginInstalledByID()
   * Checks if the given pluginID is installed or not.
   * Note: Available from v3.6.0
   * @param {string}
   * @return {boolean}
   */
  static isPluginInstalledByID(pluginID: string): boolean;
  /**
   * DataStore.installOrUpdatePluginsByID()
   * Installs a given array of pluginIDs if needed. It checks online if a new version is available and downloads it.
   * Use it without `await` so it keeps running in the background or use it with `await` in "blocking mode" if you need to install a plugin as a dependency. In this case you can use `showPromptIfSuccessful = true` to show the user a message that a plugin was installed and `showProgressPrompt` will show a loading indicator beforehand. With both values set to false or not defined it will run in "silent" mode and show no prompts.
   * returns an object with an error code and a message { code: -1, message: "something went wrong" } for example. Anything code >= 0 is a success.
   * Note: Available from v3.6.0
   * @param {Array<string>} IDs
   * @param {boolean} showPromptIfSuccessful
   * @param {boolean} showProgressPrompt
   * @param {boolean} showFailedPrompt
   * @return {Promise<{number, string}>}
   */
  static installOrUpdatePluginsByID(
    pluginIDs: Array<string>,
    showPromptIfSuccessful: boolean,
    showProgressPrompt: boolean,
    showFailedPrompt: boolean,
  ): Promise<{ code: number, message: string }>;

  /**
   * DataStore.search()
   * Searches all notes for a keyword (uses multiple threads to speed it up).
   * By default it searches in project notes and in the calendar notes. Use the second parameters "typesToInclude" to include specific types. Otherwise, pass `null` or nothing to include all of them.
   * This function is async, use it with `await`, so that the UI is not being blocked during a long search.
   * Optionally pass a list of folders (`inFolders`) to limit the search to notes that ARE in those folders (applies only to project notes). If empty, it is ignored.
   * Optionally pass a list of folders (`notInFolderslist`) to limit the search to notes NOT in those folders (applies only to project notes). If empty, it is ignored.
   * Searches for keywords are case-insensitive.
   * It will sort it by filename (so search results from the same notes stay together) and calendar notes also by filename with the newest at the top (highest dates).
   * Note: Available from v3.6.0
   * @param {string} = keyword to search for
   * @param {Array<string> | null?} typesToInclude ["notes", "calendar"] (by default all, or pass `null`)
   * @param {Array<string> | null?} inFolders list (optional)
   * @param {Array<string> | null?} notInFolderslist (optional)
   * @param {boolean?} shouldLoadDatedTodos? (optional) true to enable date-referenced items to be included in the search
   * @return {$ReadOnlyArray<TParagraph>} array of results
   */
  static search(
    keyword: string,
    typesToInclude?: Array<string>,
    inFolders?: Array<string>,
    notInFolders?: Array<string>,
    shouldLoadDatedTodos?: boolean,
  ): Promise<$ReadOnlyArray<TParagraph>>;

  /**
   * DataStore.searchProjectNotes()
   * Searches all project notes for a keyword (uses multiple threads to speed it up).
   * This function is async, use it with `await`, so that the UI is not being blocked during a long search.
   * Optionally pass a list of folders (`inNotes`) to limit the search to notes that ARE in those folders (applies only to project notes)
   * Optionally pass a list of folders (`notInFolders`) to limit the search to notes NOT in those folders (applies only to project notes)
   * Searches for keywords are case-insensitive.
   * Note: Available from v3.6.0
   * @param {string} = keyword to search for
   * @param {Array<string> | null?} folders list (optional)
   * @param {Array<string> | null?} folders list (optional)
   * @return {$ReadOnlyArray<TParagraph>} results array
   */
  static searchProjectNotes(keyword: string, inFolders?: Array<string>, notInFolders?: Array<string>): Promise<$ReadOnlyArray<TParagraph>>;

  /**
   * DataStore.searchCalendarNotes()
   * Searches all calendar notes for a keyword (uses multiple threads to speed it up).
   * This function is async, use it with `await`, so that the UI is not being blocked during a long search.
   * Note: Available from v3.6.0
   * @param {string?} (optional) keyword to search for
   * @param {boolean?} (optional) true to enable date-referenced items to be included in the search
   * @return {$ReadOnlyArray<TParagraph>} array of results
   */
  static searchCalendarNotes(keyword?: string, shouldLoadDatedTodos?: boolean): Promise<$ReadOnlyArray<TParagraph>>;
  /**
   * DataStore.listOverdueTasks()
   * Returns list of all overdue tasks (i.e. tasks that are open and in the past). Use with await, it runs in the background. If there are a lot of tasks consider showing a loading bar.
   * Note: this does not include open checklist items.
   * Note: Available from v3.8.1
   * @param {string} = keyword to search for
   * @return {$ReadOnlyArray<TParagraph>} Promise to array of results
   */
  static listOverdueTasks(keyword: string): Promise<$ReadOnlyArray<TParagraph>>;
  /**
   * DataStore.trashNote()
   * Move a regular note using the given filename (include extension and relative folder like `folder/filename.txt`, if it's in the root folder don't add a leading slash) to the trash folder.
   * Returns true if successful.
   * Note: Calendar notes cannot be moved to trash.
   * Note: Teamspace notes are deleted immediately (teamspaces have no trash folder as of now), but a copy is made inside the system trash bin, if the user needs to recover the note.
   * Note: available from v3.18.2 b1431
  * @param {string} filename of the note to trash
  * @return {boolean} successful?
  */
  static trashNote(filename: string): boolean;
}

/**
 * Object to pass window details (from Swift)
 */
type Rect = {
  x: number, // in practice are all integers
  y: number,
  width: number,
  height: number,
}

/**
 * An object when trying to run a plugin Object
 */
type PluginCommandObject = {
  /**
   * Name of the plugin command (getter)
   */
  +name: string,
  /**
   * Description of the plugin command (getter)
   */
  +desc: string,
  /**
   * ID of the plugin this command belongs to (getter)
   */
  +pluginID: string,
  /**
   * Name of the plugin this command belongs to (getter)
   */
  +pluginName: string,
  /**
   * Whether this is marked as a hidden command (getter)
   */
  +isHidden: boolean,
  +hidden: boolean,
  /**
   * List of optional argument descriptions for the specific command (getter). Use this if you want to invoke this command from another plugin to inform the user what he nees to enter for example.
   */
  +arguments: $ReadOnlyArray<string>,
}

/**
 * An object that represents a plugin
 */
type PluginObject = {
  /**
   * ID of the plugin (getter)
   */
  +id: string,
  /**
   * Name of the plugin (getter)
   */
  +name: string,
  /**
   * Description of the plugin (getter)
   */
  +desc: string,
  /**
   * Author of the plugin (getter)
   */
  +author: string,
  /**
   * RepoUrl of the plugin (getter)
   */
  +repoUrl: ?string,
  /**
   * Release page URL of the plugin (on GitHub) (getter)
   */
  +releaseUrl: ?string,
  /**
   * Version of the plugin (getter)
   */
  +version: string,
  /**
   * This is the online data of the plugin. It might not be installed locally. (getter)
   */
  +isOnline: boolean,
  /**
   * Whether this plugin is marked as hidden (getter)
   */
  +isHidden: boolean,
  +hidden: boolean,
  /**
   * Script filename that contains the code for this plugin (like script.js) (getter)
   */
  +script: string,
  /**
   * If this is a locally installed plugin, you can use this variable to check if an updated version is available online. (getter)
   */
  +availableUpdate: PluginObject,
  /**
   * A list of available commands for this plugin. (getter)
   * @type {PluginCommandObject}
   */
  +commands: $ReadOnlyArray<PluginCommandObject>,
}

type TCommandBarResultObject = {
  index: number, // (integer) index of the selected option
  value: string, // (string) value of the selected option
  keyModifiers: Array<string>, // (array of strings) keyboard modifier ("cmd", "opt", "shift", "ctrl") that were pressed while selecting a result.
}

type TCommandBarOptionObject = {
  text: string,
  icon?: string,
  shortDescription?: string,
  color?: string,
  shortcutColor?: string,
  alpha?: number,
  darkAlpha?: number,
}

/**
 * Use CommandBar to get user input. Either by asking the user to type in a
 * free-form string, like a note title, or by giving him a list of choices.
 * This list can be "fuzzy-search" filtered by the user. So, it's fine to show
 * a long list of options, like all folders or notes or tasks in a note.
 */
type TCommandBar = Class<CommandBar>
declare class CommandBar {
  // Impossible constructor
  constructor(_: empty): empty;
  /**
   * CommandBar.placeholder
   * Get or set the current text input placeholder (what you can read when no
   * input is typed in) of the Command Bar.
   */
  static placeholder: string;
  /**
   * CommandBar.searchText
   * Get or set the current text input content of the Command Bar
   * (what the user normally types in).
   */
  static searchText: string;
  /**
   * CommandBar.hide()
   * Hides the Command Bar
   */
  static hide(): void;
  // show(): void,
  /**
   * CommandBar.showOptions()
   * Display an array of choices as a list which the user can "fuzzy-search" filter by typing something.
   * The result is a CommandBarResultObject (as Promise success result), which has ".value" and ".index".
   *
   * Options can be provided in two formats:
   * 1. String array (for backward compatibility): ["Option 1", "Option 2", ...]
   * 2. Object array (available from v3.18) with properties:
   *    - text: string (required) - The display text
   *    - icon: string (optional) - Icon to display (FontAwesome icon name)
   *    - shortDescription: string (optional) - Text displayed on the right side (for display only, can be used as description or to show a shortut key - though does not provide actual keyboard shortcut functionality)
   *    - color: string (optional) - Color for the icon (hex like "#FF0000" or tailwind color name)
   *    - shortcutColor: string (optional) - Color for the shortcut text (hex or tailwind)
   *    - alpha: number (optional) - Opacity for light theme (0-1). Default opacity will be used if not specified
   *    - darkAlpha: number (optional) - Opacity for dark theme (0-1). Default opacity will be used if not specified
   *
   * Example object format:
   * [
   *   { text: "Option 1", icon: "star", color: "#FFD700" },
   *   { text: "Option 2", icon: "check", shortcut: "Premium", shortcutColor: "#00FF00" },
   *   { text: "Option 3", icon: "info", shortcut: "Beta feature", alpha: 0.8, darkAlpha: 0.9 }
   * ]
   *
   * Use the ".index" attribute to refer back to the selected item in the original array.
   * If you want to provide an existing search text that will be inserted into the command bar, use the third parameter.
   * Note: The user selection is returned as a Promise. So use it with "await CommandBar.showOptions(...)".
   *
   * @param {[String]|[TCommandBarOptionObject]} options - Array of strings or objects with options
   * @param {String} placeholder - Placeholder text for the search input
   * @param {String} searchText - Initial search text to populate
   * @returns {Promise<TCommandBarResultObject>} - Promise resolving to result with .value, .index, and .keyModifiers
   */
  static showOptions(options: $ReadOnlyArray<string | TCommandBarOptionObject>, placeholder: string, searchText?: string): Promise<TCommandBarResultObject>;
  /**
   * CommandBar.showInput()
   * Asks the user to enter something into the CommandBar.
   * Use the "placeholder" value to display a question, like "Type the name of the task".
   * Use the "submitText" to describe what happens with the selection, like "Create task named '%@'".
   * The "submitText" value supports the variable "%@" in the string, that NotePlan autofill with the typed text.
   * Also can optionally set the default search text to show. (from 3.11.1)
   * It returns a Promise, so you can wait (using "await...") for the user
   * input with the entered text as success result.
   * @param {string} placeholder
   * @param {string} submitText
   * @param {string?} searchTextDefault?
   * @returns {Promise<string>}
   */
  static showInput(placeholder: string, submitText: string): Promise<string>;
  /**
   * CommandBar.showLoading()
   * Shows or hides a window with a loading indicator or a progress ring (if progress is defined) and an info text (optional).
   * `text` is optional, if you define it, it will be shown below the loading indicator.
   * `progress` is also optional. If it's defined, the loading indicator will change into a progress ring. Use float numbers from 0-1 to define how much the ring is filled.
   * When you are done, call `showLoading(false)` to hide the window.
   * Note: Available from v3.0.26
   * @param {boolean} visible?
   * @param {string?} text
   * @param {number?} progress (floating point)
   */
  static showLoading(visible: boolean, text?: string, progress?: number): void;
  /**
   * CommandBar.onAsyncThread()
   * If you call this, anything after `await CommandBar.onAsyncThread()` will run on an asynchronous thread.
   * Use this together with `showLoading`, so that the work you do is not blocking the user interface.
   * Otherwise the loading window will be also blocked.
   *
   * Warning: Don't use any user interface calls (other than showLoading) on an asynchronous thread. The app might crash.
   * You need to return to the main thread before you change anything in the window (such as Editor functions do).
   * Use `onMainThread()` to return to the main thread.
   * Note: Available from v3.0.26
   */
  static onAsyncThread(): Promise<void>;
  /**
   * CommandBar.onMainThread()
   * If you call this, anything after `await CommandBar.onMainThread()` will run on the main thread.
   * Call this after `onAsyncThread`, once your background work is done.
   * It is safe to call Editor and other user interface functions on the main thread.
   * Note: Available from v3.0.26
   */
  static onMainThread(): Promise<void>;

  /**
   * CommandBar.prompt()
   * Show a native alert or confirm with title and message
   * Define at least one or more buttons for the user to select.
   * If you don't supply any buttons, an "OK" button will be displayed.
   * The promise returns selected button, with button index (0 - first button)
   * Note: Available from v3.3.2, and from v3.16.3 order of buttons is now same on iOS and macOS.
   * @param {string} title
   * @param {string} message
   * @param {$ReadOnlyArray<string>?} buttons
   */
  static prompt(title: string, message: string, buttons?: $ReadOnlyArray<string>): Promise<number>;

  /**
   * CommandBar.textPrompt()
   * Show a native text input prompt to the user with title and message text.
   * The buttons will be "OK" and "Cancel".
   * You can supply a default value which will be pre-filled.
   * If the user selects "OK", the promise returns users entered value
   * If the user selects "Cancel", the promise returns false.
   * Note: Available from v3.3.2, and from v3.16.3 order of buttons is now same on iOS and macOS.
   * @param {string} title
   * @param {string} message
   * @param {string?} defaultValue
   */
  static textPrompt(title: string, message: string, defaultValue?: string): Promise<string | false>;
}

type CalendarDateUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'

type DateRange = {
  +start: Date,
  +end: Date,
}

type ParsedTextDateRange = {
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
  /**
   * The detected date string (e.g. the specific words that parseDate used to create a date/time)
   */
  +text: string,
  /**
   *  The character index of the start of the detected date string
   */
  +index: number,
}

type TCalendar = Class<Calendar>
/**
 * Use Calendar to create events, reminders, and to parse dates, like
 * - "tomorrow at 8am to 10am"
 * - "today"
 * - "1st May"
 *
 * See also `CalendarItem` if you want to create an event or reminder.
 */
declare class Calendar {
  // Impossible constructor
  constructor(_: empty): empty;
  /**
   * Calendar.dateUnits
   * Get all available date units: "year", "month", "day", "hour", "minute", "second"
   */
  static +dateUnits: $ReadOnlyArray<CalendarDateUnit>;
  /**
   * Calendar.availableCalendarTitles()
   * Get the titles of all calendars the user has access to. Set `writeOnly` true, if you want to get only the calendars the user has write access to (some calendars, like holidays are not writable).
   * Note: Available from v3.1
   * @param {boolean}
   * @return {Array<string>}
   */
  static availableCalendarTitles(writeOnly: boolean): $ReadOnlyArray<string>;
  /**
   * Calendar.availableReminderListTitles()
   * Get the titles of all reminders the user has access to.
   * Note: Available from v3.1
   * @return {Array<string>}
   */
  static availableReminderListTitles(): $ReadOnlyArray<string>;
  /**
   * Calendar.add()
   * Create an event or reminder based on the given CalendarItem.
   * Returns the created CalendarItem with the assigned id, so you can
   * reference it later. If it failed, undefined is returned.
   */
  static add(item: TCalendarItem): TCalendarItem | void;
  /**
   * Calendar.parseDateText()
   * Parses a text describing a text as natural language input into a date. Such as "today", "next week", "1st May", "at 5pm to 6pm", etc.
   * Returns an array with possible results (usually one), the most likely at the top.
   * The possible values that can be accessed are:
   *   .start: time
   *   .end: time
   *   .index: character index of the start of the detected date string (available from v3.6.0)
   *   .text: the detected date string (available from v3.6.0)
   * Example:
   *    Calendar.parseDateText("* Next F1 race is Sun June 19 (Canadian GP)")
   * -> [{"index":18,"start":"2023-06-19T17:00:00.000Z","text":"Sun June 19 ","end":"2023-06-19T17:00:00.000Z"}]
   * Under the hood this uses the Chrono library.
   * IMPORTANT NOTES:
   * This API does not work correctly when the input string is "today at" something (so make sure to remove the word today from your string)
   * When .parseDate thinks something is an all-day event, it puts it at noon (both start/end at noon).
   * That means that these two (quite different) lines look identical in the return:
   *   - on Friday
   *   - on Friday at 12
   * The function helpers/dateTime.js::isReallyAllDay() can be used to disambiguate
   */
  static parseDateText(text: string): $ReadOnlyArray<ParsedTextDateRange>;
  /**
   * Calendar.dateFrom()
   * Create a date object from parts. Like year could be 2021 as a number.
   * Note: month uses Swift counting (1-12) not Javascript counting (0-11).
   */
  static dateFrom(year: number, month: number, day: number, hour: number, minute: number, second: number): Date;
  /**
   * Calendar.addUnitToDate()
   * Add a unit to an existing date. Look up all unit types using `dateUnits`.
   * For example, to add 10 days, use num = 10 and type = "day"
   */
  static addUnitToDate(date: Date, unit: CalendarDateUnit, num: number): Date;
  /**
   * Calendar.unitOf()
   * Returns the integer of a unit like "year" (should be this year's number).
   * Look up all unit types using `dateUnits`.
   */
  static unitOf(date: Date, type: CalendarDateUnit): number;
  /**
   * Calendar.timeAgoSinceNow()
   * Returns a description of how much time has past between the date and
   * today = now.
   */
  static timeAgoSinceNow(date: Date): string;
  /**
   * Calendar.unitsUntilNow()
   * Returns the amount of units between the given date and now. Look up all
   * unit types using `dateUnits`.
   */
  static unitsUntilNow(date: Date, type: CalendarDateUnit): number;
  /**
   * Calendar.unitsAgoFromNow()
   * Returns the amount of units from now and the given date. Look up all unit
   * types using `dateUnits`.
   */
  static unitsAgoFromNow(date: Date, type: CalendarDateUnit): number;
  /**
   * Calendar.unitsBetween()
   * Returns the amount of units between the first and second date. Look up all
   * unit types using `dateUnits`.
   */
  static unitsBetween(date1: Date, date2: Date, type: CalendarDateUnit): number;
  /**
   * Calendar.eventsBetween()
   * Returns all events between the `startDate` and `endDate`. Use `filter` to search for specific events (keyword in the title).
   * This function fetches events asynchronously, so use async/await.
   * Note: Available from v3.0.25
   * @param {Date}
   * @param {Date}
   * @param {string?}
   * @return {Promise}
   */
  static eventsBetween(startDate: Date, endDate: Date, filter?: ?string): Promise<Array<TCalendarItem>>;
  /**
   * Calendar.remindersBetween()
   * Returns all reminders between the `startDate` and `endDate`. Use `filter` to search for specific reminders (keyword in the title).
   * This function fetches reminders asynchronously, so use async/await.
   * Note: Available from v3.0.25
   * @param {Date}
   * @param {Date}
   * @param {string?}
   * @return {Promise}
   */
  static remindersBetween(startDate: Date, endDate: Date, filter?: ?string): Promise<Array<TCalendarItem>>;
  /**
   * Calendar.eventsToday()
   * Returns all events for today. Use `filter` to search for specific events (keyword in the title).
   * This function fetches events asynchronously, so use async/await.
   * Note: Available from v3.0.25
   * @param {string?}
   * @return {Promise}
   */
  static eventsToday(filter: ?string): Promise<Array<TCalendarItem>>;
  /**
   * Calendar.remindersToday()
   * Returns all reminders between for today. Use `filter` to search for specific reminders (keyword in the title).
   * This function fetches reminders asynchronously, so use async/await.
   * Note: Available from v3.0.25
   * @param {string?}
   * @return {Promise}
   */
  static remindersToday(filter: ?string): Promise<Array<TCalendarItem>>;
  /**
   * Calendar.update()
   * Updates an event or reminder based on the given CalendarItem, which needs to have an ID.
   * A CalendarItem has an ID, when you have used `.add(...)` and saved the return value or when you query
   * the event using `eventsBetween(...)`, `remindersBetween(...)`, `eventByID(...)`, `reminderByID(...)`, etc.
   * Returns a promise, because it needs to fetch the original event objects first in the background,
   * then updates it. Use it with `await`.
   * Note: Available from v3.0.26
   * @param {CalendarItem}
   * @return {Promise}
   */
  static update(calendarItem: TCalendarItem): Promise<void>;
  /**
   * Calendar.remove()
   * Removes an event or reminder based on the given CalendarItem, which needs to have an ID.
   * A CalendarItem has an ID, when you have used `.add(...)` and saved the return value or when you query
   * the event using `eventsBetween(...)`, `remindersBetween(...)`, `eventByID(...)`, `reminderByID(...)`, etc.
   * Returns a promise, because it needs to fetch the original event objects first in the background,
   * then updates it. Use it with `await`.
   * Note: Available from v3.0.26
   * @param {CalendarItem}
   * @return {Promise}
   */
  static remove(calendarItem: TCalendarItem): Promise<void>;
  /**
   * Calendar.eventByID()
   * Returns the event by the given ID. You can get the ID from a CalendarItem, which you got from using `.add(...)` (the return value is a CalendarItem with ID) or when you query the event using `eventsBetween(...)`, `eventByID(...)`, etc.
   * This function fetches reminders asynchronously, so use async/await.
   * Note: Available from v3.0.26
   * @param {string}
   * @return {Promise(CalendarItem)}
   */
  static eventByID(id: string): Promise<TCalendarItem>;
  /**
   * Calendar.reminderByID()
   * Returns the reminder by the given ID. You can get the ID from a CalendarItem, which you got from using `.add(...)` (the return value is a CalendarItem with ID) or when you query the event using `remindersBetween(...)`, `reminderByID(...)`, etc.
   * Use with async/await.
   * Note: Available from v3.0.26
   * @param {string}
   * @return {Promise(CalendarItem)}
   */
  static reminderByID(id: string): Promise<TCalendarItem>;
  /**
   * Calendar.remindersByLists()
   * Returns all reminders (completed and incomplete) for the given lists (array of strings).
   * If you keep the lists variable empty, NotePlan will return all reminders from all lists. You can get all Reminders lists calling `Calendar.availableReminderListTitles()`
   * This function fetches reminders asynchronously, so use async/await.
   * Note: Available from v3.5.2
   * @param {Array<string>?}
   * @return {Promise}
   */
  static remindersByLists(lists: $ReadOnlyArray<string>): Promise<Array<TCalendarItem>>;
  /**
   * Calendar.weekNumber()
   * Returns the week number of the given date adjusted by the start of the week configured by the user in the preferences.
   * @param {Date}
   * @returns {number} week number (integer)
   * Note: Available from v3.7.0
   */
  static weekNumber(date: Date): number;
  /**
   * Calendar.startOfWeek()
   * Returns the first day of the given date's week adjusted by the start of the week configured by the user in the preferences (means the returned date will always be the configured first day of the week).
   * @param {Date} date
   * @returns {Date} date of start of week
   * Note: Available from v3.7.0
   */
  static startOfWeek(date: Date): Date;
  /**
   * Calendar.endOfWeek()
   * Returns the last day of the given date's week adjusted by the start of the week configured by the user in the preferences (means the returned endOfWeek date will always be the day before the first day of the week specified in Preferences).
   * @param {Date} date
   * @returns {Date} date of last day of week
   * Note: Available from v3.7.0
   */
  static endOfWeek(date: Date): Date;
}

/**
 * You can get paragraphs from `Editor` or `Note`.
 * They represent blocks or lines of text (delimited by linebreaks = \n).
 * A task for example is a paragraph, a list item (bullet), heading, etc.
 */
type TParagraph = Paragraph
declare interface Paragraph {
  // Impossible to create Paragraphs manually
  constructor(_: empty): empty;
  /**
   * Paragraph.type
   * Get or set the type of the paragraph
   */
  type: ParagraphType;
  /**
   * Paragraph.note
   * Returns the NoteObject behind this paragraph. This is a convenience method, so you don't need to use DataStore.
   * Note: EM adds that "You could have the paragraph object in memory while the note was deleted in the background", which is why this is optional.
   * Note: Available from v3.5.2
   */
  +note: ?TNote;
  /**
   * Paragraph.content
   * Get or set the content of the paragraph
   * (without the Markdown 'type' prefix, such as '* [ ]' for open task)
   */
  content: string;
  /**
   * Paragraph.rawContent
   * Get the content of the paragraph
   * (with the Markdown 'type' prefix, such as '* [ ]' for open task)
   */
  +rawContent: string;
  /**
   * Paragraph.prefix
   * Get the Markdown prefix of the paragraph (like '* [ ]' for open task).
   * Note: @jgclark thinks this does not include any indentation whitespace.
   */
  +prefix: string;
  /**
   * Paragraph.contentRange
   * Get the range of the paragraph.
   * Note: this can become inaccurate if other content changes in the note; it is not automatically recalculated. Re-fetch paragraphs to avoid this.
   */
  +contentRange: TRange | void;
  /**
   * Paragraph.lineIndex
   * Get the line index of the paragraph.
   * Note: this can become inaccurate if other content changes in the note; it is not automatically recalculated. Re-fetch paragraphs to avoid this.
   * WARNING: this can be different in `Editor` and `Note` contexts, even for the same paragraph, because frontmatter lines are not included in the `Editor` context since ~v3.16.3.
   */
  +lineIndex: number;
  /**
   * Paragraph.date
   * Get the date of the paragraph, if any (in case of scheduled tasks).
   */
  +date: Date | void;
  /**
   * Paragraph.heading
   * Get the heading of the paragraph (looks for a previous heading paragraph).
   */
  +heading: string;
  /**
   * Paragraph.headingRange
   * Get the heading range of the paragraph
   * (looks for a previous heading paragraph).
   */
  +headingRange: TRange | void;
  /**
   * Paragraph.headingLevel
   * Get the heading level of the paragraph ('# heading' = level 1).
   */
  +headingLevel: number;
  /**
   * Paragraph.isRecurring
   * If the task is a recurring one (contains '@repeat(...)')
   */
  +isRecurring: boolean;
  /**
   * Paragraph.indents
   * Get/Set the amount of indentations.
   */
  indents: number;
  /**
   * Paragraph.filename
   * Get the filename of the note this paragraph was loaded from
   */
  +filename: ?string;
  /**
   * Paragraph.noteType
   * Get the note type of the note this paragraph was loaded from.
   */
  +noteType: ?NoteType;
  /**
   * Paragraph.linkedNoteTitles
   * Get the linked note titles this paragraph contains, such as '[[Note Name]]' (will return names without the brackets).
   */
  +linkedNoteTitles: $ReadOnlyArray<string>;
  /**
   * Paragraph.duplicate()
   * Creates a duplicate object, so you can change values without affecting the original object
   */
  duplicate(): Paragraph;
  /**
   * Returns indented paragraphs (children) underneath a task
   * Only tasks can have children, but any paragraph indented underneath a task can be a child of the task.
   * This includes bullets, tasks, quotes, text.
   * Children are counted until a blank line, HR, title, or another item at the same level as the parent task. So for items to be counted as children, they need to be contiguous vertically.
   * Important note: .children() for a task paragraph will return every child, grandchild, greatgrandchild, etc.
   * So a task that has a child task that has a child task will have 2 children (and the first child will have one).
   * If it returns empty array, it means there are no children.
   * If it returns undefined, it means there has been a failure.
   * Note: Available from v3.3
   * Note: this can become inaccurate if other content changes in the note; it is not automatically recalculated. Re-fetch paragraphs to avoid this.
   * WARNING: appears to be unreliable on iOS.
   * @return {$ReadOnlyArray<TParagraph> | void}
   */
  children(): $ReadOnlyArray<TParagraph> | void;
  /**
   * Paragraph.referencedBlocks
   * Returns an array of all paragraphs having the same blockID (including this paragraph). You can use `paragraph[0].note` to access the note behind it and make updates via `paragraph[0].note.updateParagraph(paragraph[0])` if you make changes to the content, type, etc (like checking it off as type = "done")
   * Note: Available from v3.5.2
   * @type {[TParagraph]} - getter
   */
  +referencedBlocks: [TParagraph];
  /**
   * Paragraph.note
   * Returns the NoteObject behind this paragraph. This is a convenience method, so you don't need to use DataStore.
   * Note: Available from v3.5.2
   * @type {TNote?}
   */
  +note: ?TNote;
  /**
   * Paragraph.blockId
   * Returns the given blockId if any.
   * WARNING: This has a different capitalisation than '.addBlockID'
   * Note: Available from v3.5.2
   * @type {string?}
   */
  +blockId: ?string;
}

type TNote = Note
type NoteType = 'Calendar' | 'Notes'

/**
 * Notes can be queried by DataStore. You can change the complete text of the note,
 * which will be saved to file or query, add, remove, or modify
 * particular paragraphs (a paragraph is a task for example).
 * See more paragraph editing examples under Editor.
 * NoteObject and Editor both inherit the same paragraph functions.
 */
declare interface Note extends CoreNoteFields {
  /**
   * Note.linkedItems
   * Get paragraphs contained in this note which contain a link to another [[project note]] or [[YYYY-MM-DD]] daily note.
   * Note: Available from v3.2.0
   */
  +linkedItems: $ReadOnlyArray<TParagraph>;
  /**
   * Note.datedTodos
   * Get paragraphs contained in this note which contain a link to a daily note.
   * Specifically this includes paragraphs with >YYYY-MM-DD, @YYYY-MM-DD, <YYYY-MM-DD, >today, @done(YYYY-MM-DD HH:mm), but only in non-calendar notes (because currently NotePlan doesn't create references between daily notes).
   * Note: Available from v3.2.0
   */
  +datedTodos: $ReadOnlyArray<TParagraph>;
}

/**
 * UUID type
 */
type UUID = string

/**
 * Teamspace object
 */
type TTeamspace = {
  id: UUID,
  title: string,
}

/**
 * Ranges are used when you deal with selections or need to know where a
 * paragraph is in the complete text.
 */
declare var Range: TRange
declare interface TRange {
  /**
   * Character start index of the range. (Get or set.)
   */
  start: number;
  /**
   * Character end index of the range. (Get or set.)
   */
  end: number;
  /**
   * Character length of the range (end - start). (Get only.)
   */
  +length: number;
  /**
   * Range.create()
   * Create an instance of a Range object with the start and end positions.
   * The length variable is calculated automatically and doesn't have to be set.
   * Example: Range.create(0, 10)
   * @param {number} start
   * @param {number} end
   * @returns {Range}
   */
  create(start: number, end: number): TRange;
}

type CalenderItemType = 'event' | 'reminder'
/**
 * The CalendarItem is used in combination with
 * [Calendar](Editor)
 * to create events or reminders.
 */
declare var CalendarItem: TCalendarItem
declare interface TCalendarItem {
  /**
   * The ID of the event or reminder after it has been created by
   * `Calendar.add(calendarItem)`.
   *
   * The ID is not set in the original CalendarItem, you need to use the return
   * value of `Calendar.add(calendarItem)` to get it.
   *
   * Use the ID later to refer to this event (to modify or delete).
   */
  +id: ?string;
  /**
   * The title of the event or reminder.
   */
  title: string;
  /**
   * The date (with time) of the event or reminder.
   */
  date: Date;
  /**
   * The endDate (with time) of the event (reminders have no endDate).
   * So, this can be optional.
   */
  endDate: ?Date;
  /**
   * The type of the calendar item, either "event" or "reminder".
   * Cannot be set.
   */
  +type: string;
  /**
   * If the calendar item is all-day, means it has no specific time.
   */
  isAllDay: boolean;
  /**
   * If the calendar item is completed. This applies only to reminders.
   * Note: Available from v3.0.15
   */
  isCompleted: boolean;
  /**
   * All the dates the event or reminder occurs (if it's a multi-day event for example)
   * Note: Available from v3.0.15
   */
  +occurrences: $ReadOnlyArray<Date>;
  /**
   * The calendar or reminders list where this event or reminder is (or should be) saved. If you set nothing, the event or reminder will be added to the default and this field will be set after adding.
   * Note: Available from v3.0.15.
   */
  calendar: string;
  /**
   * Text saved in the "Notes" field of the event or reminder.
   * Note: Available from v3.0.26
   */
  notes: string;
  /**
   * URL saved with the event or reminder.
   * Note: Available from v3.0.26
   */
  url: string;
  /**
   * If supported, shows the availability for the event. The default is 0 = busy.
   * notSupported = -1
   * busy = 0
   * free = 1
   * tentative = 2
   * unavailable = 3
   * Note: Available from v3.3
   */
  availability: number;
  /**
   * List of attendee names or emails.
   * Some example result strings show the variety possible:
   * - "[bob@example.com](mailto:bob@example.com)"
   * - "✓ [Jonathan Clark](/aOTg2Mjk1NzU5ODYyOTU3NUcglJxZek7H6BDKiYH0Y7RvgqchDTUR8sAcaQmcnHR_/principal/) (organizer)"
   * - "[TEST Contact1](mailto:test1@clarksonline.me.uk)",
   * But I think it is closer to being a JS Map [string, string].
   * Note: Available from v3.5.0
   */
  attendees: Array<string>;
  /**
   * List of attendee names (or email addresses if name isn't available).
   * Note: Available from v3.5.2
   */
  +attendeeNames: $ReadOnlyArray<string>;
  /**
   * Markdown link for the given event. If you add this link to a note, NotePlan will link the event with the note and show the note in the dropdown when you click on the note icon of the event in the sidebar.
   * Note: Available from v3.5, only events; reminders are not supported yet
   */
  calendarItemLink: string;
  /**
   * Location in the event
   * Note: Available from v3.5.2? for events
   */
  location: string;
  /**
   * Is this from a writeable calendar?
   * Note: get only
   */
  +isCalendarWritable: boolean;
  /**
   * Is the event part of a recurring series?
   * Note: get only
   */
  +isRecurring: boolean;
  /**
   * CalendarItem.create()
   * Create a CalendarItem. The .endDate is optional, but recommended for events.
   * Reminders don't use this field.
   *
   * The type can be "event" or "reminder".
   * And isAllDay can be used if you don't want to define a specific time, like holidays.
   * Use the calendar variable, if you want to add the event or reminder to another
   * calendar or reminders list other than the default. This is optional: if you set
   * nothing, it will use the default.
   * Use isCompleted only for reminders, by default it's false if you set nothing.
   * Note: some available from v3.0.26.
   */
  create(
    title: string,
    date: Date,
    endDate: Date | void,
    type: CalenderItemType,
    isAllDay?: boolean,
    calendar?: string,
    isCompleted?: boolean,
    notes?: string,
    url?: string,
    availability?: number,
  ): TCalendarItem;
  /**
   * CalendarItem.findLinkedFilenames()
   * Searches and returns all filenames it's linked to (meeting notes). Use with await. Returns an array of filenames.
   * @returns {Array<string>} promise to filename list
   * Note: Available from 3.9.1 (build 1020)
   */
  findLinkedFilenames(): Array<string>;
}

/**
 * Access and set the data inside the current clipboard.
 * Note: See also 2 methods in the TEditor object.
 */
declare class Clipboard {
  // Impossible constructor
  constructor(_: empty): empty;
  /**
   * Clipboard.string
   * Get or set the current text of the clipboard.
   */
  static string: string;
  /**
   * Clipboard.types
   * Returns a list of types.
   */
  static +types: $ReadOnlyArray<string>;
  /**
   * Clipboard.setStringForType()
   * Set the text of the clipboard using a specific type.
   */
  static setStringForType(string: string, type: string): void;
  /**
   * Clipboard.stringForType()
   * Get the text in the clipboard accessing a specific type.
   */
  static stringForType(type: string): ?string;
  /**
   * Clipboard.setBase64DataStringForType()
   * Set the data as base64 string for a specific type like an image or RTF.
   * Note: Available from v3.4.1
   * @param {string} base64String
   * @param {string} type
   */
  static setBase64DataStringForType(base64String: string, type: string): void;
  /**
   * Clipboard.base64DataStringForType()
   * Get the base64 data string for a specific type like an image or RTF from the clipboard.
   * Note: Available from v3.4.1
   * @param {string} type
   * @return {string}
   */
  static base64DataStringForType(type: string): string;
  /**
   * Clipboard.dataForType()
   * Get the data in the clipboard accessing a specific type.
   */
  static dataForType(type: string): mixed;
  /**
   * Clipboard.setDataForType()
   * Set the data in the clipboard for a specific type.
   */
  static setDataForType(data: mixed, type: string): void;
  /**
   * Clipboard.clearContents()
   * Clears the contents of the clipboard.
   */
  static clearContents(): void;
  /**
   * Clipboard.availableType()
   * Pass in the types you are interested in and get the available type back.
   */
  static availableType(fromTypes: $ReadOnlyArray<string>): ?string;
}

/* Available paragraph types
 * Note: 'separator' added v3.4.1, and the 'checklist*' types added v3.8.0
 */
type ParagraphType =
  | 'open'
  | 'done'
  | 'scheduled'
  | 'cancelled'
  | 'checklist'
  | 'checklistDone'
  | 'checklistScheduled'
  | 'checklistCancelled'
  | 'title'
  | 'quote'
  | 'list'
  | 'empty'
  | 'text'
  | 'code'
  | 'separator'

type TSubItem = TParagraph & {
  subItems: Array<TSubItem>,
}

type TBacklinkFields = {
  type: 'note',
  content: string,
  rawContent: string,
  prefix: string,
  lineIndex: number,
  date: Date,
  heading: string,
  headingLevel: number,
  isRecurring: boolean,
  indents: number,
  filename: string,
  noteType: NoteType,
  linkedNoteTitles: Array<string>,
  subItems: Array<TBacklinkFields>,
  // referencedBlocks: ,
  note: {},
}

/* Future idea:
type TRegularFilename = string
type TCalendarFilename = string
*/

type TCoreNoteFields = CoreNoteFields
declare interface CoreNoteFields {
  /**
   * [Editor|Note].title
   * Title = first line of the note. (NB: Getter only.)
   */
  +title: string | void;
  /**
   * [Editor|Note].type
   * Type of the note, either "Notes" or "Calendar".
   */
  +type: NoteType;
  /**
   * [Editor|Note].filename
   * Get the filename of the note.
   * Folder + Filename of the note (the path is relative to the root of the chosen storage location)
   * From v3.6.0 can also *set* the filename, which does a rename.
   */
  filename: string /* Idea: TRegularFilename | TCalendarFilename; */;
  /**
   * [Editor|Note].resolvedFilename
   * Returns the relative, resolved path of the note (including the folder, like `folder/filename.txt`).
   * If it's a teamspace note, it replaces the IDs in the path with the name of the teamspace and the name of the note. Teamspace note filenames end otherwise with an ID, and the teamspace is also represented as an ID.
   * Note: Don't use this filename to read or write the note. Use `.filename`, instead.
   * { getter only}.
   * Note: Available from v3.17.0
   */
  +resolvedFilename: string;
  /**
   * [Editor|Note].date
   * Optional date if it's a calendar note
   * WARNING: As of 3.18.2 b1428 this is not available in Editor.
   */
  +date: Date | void;
  /**
   * [Editor|Note].changedDate
   * Date and time when the note was last modified.
   * WARNING: As of 3.18.2 b1428 this is not available in Editor.
   */
  +changedDate: Date;
  /**
   * [Editor|Note].createdDate
   * Date and time of the creation of the note.
   * WARNING: As of 3.18.2 b1428 this is not available in Editor.
   */
  +createdDate: Date;
  /**
   * [Editor|Note].hashtags
   * All #hashtags contained in this note.
   * WARNING: As of 3.18.2 b1428 this is not available in Editor.
   */
  +hashtags: $ReadOnlyArray<string>;
  /**
   * [Editor|Note].mentions
   * All @mentions contained in this note.
   * WARNING: @jgclark experience shows that can be unreliable, sometimes not returning any entries when it should.
   * WARNING: As of 3.18.2 b1428 this is not available in Editor.
   */
  +mentions: $ReadOnlyArray<string>;
  /**
   * [Editor|Note].content
   * Get or set the raw text of the note (without hiding or rendering any Markdown).
   * If you set the content, NotePlan will write it immediately to file.
   * If you get the content, it will be read directly from the file.
   * WARNING: From ~v3.16.3, Editor.content and Editor.note.content can be different, with Editor.content does not include the frontmatter lines.
   */
  content: string | void;
  /**
   * [Editor|Note].paragraphs
   * Get or set the array of paragraphs contained in this note, such as tasks, bullets, etc.
   * If you set the paragraphs, the content of the note will be updated.
   * WARNING: From ~v3.16.3, Editor.paragraphs and Editor.note.paragraphs can be different, with Editor.paragraphs not including the frontmatter lines.
   */
  paragraphs: Array<TParagraph>;
  /**
   * [Editor|Note].backlinks
   * Get all backlinks pointing to the current note as Paragraph objects. In this array, the toplevel items are all notes linking to the current note and the 'subItems' attributes (of the paragraph objects) contain the paragraphs with a link to the current note. The heading of the linked paragraphs are also listed here, although they don't have to contain a link.
   * NB: Backlinks are all [[note name]] and >date links.
   * TODO(@nmn): Please include `subItems` here
   * Note: Available from v3.2.0
   */
  +backlinks: $ReadOnlyArray<TBacklinkNoteFields>;
  /**
   * [Editor|Note].publicRecordID
   * Returns the database record ID of the published note (on CloudKit). Returns null if the note is not published yet.
   * Use this to verify if a note has been published and to build the public link: https://noteplan.co/n/{publicRecordID}
   * Note: Available from v3.9.1
   * @type {String?}
   */
  +publicRecordID: ?string;
  /**
   * [Editor|Note].conflictedVersion
   * Returns the conflicted version if any, including 'url' which is the path to the file. Otherwise, returns undefined.
   * Note: Available from v3.9.3
   * @return { Object(filename: string, url: string, content: string) }
   */
  +conflictedVersion: Object;
  /**
   * [Editor|Note].versions
   * Get all available versions of a note from the backup database. It returns an array with objects that have following attributes: `content` (full content of the note) and `date` (when this version was saved).
   * You can use this in combination with note triggers and diffs to figure out what has changed inside the note.
   * The first entry in the array is the current version and the second contains the content of the previous version, etc.
   * Note: Available from v3.7.2
   */
  +versions: $ReadOnlyArray<string, Date>;
  /**
   * [Editor|Note].frontmatterTypes
   * Get all 'type's assigned to this note in the frontmatter as an array of strings.
   * You can set types of a note by adding frontmatter e.g. `type: meeting-note, empty-note` (comma separated).
   * Note: Available on Note from v3.5.0, but only on Editor from v3.16.3.
   */
  +frontmatterTypes: $ReadOnlyArray<string>;
  /**
   * [Editor|Note].frontmatterAttributes
   * Returns the frontmatter key-value pairs inside the note. To set a frontmatter attribute, use setFrontmatterAttribute.
   * You can also use the setter, but you will need to first read the complete frontmatter object (key-value pairs), change it and then set it. Otherwise the setter *won't* be triggered if you set it directly like `frontmatterAttributes["key"] = "value"`. This is more useful if you want to set multiple frontmatter values.
   * Note: @dbwertheimer says "Returns {} if no frontmatter stripes or if there are stripes but no attributes."
   * @returns {{[key: string]: string}}
   * Note: Available on Note from 3.5.0, but only on Editor from v3.16.3.
   * WARNING: The setter only works with macOS >= 14 and iOS >= 16, since below these versions, the frontmatter editor is not supported and the raw frontmatter is shown (if a user still calls this, a warning is logged).
   */
  +frontmatterAttributes: Object;
  /**
   * [Editor|Note].updateFrontmatterAttributes()
   * Updates multiple frontmatter attributes at once in a single operation.
   * More efficient than calling setFrontmatterAttribute multiple times as it only reads and writes the note content once.
   * Each attribute object should have "key" and "value" properties.
   * Note: Available from v3.18.1 (build 1419)
   * @param {Array<{key: string, value: string}>} attributes - Array of key-value pairs to update
   * @example
   * note.updateFrontmatterAttributes([
   *   { key: "title", value: "My Title" },
   *   { key: "type", value: "project" },
   *   { key: "status", value: "draft" }
   * ])
   * Available from v3.18.1 (build 1419)
   */
  updateFrontmatterAttributes(attributes: Array<{ key: string, value: string }>): void;

  /**
   * [Editor|Note].rename()
   * Renames the note. You can also define a folder path. The note will be moved to that folder and the folder will be automatically created.
   * If the filename already exists, a number will be appended. If the filename begins with ".", it will be removed.
   * It returns the actual filename.
   * Note: Available from v3.6.1
   * @param {String} newFilename requested
   * @returns {String} actualFilename
   */
  rename(newFilename: string): string;
  /**
   * [Editor|Note].insertTextInCharacterIndex()
   * Inserts the given text at the given character position (index)
   * Note: this is not quite the same as Editor.insertTextAtCharacterIndex()
   * @param text 	  - Text to insert
   * @param index   - Position to insert at (you can get this using 'renderedSelection' for example)
   */
  insertTextInCharacterIndex(text: string, index: number): void;
  /**
   * [Editor|Note].replaceTextAtCharacterRange()
   * Replaces the text at the given range with the given text
   * Note: this is not quite the same name as Editor.replaceTextInCharacterRange()
   * @param text 	    - Text to insert
   * @param location  - Position to insert at (you can get this using 'renderedSelection' for example)
   * @param length    - Amount of characters to replace from the location
   */
  replaceTextAtCharacterRange(text: string, location: number, length: number): void;
  /**
   * [Editor|Note].paragraphRangeAtCharacterIndex()
   * Returns a range object of the full paragraph of the given character
   * position.
   */
  paragraphRangeAtCharacterIndex(characterPosition: number): TRange;

  /**
   * [Editor|Note].insertParagraph()
   * Inserts a plain paragraph at the given line index.
   * WARNING: 'lineIndex' can be different in `Editor` and `Note` contexts, even for the same paragraph, because frontmatter lines are not included in the `Editor` context since ~v3.16.3.
   */
  insertParagraph(name: string, lineIndex: number, type: ParagraphType): void;

  /**
   * [Editor|Note].insertTodo()
   * Inserts a todo at the given line index
   * WARNING: 'lineIndex' can be different in `Editor` and `Note` contexts, even for the same paragraph, because frontmatter lines are not included in the `Editor` context since ~v3.16.3.
   */
  insertTodo(name: string, lineIndex: number): void;

  /**
   * [Editor|Note].insertCompletedTodo()
   * Inserts a completed todo at the given line index
   * WARNING: 'lineIndex' can be different in `Editor` and `Note` contexts, even for the same paragraph, because frontmatter lines are not included in the `Editor` context since ~v3.16.3.
   */
  insertCompletedTodo(name: string, lineIndex: number): void;

  /**
   * [Editor|Note].insertCancelledTodo()
   * Inserts a cancelled todo at the given line index
   * WARNING: 'lineIndex' can be different in `Editor` and `Note` contexts, even for the same paragraph, because frontmatter lines are not included in the `Editor` context since ~v3.16.3.
   */
  insertCancelledTodo(name: string, lineIndex: number): void;

  /**
   * [Editor|Note].insertScheduledTodo()
   * Inserts a scheduled todo at the given line index
   * WARNING: 'lineIndex' can be different in `Editor` and `Note` contexts, even for the same paragraph, because frontmatter lines are not included in the `Editor` context since ~v3.16.3.
   */
  insertScheduledTodo(name: string, lineIndex: number, date: Date): void;

  /**
   * [Editor|Note].insertQuote()
   * Inserts a quote at the given line index
   * WARNING: 'lineIndex' can be different in `Editor` and `Note` contexts, even for the same paragraph, because frontmatter lines are not included in the `Editor` context since ~v3.16.3.
   */
  insertQuote(name: string, lineIndex: number): void;

  /**
   * [Editor|Note].insertList()
   * Inserts a list (bullet) item at the given line index
   * WARNING: 'lineIndex' can be different in `Editor` and `Note` contexts, even for the same paragraph, because frontmatter lines are not included in the `Editor` context since ~v3.16.3.
   */
  insertList(name: string, lineIndex: number): void;

  /**
   * [Editor|Note].insertHeading()
   * Inserts a heading at the given line index
   * WARNING: 'lineIndex' can be different in `Editor` and `Note` contexts, even for the same paragraph, because frontmatter lines are not included in the `Editor` context since ~v3.16.3.
   */
  insertHeading(name: string, lineIndex: number, level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): void;

  /**
   * [Editor|Note].appendTodo()
   * Appends a todo at the end of the note
   */
  appendTodo(content: string): void;

  /**
   * [Editor|Note].prependTodo()
   * Prepends a todo at the beginning of the note (after the title heading)
   */
  prependTodo(content: string): void;

  /**
   * [Editor|Note].appendParagraph()
   * Appends a paragraph at the end of the note
   */
  appendParagraph(content: string, type: ParagraphType): void;

  /**
   * [Editor|Note].prependParagraph()
   * Prepends a paragraph at the beginning of the note (after the title heading)
   */
  prependParagraph(content: string, type: ParagraphType): void;

  /**
   * [Editor|Note].addTodoBelowHeadingTitle()
   * Inserts a todo below the given title of a heading (at the beginning or end of existing text)
   * @param {string} content - Text of the todo
   * @param {string} headingTitle - Title of the heading (without '#  Markdown)
   * @param {boolean} shouldAppend - If the todo should be appended at the bottom of existing text
   * @param {boolean} shouldCreate - If the heading should be created if non-existing
   */
  addTodoBelowHeadingTitle(content: string, headingTitle: string, shouldAppend: boolean, shouldCreate: boolean): void;

  /**
   * [Editor|Note].addParagraphBelowHeadingTitle()
   * Inserts a paragraph below the given title of a heading (at the beginning or end of existing text)
   * @param {string} content - Text of the paragraph
   * @param {ParagraphType} paragraphType
   * @param {string} headingTitle - Title of the heading (without '#  Markdown)
   * @param {boolean} shouldAppend - If the todo should be appended at the bottom of existing text
   * @param {boolean} shouldCreate - If the heading should be created if non-existing
   */
  addParagraphBelowHeadingTitle(content: string, paragraphType: ParagraphType, headingTitle: string, shouldAppend: boolean, shouldCreate: boolean): void;

  /**
   * [Editor|Note].appendTodoBelowHeadingLineIndex()
   * Appends a todo below the given heading index (at the end of existing text)
   * @param {string} content - Text of the todo
   * @param {number} headingLineIndex - Line index of the heading (get the line index from a paragraph object). WARNING: 'lineIndex' can be different in `Editor` and `Note` contexts, even for the same paragraph, because frontmatter lines are not included in the `Editor` context since ~v3.16.3.

   */
  appendTodoBelowHeadingLineIndex(content: string, headingLineIndex: number): void;

  /**
   * Appends a paragraph below the given heading index (at the end of existing text)
   * @param {string} content - Text of the paragraph
   * @param {paragraphType} paragraphType
   * @param {number} headingLineIndex - Line index of the heading (get the line index from a paragraph object). WARNING: 'lineIndex' can be different in `Editor` and `Note` contexts, even for the same paragraph, because frontmatter lines are not included in the `Editor` context since ~v3.16.3.

   */
  appendParagraphBelowHeadingLineIndex(content: string, paragraphType: ParagraphType, headingLineIndex: number): void;

  /**
   * Inserts a todo after a given paragraph
   * @param {string} content - Text of the paragraph
   * @param {TParagraph} otherParagraph - Another paragraph, get it from `.paragraphs`
   */
  insertTodoAfterParagraph(content: string, otherParagraph: TParagraph): void;

  /**
   * Inserts a todo before a given paragraph
   * @param {string} content - Text of the paragraph
   * @param {TParagraph} otherParagraph - Another paragraph, get it from `.paragraphs`
   */
  insertTodoBeforeParagraph(content: string, otherParagraph: TParagraph): void;

  /**
   * Inserts a paragraph after a given paragraph
   * @param {string} content - Text of the paragraph
   * @param {TParagraph} otherParagraph - Another paragraph, get it from `.paragraphs`
   * @param {paragraphType} paragraphType
   */
  insertParagraphAfterParagraph(content: string, otherParagraph: TParagraph, paragraphType: ParagraphType): void;

  /**
   * Inserts a paragraph before a given paragraph
   * @param {string} content - Text of the paragraph
   * @param {TParagraph} otherParagraph - Another paragraph, get it from `.paragraphs`
   * @param {paragraphType} paragraphType
   */
  insertParagraphBeforeParagraph(content: string, otherParagraph: TParagraph, paragraphType: ParagraphType): void;

  /**
   * Removes a paragraph at a given line index.
   * WARNING: 'lineIndex' can be different in `Editor` and `Note` contexts, even for the same paragraph, because frontmatter lines are not included in the `Editor` context since ~v3.16.3.
   * @param {number} lineIndex - Line index of the paragraph
   */
  removeParagraphAtIndex(lineIndex: number): void;

  /**
   * Removes a given paragraph
   * @param {TParagraph} paragraph - Paragraph object to remove, get it from `.paragraphs`
   */
  removeParagraph(paragraph: TParagraph): void;

  /**
   * Removes given paragraphs
   * @param {Array<TParagraph>} paragraphs - Array of Paragraph object to remove, get it from `.paragraphs`
   */
  removeParagraphs(paragraphs: $ReadOnlyArray<TParagraph>): void;

  /**
   * Updates a given paragraph. Get the paragraph, then modify it and update the text in the note or editor using this method.
   * @param {TParagraph} paragraph - Paragraph object to update, get it from `.paragraphs`
   */
  updateParagraph(paragraph: TParagraph): void;

  /**
   * Updates an array of paragraphs. Get the paragraphs, then modify them and update the text in the note or editor using this method.
   * @param {Array<TParagraph>} paragraphs - Paragraph objects to update, get it from `.paragraphs`
   */
  updateParagraphs(paragraphs: $ReadOnlyArray<TParagraph>): void;

  /**
   * Replaces the text at the given range with the given text
   * @param {string} text - Text to insert
   * @param {number} location - Position to insert at (you can get this using 'renderedSelection' for example)
   * @param {number} length - Amount of characters to replace from the location
   */
  replaceTextInCharacterRange(text: string, location: number, length: number): void;

  /**
   * Publishes the note using CloudKit (inserts a record on the public database). Build the web-link to the note by using the publicRecordID.
   * Note: Available from v3.9.1
   * @return {Promise}
   */
  publish(): Promise<void>;
  /**
   * Unpublishes the note from CloudKit (deletes the database entry from the public database).
   * Note: Available from v3.9.1
   * @return {Promise}
   */
  unpublish(): Promise<void>;

  /**
   * Generates a unique block ID and adds it to the content of this paragraph.
   * Remember to call .updateParagraph(p) to write it to the note.
   * You can call this on the Editor or note you got the paragraph from.
   * Note: Available from v3.5.2
   * @param {TParagraph} paragraph
   */
  addBlockID(paragraph: TParagraph): void;

  /**
   * Removes the unique block ID, if it exists in the content.
   * Remember to call .updateParagraph(p) to write it to the note afterwards.
   * You can call this on the Editor or note you got the paragraph from.
   * Note: Available from v3.5.2
   * @param {TParagraph}
   */
  removeBlockID(paragraph: TParagraph): void;
  /**
   * Print the note, optionally with backlinks and events sections
   * Note: available from v3.4 on macOS
   * @param {boolean} withBacklinksAndEvents
   */
  printNote(withBacklinksAndEvents: boolean): void;

  /**
   * Resolves a conflict, if any, using the current version (which is version 1 in the conflict bar inside the UI). Once resolved you need to reload the note.
   * Note: Available from v3.9.3
   */
  resolveConflictWithCurrentVersion(): void;
  /**
   * Resolves a conflict, if any, using the other version (which is version 2 in the conflict bar inside the UI). Once resolved you need to reload the note.
   * Note: Available from v3.9.3
   */
  resolveConflictWithOtherVersion(): void;

  /**
   * To quickly identify if this specific note is from a teamspace.
   * Note: Available from v3.17.0
   * @returns {boolean}
   */
  +isTeamspaceNote: boolean;
  /**
   * The ID of the teamspace the note belongs to (will be undefined for private notes). This ID has the syntax of a UUID.
   * Note: Available from v3.17.0
   * @returns {?string}
   */
  +teamspaceID: ?string;
  /**
   * Returns the title of the teamspace the note belongs to (will be undefined for private notes)
   * Note: Available from v3.17.0
   * @returns {?string}
   */
  +teamspaceTitle: ?string;
}

declare class NotePlan {
  // Impossible constructor.
  constructor(_: empty): empty;
  /**
   * NotePlan.environment
   * Returns the environment information from the operating system:
   * Available from v3.3.2:
   *   .languageCode: string?
   *   .regionCode: string?
   *   .is12hFormat: boolean
   *   .preferredLanguages: Array<string>
   *   .secondsFromGMT: integer
   *   .localTimeZoneAbbreviation: string
   *   .localTimeZoneIdentifier: string
   *   .isDaylightSavingTime: boolean
   *   .daylightSavingTimeOffset: Double
   *   .nextDaylightSavingTimeTransition: Date
   *   .platform: "macOS" | "iPadOS" | "iOS"
   *   .hasSettings: boolean
   * Available from v3.4.1:
   *   .templateFolder: string (this return path relative to NP's root folder, normally "@Templates")
   *   .version: string (NotePlan's version, for example "3.4.1". Note: it may contain alpha characters too, so it is not recommended for use in tests or comparisons)
   *   .versionNumber: number (NotePlan's version as integer,for example 341. JGC Note: this will return '36' for v3.6.0, and is not recommended for use in tests or comparisons)
   *   .buildVersion: number (NotePlan's build number as integer,for example 730. Note: This is the item recommended for use in tests or comparisons)
   *   .templateFolder: {String}, relative path to the template folder = "@Templates"
   *   .machineName: {String}, name of the device, like 'macbook-pro.local', available in v3.9.7
   *   .screenWidth: {number}, available in v3.9.7
   *   .screenHeight: {number}, available in v3.9.7
   *   .teamspaceFilenamePrefix: {string}, the prefix for teamspace notes, available in v3.17.0
   *   .osVersion: {string}, the version of the operating system, as reported by the system (e.g. "Version 15.5 (Build 24F74)"), available in v3.18.0
   */
  static +environment: Object;
  /**
   * NotePlan.ai()
   * This is an async function, use it with "await". Sends a prompt to OpenAI and returns the result.
   * Optionally send the content of notes as well to process by specifying them in the list 'filenames', which is an array. For example ["note1.md", "folder/note2.md"]. This needs to be the exact path to the note. Your note extension might differ, the default is .txt, if you haven't changed it.
   * For calendar notes, you can use YYYYMMDD.md, like 20241101.md, or 2024-W10.md for weeks, etc. Natural language input is also supported like "this week", "today", "tomorrow", "this month", "next year", etc.
   * If you need to send a relative list of calendar notes, every note of the "last 7 days", you can use exactly this as the filename. The structure is as followed:
   *  1. use "next" or "last",
   *  2. define a number, like "7",
   *  3. define one of the timeframes: "days", "weeks", "months", "quarters", "years".
   * The timeframe also defines what kind of note is being accessed. Use "weeks" if you want to send weekly notes, "days" for daily notes etc.
   * You can also define a folder to send all the notes inside this folder. Use the path of the folder prefixed with "/", like "/Projects/Work".
   * To use a note titled 'this week' set useStrictFilenames = true.
   * If you are using your own Open AI API key, you can define a model, for example "o1", or "o3-mini". By default NotePlan uses GPT-4o.
   * More details at https://help.noteplan.co/article/233-ai-prompts-in-templates
   * Note: Available from v3.15.1
   * @param {string} prompt
   * @param {Array<string>} filenames
   * @param {boolean} useStrictFilenames
   * @param {string} model (available from v3.16.3)
   * @returns {Promise<string>}
   */
  static ai(prompt: string, filenames: Array<string>, useStrictFilenames: boolean, model?: string): Promise<string>;
  /**
   * NotePlan.selectedSidebarFolder
   * The selected sidebar folder (useful when a note is not showing in Editor, which is then null)
   * Note: available from v3.5.1
   */
  static +selectedSidebarFolder?: string;
  /**
   * NotePlan.showConfigurationView()
   * Open the current plugin's config UI, if available.
   * Note: available from v3.3.2 (just for macOS so far)
   */
  static showConfigurationView(): Promise<void>;
  /**
   * NotePlan.resetCaches()
   * To reset the caches, particularly in the case where the sidebar turns out incorrect.
   * It's an async operation, but it doesn't return a promise to tell you when it's done.
   * Note: available from v3.5.0
   */
  static resetCaches(): void;
  /**
   * NotePlan.openURL()
   * Opens the given URL using the default browser (x-callback-urls can also be triggered with this).
   * Note: Available from v3.5.2
   */
  static openURL(url: string): void;
  /**
   * NotePlan.stringDiff()
   * Returns the ranges that have changed between the two versions.
   * Note: Available from v3.7.2
   * @param {string} version1
   * @param {string} version2
   * @returns {Array<TRange>}
   */
  static stringDiff(version1: string, version2: string): Array<TRange>;
  /**
   * NotePlan.editors
   * Returns a list of all opened editors (in the main view, in split views and in floating windows). See more details in the "Editor" documentation.
   * Note: Available from v3.8.1 build 973
   * @returns {Array<TEditor>}
   */
  static +editors: Array<TEditor>;
  /**
   * NotePlan.htmlWindows
   * Returns a list of all opened HTML windows.
   * Note: Available from v3.8.1 build 973
   * @returns {Array<HTMLView>}
   */
  static +htmlWindows: Array<HTMLView>;
  /**
   * NotePlan.ai()
   * Note: Available from v3.15.1 (macOS build 1300)
   * This is an async function, use it with "await". Sends a prompt to OpenAI and returns the result.
   * Optionally send the content of notes as well to process by specifying them in the list 'filenames', which is an array. For example ["note1.md", "folder/note2.md"]. This needs to be the exact path to the note. Your note extension might differ, the default is .txt, if you haven't changed it.
   * For calendar notes, you can use YYYYMMDD.md, like 20241101.md, or 2024-W10.md for weeks, etc. Natural language input is also supported like "this week", "today", "tomorrow", "this month", "next year", etc.
   * @param {string} prompt
   * @param {Arraystring> } filenames
   * @param {boolean} useStrictFilenames?
   * @returns {Promise<string>}
   */
  static ai(prompt: string, filenames: Array<string>, useStrictFilenames: boolean): Promise<string>;
}

declare class HTMLView {
  // Impossible constructor.
  constructor(_: empty): empty;
  /**
   * HTMLView.showSheet()
   * Show HTML in a sheet (e.g. mobile/iPad modal).
   * Note: Available from v3.6.2
   * @param {string} HTML to show
   * @param {number?} width (optional integer)
   * @param {number?} height (optional integer)
   */
  static showSheet(HTML: string, width?: number, height?: number): void;
  /**
   * HTMLView.showWindow()
   * Open a non-modal window above the main window with the given html code and window title.
   * Note: Available from v3.7.0 (build >862)
   * Note: Following available from v3.9.1 (build 1020):
   * - Run it with await window = showWindow(...), so you can adjust the window position and height later.
   * - Use shouldFocus = true if it should bring the window to the front (default = false) when you are reusing an existing window, means when you are reloading the html content.
   * @param {string} HTML to show
   * @param {string} title for HTML window
   * @param {number?} width (optional integer)
   * @param {number?} height (optional integer)
   * @param {boolean?} shouldFocus?
   * @returns {Window} promise to window
   */
  static showWindow(html: string, title: string, width?: number, height?: number, shouldFocus?: boolean): Window;
  /**
   * HTMLView.showWindowWithOptions()
   * Open a non-modal window above the main window with the given html code and window title.
   * It returns a promise with the created window object.
   * Optionally, supply an object as the 3rd parameter to set window options: { width, height, x, y, shouldFocus, id }
   * By default, it will focus and bring to front the window on first launch.
   * If you are re-loading an existing HTML window's content, by default the window will not change z-order or focus (if it is in the back, it will stay in the back). You can override this by setting { shouldFocus: true } to bring to front on reload.
   * Note: from v3.9.6 (build 1087) will open multiple windows if different 'id' is delivered. If set it is assigned as the `customId` to the returning window.
   * Run it with await window = showWindow(...), so you can adjust the window position and height later.
   * Note: Available from v3.9.1 (build 1020)
   * @param {string} HTML to show
   * @param {string} title for HTML window
   * @param {Object} options { x: integer, y: integer, width: integer, height: integer, shouldFocus: boolean, id: string }
   * @returns {Window} promise to window
   */
  static showWindowWithOptions(html: string, title: string, options: Object): HTMLView;
  /**
   * Get a unique ID for the window to make it easier to identify it later
   * Note: Available from NotePlan v3.8.1 build 973
   * @returns {string}
   */
  +id: string;
  /**
   * HTMLView.customId
   * Set / get a custom identifier, so you don't need to cache the unique id.
   * Example: NotePlan.editors[0].customId = "test"
   * Generally speaking you should start this string with the plugin's ID, e.g. pluginJson['plugin.id'], and append '.name' if you need to have more than 1 HTML window type in the same plugin.
   * Note: Available from NotePlan v3.8.1 build 973
   * @returns {string}
   */
  customId: string;
  /**
   * HTMLView.type
   * Get type of window where the window is embedded in.
   * Possible values: main|split|floating|unsupported
   * It's unsupported on iOS at the moment.
   * Note: Available from NotePlan v3.8.1 build 973
   * @returns {string}
   */
  +type: string;
  /**
   * HTMLView.focus()
   * Send the window to the front.
   * Note: Available from NotePlan v3.8.1 build 973
   */
  focus(): void;
  /**
   * HTMLView.close()
   * Close the HTML window.
   * Note: Available from NotePlan v3.8.1 build 973
   */
  close(): void;
  /**
   * HTMLView.runJavaScript()
   * After opening an HTML window, make changes to the contents of the window by running JS code directly inside the opened window.
   * Returns a promise you can wait for with the return value, if any (depends if you added one to the JS code that is supposed to be executed).
   * Note: Available in v3.8. Second parameter added in build 1089.
   * @param { string } code JS to execute
   * @param { string | undefined } windowId ID of the HTML window to execute it in (undefined for non-desktop platforms)
   * @return { Promise | void }
   */
  static runJavaScript(code: string, windowId: string | void): Promise<void>;
  /**
   * HTMLView.windowRect
   * Set / get the position and size of an HTMLView window. Returns an object with x, y, width, height values.
   * If you want to change the coordinates or size, save the rect in a variable, modify the variable, then assign it to windowRect.
   * The position of the window might not be very intuitive, because the coordinate system of the screen works differently (starts at the bottom left for example). Recommended is to adjust the size and position of the window relatively to it's values or other windows.
   * Example:
   *   const rect = HTMLView.windowRect
   *   rect.height -= 50
   *   Editor.windowRect = rect
   *
   * Note: Available with v3.9.1 build 1020
   */
  windowRect: Rect;
}

/** JGC: I'm not entirely sure about this next line, but Window is some sort of thing. */
type Window = HTMLView | TEditor

// dbw commenting this out because it doesn't work and causes Flow errors
// type document = {
//   /**
//    * Set the title of the HTML window.
//    * Note: Available From 3.12 b1201.
//    */
//   title?: string,
//   addEventListener?: any,
//   removeEventListener?: any,
// }

type FetchOptions = {
  /* all optional */
  headers?: { [string]: string } /* key/value pairs of headers for the request */,
  method?: string /* GET, POST, PUT, DELETE, etc. */,
  body?: string /* body for a POST or PUT request. is a string so needs to be JSON.stringified */,
  timeout?: number /* timeout in ms */,
}

/**
 * Request a URL from a server and return the result as a string or null if no response
 * If you want to get detailed errors (e.g. no internet connection, etc.), use old-school promises instead, e.g.:
 * fetch('https://example.com').then((result) => { console.log(result) }).catch((error) => { console.log(error) })
 * If your response is a JSON response string, you should run JSON.parse(result) on the result.
 * @param {string} url
 * @param {FetchOptions} options (optional) options to pass to the fetch() call: method, headers, body, timeout (in ms)
 */
declare function fetch(url: string, options?: FetchOptions): Promise<string> /* do not run with await. see documentation */

// Every function made available must be assigned to `globalThis`
// This type ensures that only functions are made available as plugins
declare var globalThis: { [string]: () => mixed, document: mixed, [string]: mixed } | null

declare type TAnyObject = { [key: string]: any }
