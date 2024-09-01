// @flow
import pluginJson from '../plugin.json'
import { createRunPluginCallbackUrl, createPrettyRunPluginLink } from '../../helpers/general'
import { log, logError, logDebug, timer, clo, JSP, copyObject } from '@helpers/dev'
import { showMessage, showMessageYesNo } from '@helpers/userInput'
import { getPluginList, type PluginObjectWithUpdateField } from '@helpers/NPConfiguration'

export async function installPlugin(pluginName: string, regenerateList?: boolean = true): Promise<void> {
  logDebug(pluginJson, `installPlugin "${pluginName}"`)
  const plugins = await DataStore.listPlugins(true)
  // clo(plugins, 'generatePluginCommandList Plugins')
  const plugin = plugins?.find((p) => p.name === pluginName)
  if (plugin) {
    // clo(plugin, `installPlugin "${pluginName}"`)
    await DataStore.installPlugin(plugin, true)
    regenerateList === true ? await generatePluginCommandList(pluginName) : null //TODO: scroll to the proper place in the file
  } else {
    await showMessage(`Could not install "${pluginName}". Plugin not found`)
  }
}

/** SAMPLES
   
  2022-11-12 16:37:30 | DEBUG | generatePluginCommandList installedPlugins[0] :: {
    "id": "nmn.DataQuery",
    "name": "Data Query",
    "desc": "Query data across Noteplan, filter and present it as HTML in a browser",
    "author": "Naman Goel",
    "repoUrl": "tbd",
    "version": "0.0.1",
    "isOnline": false,
    "script": "script.js",
    "commands": [
      "{\"name\":\"openTestHTML\",\"desc\":\"Open a test HTML page\",\"pluginID\":\"nmn.DataQuery\",\"pluginName\":\"Data Query\",\"arguments\":[]}"
    ]
  }
  2022-11-12 16:37:30 | DEBUG | generatePluginCommandList allPlugins[0] :: {
    "id": "codedungeon.Toolbox",
    "name": "🧩 Codedungeon Toolbox",
    "desc": "General Purpose Utility Commands",
    "author": "codedungeon",
    "repoUrl": "https://github.com/NotePlan/plugins/blob/main/codedungeon.Toolbox/README.md",
    "releaseUrl": "https://github.com/NotePlan/plugins/releases/tag/codedungeon.Toolbox-v1.4.1",
    "version": "1.4.1",
    "isOnline": true,
    "script": "script.js",
    "commands": [
      "{\"name\":\"convertToHtml\",\"desc\":\"Convert current note to HTML\",\"pluginID\":\"codedungeon.Toolbox\",\"pluginName\":\"🧩 Codedungeon Toolbox\",\"arguments\":[]}",
      "{\"name\":\"convertSelectionToHtml\",\"desc\":\"Convert current selection to HTML\",\"pluginID\":\"codedungeon.Toolbox\",\"pluginName\":\"🧩 Codedungeon Toolbox\",\"arguments\":[]}",
      "{\"name\":\"reorderList\",\"desc\":\"Reorder current ordered list\",\"pluginID\":\"codedungeon.Toolbox\",\"pluginName\":\"🧩 Codedungeon Toolbox\",\"arguments\":[]}"
    ]
  }
   
   */

/**
 * Get a list of plugins to ouput, either (depending on user choice):
 * 1) installed plugins only
 * 2) all latest plugins, local or online/released on github
 * @param {boolean} showInstalledOnly
 * @returns {Array<PluginObjectWithUpdateField>} - list of plugins
 */
export async function getFilteredPluginData(showInstalledOnly: boolean): Promise<Array<PluginObjectWithUpdateField>> {
  const installedPlugins = DataStore.installedPlugins()
  const plugins: Array<PluginObjectWithUpdateField> = await getPluginList(showInstalledOnly, installedPlugins)
  // clo(plugins, `generatePluginCommandList ${plugins.length} plugins`)
  const pluginsFiltered = []
  plugins.forEach((plugin) => {
    const installedVersion = installedPlugins.find((p) => p.id === plugin.id)
    const isInstalled = installedVersion != null
    plugin.updateIsAvailable = isInstalled && plugin.version !== installedVersion?.version
    plugin.isInstalled = installedVersion != null
    plugin.installedVersion = installedVersion?.version || ''
    plugin.installLink = createRunPluginCallbackUrl(pluginJson['plugin.id'], 'Install Plugin and Re-Generate Plugin Listing Page', ['false'])
    plugin.documentation = plugin.repoUrl || ''
    const commands =
      plugin?.commands?.reduce((acc, c) => {
        !c.isHidden ? acc.push(copyObject(c)) : null
        return acc
      }, []) || []
    pluginsFiltered.push({ ...copyObject(plugin), commands })
  })
  //   clo(pluginsFiltered, `generatePluginCommandList (pluginsFiltered)`)
  return pluginsFiltered
}

