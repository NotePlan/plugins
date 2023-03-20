# What's changed in 🔁 Repeat Extensions plugin?
Please see the [Readme for this plugin](https://github.com/NotePlan/plugins/tree/main/jgclark.RepeatExtensions) for more details, including the available settings. For this plugin to work, **you need to have the 'Append Completion Date' setting turned on in Preferences > Todo**.

## [0.5.2] - 2023-03-???
### Changed
<!-- - Now internally running from Editor only -->
- Now will write the new repeat date as a week-style date (e.g. `>2023-W11`) where either the task is in a weekly note, or the scheduling of the repeat is for a weekly date.
### Fixed
- ??? Fixed error when running from calendar notes (thanks to @DHERRADOR and @dbcoyer for the report)

## [0.5.1] - 2023-01-17
### Changed
- the @repeat(...) intervals can now use uppercase B,D,W,M,Q,Y characters. (for advanced Templating work by @DocJulien and @dwertheimer)

## [0.5.0] - 2022-12-22
### Added
- new repeats using this extended syntax can now be generated automatically after you complete an existing one. This requires NotePlan v3.7.2, and adding this line to frontmatter at the start of every note you wish to automate in this way:
``` yaml
---
triggers: onEditorWillSave => jgclark.RepeatExtensions.onEditorWillSave
---
```

## [0.4.0] - 2022-11-08
### Added
- will now find and process repeats in Weekly notes as well as other notes
- added logging options

## [0.3.1] - 2022-02-20
### Changed
- can now be called by the command `/generate repeats`, (alias `/rpt`)
- code refactoring

## [0.3.0] - 2021-10-24
### Added
- now tells user if no suitable repeats were found to process, to make it clear that it did run

### Fixed
- the new repeats now don't show as 'scheduled' (i.e. starting `* [>]`) but just as ordinary open tasks (`* [ ] `), which then makes them visible in the references area, as intended (thanks to @orionp for pointing this out)

## [0.2.1..0.2.4] - 2021-06-29
### Added
- new: where the repeat is in a daily note, now 'throw' the new repeat of the task into the future date. (Note this is currently waiting on a fix to the API to be implemented fully.)
### Changed
- updated: now compiled for macOS versions back to 10.13.0.
- improve: quality of month interval calculations
- update: following API fix, future repeats are created OK in daily notes

## Fixed
- fix: allow for other date localisations (that make `@done()` include versions of AM/PM string as well)

## [0.2.0] - 2021-05-27
### Added
- first released version for plugin, ported to JavaScript plugin framework from my [npTools Ruby script](https://github.com/jgclark/NotePlan-tools/).
