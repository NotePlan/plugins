// Tip: Open the "Help" -> "Plugin Console" in the menubar.
// Sync: Plugins are automatically synced via CloudKit or iCloud Drive to all your devices.
// iOS: Plugins work on iOS exactly the same.
// Development: You can change the script and the plugin.json file and re-run it without restaring NotePlan. You just need to search again for the command, so clear out the text in the Command Bar and retype the command.
// Dependencies [Warning: Not all dependencies work]: Download the libraries you need, store them in your plugin folder and define the name in the `"plugin.dependencies": []` array in "plugin.json". They will be loaded into this script and are ready to use
// Useful dependencies:
//  - https://date-fns.org/ for date formatting
//  - Make Chrono.JS somehow work
// Learn about Javascript `Promises`, all methods which have a callback work on Promises (like the CommandBar.show... methods): https://gist.github.com/a-morales/24dcd9fd51a4830f46563d9c673cbaaf
// Learn about `await` here: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await which is compatible with the `Promise` framework

function init() {
  // Anything you need to do to setup the script. You can keep it empty or delete the function, too.
}
globalThis.init = init;

// example1
function readContent() {
  // Content from the editor
  const content = Editor.content;
  console.log('content: ' + content); // Prints into the "Help" -> "Plugin Console" window (see menubar)
}

// example2
function writeContent() {
  // Writes the given text to the editor, which will be subsequently saved to the file
  Editor.content = '# TEST\nCHANGED';
}

// example3
function noteInformation() {
  const title = Editor.title; // First line of the note, typically the title
  const type = Editor.type; // Can be 'Calendar' or 'Notes'
  const filename = Editor.filename; // Actual filename as in Finder

  console.log(
    'Note info:\n\ttitle = ' +
      title +
      '\n\ttype = ' +
      type +
      '\n\tfilename = ' +
      filename,
  );

  // Alternatively, get the note object of the currently edited note from the Editor, if you need more information. This is queried from the cache and might be slightly older information that the editor has
  printNote(Editor.note);
}

// example4
function cachedFolders() {
  const folders = DataStore.folders; // All folders as [String] array
  console.log('Folders:\n' + folders);
}

// example5
function calendarNotes() {
  const notes = DataStore.calendarNotes; // All calendar notes as [String] array
  console.log('Calendar Notes:\n');
  notes.forEach((note) => printNote(note));
}

// example6
function projectNotes() {
  const notes = DataStore.projectNotes; // All project notes as [String] array
  console.log('Project Notes:\n');
  notes.forEach((note) => printNote(note));
}

// example7
async function openNoteByDate() {
  //    Editor.openNoteByDateString("20210411") // Opens 11th April 2021
  //    Editor.openNoteByDateString("20210411.txt") // Opens 11th April 2021
  //    Editor.openNoteByDate(new Date()) // Opens today using a Javascript date
  //    Editor.openNoteByDate(new Date(), true) // date, isNewWindow
  await Editor.openNoteByDate(new Date(), false, 0, 10); // date, isNewWindow, highlightStart, highlightEnd
  console.log('Filename: ' + Editor.filename);
}

// example8
async function openNoteByFilename() {
  //    Editor.openNoteByFilename("TEST.txt") // filename
  //    Editor.openNoteByFilename("TEST.txt", true) // filename, isNewWindow
  await Editor.openNoteByFilename('TEST.txt', false, 0, 6); // filename, isNewWindow, highlightStart, highlightEnd
  console.log('Filename: ' + Editor.filename);
}

// example9
async function openNoteByTitle() {
  // TODO: Add caseSensitive also to DataStore proejctNotebytitle?
  // Opens the first note it can find with that title
  await Editor.openNoteByTitle('Test'); // title
  //    Editor.openNoteByTitleCaseInsensitive("test")
  //    Editor.openNoteByTitle("TEST", true) // title, isNewWindow
  //    Editor.openNoteByTitle("TEST", false, 0, 6) // title, isNewWindow, highlightStart, highlightEnd
  console.log('Filename: ' + Editor.filename);
}

