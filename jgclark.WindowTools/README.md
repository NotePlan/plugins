# 🖥️ Window Tools

This plugin gives some tools to help manage NotePlan's windows more easily:
- **save different layouts** ('Window Sets') of your NotePlan windows on macOS, and then **restore them** in just a few clicks. This includes ordinary notes, calendar notes and special 'html' windows created by some Plugins. (See more detail below.)
- **swap split to main** command (alias: **swap**) swaps the currently-selected split to main, or if no split is currently selected, asks the user which to swap
- **move split to main** command (alias: **mstm**) moves the currently-selected split pane to be the first one in the main window.
- **constrain main window** command (alias: **cmw**) moves the main window to make sure its fully in the screen area, shrinking it if it needs to.
- **open note in new split**: (alias: **onns**) opens a user-selected note in a new split of the main window (*)
- **open note in new window** (alias: **onnw**) opens a user-selected note in a new window (*)
- **open current in new split**: (alias: **ocns**) opens the current note again in a new split of the main window (*)
- **open current in new window**: (alias: **ocnw**) opens the current note again in a new floating window
- **/reset main window** (alias **rmw**): (from Plugin v1.4) This resets the main NP window to default widths, including the main (left) sidebar (requires NP v3.19.2 or later)

(*) these were originally released in the Note Helpers plugin.

Note: this plugin requires NotePlan version 3.9.8 or higher.

## Window Set commands
There are two main commands:
- **/save Window Set** (alias **sws**): Save the size and position of currently open NotePlan windows and 'split' panes and the state of the main (left) sidebar as a set. You're given the option to save any open calendar notes as either relative to today (e.g. 'yesterday' or 'next week'), or as a fixed note.
- **/open Window Set** (alias **ows**): Open a saved set of windows/panes. You're shown a list of all existing window sets to choose from.

As monitor dimensions vary widely, a window set layout is specific to the particular Mac computer you've defined it on. If you have more than one then it will only show you the ones for the machine you're currently using.

Note: these commands require NP vv3.19.2 or higher for control of the main sidebar.

You can also **delete Window Set** (alias **dws**): You are shown a list of all existing window sets to choose from. Or you can **delete all saved Window Sets**.

