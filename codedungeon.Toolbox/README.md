# codedungeon.Test Noteplan Plugin

[You will delete this text and replace it with a readme about your plugin -- not ever seen by users, but good for people looking at your code. Before you delete though, you should know:]

You do not need all of this scaffolding for a basic NP plugin. As the instructions state [Creating Plugins](https://help.noteplan.co/article/65-commandbar-plugins), you can create a plugin with just two files: `plugin.json` and `script.js`. Please read that whole page before proceeding here.

However, for more complex plugins, you may find that it's easier to write code in multiple files, incorporating code (helper functions, etc.) written (and *TESTED*) previously by others. You also may want type checking (e.g. [Flow.io](https://flow.io)) to help validate the code you write. If either of those is interesting to you, you're in the right place. Before going any further, make sure you follow the development environment [setup instructions](https://github.com/NotePlan/plugins).

Clone/download the entire plugins repository from github.

Then create a copy of this skeleton folder. Give your skeleton folder copy a name (e.g. your githubUsername.pluginOrCollectionOfCommandsName). Some examples that exist today:
- jgclark.NoteHelpers
- dwertheimer.DateAutomations

Do a global find/replace in your folder for `tsetFunction` for the function name of your plugin's JS entry point (it will be listed in the plugin.json). And change the filename `tsetFunction.js` to match.

Open up a terminal folder and change directory to the plugins repository root. Run the command `npm run autowatch` which will keep looking for changes to plugin files and will re-compile when Javascript changes are made. It will also transpile ES6 and ES7 code down to ES5 which will run on virtually all Macs, and will copy the file to your plugins folder, so you can immediately test in Noteplan.

Keep in mind that you can code/test without updating the plugin version # in plugin.json, but when you push the code to the repository (or create a PR), you should update the version number so that other peoples' Noteplan apps will know that there's a newer version.

Further to that point, you can use your plugin locally, or you can use `git` to create a Pull Request to get it included in the Noteplan/plugins repository and potentially available for all users through the Preferences > Plugins tab.

That's it. Happy coding!

Hat-tip to @eduard, @nmn & @jgclark, who made all this fancy cool stuff.

Best,
@dwertheimer


## Configuration

Notes about how to configure your plugin (if required)