// example10
function queryNotes() {
  // With note type parameters "Calendar" or "Notes"
  //    var note = DataStore.noteByFilename("20210411", "Calendar")

  // Using a date object
  //    var note = DataStore.calendarNoteByDate(new Date())

  // Using an ISO string "YYYYMMDD", with or without the file-extension
  //    var note = DataStore.calendarNoteByDateString("20210410")

  // Returns multiple notes potentially if the user has named multiple notes with the same title.
  //    var note = DataStore.projectNoteByTitle("TEST")[0]

  // Search for title - case insensitive
  //    var note = DataStore.projectNoteByTitleCaseInsensitive("test")[0]

  // Here the file-extension is important
  const note = DataStore.projectNoteByFilename('test.txt');
  // note.insertTodo("hello World", 9999) // Add a task at the end of the note
  printNote(note);

  // Get the default file extension for notes. It's a getter, the setter hasn't been implemented because it might cause chaos if it's not called through the preferences.
  const extension = DataStore.defaultFileExtension;
  console.log("The default file extension for notes is: '" + extension + "'");
}

// example11
function overwriteNote() {
  const note = DataStore.projectNoteByFilename('TEST.txt');
  if (note != undefined) {
    note.content =
      '# TEST\nThis is new content with random number: ' +
      Math.floor(Math.random() * 100);
  } else {
    console.log("Note not found! - Create a note 'TEST.txt'.");
  }
}

// exmaple12
function createNewNote() {
  // DataStore.newNote(title, folder)
  const filename = DataStore.newNote('This is a test', 'TEST');
  console.log('Created note with filename: ' + filename);
}

// exmaple13
// Note: Don't pass JS objects into the `CommandBar.show...` functions, NotePlan might crash. Only pass strings / array of strings.
async function commandBarInput() {
  // CommandBar.showInput(placeholder, text of first result with variable for keyword, JS callback function)
  const title = await CommandBar.showInput(
    'Enter title of the new note',
    "Create a new note with title = '%@'",
  );
  const folder = (
    await CommandBar.showOptions(
      DataStore.folders,
      "Select a folder for '" + title + "'",
    )
  ).value;

  if (title != undefined && title !== '') {
    const filename = DataStore.newNote(title, folder);
    console.log('Created note with filename: ' + filename);
  } else {
    console.log('Reply undefined or empty: ' + title);
    // Some error message
  }
}

// example14
async function createEvent() {
  const title = await CommandBar.showInput(
    'Enter the title of the event',
    "Submit title '%@', then...",
  );

  // To make this work you need to enter '2021/04/12 09:00' for example
  const dateText = await CommandBar.showInput(
    'Enter date',
    "Create event '" + title + "' with date '%@'",
  );

  console.log('dateText: ' + dateText);

  // Parses date and time text such as 'today at 5pm - 7pm'
  const dates = Calendar.parseDateText(dateText);

  if (dates.length >= 0) {
    const parsed = dates[0];
    const start = parsed.start;
    let end = parsed.start;

    if (parsed.end !== undefined) {
      end = parsed.end;
    }

    console.log(
      "parsed start: '" +
        start +
        ", end: '" +
        end +
        "' from text: '" +
        dateText +
        "'",
    );

    // CalendarItem.create(title, start date, optional end date, "event" or "reminder", isAllDay)
    const event = CalendarItem.create(title, start, end, 'event', false);
    const createdEvent = Calendar.add(event);

    if (createdEvent != undefined) {
      console.log('Event created with id: ' + createdEvent.id);
    } else {
      console.log('Failed to create event');
    }
  }
}

//example15
// Note: Normal emojis like 😀 count as 2 characters, some emojis like 👨‍👩‍👧 count as 8 characters, because they are a combination of emojis.
// Note: Some characters might be replaced by a symbol, like Markdown URLs and folded text. The `renderedSelection` functions refer to the text in the Editor you can see (URLs and folded text removed). Otherwise, the replaced text is considered in the text and selection functions.
// Markdown URL symbols take up one character count while the ` …` in folded text takes up two, because it also adds a space as prefix.
// Note: Some text is just hidden, but not replaced, like completed, scheduled, and canceled tasks always look like `* [x] ` or `- [x] `. But NotePlan hides the `[x] ` parts. They still need to be considered in the rendered and non-rendered functions.
// Note: If you select folded, raw text, it will be unfolded automatically.
function selectionExample() {
  // By default you deal with raw selections and text
  // Use the text "[link](https://noteplan.co) TEST" as a test to demonstrate the differences mentioned above and place the cursor before the "T" of "TEST".
  const rawPos = Editor.selection;
  console.log(
    'Raw selection: start = ' + rawPos.start + ' length = ' + rawPos.length,
  );

  // Alternatively, return the rendered selection. Means the URLs are compressed to a single character and folded text will be also ignored.
  const renderedPos = Editor.renderedSelection;
  console.log(
    'Rendered selection: start = ' +
      renderedPos.start +
      ' length = ' +
      renderedPos.length,
  );

  const selectedLines = Editor.selectedLinesText;
  console.log('Selected lines: ' + selectedLines);

  // Editor.renderedSelect(start, length)

  // Should select the "TEST" in "[link](https://noteplan.co) TEST"
  Editor.select(28, 4);

  // Same here, but the URL is replaced with a symbol in the rendered text, so it's shorter
  //    Editor.renderedSelect(10, 4)
}