/**
 * Plugin Entry Point for "/Generate Plugin Command Listing"
 * Outputs command list to Editor and saves to file "@PluginInfo/PluginCommands"
 * @param {string} pluginID - item to scroll to after drawing page
 * @param {string} listExtent -
 *
 */
export async function generatePluginCommandList(pluginID: string = '', listExtent: string = ''): Promise<void> {
  //TODO: save listExtent
  try {
    logDebug(pluginJson, `generatePluginCommandList ${pluginID ? `scroll to ${pluginID}` : ''}`)
    const fileName = '@PluginInfo/PluginCommands'
    let showInstalledOnly = false
    if (!listExtent) {
      const resp = await showMessageYesNo(`Show all available plugins?\n\n(if you say 'No', it will show only the plugins you have already installed)`)
      showInstalledOnly = resp === 'No'
    }
    const plugins = await getFilteredPluginData(showInstalledOnly)

    const output = [
      `# Plugin Commands`,
      `\t[🔄 Refresh](noteplan://x-callback-url/runPlugin?pluginID=np.plugin-test&command=Generate%20Plugin%20Command%20Listing&arg0=#%20Plugin%20Commands&arg1=${String(
        showInstalledOnly,
      )}`,
    ]
    plugins.forEach((plugin) => {
      // logDebug(
      //   pluginJson,
      //   `generatePluginCommandList ${plugin.id} installedPlugins.length: ${installedPlugins.length} showInstalledOnly: ${showInstalledOnly} ${plugin.version} `,
      // )
      // clo(installedVersion, `generatePluginCommandList ${plugin.id} installedVersion`)
      // clo(plugin, `generatePluginCommandList ${plugin.id} plugin (should be cloud version)`)
      const { isInstalled, updateIsAvailable } = plugin
      //   logDebug(
      //     pluginJson,
      //     `generatePluginCommandList ${plugin.id} isInstalled:${String(isInstalled)} availableUpdate:${String(updateIsAvailable) || ''} plugin.version=${
      //       plugin.version
      //     } installedVersion?.version=${String(installedVersion?.version)} isOnline:${String(installedVersion?.isOnline) || ''}`,
      //   )
      const readmeLink = plugin.repoUrl ? ` [Documentation](${plugin.repoUrl})` : ``
      let installLink = ''
      if (isInstalled) {
        if (updateIsAvailable) {
          installLink = ` ${createPrettyRunPluginLink(`update to latest version`, pluginJson['plugin.id'], 'Install Plugin and Re-Generate Plugin Listing Page', [plugin.name])}`
        }
      } else {
        installLink = ` ${createPrettyRunPluginLink(`install it`, pluginJson['plugin.id'], 'Install Plugin and Re-Generate Plugin Listing Page', [plugin.name])}`
      }
      output.push(`---\n## ${plugin.name} v${plugin.version}${installLink}`)
      output.push(`> ${plugin.desc}`)
      output.push(`> Author: ${String(plugin.author)}${readmeLink}`)
      const visibleCommands = plugin.commands?.filter((c) => !c.isHidden)
      if (Array.isArray(visibleCommands)) {
        output.push(`### Commands`)
        visibleCommands.forEach((command) => {
          const linkText = `try it`
          const rpu = isInstalled ? createPrettyRunPluginLink(linkText, plugin.id, command.name) : ''
          output.push(`- /${command.name} ${rpu}\r\t*${command.desc}*`)
        })
      }
    })
    if (output.length) {
      const outText = `${output.join(`\n`)}\n`
      let note = DataStore.noteByFilename(fileName, 'Notes')
      if (!note) {
        const newNote = DataStore.newNoteWithContent(outText, '@PluginInfo', 'Plugin Commands')
        note = DataStore.noteByFilename(newNote, 'Notes')
      } else {
        note.content = outText
      }
      if (note) {
        await Editor.openNoteByFilename(note.filename)
        if (pluginID) {
          const para = Editor.paragraphs.find((p) => p.content.includes(pluginID))
          if (para && para.contentRange?.start) {
            Editor.select(para.contentRange.start, 0)
          }
          // clo(para, `generatePluginCommandList ${pluginID} para for scrolling`)
        }
      }
    } else {
      await showMessage(`No plugins found`)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
