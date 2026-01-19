
async function installPluginsIncludingHidden() {
	_installPlugins(true)
}

async function installPlugins() {
	_installPlugins(false)
}

async function _installPlugins(showHidden) {
  let plugins = await DataStore.listPlugins(true, showHidden)

  let list = plugins.map(p => pluginToDescription(p))
  list.push("❌ Cancel")

  let selection = await CommandBar.showOptions(list, "Select a plugin to install/update:")

  if(selection.index < plugins.length) {
    let plugin = plugins[selection.index]
    try {
      let result = await DataStore.installPlugin(plugin, true)

      let list = ["✅ OK", "📖 Open Readme", "", "Commands:"]
      plugin.commands.forEach((item, i) => {
        list.push("/" + item.name + " - " + item.desc)
      });

      let selection = await CommandBar.showOptions(list, "Successfully installed '" + plugin.name + "'")
      if(selection.index == 1) {
        CommandBar.openURL(plugin.repoUrl)
      }
    } catch(err) {
      await CommandBar.showOptions(["✅ OK"], "Error: " + err)
    }
  }
}

function pluginToDescription(p) {
  let installed = p.isOnline ? "" : ", installed: 🆗"

  if(p.availableUpdate) {
    installed += ", update: v" + p.availableUpdate.version + " 🆕"
  }

  return p.name + " (v" + p.version + installed + ")"
}
