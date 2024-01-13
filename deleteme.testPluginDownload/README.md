# PLUGIN DOWNLOAD TEST Noteplan Plugin

## Latest Updates

See [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/deleteme.testPluginDownload/CHANGELOG.md) for latest updates/changes to this plugin.

## About This Plugin 

My Plugin for NotePlan

[You will delete this text and replace it with a readme about your plugin -- not ever seen by users, but good for people looking at your code. Before you delete though, you should know:]

You do not need all of this scaffolding for a basic NP plugin. As the instructions state [Creating Plugins](https://help.noteplan.co/article/65-commandbar-plugins), you can create a plugin with just two files: `plugin.json` and `script.js`. Please read that whole page before proceeding here.

However, for more complex plugins, you may find that it's easier to write code in multiple files, incorporating code (helper functions, etc.) written (and *TESTED*) previously by others. We strongly recommend type checking (e.g. [Flow.io](https://flow.io)) to help validate the code you write. If either of those is interesting to you, you're in the right place. Before going any further, make sure you follow the development environment [setup instructions](https://github.com/NotePlan/plugins).

## Creating NotePlan Plugin

You can create a NotePlan plugin by executing:

```bash
noteplan-cli plugin:create
```

Open up a terminal folder and change directory to the plugins repository root. Run the command `npm run autowatch` which will keep looking for changes to all plugin files and will re-compile when JavaScript changes are made. It will also transpile ES6 and ES7 code to ES5 which will run on virtually all Macs, and will copy the file(s) to the NotePlan Plugins folder, so you can immediately test in Noteplan.

### NotePlan Plugins Directory
You can find all your currently installed NotePlan Plugins here (for AppStore version of NotePlan):

```bash
/Users/<user>/Library/Containers/co.noteplan.NotePlan3/Data/Library/Application Support/co.noteplan.NotePlan3/Plugins
```

Keep in mind that you can code/test without updating the plugin version property in `plugin.json`, however when you push the code to the Plugins repository (or create a PR), you should update the version number so that other NotePlan users who have installed your plugin will know that an updated version is available.

Further to that point, you can use your plugin locally, or you can use `git` to create a Pull Request to get it merged in the Noteplan/plugins repository and potentially available for all users through the `NotePlan > Preferences > Plugins` tab.

That's it. Happy coding!

## NotePlan Plugin Team
Hat-tip to @eduard, @nmn, @jgclark, @dwertheimer and @codedungeon, who made all this fancy cool stuff.
