// Regex for timeblocks. The first one captures the start time
// These Regexs are used by the app, but don't work in JS
// So they are just here for reference
export const timeblockRegex1 =
  '(^|\\s|T)' +
  '(?:(?:at|from)\\s*)?' +
  '(\\d{1,2}|noon|midnight)' +
  '(?:' +
  '(?:\\:|\\：)(\\d{1,2})' +
  '(?:' +
  '(?:\\:|\\：)(\\d{2})' +
  ')?' +
  ')?' +
  '(?:\\s*(A\\.M\\.|P\\.M\\.|AM?|PM?))?' +
  '(?=\\W|$)'
// The second one captures the end time (optional)
export const timeblockRegex2 =
  '^\\s*' +
  '(\\-|\\–|\\~|\\〜|to|\\?)\\s*' +
  '(\\d{1,4})' +
  '(?:' +
  '(?:\\:|\\：)(\\d{1,2})' +
  '(?:' +
  '(?:\\:|\\：)(\\d{1,2})' +
  ')?' +
  ')?' +
  '(?:\\s*(A\\.M\\.|P\\.M\\.|AM?|PM?))?' +
  '(?=\\W|$)'

export const markdownRegex = {
  orderedStyles: [
    'title-mark1',
    'title-mark2',
    'title-mark3',
    'body',
    'quote-content',
    'bold',
    'bold-left-mark',
    'bold-right-mark',
    'italic',
    'italic-left-mark',
    'italic-right-mark',
    'boldItalic',
    'boldItalic-left-mark',
    'boldItalic-right-mark',
    'code',
    'code-left-backtick',
    'code-right-backtick',
    'special-char',
    'checked-todo-characters',
    'todo',
    'checked',
    'quote-mark',
    'tabbed',
    'link',
    'hashtag',
    'attag',
    'schedule-to-date-link',
    'done-date',
    'schedule-from-date-link',
    'note-title-link',
    'title1',
    'title2',
    'title3',
    'note-title-link',
  ],

  title1: {
    regex: '^\\h*(# )(.*)',
    matchPosition: 2,
    isRevealOnCursorRange: true,
  },

  title2: {
    regex: '^\\h*(## )(.*)',
    matchPosition: 2,
    isRevealOnCursorRange: true,
  },

  title3: {
    regex: '^\\h*(###+ )(.*)',
    matchPosition: 2,
    isRevealOnCursorRange: true,
  },

  'title-mark1': {
    regex: '^\\h*(# )(.*)',
    matchPosition: 1,
    isMarkdownCharacter: true,
    isHiddenWithoutCursor: true,
    isRevealOnCursorRange: true,
  },

  'title-mark2': {
    regex: '^\\h*(## )(.*)',
    matchPosition: 1,
    isMarkdownCharacter: true,
    isHiddenWithoutCursor: true,
    isRevealOnCursorRange: true,
  },

  'title-mark3': {
    regex: '^\\h*(###+ )(.*)',
    matchPosition: 1,
    isMarkdownCharacter: true,
    isHiddenWithoutCursor: true,
    isRevealOnCursorRange: true,
  },

  bold: {
    regex: '(^|[\\W_])(?:(?!\\1)|(?=^))((\\*|_)\\3)(?=\\S)(.*?\\S)(\\3\\3)(?!\\2)(?=[\\W_]|$)',
    matchPosition: 4,
    isRevealOnCursorRange: true,
  },

  italic: {
    regex: '(^|[\\W_])(?:(?!\\1)|(?=^))(\\*|_)(?=\\S)((?:(?!\\2).)*?\\S)(\\2)(?!\\2)(?=[\\W_]|$)',
    matchPosition: 3,
    isRevealOnCursorRange: true,
  },

  boldItalic: {
    regex: '(\\*\\*\\*)\\w+(\\s\\w+)*(\\*\\*\\*)',
    matchPosition: 2,
    isRevealOnCursorRange: true,
  },

  'bold-left-mark': {
    regex: '(^|[\\W_])(?:(?!\\1)|(?=^))((\\*|_)\\3)(?=\\S)(.*?\\S)(\\3\\3)(?!\\2)(?=[\\W_]|$)',
    matchPosition: 2,
    isMarkdownCharacter: true,
    isHiddenWithoutCursor: true,
    isRevealOnCursorRange: true,
  },

  'bold-right-mark': {
    regex: '(^|[\\W_])(?:(?!\\1)|(?=^))(\\*|_)\\2(?=\\S)(.*?\\S)(\\2\\2)(?!\\2)(?=[\\W_]|$)',
    matchPosition: 4,
    isMarkdownCharacter: true,
    isHiddenWithoutCursor: true,
    isRevealOnCursorRange: true,
  },

  'italic-left-mark': {
    regex: '(^|[\\W_])(?:(?!\\1)|(?=^))(\\*|_)(?=\\S)((?:(?!\\2).)*?\\S)(\\2)(?!\\2)(?=[\\W_]|$)',
    matchPosition: 2,
    isMarkdownCharacter: true,
    isHiddenWithoutCursor: true,
    isRevealOnCursorRange: true,
  },

  'italic-right-mark': {
    regex: '(^|[\\W_])(?:(?!\\1)|(?=^))(\\*|_)(?=\\S)((?:(?!\\2).)*?\\S)(\\2)(?!\\2)(?=[\\W_]|$)',
    matchPosition: 4,
    isMarkdownCharacter: true,
    isHiddenWithoutCursor: true,
    isRevealOnCursorRange: true,
  },

  'boldItalic-left-mark': {
    regex: '(\\*\\*\\*)\\w+(\\s\\w+)*(\\*\\*\\*)',
    matchPosition: 1,
    isMarkdownCharacter: true,
    isHiddenWithoutCursor: true,
    isRevealOnCursorRange: true,
  },

  'boldItalic-right-mark': {
    regex: '(\\*\\*\\*)\\w+(\\s\\w+)*(\\*\\*\\*)',
    matchPosition: 3,
    isMarkdownCharacter: true,
    isHiddenWithoutCursor: true,
    isRevealOnCursorRange: true,
  },

  'special-char': {
    regex: '([\\*\\-]+)',
    matchPosition: 1,
  },

  checked: {
    regex: '(^\\h*[\\*\\-]{1} |^\\h*[0-9]+[\\.\\)] )(\\[[x\\-\\>]\\] )(.*)',
    matchPosition: 0,
  },

  'checked-todo-characters': {
    regex: '(^\\h*[\\*\\-]{1} |^\\h*[0-9]+[\\.\\)] )(\\[[x\\-\\>]\\] )',
    matchPosition: 0,
    type: 'linkAction',
    isMarkdownCharacter: true,
  },

  todo: {
    regex: '(^\\h*[\\*\\-]{1} |^\\h*[0-9]+[\\.\\)] )(?:(?!\\[[x\\-\\>]\\] ))(?:\\[\\s\\] )?',
    matchPosition: 0,
    type: 'linkAction',
    isMarkdownCharacter: true,
  },

  tabbed: {
    regex: '^(\\t+)(?:[\\*\\-\\>]{1} .*|[0-9]+[\\.\\)] .*)$',
    matchPosition: 0,
  },

  'quote-mark': {
    regex: '(^\\h*> )(.*)',
    matchPosition: 1,
    isMarkdownCharacter: true,
  },

  'quote-content': {
    regex: '(^\\h*> )(.*)',
    matchPosition: 2,
  },

  link: {
    regex:
      '((\\b([0-9a-zA-Z\\-\\.\\+]+):\\/\\/[^：\\s{}\\(\\)\\[<>±„"“]+(?<![\\.,;!"\\]\\*]))|[^：\\*\\s{}\\(\\)\\[<>±„"“]+\\.(com|org|edu|gov|uk|net|in|co\\.in|co\\.uk|co|ca|de|jp|fr|au|us|ru|ch|it|nl|se|no|es|mil|ac|kr|an|aq|at|bb|bw|cd|cy|dz|ec|ee|eg|et|fi|gh|gl|gr|hk|ht|hu|ie|il|iq|is|kh|kg|kz|lr|lv|nz|pe|pa|ph|pk|pl|pt|sg|tw|ua|me)(([\\/%]+[^：\\s{}\\(\\)\\[<>±]*)(?<![\\.,;!"\\]„"“])|$|(?=[^a-zA-Z])))',
    matchPosition: 1,
    type: 'link',
  },

  'schedule-to-date-link': {
    regex:
      '[>@](today|tomorrow|yesterday|(([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])))( ((0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]( ?[aApP][mM])?))?',
    matchPosition: 0,
    urlPosition: 1,
    type: 'link',
    prefix: 'noteplan://x-callback-url/openNote?view=daily&noteDate=',
  },

  'done-date': {
    regex:
      '@done\\((([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1]))( ((0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]( ?[aApP][mM])?))?\\)',
    matchPosition: 0,
    type: 'nolink',
  },

  'schedule-from-date-link': {
    regex: '<(([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1]))',
    matchPosition: 0,
    urlPosition: 1,
    type: 'link',
    prefix: 'noteplan://x-callback-url/openNote?view=daily&noteDate=',
  },

  'note-title-link': {
    regex: '(\\[{2})(.*?\\]*)(\\]{2})',
    matchPosition: 2,
    urlPosition: 2,
    type: 'noteLink',
    prefix: 'noteplan://x-callback-url/openNote?noteTitle=',
  },

  hashtag: {
    regex:
      '(\\s|^|\\"|\\\'|\\(|\\[|\\{)(?!#[\\d[:punct:]]+(\\s|$))(#([^[:punct:]\\s]|[\\-_\\/])+?\\(.*?\\)|#([^[:punct:]\\s]|[\\-_\\/])+)',
    matchPosition: 3,
    urlPosition: 3,
    type: 'link',
    prefix: 'noteplan://x-callback-url/selectTag?name=',
  },

  attag: {
    regex:
      '(\\s|^|\\"|\\\'|\\(|\\[|\\{)(?!@[\\d[:punct:]]+(\\s|$))(@([^[:punct:]\\s]|[\\-_\\/])+?\\(.*?\\)|@([^[:punct:]\\s]|[\\-_\\/])+)',
    matchPosition: 3,
    urlPosition: 3,
    type: 'link',
    prefix: 'noteplan://x-callback-url/selectTag?name=',
  },

  code: {
    regex: '(`)([^`]{1,})(`)',
    matchPosition: 2,
    isRevealOnCursorRange: true,
  },

  'code-left-backtick': {
    regex: '(`)([^`]{1,})(`)',
    matchPosition: 1,
    isMarkdownCharacter: true,
    isHiddenWithoutCursor: true,
    isRevealOnCursorRange: true,
  },

  'code-right-backtick': {
    regex: '(`)([^`]{1,})(`)',
    matchPosition: 3,
    isMarkdownCharacter: true,
    isHiddenWithoutCursor: true,
    isRevealOnCursorRange: true,
  },
}
