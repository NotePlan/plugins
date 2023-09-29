# 🖥️ Window Sets
This plugin allows you to save particular 'sets' or layouts of your NotePlan windows on macOS, and then **restore** them in just a few clicks. This includes ordinary notes, calendar notes and special 'html' windows created by some Plugins.

The commands are simple:
- **/open window set** (alias **/ows**): Open a saved set of windows/panes. You're shown a list of all saved window sets to choose from.
- **/save window set** (alias **/sws**): Save the currently open set of windows/panes as a set, complete with size and position of 'floating' windows.  Note: This doesn't include being able to save the precise Plugin window details.

??? machineName

The Plugin requires NotePlan version 3.9.8 or higher.

(There are currently some other commands for testing.)

## Defining Window Sets
These are defined in a special note; by default this is `@Window Sets/Windows Sets` but can be changed in the plugin Settings. All Window Sets are defined in a code block in JSON format. When first run it will offer to write out some examples for you to use or modify.

In more detail:
??? - tbd

(You might be wondering "Why doesn't it use the normal Plugin Preferences system?" The answer is that it isn't flexible enough to store the necessary details for an arbitrary number of window sets.)

### Specifiying general Notes
???

### Specifying Calendar Dates
Specific Calendar notes can be specified using their internal filenames (examples: 2023.md, 2023-Q3.md, 2023-09.md, 2023-W44.md, 20230903.md). More usefully, they can be specified as **dates relative to today**, using the special syntax options:
-  `{+n[bdwmqy]}` meaning `n` business days/days/weeks/months/quarters/years after today
- `{-n[bdwmqy]}` meaning `n` before today
- `{0[dwmqy]}` meaning the current day/week/month/quarter/year.

For example, `{-1w}`, `{0w}`,`{1w}` means last week, this week and next week's notes respectively.

### Specifiying Plugin Windows
???
It will do its best to ... however ...

## Other Configuration
Click the gear button on the **Window Sets** line in the Plugin Preferences panel, and fill in the settings accordingly:
- Folder where Window Set definitions are stored: defaults to `@Window Sets`.

## Running from x-callback
The **/open window set** command can be triggered by opening a a special x-callback URL. The first argument is the name of the window set to open (with spaces replaced by `%20`.)`

For example to restore the 'Days + Weeks' Window Set:
`noteplan://x-callback-url/runPlugin?pluginID=jgclark.WindowSets&command=open%20window%20set&arg0=Days%20%2B%20Weeks`

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue'](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg">](https://www.buymeacoffee.com/revjgc)

Thanks!

## History
Please see the [CHANGELOG](CHANGELOG.md).
