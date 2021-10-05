# What's Changed in 🔢 np.Statistics plugin?

## [0.4.0] - 4.10.2021
### Changed
- `/nc` (note counts) now shows Templates as a separate category, separate from Project Notes
- `/tsp` (task stats for all projects) now ignores Templates

## [0.3.6] - 16.8.2021
### Changed
- re-compiled for macOS versions back to 10.13.0.

## [0.3.5] - 1.8.2021
### Fixed
- list today's events broke after a config framework change

## [0.3.4] - 28.7.2021
### Fixed
- edge case of zero tasks → NaN

## [0.3.3] - 2.7.2021
### Changed
- tweaks to display; large numbers will now display using local settings for thousands separators

## [0.3.2] - 29.6.2021
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
