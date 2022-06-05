// @flow

/**
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
  ...TParagraphBridge,
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
   * Inserts a plain paragraph before the selected paragraph (or the paragraph the cursor is currently positioned)
   * @param name - Text of the paragraph
   * @param type - paragraph type
   * @param indents - How much it should be indented
   */
  insertParagraphAtCursor(name: string, type: ParagraphType, indents: number): void,
  /**
   * Replaces the current cursor selection with the given text
   * @param text - Text to insert
   */
  replaceSelectionWithText(text: string): void,
  /**
   * Opens a note using the given filename.
   * Note: some parameters introduced in v3.4 and v3.5.2
   * @param {string} filename - Filename of the note file (can be without extension), but has to include the relative folder such as `folder/filename.txt`.
   * @param {boolean} newWindow - (optional) Open note in new window (default = false)?
   * @param {number} highlightStart - (optional) Start position of text highlighting
   * @param {number} highlightEnd - (optional) End position of text highlighting
   * @param {boolean} splitView - (optional) Open note in a new split view (Note: Available from v3.4)
   * @param {boolean} createIfNeeded - (optional) Create the note with the given filename if it doesn't exist (only project notes, v3.5.2+)
   * @return {Promise<TNote>} - When the note has been opened, a promise will be returned (use with await ... or .then())
   */
  openNoteByFilename(filename: string, newWindow?: boolean, highlightStart?: number, highlightEnd?: number, splitView?: boolean): Promise<TNote>,
  /**
   * Opens a note by searching for the give title (first line of the note)
   * Note: splitView parameter available for macOS from r727 (v3.4)
   * @param {String} title - Title (case sensitive) of the note (first line)
   * @param {boolean} newWindow - (optional) Open note in new window (default = false)?
   * @param {number} highlightStart - (optional) Start position of text highlighting
   * @param {number} highlightEnd - (optional) End position of text highlighting
   * @param {boolean} splitView - (optional) Open note in a new split view (Note: Available from v3.4)
   * @return {Promise<TNote>} - When the note has been opened, a promise will be returned
   */
  openNoteByTitle(title: string, newWindow?: boolean, highlightStart?: number, highlightEnd?: number, splitView?: boolean): Promise<TNote>,
  /**
   * Opens a note by searching for the give title (first line of the note)
   * Note: splitView parameter available for macOS from r727 (v3.4)
   * @param {String} title - Title (case sensitive) of the note (first line)
   * @param {boolean} newWindow - (optional) Open note in new window (default = false)?
   * @param {number} highlightStart - (optional) Start position of text highlighting
   * @param {number} highlightEnd - (optional) End position of text highlighting
   * @param {boolean} splitView - (optional) Open note in a new split view (Note: Available from v3.4)
   * @return {Promise<TNote>} - When the note has been opened, a promise will be returned
   */
  openNoteByTitleCaseInsensitive(title: string, newWindow?: boolean, caseSensitive?: boolean, highlightStart?: number, highlightEnd?: number, splitView?: boolean): Promise<TNote>,
  /**
   * Opens a calendar note by the given date
   * Note: splitView parameter available for macOS from r727 (v3.4)
   * @param {Date} date - The date that should be opened, this is a normal JavaScript date object
   * @param {boolean} newWindow - (optional) Open note in new window (default = false)?
   * @param {number} highlightStart - (optional) Start position of text highlighting
   * @param {number} highlightEnd - (optional) End position of text highlighting
   * @param {boolean} splitView - (optional) Open note in a new split view (Note: Available from v3.4)
   * @return {Promise<TNote>} - When the note has been opened, a promise will be returned
   */
  openNoteByDate(date: Date, newWindow?: boolean, highlightStart?: number, highlightEnd?: number, splitView?: boolean): Promise<TNote>,
  /**
   * Opens a calendar note by the given date string
   * @param {String} dateString - The date string that should be opened, in ISO format: "YYYYMMDD", like "20210501"
   * @param {boolean} newWindow - (optional) Open note in new window (default = false)?
   * @param {number} highlightStart - (optional) Start position of text highlighting
   * @param {number} highlightEnd - (optional) End position of text highlighting
   * @param {boolean} splitView - (optional) Open note in a new split view (Note: Available from v3.4)
   * @return {Promise<TNote>} - When the note has been opened, a promise will be returned
   */
  openNoteByDateString(filename: string, newWindow?: boolean, highlightStart?: number, highlightEnd?: number, splitView?: boolean): Promise<TNote | void>,
  /**
   * Selects the full text in the editor.
   * NB: Available from NotePlan v3.2 (Mac Build: 662, iOS Build: 593)
   */
  selectAll(): void,
  /**
   * (Raw) select text in the editor (like select 10 characters = length from position 2 = start)
   * Raw means here that the position is calculated with the Markdown revealed,
   * including Markdown links and folded text.
   * @param {number} start - Character start position
   * @param {number} length - Character length
   */
  select(start: number, length: number): void,
  /**
   * (Rendered) select text in the editor (like select 10 characters = length from position 2 = start)
   * Rendered means here that the position is calculated with the Markdown hidden,
   * including Markdown links and folded text.
   * @param {number} start - Character start position
   * @param {number} length - Character length
   */
  renderedSelect(start: number, length: number): void,
  /**
   * Copies the currently selected text in the editor to the system clipboard.
   * NB: See also Clipboard object.
   * NB: Available from NotePlan v3.2 (Mac Build: 662, iOS Build: 593)
   */
  copySelection(): void,
  /**
   * Pastes the current content in the system clipboard into the current selection in the editor.
   * NB: See also Clipboard object.
   * NB: Available from NotePlan v3.2 (Mac Build: 662, iOS Build: 593)
   */
  pasteClipboard(): void,
  /**
   * Scrolls to and highlights the given paragraph. If the paragraph is folded,
   * it will be unfolded.
   * @param {TParagraph} paragraph to highlight
   */
  highlight(paragraph: TParagraph): void,
  /**
   * Scrolls to and highlights the given range. If the paragraph is folded, it
   * will be unfolded.
   * @param {RangeObject} range
   */
  highlightByRange(range: Range): void,
  /**
   * Scrolls to and highlights the given range defined by the character index and
   * the character length it should cover. If the paragraph is folded, it will be unfolded.
   * Note: Available from v3.0.23+ (Mac: Build 636+, iOS: Build 562+)
   * @param {number} index
   * @param {number} length
   */
  highlightByIndex(index: number, length: number): void,
  /**
   * Folds the given paragraph or unfolds it if its already folded. If the paragraph is not a heading, it will look for the heading this paragraph exists under.
   * Note: Available from v3.6.0
   * @param {TParagraph}
  */
  toggleFolding(paragraph: TParagraph): void,
    /**
     * Checks if the given paragraph is folded or not. If it's not a heading, it will look for the heading this paragraph exists under.
     * Note: Available from v3.6.0
     * @param {TParagraph}
     * @return {boolean}   
    */
  isFolded(paragraph: TParagraph): boolean,
  /**
   * Shows or hides a window with a loading indicator or a progress ring (if progress is defined) and an info text (optional).
   * `text` is optional, if you define it, it will be shown below the loading indicator.
   * `progress` is also optional. If it's defined, the loading indicator will change into a progress ring. Use float numbers from 0-1 to define how much the ring is filled.
   * When you are done, call `showLoading(false)` to hide the window.
   * Note: Available from v3.0.26
   * @param {boolean}
   * @param {String?}
   * @param {Float?}
   */
  showLoading(visible: boolean, text?: ?string, progress?: number): void,
  /**
   * If you call this, anything after `await CommandBar.onAsyncThread()` will run on an asynchronous thread.
   * Use this together with `showLoading`, so that the work you do is not blocking the user interface.
   * Otherwise the loading window will be also blocked.
   *
   * Warning: Don't use any user interface calls (other than showLoading) on an asynchronous thread. The app might crash.
   * You need to return to the main thread before you change anything in the window (such as Editor functions do).
   * Use `onMainThread()` to return to the main thread.
   * Note: Available from v3.0.26
   * @return {Promise}
   */
  onAsyncThread(): Promise<void>,
  /**
   * If you call this, anything after `await CommandBar.onMainThread()` will run on the main thread.
   * Call this after `onAsyncThread`, once your background work is done.
   * It is safe to call Editor and other user interface functions on the main thread.
   * Note: Available from v3.0.26
   * @return {Promise}
   */
  onMainThread(): Promise<void>,
  /**
   * Get the names of all supported themes (including custom themes imported into the Theme folder).
   * Use together with `.setTheme(name)`
   * Note: Available from NotePlan v3.1+
   * @return {$ReadOnlyArray<string>}
   */
  availableThemes(): $ReadOnlyArray<string>,
  /**
   * Change the current theme. Get all available theme names using `.availableThemes`. Custom themes are also supported. Use the filename in this case.
   * Note: Available from NotePlan v3.1+
   * @param {String}
   */
  setTheme(name: string): void,
  /**
   * Add a new theme using the raw json string. It will be added as a custom theme and you can load it right away with `.setTheme(name)` using the filename defined as second parameter. Use ".json" as file extension.
   * It returns true if adding was successful and false if not. An error will be also printed into the console.
   * Adding a theme might fail, if the given json text was invalid.
   * Note: Available from NotePlan v3.1+
   * @param {string} json
   * @param {string} filename
   * @return {Boolean}
   */
  addTheme(json: string, filename: string): boolean,
  /**
   * Print current note, optionally with backlinks and events sections
   * Note: available from macOS build 729
   * @param {boolean} addReferenceSections
   */
  printNote(boolean: addReferenceSections): void,
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
   * Get all folders as array of strings. Including the root "/" and excluding
   * folders from Archive or Trash.
   */
  +folders: $ReadOnlyArray<string>,
  /**
   * Get all calendar notes.
   * Note: from v3.4 this includes all future-referenced dates, not just those with
   * an actual created note.
   */
  +calendarNotes: $ReadOnlyArray<TNote>,
  /**
   * Get all regular, project notes.
   */
  +projectNotes: $ReadOnlyArray<TNote>,

  /**
   * Get or set settings for the current plugin (as a JavaScript object).
   * Example: settings.shortcutExpenses[0].category
   * Note: Available from NotePlan v3.3.2
   */
  settings: Object,

  /**
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
   * Others can be set by plugins.
   */
  +preference: (key: string) => any,
  /**
   * Change a saved preference or create a new one. It will most likely be picked up by NotePlan after a restart, if you use one of the keys utilized by NotePlan.
   * To change a NotePlan preference, use the keys found in the description of the function `.preference(key)`.
   * You can also save custom preferences specific to the plugin, if you need any. Prepend it with the plugin id or similar to avoid collisions with existing keys.
   * Note: Available from NotePlan v3.1
   * @param {string}
   * @param {any}
   */
  setPreference(key: string, value: any): void,
  /**
   * Save a JavaScript object to the Plugins folder as JSON file.
   * This can be used to save preferences or other persistent data.
   * It's saved automatically into a new folder "data" in the Plugins folder.
   * But you can "escape" this folder using relative paths: ../Plugins/<folder or filename>.
   * Note: Available from NotePlan v3.1
   * @param {Object}
   * @param {string}
   * @return {boolean}
   */
  saveJSON(object: Object, filename?: string): boolean,
  /**
   * Load a JavaScript object from a JSON file located (by default) in the <Plugin>/data folder.
   * But you can also use relative paths: ../Plugins/<folder or filename>.
   * Note: Available from NotePlan v3.1
   * @param {string}
   * @return {Object}
   */
  loadJSON(filename?: string): Object,
  /**
  * Note: Available from NotePlan v3.2+
  * Save data to a file, as base64 string. The file will be saved under "[NotePlan Folder]/Plugins/data/[plugin-id]/[filename]".
  * Returns true if the file could be saved, false if not and prints the error.
  * @param {String} 
  * @param {String} 
  * @return {Boolean}
  */
  saveData(data: string, filename: string): boolean,
  /**
  * Note: Available from NotePlan v3.2+
  * Load binary data from file encoded as base64 string. 
  * The file has to be located in "[NotePlan Folder]/Plugins/data/[plugin-id]/[filename]".
  * You can access the files of other plugins as well, if the filename is known using relative paths "../[other plugin-id]/[filename]" or simply go into the "data"'s root directory "../[filename]" to access a global file.
  * Returns undefined, if the file couldn't be loaded and prints an error message.
  * @param {String} 
  * @return {String?}
  */
  loadData(filename: string): ?string,
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
   * Returns all regular notes with the given title.
   * Since multiple notes can have the same title, an array is returned.
   * Use 'caseSensitive' (default = false) to search for a note ignoring
   * the case and set 'searchAllFolders' to true if you want to look for
   * notes in trash and archive as well.
   * By default NotePlan won't return notes in trash and archive.
   */
  projectNoteByTitle(title: string, caseInsensitive?: boolean, searchAllFolders?: boolean): ?$ReadOnlyArray<TNote>,
  /**
   * Returns all regular notes with the given case insensitive title.
   * Note: Since multiple notes can have the same title, an array is returned.
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
   * Use "YYYYMMDD.ext" for calendar notes, like "20210503.txt".
   */
  noteByFilename(filename: string, type: NoteType): ?TNote,
  /**
   * Move a regular note using the given filename (with extension) to another
   * folder. Use "/" for the root folder.
   * Returns the final filename; if the there is a duplicate, it will add a number.
   */
  moveNote(noteName: string, folder: string): ?string,
  /**
   * Creates a regular note using the given title and folder.
   * Use "/" for the root folder.
   * It will write the given title as "# title" into the new file.
   * Returns the final filename; if the there is a duplicate, it will add a number.
   */
  newNote(noteTitle: string, folder: string): ?string,
  /**
   * Creates a regular note using the given content, folder and filename. Use "/" for the root folder.
   * The content should ideally also include a note title at the top.
   * Returns the final filename with relative folder (`folder/filename.txt` for example).
   * If the there is a duplicate, it will add a number.
   * Alternatively, you can also define the filename as the third optional variable (v3.5.2+)
   * Note: available from v3.5, with 'filename' parameter added in v3.5.2
   * @param {string} content for note
   * @param {string} folder to create the note in
   * @param {string} filename of the new note (available from v3.5.2)
   * @return {string}
   */
  newNoteWithContent(content: string, folder: string, filename: string): string,

  /**
   * Loads all available plugins asynchronously from the GitHub repository and returns a list.
   * You can show a loading indicator using the first parameter (true) if this is part of some user interaction. Otherwise, pass "false" so it happens in the background.
   * Note: Available from NotePlan v3.5.2
   * @param {boolean}
   */
  listPlugins(showLoading: boolean): Promise<void>,
  /**
   * Installs a given plugin (load a list of plugins using `.listPlugins` first). If this is part of a user interfaction, pass "true" for `showLoading` to show a loading indicator.
   * Note: Available from NotePlan v3.5.2
   * @param {PluginObject}
   * @param {boolean}
   */
  installPlugin(pluginObject: PluginObject, showLoading: boolean): Promise<void>,
  /**
   * Returns all installed plugins as PluginObject(s).
   * Note: Available from NotePlan v3.5.2
   * @return {[PluginObject]}
   */
  installedPlugins(): [PluginObject],
  /**
   * Invoke a given command from a plugin (load a list of plugins using `.listPlugins` first, then get the command from the `.commands` list).
   * If the command supports it, you can also pass an array of arguments which can contain any type (object, date, string, integer,...)
   * It returns the particular return value of that command which can be a Promise so you can use it with `await`.
   * Note: Available from NotePlan v3.5.2
   * @param {PluginCommandObject}
   * @param {$ReadOnlyArray<mixed>}
   * @return {any} Return value of the command, like a Promise
   */
  invokePluginCommand(command: PluginCommandObject, arguments: $ReadOnlyArray<mixed>): Promise<any>,
  /**
   * Invoke a given command from a plugin using the name and plugin ID, so you don't need to load it from the list.
   * If the command doesn't exist locally null will be returned with a log message.
   * If the command supports it, you can also pass an array of arguments which can contain any type (object, date, string, integer,...)
   * Note: Available from NotePlan v3.5.2
   * @param {string}
   * @param {string}
   * @param {$ReadOnlyArray<mixed>}
   * @return {any} Return value of the command, like a Promise
   */
  invokePluginCommandByName(command: string, pluginID: string, arguments ?: $ReadOnlyArray < mixed >): Promise < any >,
    /**
     * Checks if the given pluginID is installed or not.
     * Note: Available from NotePlan v3.6.0
     * @param {string}
     * @return {boolean}
     */
    isPluginInstalledByID(pluginID: string): boolean,
      /**
       * Installs a given array of pluginIDs if needed. It checks online if a new version is available and downloads it. 
       * Use it without `await` so it keeps running in the background or use it with `await` in "blocking mode" if you need to install a plugin as a dependency. In this case you can use `showPromptIfSuccessful = true` to show the user a message that a plugin was installed and `showProgressPrompt` will show a loading indicator beforehand. With both values set to false or not defined it will run in "silent" mode and show no prompts.
       * Note: Available from NotePlan v3.6.0
       * @param {[string]} 
       * @param {boolean} 
       * @param {boolean} 
       * @return {Promise<>}
       */
      installOrUpdatePluginsByID(pluginIDs: [string], showPromptIfSuccessful: boolean, showProgressPrompt: boolean): Promise < void> | void,
  /**
   * Returns an array of paragraphs having the same blockID like the given one (which is also part of the return array).
   * You can use `paragraph[0].note` to access the note behind it and make updates via `paragraph[0].note.updateParagraph(paragraph[0])` if you make changes to the content, type, etc (like checking it off as type = "done").
   * Note: Available from NotePlan v3.5.2
   * @param {TParagraph}
   * @return {[TParagraph]}
   */
  referencedBlocks(paragraph: TParagraph): TParagraph,
}

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
}

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
  +commands: PluginCommandObject,
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
  showOptions<TOption: string = string>(options: $ReadOnlyArray<TOption>, placeholder: string): Promise<{ +index: number, +value: TOption }>,
  /**
   * Asks the user to enter something into the CommandBar.
   *
   * Use the "placeholder" value to display a question,
   * like "Type the name of the task".
   *
   * Use the "submitText" to describe what happens with the selection,
   * like "Create task named '%@'".
   *
   * The "submitText" value supports the variable "%@" in the string, that
   * NotePlan autofill with the typed text.
   *
   * It returns a Promise, so you can wait (using "await...") for the user
   * input with the entered text as success result.
   */
  showInput(placeholder: string, submitText: string): Promise<string>,
  /**
   * Shows or hides a window with a loading indicator or a progress ring (if progress is defined) and an info text (optional).
   * `text` is optional, if you define it, it will be shown below the loading indicator.
   * `progress` is also optional. If it's defined, the loading indicator will change into a progress ring. Use float numbers from 0-1 to define how much the ring is filled.
   * When you are done, call `showLoading(false)` to hide the window.
   * Note: Available from v3.0.26
   * @param {Bool}
   * @param {String?}
   * @param {Float?}
   */
  showLoading(visible: boolean, text?: string, progress?: number): void,
  /**
   * If you call this, anything after `await CommandBar.onAsyncThread()` will run on an asynchronous thread.
   * Use this together with `showLoading`, so that the work you do is not blocking the user interface.
   * Otherwise the loading window will be also blocked.
   *
   * Warning: Don't use any user interface calls (other than showLoading) on an asynchronous thread. The app might crash.
   * You need to return to the main thread before you change anything in the window (such as Editor functions do).
   * Use `onMainThread()` to return to the main thread.
   * Note: Available from v3.0.26
   */
  onAsyncThread(): Promise<void>,
  /**
   * If you call this, anything after `await CommandBar.onMainThread()` will run on the main thread.
   * Call this after `onAsyncThread`, once your background work is done.
   * It is safe to call Editor and other user interface functions on the main thread.
   * Note: Available from v3.0.26
   */
  onMainThread(): Promise<void>,

  /**
   * Show a native alert or confirm with title and message
   * Define at least one or more buttons for the user to select.
   * If you don't supply any buttons, an "OK" button will be displayed.
   * The promise returns selected button, with button index (0 - first button)
   * Note: Available from v3.3.2
   * @param {string}
   * @param {string}
   * @param {?$ReadOnlyArray<string>}
   */
  prompt(title: string, message: string, buttons?: $ReadOnlyArray<string>): Promise<number>,

  /**
   * Show a native text input prompt to the user with title and message text.
   * The buttons will be "OK" and "Cancel".
   * You can supply a default value which will be pre-filled.
   * If the user selects "OK", the promise returns users entered value
   * If the user selects "Cancel", the promise returns false.
   * Note: Available from v3.3.2
   * @param {String}
   * @param {String?}
   * @param {String?}
   */
  textPrompt(title: string, message: string, defaultValue: string): Promise<string | false>,
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
   * Get the titles of all calendars the user has access to. Set `writeOnly` true, if you want to get only the calendars the user has write access to (some calendars, like holidays are not writable).
   * Note: Available from NotePlan v3.1
   * @param {boolean}
   * @return {[string]}
   */
  availableCalendarTitles(writeOnly: boolean): $ReadOnlyArray<string>,
  /**
   * Get the titles of all reminders the user has access to.
   * Note: Available from NotePlan v3.1
   * @return {[string]}
   */
  availableReminderListTitles(): $ReadOnlyArray<string>,
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
   * Note: month uses Swift counting (1-12) not Javascript counting (0-11).
   */
  dateFrom(year: number, month: number, day: number, hour: number, minute: number, second: number): Date,
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
   * Returns all events between the `startDate` and `endDate`. Use `filter` to search for specific events (keyword in the title).
   * This function fetches events asynchronously, so use async/await.
   * Note: Available from v3.0.25
   * @param {Date}
   * @param {Date}
   * @param {String?}
   * @return {Promise}
   */
  eventsBetween(startDate: Date, endDate: Date, filter?: ?string): Promise<Array<TCalendarItem>>,
  /**
   * Returns all reminders between the `startDate` and `endDate`. Use `filter` to search for specific reminders (keyword in the title).
   * This function fetches reminders asynchronously, so use async/await.
   * Note: Available from v3.0.25
   * @param {Date}
   * @param {Date}
   * @param {String?}
   * @return {Promise}
   */
  remindersBetween(startDate: Date, endDate: Date, filter?: ?string): Promise<Array<TCalendarItem>>,
  /**
   * Returns all events for today. Use `filter` to search for specific events (keyword in the title).
   * This function fetches events asynchronously, so use async/await.
   * Note: Available from v3.0.25
   * @param {String?}
   * @return {Promise}
   */
  eventsToday(filter: ?string): Promise<Array<TCalendarItem>>,
  /**
   * Returns all reminders between for today. Use `filter` to search for specific reminders (keyword in the title).
   * This function fetches reminders asynchronously, so use async/await.
   * Note: Available from v3.0.25
   * @param {String?}
   * @return {Promise}
   */
  remindersToday(filter: ?string): Promise<Array<TCalendarItem>>,
  /**
   * Updates an event or reminder based on the given CalendarItem, which needs to have an ID.
   * A CalendarItem has an ID, when you have used `.add(...)` and saved the return value or when you query
   * the event using `eventsBetween(...)`, `remindersBetween(...)`, `eventByID(...)`, `reminderByID(...)`, etc.
   * Returns a promise, because it needs to fetch the original event objects first in the background,
   * then updates it. Use it with `await`.
   * Note: Available from v3.0.26
   * @param {CalendarItem}
   * @return {Promise}
   */
  update(calendarItem: TCalendarItem): Promise<void>,
  /**
   * Removes an event or reminder based on the given CalendarItem, which needs to have an ID.
   * A CalendarItem has an ID, when you have used `.add(...)` and saved the return value or when you query
   * the event using `eventsBetween(...)`, `remindersBetween(...)`, `eventByID(...)`, `reminderByID(...)`, etc.
   * Returns a promise, because it needs to fetch the original event objects first in the background,
   * then updates it. Use it with `await`.
   * Note: Available from v3.0.26
   * @param {CalendarItem}
   * @return {Promise}
   */
  remove(calendarItem: TCalendarItem): Promise<void>,
  /**
   * Returns the event by the given ID. You can get the ID from a CalendarItem, which you got from using `.add(...)` (the return value is a CalendarItem with ID) or when you query the event using `eventsBetween(...)`, `eventByID(...)`, etc.
   * This function fetches reminders asynchronously, so use async/await.
   * Note: Available from v3.0.26
   * @param {String}
   * @return {Promise(CalendarItem)}
   */
  eventByID(id: string): Promise<Array<TCalendarItem>>,
  /**
   * Returns the reminder by the given ID. You can get the ID from a CalendarItem, which you got from using `.add(...)` (the return value is a CalendarItem with ID) or when you query the event using `remindersBetween(...)`, `reminderByID(...)`, etc.
   * Use with async/await.
   * Note: Available from v3.0.26
   * @param {String}
   * @return {Promise(CalendarItem)}
   */
  reminderByID(id: string): Promise<Array<TCalendarItem>>,
  /**
   * Returns all reminders (completed and incomplete) for the given lists (array of strings).
   * If you keep the lists variable empty, NotePlan will return all reminders from all lists. You can get all Reminders lists calling `Calendar.availableReminderListTitles()`
   * This function fetches reminders asynchronously, so use async/await.
   * Note: Available from v3.5.2
   * @param {[string]?}
   * @return {Promise}
   */
  remindersByLists(lists: $ReadOnlyArray<string>): Promise<Array<TCalendarItem>>,
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
  title?: ?string,
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
  /**
   * Returns indented paragraphs (children) underneath a task
   * Only tasks can have children, but any paragraph indented underneath a task
   * can be a child of the task. This includes bullets, tasks, quotes, text.
   * Children are counted until a blank line, HR, title, or another item at the
   * same level as the parent task. So for items to be counted as children, they
   * need to be contiguous vertically.
   * Important note: .children() for a task paragraph will return every child,
   * grandchild, greatgrandchild, etc. So a task that has a child task that has
   * a child task will have 2 children (and the first child will have one)
   * Note: Available from v3.3
   * @return {[TParagraph]}
   */
  children(): $ReadOnlyArray<TParagraph>,
  /**
   * Returns an array of all paragraphs having the same blockID (including this paragraph). You can use `paragraph[0].note` to access the note behind it and make updates via `paragraph[0].note.updateParagraph(paragraph[0])` if you make changes to the content, type, etc (like checking it off as type = "done")
   * Note: Available from v3.5.2
   * @type {[ParagraphObject]} - getter
   */
  +referencedBlocks: [TParagraph],
  /**
   * Returns the NoteObject behind this paragraph. This is a convenience method, so you don't need to use DataStore.
   * Note: Available from v3.5.2
   * @type {TNote?}
   */
  +note: ?TNote,
  /**
   * Returns the given blockId if any.
   * Note: Available from v3.5.2
   * @type {string?}
   */
  +blockId: ?string,
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
  ...TParagraphBridge,
  /**
   * Folder + Filename of the note (the path is relative to the root of the chosen storage location)
   */
  +filename: string,
  /**
   * Type of the note, either "Notes" or "Calendar".
   */
  +type: NoteType,
  /**
   * Title = first line of the note. (NB: Getter only.)
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
   * Get or set the raw text of the note (without hiding or rendering any Markdown).
   * If you set the content, NotePlan will write it immediately to file.
   * If you get the content, it will be read directly from the file.
   */
  content: string | void,
  /**
   * Get or set paragraphs contained in this note (can be tasks, plain text, headings...).
   * If you set the paragraph array, it will join them and save the new content
   * to file.
   */
  paragraphs: Array<TParagraph>,
  /**
   * Get paragraphs contained in this note which contain a link to another [[project note]] or [[YYYY-MM-DD]] daily note.
   * Note: Available from v3.2.0
   */
  +linkedItems: $ReadOnlyArray<TParagraph>,
  /**
   * Get paragraphs contained in this note which contain a link to a daily note.
   * Specifically this includes paragraphs with >YYYY-MM-DD, @YYYY-MM-DD, <YYYY-MM-DD, >today, @done(YYYY-MM-DD HH:mm), but only in non-calendar notes (because currently NotePlan doesn't create references between daily notes).
   * Note: Available from v3.2.0
   */
  +datedTodos: $ReadOnlyArray<TParagraph>,
  /**
   * Get all backlinks pointing to the current note as Paragraph objects. In this array, the toplevel items are all notes linking to the current note and the 'subItems' attributes (of the paragraph objects) contain the paragraphs with a link to the current note. The heading of the linked paragraphs are also listed here, although they don't have to contain a link.
   * NB: Backlinks are all [[note name]] and >date links.
   * Note: Available from v3.2.0
   */
  +backlinks: $ReadOnlyArray<TParagraph>,
  /**
   * Get all types assigned to this note in the frontmatter as an array of strings.
   * You can set types of a note by adding frontmatter e.g. `type: meeting-note, empty-note` (comma separated).
   * Note: Available from v3.5.0
   */
  +frontmatterTypes: $ReadOnlyArray<string>,
  /**
   * Print the note, optionally with backlinks and events sections
   * Note: available from macOS build 729
   * @param {boolean} addReferenceSections
   */
  printNote(addReferenceSections: boolean): void,
  /**
   * Generates a unique block ID and adds it to the content of this paragraph.
   * Remember to call .updateParagraph(p) to write it to the note.
   * You can call this on the Editor or note you got the paragraph from.
   * Note: Available from v3.5.2
   * @param {TParagraph}
   */
  addBlockID(paragraph: TParagraph): void,
  /**
   * Removes the unique block ID, if it exists in the content.
   * Remember to call .updateParagraph(p) to write it to the note afterwards.
   * You can call this on the Editor or note you got the paragraph from.
   * Note: Available from v3.5.2
   * @param {TParagraph}
   */
  removeBlockID(paragraph: TParagraph): void,
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
  +type: string,
  /**
   * If the calendar item is all-day, means it has no specific time.
   */
  +isAllDay: boolean,
  /**
   * If the calendar item is completed. This applies only to reminders.
   * Note: Available from v3.0.15
   */
  +isCompleted: boolean,
  /**
   * All the dates the event or reminder occurs (if it's a multi-day event for example)
   * Note: Available from v3.0.15
   */
  +occurrences: [Date],
  /**
   * The calendar or reminders list where this event or reminder is (or should be) saved. If you set nothing, the event or reminder will be added to the default and this field will be set after adding.
   * Note: Available from v3.0.15.
   */
  +calendar: string,
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
   * If supported, shows the availability for the event. The default is 0 = busy.
   * notSupported = -1
   * busy = 0
   * free = 1
   * tentative = 2
   * unavailable = 3
   * Note: Available from v3.3
   */
  +availability: number,
  /**
   * List of attendee names or emails.
   * Some example result strings show the variety possible:
   * - "[bob@example.com](mailto:bob@example.com)"
   * - "✓ [Jonathan Clark](/aOTg2Mjk1NzU5ODYyOTU3NUcglJxZek7H6BDKiYH0Y7RvgqchDTUR8sAcaQmcnHR_/principal/) (organizer)"
   * - "[TEST Contact1](mailto:test1@clarksonline.me.uk)",
   * But I think it is closer to being a JS Map [string, string].
   * Note: Available from v3.5.0
   */
  +attendees: [string],
    /**
     * List of attendee names (or email addresses if name isn't available).
     * Note: Available from v3.5.2
     */
    +attendeeNames: [string],
  /**
   * Markdown link for the given event. If you add this link to a note, NotePlan will link the event with the note and show the note in the dropdown when you click on the note icon of the event in the sidebar.
   * Note: Available from v3.5, only events, reminders are not supported yet
   */
  +calendarItemLink: string,
  /**
   * Create a CalendarItem. The .endDate is optional, but recommended for events.
   * Reminders don't use this field.
   *
   * The type can be "event" or "reminder". And isAllDay can be used if you
   * don't want to define a specific time, like holidays.
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
  ): TCalendarItem,
}

/**
 * Access and set the data inside the current clipboard.
 * Note: See also 2 methods in the TEditor object.
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
   * Set the data as base64 string for a specific type like an image or RTF.
   * Note: Available from v3.4.1
   * @param {string} base64String
   * @param {string} type
   */
  setBase64DataStringForType(base64String: string, type: string): void,
  /**
   * Get the base64 data string for a specific type like an image or RTF from the clipboard.
   * Note: Available from v3.4.1
   * @param {string} type
   * @return {string}
   */
  base64DataStringForType(type: string): string,
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

