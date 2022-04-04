// @flow

// including so rollup will trigger build when plugin.json is modified
import pluginJson from '../plugin.json'

export { templateInit } from './Templating'
export { templateInsert } from './Templating'
export { templateAppend } from './Templating'
export { templateNew } from './Templating'
export { templateMeetingNote } from './Templating'
export { templateQuickNote } from './Templating'
export { templateWeather } from './Templating'
export { templateAdvice } from './Templating'
export { templateAffirmation } from './Templating'
export { templateQuote } from './Templating'
export { templateVerse } from './Templating'
export { onUpdateOrInstall } from './Templating'
export { migrateTemplates } from './Templating'
export { migrateQuickNotes } from './Templating'
export { templateAbout } from './Templating'
