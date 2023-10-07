# 🖥️ Window Sets

This plugin (which requires NotePlan version 3.9.8 or higher) allows you to save particular 'sets' or layouts of your NotePlan windows on macOS, and then **restore** them in just a few clicks. This includes ordinary notes, calendar notes and special 'html' windows created by some Plugins.

The commands are simple:
- **/open window set** (alias **/ows**): Open a saved set of windows/panes. You're shown a list of all saved window sets to choose from.
- **/save window set** (alias **/sws**): Save the currently open set of windows/panes as a set, complete with size and position of 'floating' windows, including more advanced 'HTML' windows.

(There are currently some other commands for testing. To see the underlying window set definitions, you can use **/log window sets** which writes to the Help > Plugin Console.)

[<img width="100px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg">](https://www.buymeacoffee.com/revjgc)

## Defining Window Sets
These are defined in a special note; by default this is `@Window Sets/Windows Sets` but can be changed in the plugin Settings. All Window Sets are defined in a code block in JSON format. When first run it will offer to write out some examples for you to use or modify.

Note: to help people who use NotePlan on more than one Mac, each Window Set is tied to the 'machineName' that it was created on. This picks up the name you set in macOS' System Settings > General > Sharing > Local hostname.

In more detail here is an annotated example of the code block:
```jsonc
"WS":
[ // array of sets
  {
    "name": "Some relative dates", // name you give the set. Should be unique per machine
    "machineName": "mba2.local",
    "htmlWindows": [], // empty array
    "editorWindows": [
      { // define first note
        "x": 684, // window starts 684 pixels from left
        "y": 0, //  and 0 pixels from bottom
        "height": 623, // window height
        "width": 652, // window width
        "noteType": "Calendar",
        "title": "today", // a name just to help you identify it
        "windowType": "main", // the first ('main') window in NP
        "filename": "{0d}" // i.e. 0 days from today
      },
      { // define second note: the ordering of elements doesn't matter, and tends not to be maintained
        "noteType": "Notes", //
        "x": 966,
        "height": 623,
        "y": 107,
        "width": 450,
        "filename": "", // filename of the note, relative to the root of NotePlan's notes
        "title": "Window Sets", // title of the note
        "windowType": "split" // another 'split' pane in the main NP window
      },
      {
        "x": 954,
        "height": 623,
        "y": 51,
        "noteType": "Notes",
        "title": "Window Sets",
        "windowType": "floating", // a separate, 'floating' window
        "width": 450,
        "filename": "???"
      }
    ],
    "closeOtherWindows": true // when opening this window set, should existing windows/splits be closed?
  }
]
}
```

(You might be wondering "Why doesn't it use the normal Plugin Preferences system?" The answer is that it isn't flexible enough to store the necessary details for an arbitrary number of window sets.)

### Specifying Calendar Dates
Specific Calendar notes can be specified using their internal filenames (examples: 2023.md, 2023-Q3.md, 2023-09.md, 2023-W44.md, 20230903.md). More usefully, they can be specified as **dates relative to today**, using the special syntax options:
-  `{+n[bdwmqy]}` meaning `n` business days/days/weeks/months/quarters/years after today
- `{-n[bdwmqy]}` meaning `n` before today
- `{0[dwmqy]}` meaning the current day/week/month/quarter/year.

For example, filenames of `{-1w}`, `{0w}`,`{1w}` respectively means last week, this week and next week's notes.

### Specifiying Plugin Windows
It will do its best to identify the plugin command used to create the window, however this is based on a lookup list, and so may not include everything. It will tell you if you need to manually update the Window Set definition: just search for the `?` which tell you where the command name needs adding.

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
