// @flow

// including so rollup will trigger build when plugin.json is modified
// eslint-disable-next-line
import pluginJson from '../plugin.json'

// NotePlan Event Hooks
export { init } from './Templating'
export { onSettingsUpdated } from './Templating'
export { onUpdateOrInstall } from './Templating'

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
export { templateRunner } from './Templating'
export { templateWOTD } from './Templating'
export { templatingHelp } from './Templating'
export { addFrontmatterToTemplate } from './NPTemplateRunner'

// np.Templating Utility Commands
export { templateAbout } from './Templating'

// np.Templating Testing
export { templateTest } from './Templating'

// exported to support DataStore.invokePluginCommandByName
export { getTemplate } from './Templating'
export { renderFrontmatter } from './Templating'
export { render } from './Templating'
export { renderTemplate } from './Templating'

export { templateFileByTitle } from './Templating'

// Allow for mobile editing of settings
export { editSettings } from '@helpers/NPSettings'
