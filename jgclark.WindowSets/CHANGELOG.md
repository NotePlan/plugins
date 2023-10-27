# What's changed in 🖥️ Window Sets?
_Please also see the Plugin [README](https://github.com/NotePlan/plugins/blob/main/jgclark.WindowSets/README.md)._

## [0.5.0b1] - 2023-10-27
First private attempt to use updated API to deal with split window widths properly in saving and opening window sets. In particular:
- added a new command **/set editor width** (alias: /sew), which tests this new functionality.

## [0.4.0] - 2023-10-20
**This is the first public release. It requires NotePlan v3.9.8.**
- wrote most documentation
- now checks that windows live within the visible screen dimensions, and moves/resizes them if not
- smarter mechanism for guessing plugin (HTML) windows details by developer convention
- now knows which machine they live on ... so now ... . See README for details.
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
