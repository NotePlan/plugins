# NotePlan Plugins

## Overview
NotePlan Plugins provides an extensive API for extending default editing and task management. Each plugin can be invoked using the 
[NotePlan Command Bar](https://help.noteplan.co/article/65-commandbar-plugins) or by entering any of available commands directly in the editor by entering `/command` (NotePlan will auto update the list of possible commands as you type)
 
![](https://d33v4339jhl8k0.cloudfront.net/docs/assets/6081f7f4c9133261f23f4b41/images/608c5886f8c0ef2d98df845c/file-fLVrMGjoZr.png)

## Plugin Information
If you have an idea for a plugin, [submit them here](https://feedback.noteplan.co/plugins-scripting) or inquire in the [NotePlan Discord community](https://discord.gg/D4268MT)'s `#plugin-ideas` channel.

If you are a developer and want to contribute and build your plugins, see the [plugin writing documentation](https://help.noteplan.co/article/67-create-command-bar-plugins) and discuss this with other developers on [Discord](https://discord.gg/D4268MT) `#plugin-dev` channel.  Your might want to consult this [good modern JavaScript tutorial](https://javascript.info/).

### Getting Started with Plugin Development

1.  Clone this repository
2.  Make sure you have a recent version of `node` and `npm` installed (if you need to install node, `brew install node` is the quickest method, your can following instructions on [node website](https://nodejs.org/en/download/)).
3.  Run `npm run init` from the root of your local GitHub repository for `NotPlan/plugins`. This will install the necessary npm dependencies and initialize your plugin working directory, including: 
4. 
 - Configure `eslint` [eslint](https://eslint.org/) (for checking code conventions)
 - Configure `flow` [flow](https://flow.org/) (for type checking)
 - Configure `babel` [babel](https://babeljs.io/) (a JS compiler)
 - Configure `rollup` [rollup](https://rollupjs.org/guide/en/) (for bundling multiple source files into a single release).  

Each of these tools have their own configuration files at the root directory (e.g., `.flowconfig` or `.eslintrc`)

Note: Each of these configuration files can be overridden if needed by placing a project specific configuration file in you project plugin, however, for consistency with other NotePlan plugins, we encourage to use the defaults wherever possible.

### Creating your first NotePlan Plugin
Using the NotePlan CLI, perform the following:

1. Run `noteplan-cli plugin:create`
	- Answer the prompt questions (or supply all the necessary options from command line (see `noteplan-cli plugin:create --help` for details)
	
2. Run `noteplan-cli plugin:info` to see a list of all available commands across all existing NotePlan plugins.
3. Run `noteplan-cli plugin:info --check <name>` to see if your plugin command is available 
4. Run `npm run autowatch` from the root directory to build your plugin. 
5. After you have built all plugins, you can use the alternate command `npm run autowatch <plugin_name>`

### Github Installation
If you don't have github `gh` installed, you will need to complete installation before you can continue with preparing your plugin for publishing to the `NotePlan/plugins` repository (the same repository where you performed clone above)

Install GitHub command line tools `gh` and authorize it for future use:

   ```
   > brew install gh
   > gh auth login
   	  [ Github.com > HTTPS > Yes Credentials > Login with web browser ]
      [ Enter (copy OTP code from command line) ]
      [ Paste OTP code in browser window ]
   ```

### Common Development Commands
These are the most common commands you will use while developing:

1. **`npm run autowatch` from the root of your local GitHub `NotePlan/plugins` repository and your multi-file JS plugins will be compiled for you and copied from your repository directory to your Plugins folder in the running NotePlan data directory for testing**.
	- The watcher will remain running, _watching_ the NotePlan directory and re-compile whenever changes have been made to your `<your_plugin>/src` JavaScript files. 

#### File Watcher
The default watch command `npm run autowatch` (without any other arguments) command will rebuild _all_ plugins just in case shared files affect another plugin. If you want to focus autowatch on a subset of plugins, you can pass the plugin folder name to autowatch like so:

   `npm run autowatch dwertheimer.TaskAutomations`

For compatibility with older Macs, the plugins are transpiled into a single `scripts.js` file before they are copied to the NotePlan Plugins folder. 

#### Using NotePlan Debugger
If you need to use your IDE JavaScript Debugger This works great, but if you want to try to debug in the [Javascript debugger](https://help.noteplan.co/article/103-debugging-plugins) you can use the following watching syntax:

   `npm run autowatch dwertheimer.TaskAutomations -- -debug`

That will bundle your code together into one `script.js` file, but will not transpile it to ES5.

Then, when you are done debugging, build the plugin properly for release using the non-debug version above.

### Creating Pull Request to NotePlan Public Repository
1. Once you have necessary permissions to the repository and want to release the plugin for all NotePlan users, create a [Pull Request] (https://docs.github.com/en/github/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests)

### Frequently Used Commands
The common script you will run `npm run autowatch` however, you may need to use any of the following

- `noteplan-cli plugin:info --check <name>` to check if you desired command name is in use by any other NotPlan Plugins
- `npm run build`: Will build all the plugins into single files (where needed)
- `npm run watch`: Will watch *all* files for changes and automatically compile them into single javascript files (where needed)
- `npm run typecheck`: Will typecheck all the javascript files with `Flow`. Only files with a `// @flow` comment are checked.
- `npm run fix`: Will lint and auto-format
- `npm run test`: Will lint and typecheck all Javascript files and report, but not fix anything
- `npm run lint`: Will run ESlint on the entire repo
- `npm run lint-fix`: Will run ESlint on the entire repo and fix whatever it can automatically fix
- `npm run format`: Will auto-format all Javascript files.
- `gh release delete <release name>`: Will delete the release from the repository, so making it unavailable in NotePlan as well. (Though it won't remove it from anyone who has already downloaded it.)

## Editor Setup

Use the setup guide for your preferred editor (we prefer Visual Studio Code), and then read the section on Working with Multiple Files.

### Visual Studio Code (recommended)

1. Install extensions for the following tools:
   1. `flow` "Flow Language Support" by flowtype
   2. `eslint` "ESLint" by Dirk Baeumer
   3. `prettier` "Prettier - Code formatter" by Prettier
2. Update Settings:
3. Set `prettier` to be the default formatter for js files.
   - You can open the Command Bar using `CMD+SHIFT+P` and then search for `Format Document`.
   - When you do this, you may get asked for a formatter of choice. Choose "Prettier"
   - If it asks you if this should be your default for all JS files, choose Yes.
4. Restart the editor to ensure the plug-ins are working.
   - You should see type errors when you make those
   - You should see lint errors when you format code wrong
   - You should see your code get auto formatted when you save
5. Make sure to open this folder directly in VSCode and not the entire repo as the ESLint plug-in can be annoying about that

### Sublime Text 3 and 4

1. Install the following extensions using Package Control
   1. `SublimeLinter` This allows various linters to work
   2. `SublimeLinter-eslint`
   3. `SublimeLinter-flow`
   4. `jsPrettier`
   5. `Babel` Syntax definitions for ES6 Javascript and React JSX extensions
2. Configure your packages:
   1. Open a `.js` file
   2. From the View menu, select Syntax → Open all with current extension as… → Babel → JavaScript (Babel)
   3. Open the package settings for `jsPrettier` and add `"auto_format_on_save": true,`

### Working with multiple files

NoNotePlan plugins need to be packaged as a single JavaScript file, using [rollup](https://rollupjs.org/guide/en/) to handle all the heavy lifting.

If you don't have an editor set up to lint as you code, you can run `npm run test` and it will give a list of problems to fix.

## Using Flow
NotePlan plugins use [flow](https://flow.org/) for static type checking. You can get more information by referencing [NotePlan Flow Guide](https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md)

## Using NotePlan CLI
NotNotePlan CLI can be used throughout your development process.  For more information about available NotePlan CLI commands, you can use:

```bash
noteplan-cli --help
```

The following commands are available:

### plugin:info
Provides information about the installed NotePlan Plugins (see `noteplan-cli plugin:info --help` for available options)

### plugin:create
Used to create new NotePlan Plugins (see `noteplan-cli plugin:create --help` for available options)

#### NotePlan CLI Alias
You can also use the NotePlan CLI alias `np-cli`

```bash
np-cli <command>
```

## Contributing

If you would like to contribute to the NotePlan Plugin repository, feel free to submit a [Pull Request] (https://docs.github.com/en/github/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests) for any existing NotePlan Plugin, or any of the support materials.

