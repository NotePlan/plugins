# What's changed in 🖥️ Window Sets?
_Please also see the Plugin [README](https://github.com/NotePlan/plugins/blob/main/jgclark.WindowSets/README.md)._

<!-- - ??? Now knows which machine they live on ... so now ... . See README for details. -->
## [0.4.0b1] - 2023-10-07
- now checks that windows live within the visible screen dimensions, and moves/resizes them if not
- smarter mechanism for guessing plugin (HTML) windows details by developer convention
- add update trigger a different way, and fixed it dealing with stale data
- wrote most documentation
- fix problem where regular notes' filenames aren't being saved

## [0.3.0] - 2023-09-28 (unreleased; following change of design)
- Window Set definitions now live in a hidden preference, _but can be automatically sync'd to/from a user's note to see what's going on_. See README for details.
- added a lookup list (held in src/WSHelpers.js::pluginWindowsAndCommands) to automatically identify plugin (HTML) windows where known.

## [0.2.0] - 2023-09-10 (unfinished; unreleased -- decided to change design)
- Window Set definitions now live in notes. See README for details. Can now have any number of defined window sets.
- **/Save window set** command. Now includes window size and position for floating windows. (Incomplete: doesn't yet work for updating existing Window Set definition.)

## [0.1.0] - 2023-04-04
- First basic working version. Note: only catering for 5 window sets, due to limitiation of configuration system.
