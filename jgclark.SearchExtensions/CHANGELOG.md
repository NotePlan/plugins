# What's Changed in 🔎 Search Extensions plugin?
(And see the full [README](https://github.com/NotePlan/plugins/tree/main/jgclark.SearchExtensions).)
<!-- Main description: Allows searches to be saved and re-run, to use more powerful search operators, and be done over specified time periods. -->

## [1.1.0-beta3] - 2022-12-13 <!-- [tell JPR1972, DW, as, kennonb] -->
### New
- where there's an existing search results note, and the search is re-run, other text that you add before or after the results section is retained. (For @JPR1972)
### Changed
- will now give a warning to the user if more than 20 open tasks in results would result in sync lines being created. (This only applies if you're using the 'NotePlan' output style.)
- removed the restriction that stopped you using 1- or 2-character search terms, now that you can opt to limit the number of search results returned
- is smarter about when a new split window to show the results is needed (but it's still limited by the API)

<!-- ### Fixed
// FIXME: suffixes causing sync line problems. -->

## [1.1.0-beta2] - 2022-12-12 (unreleased)
### Changed
- search prompt box now shows more of the syntax options you can use: "Enter search term(s) separated by spaces. (You can use + term, -term and !term as well.)"
### Fixed
- error when refreshing results for /searchOverCalendar

## [1.1.0-beta1] - 2022-11-24
### Added
- Adds a new 'Result set size limit' setting that limits very large search results, to prevent overwhelming the app, particularly on mobile devices.
### Changed
- The **/searchOpenTasks** command can now take search terms that are purely negative (e.g. "-@personX") (for @JPR1972)
- Search terms like 'twitter.com' (that contain a `.` character) are now treated as one term not two.

## [1.0.0] - 2022-11-17
### Changed
- **This is a major re-write, so read carefully!**
- simplified most command names from `saveSearch...` to just `search...`
### Added
- supports `+` and `-` search operators for terms that **must** appear, and **must not** appear, respectively.  For example `+must may could -cannot` has 4 search terms, the first must be present, the last mustn't be present, and the middle two (may, could) can be.  The test for + and - is done per line in notes. If you wish to ignore the whole note that has a term, you can use the ! operator, e.g. `+must !not-me`. (thanks @dwertheimer for this suggestion)
- when returning an open task in a result (when using the 'Noteplan' style of output) the task line will be a sync'd copy of the original, not a copy of it. This means checking it off in the results will complete it in the original location too. (This is necessary for the new /searchOpenTasks command.) (For @dwertheimer and @JPR1972).
- new **/searchOpenTasks** command, that takes advantage of this open task sync
- you can now refresh results in a single click, with the " [🔄 Refresh results for ...]" pseudo-button under the heading on each search page
- there are two result styles: normal 'NotePlan' styling, showing tasks, bullets and quotes, tweaked slightly for matching headings. Or 'Simplified' text, more like web search engine results.
- searches run over the new Weekly Notes as well
- `"multi word"` search phrases aren't supported by the underlying API, but instead they will be treated as `+multi +word`, which means a match will only happen if they are at least on the same line
- provides x-callback entry points for these searches, and provides options for restricting searches to certain types of line -- see the [README](https://github.com/NotePlan/plugins/tree/main/jgclark.SearchExtensions) for details.
- added an API call for this that also allows restricting search to one or more paragraph types (e.g. 'open' for incomplete tasks), through the last parameter on `runSearchV2(...)`.

<!-- ## [1.0.0-beta3] - 2022-11-14
### Changed
- simplified recent code changes to enable more to be tested again

## [1.0.0-beta2] - 2022-11-11
### Added
- new **/searchOpenTasks** command.
### Changed
- when returning an open task in a result (when using the 'Noteplan' style of output) the task line will be a sync'd copy of the original, not a copy of it. This means checking it off in the results will complete it in the original location too. (This is necessary for the new /searchOpenTasks command.) (For @dwertheimer and @JPR1972).
### Fixed
- fixed requested sort order getting ignored in some scenarios
- fixed highlight on consecutive matched words

## [1.0.0-beta1] - 2022-08-19
### Changed
- **This is a major re-write, so read carefully!**
- simplified most command names from `saveSearch*` to just `search*`
### Added
- Major new version, that now supports `+` and `-` search operators for terms that **must** appear, and **must not** appear, respectively.  For example `+must may could -cannot` has 4 search terms, the first must be present, the last mustn't be present, and the middle two (may, could) can be.  The test for + and - is done per line in notes. If you wish to ignore the whole note that has a term, you can use the ! operator, e.g. `+must !not-me`. (thanks @dwertheimer for this suggestion)
- you can now refresh results in a single click, with the " [🔄 Click to refresh results]" pseudo-button under the heading on each search page
- there are two result styles: normal 'NotePlan' styling, showing tasks, bullets and quotes, tweaked slightly for matching headings. Or 'Simplified' text, more like web search engine results.
- searches run over the new Weekly Notes as well
- `"multi word"` search phrases aren't supported by the underlying API, but instead they will be treated as `+multi +word`, which means a match will only happen if they are at least on the same line
- provides x-callback entry points for these searches, and provides options for restricting searches to certain types of line -- see the [README](https://github.com/NotePlan/plugins/tree/main/jgclark.SearchExtensions) for details.
- added an API call for this that also allows restricting search to one or more paragraph types (e.g. 'open' for incomplete tasks), through the last parameter on `runSearchV2(...)`.

<!-- 
### Todo
- [ ] tidy up display in special case of matching H1
- [ ] go through TODOs in searchHelpers.js
- [ ] go through TODOs in saveSearch.js
- [ ] go through TODOs in saveSearchPeriod.js
-->

## [0.4.1] - 2022-07-11
### Added
- new command **/quickSearch** which searches over all notes and shows the results in a fixed results note, whose title is given by new setting '/quickSearch note title' (default: `Quick Search Results`)
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

## [0.1.1..0.1.2] - 2022-07-05
### Added
- added /saveSearchOverNotes command
- added /saveSearchOverCalendar command
### Fixed
- fixed problem with /saveSearchOverNotes command

## [0.1.0] - 2022-07-02
First release, with commands from earlier Summaries plugin.
### Changes
- speeded up the **/saveSearchResults** and **/saveSearchResultsInPeriod** commands significantly. (Under the hood the plugin now uses an API that takes advantage of caching.)
- now trims the display of matching results in search output, but still highlights the matched terms