//example16
async function promisesTest() {
  const reply = await CommandBar.showInput('1. Enter something', "Submit '%@'");
  console.log('Reply: ' + reply);
}

//example17
function fetchTest() {
  fetch(
    'https://api.weatherapi.com/v1/current.json?key=f4c442d67eef4574b99184324211404&q=Berlin&aqi=no',
  )
    .then((data) => {
      console.log(data);
    })
    .catch((e) => console.log(e));
}

//example18
function selectedText() {
  // This returns the selected, raw text. Means it turns the link symbols back into urls and includes folded text.
  const text = Editor.selectedText;
  console.log('Selected text: ' + text);
}

//example19
function getPreferences() {
  // DataStore.preference(name)
  // Available names:
  //    "themeLight"              // theme used in light mode
  //    "themeDark"               // theme used in dark mode
  //    "fontDelta"               // delta to default font size
  //    "firstDayOfWeek"          // first day of calendar week
  //    "isAgendaVisible"         // only iOS, indicates if the calendar and note below calendar are visible
  //    "isAgendaExpanded"        // only iOS, indicates if calendar above note is shown as week (true) or month (false)
  //    "isAsteriskTodo"          // "Recognize * as todo" = checked in markdown preferences
  //    "isDashTodo"              // "Recognize - as todo" = checked in markdown preferences
  //    "isNumbersTodo"           // "Recognize 1. as todo" = checked in markdown preferences
  //    "defaultTodoCharacter"    // returns * or -
  //    "isAppendScheduleLinks"   // "Append links when scheduling" checked in todo preferences
  //    "isAppendCompletionLinks" // "Append completion date" checked in todo preferences
  //    "isCopyScheduleGeneralNoteTodos" // "Only add date when scheduling in notes" checked in todo preferences
  //    "isSmartMarkdownLink"     // "Smart Markdown Links" checked in markdown preferences
  //    "fontSize"                // Font size defined in editor preferences (might be overwritten by custom theme)
  //    "fontFamily"              // Font family defined in editor preferences (might be overwritten by custom theme)

  console.log('isAsteriskTodo: ' + DataStore.preference('isAsteriskTodo'));
}

//example20
function getAllParagraphsFromEditor() {
  const paragraphs = Editor.paragraphs;
  printParagraphs(paragraphs);
}

//example21
function getAllParagraphsFromNote() {
  const today = DataStore.calendarNoteByDate(new Date());
  printParagraphs(today.paragraphs);
}

//example22
async function insertTodo() {
  // You can use with `Editor` and `Note` following functions to add paragraphs:
  // `insertTodo(name, line)`,
  // `insertCancelledTodo(name, line)`,
  // `insertCompletedTodo(name, line)`,
  // `insertScheduledTodo(name, line)`,
  // `insertQuote(name, line)`,
  // `insertList(name, line)`,
  // `insertHeading(name, line, level)`, where level has to be minimum 1
  // `insertParagraph(name, line, type)`, where type can be one of: "open", "done", "scheduled", "cancelled", "quote", "list" (which is a bullet) or "empty" (plain text)

  // Ask user to type the name
  const text = await CommandBar.showInput(
    'Type the name of the task',
    "Create task named '%@'",
  );
  const lines = Editor.paragraphs;

  const re = await CommandBar.showOptions(
    lines.map((p) => p.lineIndex.toString() + ': ' + p.content),
    'Select line for the new task',
  );
  const line = lines[re.index];

  console.log('selected line: ' + line.content);

  if (line != undefined) {
    Editor.insertTodo(text, line.lineIndex);
  } else {
    console.log('index undefined');
  }
}

