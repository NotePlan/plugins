# What's Changed in 🔎 Search Extensions plugin?
(And see the full [README](https://github.com/NotePlan/plugins/tree/main/jgclark.SearchExtensions).)
<!-- 
- searches now run over Weekly Notes as well (now the underlying API has been extended)
-->

## [0.5.0] - 2022-07-22
### Added
- Major new version, that now supports + and - search operators for terms that must appear, and cannot appear, respectively.  For example `+"must have me" may could -"cannot have me"` has 4 search terms, the first must be present, the last mustn't be present, and the middle two (may, could) can be.
- the test for + and - is done per line in notes
- adds a button under the heading to 'refresh results'

**NB**:
- I've only really tested the /quickSearch command so far
- TODO: support `"multi-word terms"`
- TODO: support ! operator as well (defeat a whole note if a 'cannot' term appears in it)
- TODO: decide whether to support case insensitivity option still
- TODO: hook up x-callback for calendar-only searching
- ___your feedback is most welcome!___


## [0.4.1] - 2022-07-11
### Added
- new command **/quickSearch** which searches over all notes and shows the results in a fixed results note, whose title is given by new setting '/quickSearch note title' (default: Quick Search Results)
### Changed
- much speedier searches, now it can take advantage of NotePlan improvements in build 813+
### Fixed
- The opening in split window now works reliably (thanks to @dwertheimer)

## [0.3.0] - 2022-07-08
### Added
- new setting 'Automatically save' when turned on automatically decides the name of the note to save the search results to (based on the search term), which avoids the final prompt. (for @dwertheimer)

## [0.2.0] - 2022-07-05
### Added
- the **order** of results can now be set: by title, created date, or changed date of the note the result is found in. This can be changed in the Settings.

## [0.1.2..0.1.1] - 2022-07-05
### Added
- added /saveSearchOverNotes command
- added /saveSearchOverCalendar command
### Fixed
- fixed problem with /saveSearchOverNotes command

## [0.1.0] - 2022-07-02
First release, with commands from earlier Summaries plugin.
### Changes
- speeded up the **/saveSearchResults** **/saveSearchResultsInPeriod** commands significantly. (Under the hood the plugin now uses an API that takes advantage of caching.)
- now trims the display of matching results in search output, but still highlights the matched terms
