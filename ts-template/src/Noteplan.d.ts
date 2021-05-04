/* eslint-disable no-unused-vars */
type Range = {
  start: number;
  end: number;
  readonly length: number;
};

declare const Paragraph: Paragraph;
type Paragraph = {
  content: string;
  type: ParagraphType;
  readonly rawContent: string;
  readonly prefix: string;
  readonly contentRange: Range | undefined;
  readonly lineIndex: number;
  readonly date: Date | undefined;
  readonly heading: string;
  readonly headingRange: Range | undefined;
  headingLevel: string;
  readonly isRecurring: boolean;
  indents: number;
  readonly filename: string | undefined;
  readonly noteType: NoteType | undefined;
  readonly linkedNoteTitles: Array<string>;

  duplicate(): Paragraph;
};

type NoteType = "Calendar" | "Notes";
declare const Note: Note;
type Note = {
  readonly filename: string;
  readonly type: NoteType;
  readonly title: string | undefined;
  readonly date: Date | undefined;
  readonly changedDate: Date | undefined;
  readonly createdDate: Date | undefined;
  readonly hashtashs: Array<string>;
  readonly mentions: Array<string>;
  content: string | undefined;
  paragraphs: Array<Paragraph>;
} & ParagaraphBridge;

type ParagraphType =
  | "open"
  | "done"
  | "scheduled"
  | "cancelled"
  | "quote"
  | "list"
  | "empty";

declare const ParagaraphBridge: ParagaraphBridge;
type ParagaraphBridge = {
  paragraphRangeAtCharacterIndex(pos: number): Range | undefined;
  insertTodo(name: string, lineIndex: number): void;
  insertCompletedTodo(name: string, lineIndex: number): void;
  insertCancelledTodo(name: string, lineIndex: number): void;
  insertScheduledTodo(name: string, lineIndex: number): void;
  insertParagraph(
    name: string,
    lineIndex: number,
    paragraphType: ParagraphType
  ): void;
  insertQuote(name: string, lineIndex: number): void;
  insertBullet(name: string, lineIndex: number): void;
  insertHeading(name: string, lineIndex: number, level: number): void;
  appendTodo(title: string): void;
  prependTodo(title: string): void;
  appendParagraph(title: string, paragraphType: ParagraphType): void;
  prependParagraph(title: string, paragraphType: ParagraphType): void;
  addTodoBelowHeadingTitle(
    title: string,
    headingTitle: string,
    shouldAppend: boolean,
    shouldCreate: boolean
  ): void;
  addParagraphBelowHeadingTitle(
    title: string,
    paragraphType: ParagraphType,
    headingTitle: string,
    shouldAppend: boolean,
    shouldCreate: boolean
  ): void;
  appendTodoBelowHeadingLineIndex(title: string, headinLineIndex: number): void;
  appendParagraphBelowHeadingLineIndex(
    title: string,
    paragraphType: ParagraphType,
    headingLineIndex: number
  ): void;
  insertTodoAfterParagraph(title: string, otherTodo: Paragraph): void;
  insertTodoBeforeParagraph(title: string, otherTodo: Paragraph): void;
  insertParagraphAfterParagraph(
    title: string,
    otherParagraph: Paragraph,
    paragraphType: ParagraphType
  ): void;
  insertParagraphBeforeParagraph(
    title: string,
    otherParagraph: Paragraph,
    paragraphType: ParagraphType
  ): void;
  removeParagraphAtIndex(lineIndex: number): void;
  removeParagraph(paragraph: Paragraph): void;
  updateParagraph(paragraph: Paragraph): void;
};

declare const Editor: Editor;
type Editor = {
  readonly note: Note;
  content: string | undefined;
  readonly title: string | undefined;
  readonly type: NoteType | undefined;
  readonly filename: string | undefined;
  paragraphs: Array<Paragraph>;
  readonly selectedLinesText: Array<string>;
  readonly selectedParagraphs: Array<Paragraph>;
  readonly selection: Range | undefined;
  readonly renderedSelection: Range | undefined;
  readonly selectedText: string | undefined;

  select(start: number, length: number): void;
  renderedSelect(start: number, length: number): void;
  openNoteByFilename(
    filename: string,
    newWindow?: boolean,
    highlightStart?: number,
    highlightEnd?: number
  ): Promise<Note>;
  openNoteByTitle(
    title: string,
    newWindow?: boolean,
    highlightStart?: number,
    highlightEnd?: number
  ): Promise<Note>;
  openNoteByTitleCaseInsensitive(
    title: string,
    newWindow?: boolean,
    caseSensitive?: boolean,
    highlightStart?: number,
    highlightEnd?: number
  ): Promise<Note>;
  openNoteByDate(
    date: Date,
    newWindow?: boolean,
    highlightStart?: number,
    highlightEnd?: number
  ): Promise<Note>;
  openNoteByDateString(
    filename: string,
    newWindow?: boolean,
    highlightStart?: number,
    highlightEnd?: number
  ): Promise<Note | undefined>;
  scrollTo(pos: number): void;
} & ParagaraphBridge;

declare const DataStore: DataStore;
type DataStore = {
  readonly defaultFileExtension: string;
  readonly folders: Array<string>;
  readonly calendarNotes: Array<Note>;
  readonly projectNotes: Array<Note>;

  preference(key: PreferenceKey): any | undefined;
  calendarNoteByDate(date: Date): Note | undefined;
  calendarNoteByDateString(filename: string): Note | undefined;
  projectNoteByTitle(
    title: string,
    caseInsensitive: boolean
  ): Array<Note> | undefined;
  projectNoteByTitleCaseInsensitive(title: string): Array<Note> | undefined;
  projectNoteByFilename(filename: string): Note | undefined;
  noteByFilename(filename: string, type: NoteType): Note | undefined;
  moveNote(noteName: string, folder: string): string | undefined;
  newNote(noteTitle: string, folder: string): string | undefined;
};

declare const CommandBar: CommandBar;
type CommandBar = {
  placeholder: string;
  searchText: string;

  show(): void;
  hide(): void;
  showOptions(
    options: Array<string>,
    placeholder: string
  ): Promise<{ index: number; value: string }>;
  showInput(placeholder: string, submitText: string): Promise<string>;
};

declare const Calendar: Calendar;
type Calendar = {
  add(item: CalendarItem): CalendarItem | undefined;
  parseDateText(text: string): Array<{ [key: string]: Date }>;
};

type CalenderItemType = "event" | "reminder";
declare const CalendarItem: CalendarItem;
type CalendarItem = {
  id: string | undefined;
  readonly title: string;
  readonly date: Date;
  readonly endDate: Date | undefined;
  readonly type: CalenderItemType;
  readonly isAllDay: boolean;
  create(
    title: string,
    date: Date,
    endDate: Date | undefined,
    type: CalenderItemType,
    isAllDay: boolean
  ): CalendarItem;
};

type PreferenceKey =
  | "themeLight"
  | "themeDark"
  | "fontDelta"
  | "firstDayOfWeek"
  | "isAgendaVisible"
  | "isAgendaExpanded"
  | "isAsteriskTodo"
  | "isDashTodo"
  | "isNumbersTodo"
  | "defaultTodoCharacter"
  | "isAppendScheduleLinks"
  | "isAppendCompletionLinks"
  | "isCopyScheduleGeneralNoteTodos"
  | "isSmartMarkdownLink"
  | "fontSize"
  | "fontFamily";

declare function fetch(url: string): Promise<any>;
