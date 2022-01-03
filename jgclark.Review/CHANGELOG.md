# What's changed in 🔬 Reviews plugin?
See [website README for more details](https://github.com/NotePlan/plugins/tree/main/jgclark.Review), and how to configure.

## [0.5.1] - 2022-01-03
### Changed
- removed `addProject` command. I've realised the equivalent is now available already by setting up the `/qtn` command in Templates plugin. See my [README](README.md) for details.

## [0.5.0] - 2021-12-28
### Changed
- the `foldersToExclude` setting now means `/startReviews` and `projectLists` commands ignore any sub-folders of the specified ones as well
- tweaked the output to show overdue reviews in **bold**
- improved code documentation

### Fixed
- will no longer ignore notes in the root folder (thanks to @Matthias for the report)

## [0.4.4..0.4.5] - 2021-12-09
### Fixed
- /projectList could fail on invalid `@due()` dates; made the metadata line reader more resilient

## [0.4.1..0.4.3] - 2021-10-24
### Fixed
- updated some warning messages
- found that NP strips out hash symbols from note titles; this led to duplicate Review notes (later reported as #138 by @codedungeon)
- typo in default configuration that gets copied to _configuration

## [0.4.0] - 2021-09-10
### Added
- new command `/addProject` that adds a new note using your template 'New Project Template' (if defined)

### Changed
- under-the-hood change: the `/startReviews` and `nextReview` commands now use the (invisible) preferences system available from v3.1.0, rather than the (visible) `_reviews` note. _This requires NotePlan v3.1.0 (build 654) or greater._

## [0.3.0] - 2021-08-21
### Added
- new support for projects labelled `#cancelled` or `#someday` -- these are marked differently in the output lists
- new setting `displayArchivedProjects` which for the command `/projectLists` controls whether to display project notes marked `#archive`
### Changed
- update: changes the `noteTypeTags` setting to be an array of strings not a comma-separated string. E.g. `noteTypeTags: ["#area", "#project"]`

## [0.2.1..0.2.3] - 2021-08-01
### Added
- new command `/completeProject` that adds a `@completed(today)` date,
- new setting `foldersToIgnore` that allows an array of folder names to ignore in the commands

### Fixed
- contents of sub-folders were being duplicated in the lists
