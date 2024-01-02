# What's changed in 🖥️  Window Tools?
_Please also see the Plugin [README](https://github.com/NotePlan/plugins/blob/main/jgclark.WindowSets/README.md)._

## [1.0.0] - 2024-01-02
Renamed plugin to '**🖥️  Window Tools**' (at v1.0.0) as it now covers more than just Window Sets:
- new command **/move split to main** (alias: /mstm) that moves the current split pane to be the first one in the main window
- new command **/constrain main window** (alias: /cmw) moves the main window to make sure its fully in the screen area, shrinking it if it needs to.

Also the following window-management commands have moved from Note Helpers:
- **open note in new split**: (alias: /onns) opens a user-selected note in a new split of the main window
- **open note in new window** (alias: /onnw) opens a user-selected note in a new window
- **open current in new split**: (alias: /ocns) opens the current note again in a new split of the main window
- **open current in new window**: (alias: /ocnw) opens the current note again in a new floating window

<!-- ## [0.5.0b1] - 2023-10-27
First private attempt to use updated API to deal with split window widths properly in saving and opening window sets. In particular:
- FIXME: added a new command **/set editor width** (alias: /sew), which tests this new functionality. -->

## [0.4.0] - 2023-10-20
**This is the first public release. It requires NotePlan v3.9.8.**
- wrote most documentation
- now checks that windows live within the visible screen area, and moves them if not, shrinking if necessary
- smarter mechanism for guessing plugin (HTML) windows details by developer convention
- now knows which Mac a WindowSet was defined on, and now will only offer to open WindowSets from that same Mac. This helps users with multiple machines with different sized monitors, including me.
- add update trigger a different way, and fixed it dealing with stale data
- fix problem where regular notes' filenames weren't being saved

## [0.3.0] - 2023-09-28 (unreleased; following change of design)
- Window Set definitions now live in a hidden preference, _but can be automatically sync'd to/from a user's note to see what's going on_. See README for details.
- added a lookup list (held in src/WSHelpers.js::pluginWindowsAndCommands) to automatically identify plugin (HTML) windows where known.

## [0.2.0] - 2023-09-10 (unfinished; unreleased -- decided to change design)
- Window Set definitions now live in notes. See README for details. Can now have any number of defined window sets.
- **/Save window set** command. Now includes window size and position for floating windows. (Incomplete: doesn't yet work for updating existing Window Set definition.)

## [0.1.0] - 2023-04-04
- First basic working version. Note: only catering for 5 window sets, due to limitiation of configuration system.