//example23
async function appendTodo() {
  // You can use with `Editor` and `Note` following functions to add paragraphs:
  // `appendTodo(name)`,
  // `prependTodo(name)`,
  // `appendParagraph(name, type)`, `prependParagraph(name, type)`, where *type* can be one of: "open", "done", "scheduled", "cancelled", "quote", "list" (which is a bullet) or "empty" (plain text)

  const text = await CommandBar.showInput(
    'Type the name of the task',
    "Create task named '%@'",
  );
  Editor.prependTodo(text);
}

//example24
async function addTaskToNote() {
  const notes = DataStore.projectNotes;

  // CommandBar.showOptions only takes [string] as input
  const re = await CommandBar.showOptions(
    notes.map((n) => n.title),
    'Select note for new todo',
  );
  const note = notes[re.index];

  const todoTitle = await CommandBar.showInput(
    'Type the task',
    "Add task '%@' to '" + note.title + "'",
  );
  note.insertTodo(todoTitle, 1);
}

//example25
// This adds a task to a selected heading. Problem here is that duplicate headings are not respected. An alternative solution has been added, commented out.
async function addTaskToHeading() {
  // addTodoBelowHeading(todoTitle, headingTitle, true or false = should append, true or false = should create if non-existing)
  // First ask for the note we want to add the todo
  const notes = DataStore.projectNotes;

  // CommandBar.showOptions only takes [string] as input
  const re = await CommandBar.showOptions(
    notes.map((n) => n.title),
    'Select note for new todo',
  );
  const note = notes[re.index];
  printNote(note);

  // Ask to which heading to add the todo
  const headings = note.paragraphs.filter((p) => p.type == 'title');
  const re2 = await CommandBar.showOptions(
    headings.map((p) => p.prefix + p.content),
    'Select a heading',
  );

  const heading = headings[re2.index];
  console.log('Selected heading: ' + heading.content);

  // Ask for the todo title finally
  const todoTitle = await CommandBar.showInput(
    'Type the task',
    "Add task '%@' to '" + note.title + "'",
  );
  console.log(
    'Adding todo: ' +
      todoTitle +
      ' to ' +
      note.title +
      ' in heading: ' +
      heading.content,
  );

  // Add todo to the heading in the note
  //    note.appendTodoBelowHeadingLineIndex(todoTitle, heading.lineIndex) // This works also if there are duplicate headings
  //    note.appendParagraphBelowHeadingLineIndex(todoTitle, "quote", heading.lineIndex)
  //    note.addTodoBelowHeadingTitle(todoTitle, heading.content, false, true)
  //    note.addParagraphBelowHeadingTitle(todoTitle, "done", heading.content, true, true)
  //    note.insertTodoAfterParagraph(todoTitle, heading.content)
  //    note.insertTodoBeforeParagraph(todoTitle, heading.content)
  //    note.insertParapgrahBeforeParagraph(todoTitle, heading.content, "list")
  //    note.insertParagraphAfterParagraph(todoTitle, heading.content, "list")
}

//example26
function rangeOfParagraph() {
  const selection = Editor.selection;
  const range = Editor.paragraphRangeAtCharacterIndex(selection.start);

  const text = 'Location: ' + range.start + ', length: ' + range.length;
  CommandBar.showOptions([text], 'The paragraph range is:');
}

//example27
function selectedParagraphs() {
  printParagraphs(Editor.selectedParagraphs);
}

//example28
async function modifyExistingParagraphs() {
  const paragraphs = Editor.paragraphs;

  // Change the content and type of a paragraph
  const re = await CommandBar.showOptions(
    paragraphs.map((p) => p.lineIndex + ': ' + p.content),
    'Select a paragraph to modify',
  );
  const newParagraphText = await CommandBar.showInput(
    'New content of selected paragraph',
    "Change paragraph to '%@'",
  );
  const newType = await CommandBar.showOptions(
    ['open', 'done', 'scheduled', 'cancelled', 'quote', 'empty', 'list'],
    'Select the new type',
  );

  paragraphs[re.index].content = newParagraphText;
  paragraphs[re.index].type = newType.value;
  Editor.paragraphs = paragraphs;

  // Alternative implementation
  //    let paragraph = paragraphs[re.index]
  //    paragraph.content = newParagraphText
  //    paragraph.type = newType.value
  //    Editor.updateParagraph(paragraph)
}