[<img width="160px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" />](https://www.buymeacoffee.com/revjgc)

### Known limitations
Unfortunately because of limitations in the API that plugins use, WindowSets:
1. can't control the width of split windows within the main NotePlan window.
2. can't control the order of windows that overlap, as the API doesn't supply the z-order of windows when saving a set. (Nor can it control the z-order of windows when opening a set.)
3. doesn't seem to be able to set size/position of floating Editor windows.

### FAQ
Q: Why does this plugin create a new folder for me called @WindowSet?
A: This is the way that all the details of a saved set can be displayed to users who want to be able to do advanced configuration.

Q: I run on multiple Macs: when can't I see some Window Sets on some Macs? 
A: Different Macs tend to have different screen dimensions, and therefore need different Window Sets. For this reason, each Window Set is tied to the 'machineName' that it was created on. (This picks up the name you set in macOS' System Settings > General > Sharing > Local hostname.) The plugin is smart enough to only show you the Window Sets created on the same machine.

Q: Can I delete this folder or re-organise it?
A: Yes, you can delete it or move it (say to the Archive) if you don't intend to be doing advanced configuration (see below).

Q: How can I change the icon used in the Window Set menus?
A: From plugin v1.4, you can manually update the Window Set definition note to set it -- see Advanced Configuration below.

## Configuration
Click the gear button on the **Window Tools** line in the Plugin Preferences panel, to update the settings:
- Note title for Window Set definitions: defaults to `Window Sets`.
- Folder where Window Set definitions are stored: defaults to `@Window Sets`.
- Save main sidebar width? as part of Window Set definitions
- Default main sidebar width: used when resetting windows (default is 300px)
- Default editor width: used when resetting windows (default is 500px)

_If you want to dig into more detail, and tweak more of what's going on, please read the final section below. But you shouldn't need to for most use of saving and opening window sets._

## Running from x-callback
The **/open window set** command can be triggered by opening a a special x-callback URL. The first argument is the name of the window set to open (with spaces replaced by `%20`.)`

For example to restore the 'Days + Weeks' Window Set:
`noteplan://x-callback-url/runPlugin?pluginID=jgclark.WindowTools&command=open%20window%20set&arg0=Days%20%2B%20Weeks`

The **/open note in new split** command can also be run this way. For example:
- to open 'Note Title': `noteplan://x-callback-url/runPlugin?pluginID=jgclark.WindowTools&command=open%20note%20in%20new%20split&arg0=Note%20Title`
- to open tomorrow's daily note: `noteplan://x-callback-url/runPlugin?pluginID=jgclark.WindowTools&command=open%20note%20in%20new%20split&arg0=tomorrow` 

Similarly for the **/open note in new window** command, for example `noteplan://x-callback-url/runPlugin?pluginID=jgclark.WindowTools&command=open%20note%20in%20new%20window&arg0=Note%20Title`.

You can trigger the **/delete window set** command for a particular named Window Set, for example `noteplan://x-callback-url/runPlugin?pluginID=jgclark.WindowTools&command=delete%20window%20nset&arg0=WS%20Name`.

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue' in GitHub](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:

[<img width="180px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" />](https://www.buymeacoffee.com/revjgc)

Thanks!

## History
Please see the [CHANGELOG](CHANGELOG.md).

<hr />

## Advanced Configuration

In more detail here is an annotated example of the code block in the special note:
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
        "noteType": "Notes",
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
        "filename": "@WindowSets/Window Sets.md"
      }
    ],
    "closeOtherWindows": true, // when opening this window set, should existing windows/splits be closed?
    "mainSidebarWidth": 250, // (from v1.4, optional) width of main (left) sidebar, in pixels
    "icon": "window-restore", // (from v1.4, optional) icon as used in note frontmatter
    "iconColor": "#AA6734" // (from v1.4, optional) hexadecimal color (note: not Tailwind colors as used in note frontmatter)
  }
]
}
```
Note: you can't actually include comments in the code block (for this breaks JSON).

(You might be wondering "Why doesn't it use the normal Plugin Preferences system?" The answer is that it isn't flexible enough to store the necessary details for an arbitrary number of window sets.)

### Specifying Calendar Dates
Specific Calendar notes can be specified using their internal filenames (examples: 2023.md, 2023-Q3.md, 2023-09.md, 2023-W44.md, 20230903.md). More usefully, they can be specified as **dates relative to today**, using the special syntax options:
-  `{+n[bdwmqy]}` meaning `n` business days/days/weeks/months/quarters/years after today
- `{-n[bdwmqy]}` meaning `n` before today
- `{0[dwmqy]}` meaning the current day/week/month/quarter/year.

For example, filenames of `{-1w}`, `{0w}`,`{1w}` respectively means last week, this week and next week's notes.

### Specifying Plugin Windows
When you create a Window Set it will do its best to identify the plugin command used to create an 'HTML' window, however this is based on a lookup list, and so may not include everything. It will tell you if you need to manually update the Window Set definition: just search for the `?` which tell you where the command name needs adding.

## Support
If you find an issue with this plugin, or would like to suggest new features for it, please raise a [Bug or Feature 'Issue' in GitHub](https://github.com/NotePlan/plugins/issues).

If you would like to support my late-night work extending NotePlan through writing these plugins, you can through:

[<img width="200px" alt="Buy Me A Coffee" src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" />](https://www.buymeacoffee.com/revjgc)

Thanks!

## History
Please see the [CHANGELOG](https://github.com/NotePlan/plugins/blob/main/jgclark.WindowTools/CHANGELOG.md).
