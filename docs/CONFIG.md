# NotePlan Plugin Configuration

## Overview
NotePlan Plugins use a configuration file `plugin.json` which resides in the root level of your plugin folder (e.g., `codedungeon.Toolbox/plugin.json`) and is used by the NotePlan Plugin Preferences to dsiplay information about your plugin, and the plugin entrypoints and commands.

<h1 align="center">
    <img src="images/noteplan-preferences.png" alt="NotePlan Plugin Preferences">
</h1>

#### Example `plugin.json`
Example configuration file, all fields are required

```json
{
	"macOS.minVersion": "10.13.0",
	"noteplan.minAppVersion": "3.0.21",
	"plugin.id": "githubName.PluginName",
	"plugin.name": "🚀 PluginName",
	"plugin.description": "My Wonderful Contribution",
	"plugin.author": "githubName",
	"plugin.version": "1.1.1",
	"plugin.dependencies": [],
	"plugin.script": "script.js",
	"plugin.url": "https://github.com/NotePlan/plugins/blob/main/githubName.PluginName/README.md",
	"plugin.commands": [{
		"name": "helloWorld",
		"description": "Say hello!",
		"jsFunction": "helloWorldFunctionName"
	}]
}
```

## Plugin Configuration Definition
The following table outlines each of the keys and how they are used

| Key                    | Description                      | Example                                                                        |
| ---------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| macOS.minVersion       | Minimum macOS Version            | 10.13.0 (this should never be below 10.13.0)                      |
| noteplan.minAppVersion | Minimum NotePlan Version         | 3.0.21 (this should never be below 3.0.21)                                   |
| plugin.id              | Plugin Unique ID                 | codedungeon.Toolbox                                                          |
| plugin.name            | Plugin Name                      | 🧩 Codedungeon Toolbox                                                       |
| plugin.description     | Plugin Description               | General Purpose Utility Commands                                             |
| plugin.version         | Plugin Version (follows semver)  | 1.2.1 (see information below about versioning)                               |
| plugin.script          | Plugin Main Entrypoint           | This should always be `script.js`                                            |
| plugin.url             | Plugin "More Info"               | https://github.com/NotePlan/plugins/blob/main/codedungeon.Toolbox/README.md  |
| plugin.commands        | List of Commands                 | _Array of Command Objects (see below for command object definition)_         |

### Plugin Command Object
The `plugin.json` file contains a key labeled `plugin.commands` which is an array of command objects

```json
...
"plugin.commands": [{
	"name": "helloWorld",
	"description": "Say hello!",
	"jsFunction": "helloWorldFunctionName"
}]
...
```

| Key                  | Description                                    | Example                                                       |
| -------------------- | --------------------------------------------   | ------------------------------------------------------------- |
| name                 | Command Name                                   | convertToHtml                                                 |
| description          | Command Description                            | Convert current note to HTML                                  |
| jsFunction           | You function name (as defined in `index.js`)   | General Purpose Utility Commands                              |
| alias                | An array of alias names which can be used      | ['toHtml','convertNoteToHtml']                                |

## Plugin Versioning
The `plugin.json` file contains a key labeled `plugin.version` which NotePlan uses to determine the current version of a given plugin, and is used to determine if an updated version is available.

❗️ You must follow [semantic versioning](https://semver.org/) when formatting your version numbers.

There are three required parts to a version number

**major** - The `major` version will increment whenever major features are added to your plugin, or if there are breaking changes
**minor** - The `minor` number will increment whenever minor functionality is added to your plugin, such as a new command, or enhancing an existing command.
**patch** - The `patch` number will be incremented whenever you are fixing an issue to an existing command

In addition, if you are release a beta or pull request (pr) version, followed by incremental changes which occur during the testing period.

**type** - The `type` of version, either `pr` or `beta`

#### Pull Request Release (required)
If you are creating a new plugin and submitting it as a PR, use the `pr` part, and increment each time a new build is updated.
This will be important during the review process as it will be displayed in the **NotePlan Preferences - Plugin** dialog

`0.0.1-pr.1` would be the first `pr` release
`0.0.1-pr.2` would be the second `pr` release

#### Beta Release (not required)
If you are working on providing a feature/fix to an existing plugin, use the `beta` part, and increment each time a new build is updated
Once your plugin has been published for public consumption, if you are in a `testing` phase for external users, you should use the `beta` version until the plugin is deemed "final"

`0.0.1-beta.1` would be the first `beta` release
`0.0.1-beta.2` would be the second `beta` release

## NotePlan Plugin Support
Should you need support for anything related to NotePlan Plugins, you can reach us at the following:

### Email
If you would prefer email, you can reach us at:

- [NotePlan Info](hello@noteplan.co)

### Discord
Perhaps the fastest method would be at our Discord channel, where you will have access to the widest amount of resources:

- [Discord Plugins Channel](https://discord.com/channels/763107030223290449/784376250771832843)

### Github Issues
This is a great resource to request assistance, either in the form of a bug report, or feature request for a current or future NotePlan Plugin

- [GitHub Issues](https://github.com/NotePlan/plugins/issues/new/choose)