/* Available paragraph types
 * Note: 'separator' added v3.4.1
 */
type ParagraphType = 'open' | 'done' | 'scheduled' | 'cancelled' | 'title' | 'quote' | 'list' | 'empty' | 'text' | 'code' | 'separator'

declare var ParagraphBridge: TParagraphBridge
type TParagraphBridge = {
  /**
   * Returns a range object of the full paragraph of the given character
   * position.
   */
  paragraphRangeAtCharacterIndex(characterPosition: number): Range,

  /**
   * Inserts a plain paragraph at the given line index
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
  insertHeading(name: string, lineIndex: number, level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): void,

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
   * Inserts a todo below the given title of a heading (at the beginning or end of existing text)
   * @param {string} title - Text of the todo
   * @param {string} headingTitle - Title of the heading (without '#  Markdown)
   * @param {boolean} shouldAppend - If the todo should be appended at the bottom of existing text
   * @param {boolean} shouldCreate - If the heading should be created if non-existing
   */
  addTodoBelowHeadingTitle(title: string, headingTitle: string, shouldAppend: boolean, shouldCreate: boolean): void,

  /**
   * Inserts a paragraph below the given title of a heading (at the beginning or end of existing text)
   * @param {string} title - Text of the paragraph
   * @param {ParagraphType} paragraphType
   * @param {string} headingTitle - Title of the heading (without '#  Markdown)
   * @param {boolean} shouldAppend - If the todo should be appended at the bottom of existing text
   * @param {boolean} shouldCreate - If the heading should be created if non-existing
   */
  addParagraphBelowHeadingTitle(title: string, paragraphType: ParagraphType, headingTitle: string, shouldAppend: boolean, shouldCreate: boolean): void,

  /**
   * Appends a todo below the given heading index (at the end of existing text)
   * @param title - Text of the todo
   * @param headingLineIndex - Line index of the heading (get the line index from a paragraph object)
   */
  appendTodoBelowHeadingLineIndex(title: string, headingLineIndex: number): void,

  /**
   * Appends a paragraph below the given heading index (at the end of existing text)
   * @param title - Text of the paragraph
   * @param paragraphType
   * @param headingLineIndex - Line index of the heading (get the line index from a paragraph object)
   */
  appendParagraphBelowHeadingLineIndex(title: string, paragraphType: ParagraphType, headingLineIndex: number): void,

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
  insertParagraphAfterParagraph(title: string, otherParagraph: TParagraph, paragraphType: ParagraphType): void,

  /**
   * Inserts a paragraph before a given paragraph
   * @param title - Text of the paragraph
   * @param otherParagraph - Another paragraph, get it from `.paragraphs`
   * @param paragraphType
   */
  insertParagraphBeforeParagraph(title: string, otherParagraph: TParagraph, paragraphType: ParagraphType): void,

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
   * @param {TParagraph} paragraph - Paragraph object to update, get it from `.paragraphs`
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
  replaceTextInCharacterRange(text: string, location: number, length: number): void,
}

