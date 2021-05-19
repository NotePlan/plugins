// @flow

type Range = {
  start: number,
  end: number,
  +length: number,
};

declare var Paragraph: TParagraph;

type TParagraph = {
  content: string,
  type: ParagraphType,
  +rawContent: string,
  +prefix: string,
  +contentRange: Range | void,
  +lineIndex: number,
  +date: Date | void,
  +heading: string,
  +headingRange: Range | void,
  headingLevel: string,
  +isRecurring: boolean,
  indents: number,
  +filename: string | void,
  +noteType: NoteType | void,
  +linkedNoteTitles: $ReadOnlyArray<string>,

  duplicate(): TParagraph,
};

type NoteType = 'Calendar' | 'Notes';
declare var Note: TNote;
type TNote = {
  ...TParagaraphBridge,
  +filename: string,
  +type: NoteType,
  +title: string | void,
  +date: Date | void,
  +changedDate: Date | void,
  +createdDate: Date | void,
  +hashtashs: $ReadOnlyArray<string>,
  +mentions: $ReadOnlyArray<string>,
  content: string | void,
  paragraphs: $ReadOnlyArray<TParagraph>,
};

type ParagraphType =
  | 'open'
  | 'done'
  | 'scheduled'
  | 'cancelled'
  | 'quote'
  | 'list'
  | 'empty';

declare var ParagaraphBridge: TParagaraphBridge;
type TParagaraphBridge = {
  paragraphRangeAtCharacterIndex(pos: number): Range | void,
  insertTodo(name: string, lineIndex: number): void,
  insertCompletedTodo(name: string, lineIndex: number): void,
  insertCancelledTodo(name: string, lineIndex: number): void,
  insertScheduledTodo(name: string, lineIndex: number): void,
  insertParagraph(
    name: string,
    lineIndex: number,
    paragraphType: ParagraphType,
  ): void,
  insertQuote(name: string, lineIndex: number): void,
  insertBullet(name: string, lineIndex: number): void,
  insertHeading(name: string, lineIndex: number, level: number): void,
  appendTodo(title: string): void,
  prependTodo(title: string): void,
  appendParagraph(title: string, paragraphType: ParagraphType): void,
  prependParagraph(title: string, paragraphType: ParagraphType): void,
  addTodoBelowHeadingTitle(
    title: string,
    headingTitle: string,
    shouldAppend: boolean,
    shouldCreate: boolean,
  ): void,
  addParagraphBelowHeadingTitle(
    title: string,
    paragraphType: ParagraphType,
    headingTitle: string,
    shouldAppend: boolean,
    shouldCreate: boolean,
  ): void,
  appendTodoBelowHeadingLineIndex(title: string, headinLineIndex: number): void,
  appendParagraphBelowHeadingLineIndex(
    title: string,
    paragraphType: ParagraphType,
    headingLineIndex: number,
  ): void,
  insertTodoAfterParagraph(title: string, otherTodo: TParagraph): void,
  insertTodoBeforeParagraph(title: string, otherTodo: TParagraph): void,
  insertParagraphAfterParagraph(
    title: string,
    otherParagraph: TParagraph,
    paragraphType: ParagraphType,
  ): void,
  insertParagraphBeforeParagraph(
    title: string,
    otherParagraph: TParagraph,
    paragraphType: ParagraphType,
  ): void,
  removeParagraphAtIndex(lineIndex: number): void,
  removeParagraph(paragraph: TParagraph): void,
  updateParagraph(paragraph: TParagraph): void,
};

