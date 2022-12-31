# What's Changed in 🔢 Statistics plugin?
## [0.6.0] - 2022-12-30
### New
- "/task stats ..." command now includes counts for Checklist items (ready for NotePlan v3.8)
- "/note stats" command now includes counts for notes in the @Archive
### Changed
- Now ignores weekly/monthly/quarterly/yearly notes in the "Daily Calendar notes" count

## [0.5.2] - 2022-05-14
### Changed
- Updated references to the new Templates built-in folder.

## [0.5.1] - 2021-11-07
### Changed
- A little code cleanup.
- Removed pointed to old command /stp which has now been in Summaries plugin for a while.

## [0.5.0] - 2021-10-11
### Changed
- **`/stp` (stats for time period) command now moved to the new Summaries plugin**

## [0.4.0] - 2021-10-04
### Changed
- `/nc` (note counts) now shows Templates as a separate category, separate from Project Notes
- `/tsp` (task stats for all projects) now ignores Templates

## [0.3.6] - 2021-08-16
### Changed
- re-compiled for macOS versions back to 10.13.0.

## [0.3.5] - 2021-08-01
### Fixed
- list today's events broke after a config framework change

## [0.3.4] - 2021-07-28
### Fixed
- edge case of zero tasks → NaN

## [0.3.3] - 2021-07-02
### Changed
- tweaks to display; large numbers will now display using local settings for thousands separators

## [0.3.2] - 2021-06-29
### Added
- new `/stp` command generates statistics and summaries over time periods.

## [0.2.0]
### Added
- new `/tsp` command, giving task stats for all projects

### Changed
- renamed commands to use new abbreviated form

## [0.1.0]
### Added
First release, with `/tc` (task count), `/wc` (word count) and `/nc` (note count) statistics
