# What's changed in 🔁 Repeat Extensions plugin?

## [unreleased]
- just moving code around

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
