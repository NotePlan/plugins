// @flow

// including so rollup will trigger build when plugin.json is modified
import pluginJson from '../plugin.json'

// NotePlan Event Hooks
export { init } from './Templating'
export { onSettingsUpdated } from './Templating'
export { onUpdateOrInstall } from './Templating'

// np.Templating Migration Commands
export { migrateTemplates } from './Templating'
export { migrateTemplatesCommand } from './Templating'
export { migrateQuickNotes } from './Templating'

// np.Templating Commands
export { templateInit } from './Templating'
export { templateInsert } from './Templating'
export { templateAppend } from './Templating'
export { templateNew } from './Templating'
export { templateMeetingNote } from './Templating'
export { templateQuickNote } from './Templating'
export { templateSamples } from './Templating'
export { templateFileByTitle } from './Templating'
export { templateRunner } from './Templating'
// export { test } from './Templating'

// np.Templating Utility Commands
export { templateAbout } from './Templating'
export { getXCallbackForTemplate } from './Templating'

// np.Templating Testing
export { testInvoke } from './Templating'
