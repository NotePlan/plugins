# m1well.Expenses Plugin Changelog

## [1.5.1] - 2022-01-04 (@m1well)
### Fixed
- corrected [plugin.json](./plugin.json) according to the official documentation  
  [https://help.noteplan.co/article/67-create-command-bar-plugins](https://help.noteplan.co/article/67-create-command-bar-plugins)

## [1.5.0] - 2022-01-01 (@m1well)
### Fixed
- error calculating the current month in fixed tracking
### Changed
- note processing (depend on note object, not on editor object)
- add multiple lines at once on fixed tracking and aggregation

## [1.4.0] - 2021-12-15 (@m1well)
### Changed
- configurable amount format (`full` with always 2 fraction digits or `short` with no fraction digits and always rounded)

## [1.3.0] - 2021-12-09 (@m1well) (some ideas from @dwertheimer)
because of breaking changes, normally this should give a new major version.  
but because I assume that no one has yet installed this plugin, a minor version would be ok
### Changed
- config: added configurable delimiter
- config: added configurable date format
- config: added configurable column order
- config: changed shortcuts from string to object datastructure
- tracking: added some more checks (if category is configured and amount is "ok")
- commands: added 3 new commands for individual tracking, shortcuts tracking and fixed tracking
- aggratation: changed whole aggregation because of new date and column order
- tests: added tests

## [1.2.0] - 2021-12-06 (@m1well)
### Changed
- trim input from user for the text @individual tracking

## [1.1.0] - 2021-12-03 (@m1well)
### Changed
- changed exception handling for aggregation quality check
- moved tests to new [folder](./__tests__)
- changed wordings: 'fixExpenses' to 'fixedExpenses' and 'cluster' to 'category'

## [1.0.0] - 2021-11-24 (@m1well)
### Added
- initial releaase