declare var NotePlan: {
  /**
   * Returns the environment information from the operating system:
   * Available from v3.3.2:
   *   .languageCode: string?
   *   .regionCode: string?
   *   .is12hFormat: boolean
   *   .preferredLanguages: [string]
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
   *   .version: string (NotePlan's version, for example "3.4.1")
   *   .versionNumber: number (NotePlan's version as integer,for example 341)
   *   .buildVersion: number (NotePlan's build number as integer,for example 730)
   */
  +environment: Object,
  /**
   * The selected sidebar folder (useful when a note is not showing in Editor, which is then null)
   * Note: available from v3.5.1
   */
  +selectedSidebarFolder?: string,
  /**
   * Open the current plugin's config UI, if available.
   * Note: available from v3.3.2 (just for macOS so far)
   */
  showConfigurationView(): Promise<void>,
  /**
   * To reset the caches, particularly in the case where the sidebar turns out incorrect.
   * It's an async operation, but it doesn't return a promise to tell you when it's done.
   * Note: available from v3.5.0
   */
  resetCaches(): void,
  /**
   * Note: Available from v3.5.2
   * Opens the given URL using the default browser (x-callback-urls can also be triggered with this).
   */
  openURL(url: string): void,
}

// Every function made available must be assigned to `globalThis`
// This type ensures that only functions are made available as plugins
declare var globalThis: { [string]: () => mixed }
