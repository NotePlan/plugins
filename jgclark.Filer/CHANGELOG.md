# Changelog
## [Unreleased]
### Added
- fix: /fp and /mp now create the destination daily note if it doesn't already exist

## [0.5.1] - 3.10.2021
### Fixed
- moving to the special '(bottom of note)' pseudo-heading

## [0.5.0] - 29.8.2021
### Added
- the setting `addDateBacklink` can now be specified in the (new) `Filer` section in your _configuration note. The default for this is still `true`.
### Changed
- minor improvement to the heading selection dialog

# [0.4.3] - 29.7.2021
### Changed
- will prepend at a smarter point (i.e. after any frontmatter or metadata lines)

## [0.4.2] - 27.7.2021
### Changed
- minor improvement to folder list display

## [0.4.1] - 5.7.2021
### Fixed
- fixes to /nns (not working with subfolders)
### Changed
- update README

## [0.4.0] - 15.6.2021 (@dwertheimer)
### Added
- `/nns` (new note from selection) moved from NoteHelpers

## [0.3.3] - 11.6.2021
### Added
- add `/mp` (move) as an alias to `/fp` (file)
- removed restriction to move to just project notes
### Changed
- update code to work with today's API fixes
- bug fixes and additions to README

## [0.3.0] - 31.5.2021
### Added
- can now move any indented paragraphs after the selected line
- creates a `>date` backlink when moving from a calendar note (requested by @Dimitry). Can be turned off by the `pref_addDateBacklink` setting (see above).

## [0.2.2] - 26.5.2021
### Added
- add ability to move paragraphs to top or bottom of note. (Top of note comes after title if there is one.)
- now works when moving to notes with _no title or headings at all_ [Issue 10 by @dwertheimer ]

## [0.2.0] - 25.5.2021
### Added
- first release