//example29
async function removeParagraph() {
  const paragraphs = Editor.paragraphs;

  const re = await CommandBar.showOptions(
    paragraphs.map((p) => p.lineIndex + ': ' + p.content),
    'Select a paragraph to remove',
  );

  Editor.removeParagraphAtIndex(re.index);

  // Alternative implementations
  //    Editor.removeParagraph(paragraphs[re.index])

  //    paragraphs.splice(re.index, 1)
  //    Editor.paragraphs = paragraphs
}

function printParagraphs(ps) {
  ps.forEach((p) => printParagraph(p));
}

function printParagraph(p) {
  if (p == undefined) {
    console.log('paragraph is undefined');
    return;
  }

  console.log(
    '\n\ncontent: ' +
      p.content +
      '\n\ttype: ' +
      p.type +
      '\n\tprefix: ' +
      p.prefix +
      '\n\tcontentRange: ' +
      rangeToString(p.contentRange) +
      '\n\tlineIndex: ' +
      p.lineIndex +
      '\n\tdate: ' +
      p.date +
      '\n\theading: ' +
      p.heading +
      '\n\theadingRange: ' +
      rangeToString(p.headingRange) +
      '\n\theadingLevel: ' +
      p.headingLevel +
      '\n\tisRecurring: ' +
      p.isRecurring +
      '\n\tindents: ' +
      p.indents +
      '\n\tfilename: ' +
      p.filename +
      '\n\tnoteType: ' +
      p.noteType +
      '\n\tlinkedNoteTitles: ' +
      p.linkedNoteTitles,
  );
}

// Helper function, not called by a command
function printNote(note) {
  if (note == undefined) {
    console.log('Note not found!');
    return;
  }

  if (note.type == 'Notes') {
    console.log(
      'title: ' +
        note.title +
        '\n\tfilename: ' +
        note.filename +
        '\n\thashtags: ' +
        note.hashtags +
        '\n\tmentions: ' +
        note.mentions +
        '\n\tcreated: ' +
        note.createdDate +
        '\n\tchanged: ' +
        note.changedDate,
    );
  } else {
    console.log(
      'date: ' +
        note.date +
        '\n\tfilename: ' +
        note.filename +
        '\n\thashtags: ' +
        note.hashtags +
        '\n\tmentions: ' +
        note.mentions,
    );
  }
}

function rangeToString(r) {
  if (r == undefined) {
    return 'Range is undefined!';
  }

  return 'location: ' + r.start + ', length: ' + r.length;
}

globalThis.readContent = readContent;
globalThis.writeContent = writeContent;
globalThis.noteInformation = noteInformation;
globalThis.cachedFolders = cachedFolders;
globalThis.calendarNotes = calendarNotes;
globalThis.projectNotes = projectNotes;
globalThis.queryNotes = queryNotes;
globalThis.overwriteNote = overwriteNote;
globalThis.promisesTest = promisesTest;
globalThis.fetchTest = fetchTest;
globalThis.selectedText = selectedText;
globalThis.getPreferences = getPreferences;
globalThis.getAllParagraphsFromEditor = getAllParagraphsFromEditor;
globalThis.getAllParagraphsFromNote = getAllParagraphsFromNote;
globalThis.insertTodo = insertTodo;
globalThis.appendTodo = appendTodo;
globalThis.addTaskToNote = addTaskToNote;
globalThis.rangeOfParagraph = rangeOfParagraph;
globalThis.selectedParagraphs = selectedParagraphs;
globalThis.modifyExistingParagraphs = modifyExistingParagraphs;
globalThis.removeParagraph = removeParagraph;
globalThis.openNoteByDate = openNoteByDate;
globalThis.openNoteByFilename = openNoteByFilename;
globalThis.openNoteByTitle = openNoteByTitle;
globalThis.createNewNote = createNewNote;
globalThis.commandBarInput = commandBarInput;
globalThis.createEvent = createEvent;
globalThis.selectionExample = selectionExample;
globalThis.addTaskToHeading = addTaskToHeading;
