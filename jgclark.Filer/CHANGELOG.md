# What's changed in 📦 Filer plugin?
## [0.6.0] - 2022-01-???
### Added
- add ability to default to moving to the end of a heading's section, not the start of it, using setting `whereToAddInSection`.
<!--
- ??? /fp and /mp now create the destination daily note if it doesn't already exist
- ??? add ability to default to moving to the end of a heading's section, not the start of it. See setting
- [when environment() API call is available] ??? will use system locale in dates, where possible
- ???. Also refactored code to allow re-use of my paragraph block finding code.
-->


## [0.5.1] - 2021-10-03
### Fixed
- moving to the special '(bottom of note)' pseudo-heading

## [0.5.0] - 2021-08-29
### Added
- the setting `addDateBacklink` can now be specified in the (new) `Filer` section in your _configuration note. The default for this is still `true`.
- `/nns` (new note from selection) moved from NoteHelpers

### Changed
- minor improvement to the heading selection dialog

## [0.4.0..0.4.3] - 2021-07-29
### Changed
- will prepend at a smarter point (i.e. after any frontmatter or metadata lines)
- minor improvement to folder list display
- update README

### Fixed
- fixes to /nns (not working with subfolders)

## [0.3.0..0.3.3] - 2021-06-11
### Added
- add `/mp` (move) as an alias to `/fp` (file)
- removed restriction to move to just project notes
- can now move any indented paragraphs after the selected line
- creates a `>date` backlink when moving from a calendar note (requested by @Dimitry). Can be turned off by the `pref_addDateBacklink` setting (see above).
### Changed
- update code to work with today's API fixes
- bug fixes and additions to README

## [0.2.0..0.2.2] - 2021-05-26
### Added
- add ability to move paragraphs to top or bottom of note. (Top of note comes after title if there is one.)
- now works when moving to notes with _no title or headings at all_ [Issue 10 by @dwertheimer ]
- first release
