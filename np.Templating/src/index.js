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
export { templateInvoke } from './Templating'
export { templateNew } from './Templating'
export { templateMeetingNote } from './Templating'
export { templateQuickNote } from './Templating'
export { templateConvertNote } from './Templating'
export { templateSamples } from './Templating'
export { templateExecute } from './Templating'

// np.Templating Utility Commands
export { templateAbout } from './Templating'

// np.Templating Testing
export { templateTest } from './Templating'

// exported to support DataStore.invokePluginCommandByName
export { getTemplate } from './Templating'
export { preRender } from './Templating'
export { render } from './Templating'
export { renderTemplate } from './Templating'