declare var Editor: TEditor;
type TEditor = {
  +note: TNote,
  content: string | void,
  +title: string | void,
  +type: NoteType | void,
  +filename: string | void,
  paragraphs: $ReadOnlyArray<TParagraph>,
  +selectedLinesText: $ReadOnlyArray<string>,
  +selectedParagraphs: $ReadOnlyArray<TParagraph>,
  +selection: Range | void,
  +renderedSelection: Range | void,
  +selectedText: string | void,

  select(start: number, length: number): void,
  renderedSelect(start: number, length: number): void,
  openNoteByFilename(
    filename: string,
    newWindow?: boolean,
    highlightStart?: number,
    highlightEnd?: number,
  ): Promise<TNote>,
  openNoteByTitle(
    title: string,
    newWindow?: boolean,
    highlightStart?: number,
    highlightEnd?: number,
  ): Promise<TNote>,
  openNoteByTitleCaseInsensitive(
    title: string,
    newWindow?: boolean,
    caseSensitive?: boolean,
    highlightStart?: number,
    highlightEnd?: number,
  ): Promise<TNote>,
  openNoteByDate(
    date: Date,
    newWindow?: boolean,
    highlightStart?: number,
    highlightEnd?: number,
  ): Promise<TNote>,
  openNoteByDateString(
    filename: string,
    newWindow?: boolean,
    highlightStart?: number,
    highlightEnd?: number,
  ): Promise<TNote | void>,
  scrollTo(pos: number): void,
};

type DataStorePreference = ((key: 'themeLight') => void | string) &
  ((key: 'themeDark') => void | string) &
  ((key: 'fontDelta') => number) &
  ((key: 'firstDayOfWeek') => number) &
  ((key: 'isAgendaVisible') => void | boolean) &
  ((key: 'isAgendaExpanded') => void | boolean) &
  ((key: 'isAsteriskTodo') => void | boolean) &
  ((key: 'isDashTodo') => void | boolean) &
  ((key: 'isNumbersTodo') => void | boolean) &
  ((key: 'defaultTodoCharacter') => '*' | '-') &
  ((key: 'isAppendScheduleLinks') => void | boolean) &
  ((key: 'isAppendCompletionLinks') => void | boolean) &
  ((key: 'isCopyScheduleGeneralNoteTodos') => void | boolean) &
  ((key: 'isSmartMarkdownLink') => void | boolean) &
  ((key: 'fontSize') => number) &
  ((key: 'fontFamily') => string);

declare var DataStore: TDataStore;
type TDataStore = {
  +defaultFileExtension: string,
  +folders: $ReadOnlyArray<string>,
  +calendarNotes: $ReadOnlyArray<TNote>,
  +projectNotes: $ReadOnlyArray<TNote>,
  +preference: DataStorePreference,

  calendarNoteByDate(date: Date): TNote | void,
  calendarNoteByDateString(filename: string): TNote | void,
  projectNoteByTitle(
    title: string,
    caseInsensitive: boolean,
  ): $ReadOnlyArray<TNote> | void,
  projectNoteByTitleCaseInsensitive(
    title: string,
  ): $ReadOnlyArray<TNote> | void,
  projectNoteByFilename(filename: string): TNote | void,
  noteByFilename(filename: string, type: NoteType): TNote | void,
  moveNote(noteName: string, folder: string): string | void,
  newNote(noteTitle: string, folder: string): string | void,
};

declare var CommandBar: TCommandBar;
type TCommandBar = {
  placeholder: string,
  searchText: string,

  show(): void,
  hide(): void,
  showOptions(
    options: $ReadOnlyArray<string>,
    placeholder: string,
  ): Promise<{ +index: number, +value: string }>,
  showInput(placeholder: string, submitText: string): Promise<string>,
};

declare var Calendar: TCalendar;
type TCalendar = {
  add(item: TCalendarItem): TCalendarItem | void,
  parseDateText(text: string): $ReadOnlyArray<{ [key: string]: Date }>,
  addUnitToDate(Date, 'day' | 'month' | 'year', number): Date,
};

type CalenderItemType = 'event' | 'reminder';
declare var CalendarItem: TCalendarItem;
type TCalendarItem = {
  +id: string | void,
  +title: string,
  +date: Date,
  +endDate: Date | void,
  +type: CalenderItemType,
  +isAllDay: boolean,
  create(
    title: string,
    date: Date,
    endDate: Date | void,
    type: CalenderItemType,
    isAllDay: boolean,
  ): TCalendarItem,
};

declare function fetch(url: string): Promise<{ [string]: mixed }>;

// Every function made available must be assigned to `globalThis`
// This type ensures that only functions are made available as plugins
declare var globalThis: { [string]: () => mixed };
