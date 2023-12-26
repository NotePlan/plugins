# What's Changed in 🔎 Search Extensions plugin?
(And see the full [README](https://github.com/NotePlan/plugins/tree/main/jgclark.SearchExtensions).)
<!-- Main description: Allows searches to be saved and re-run, to use more powerful search operators, and be done over specified time periods. -->

## [1.3.0] - 2023-12-26
- Adds ability to **automatically refresh** a saved search when opening its note. To enable this, run "/add trigger" on the saved search note, and select "🔎 Search Extensions: 'refreshSavedSearch'" from the list.  To turn this off again, just remove the line starting `triggers: onOpen` from the frontmatter.
- Adds **wildcard operators `*` and `?`** in search terms. These match any number of characters (including none) and just 1 character respectively within a word. For example, `pos*e` matches "possible", "posie" and "pose"; `poli?e` matches "polite" and "police".
- Speeded up searches that have multiple terms (particularly 'must-find' terms)
- Now places the date and time of the search, and the Refresh 'button' under the section heading, not above it. This makes better sense for the auto-refresh (above).
- Now clarified that searches do include the special Archive and Templates folders, unless you exclude them using the 'Folders to exclude' setting.

## [1.2.4] - 2023-10-04
### Changes
- the /flexiSearch dialog box simplified with a new tooltip help, and better validation checks
- the /flexiSearch dialog box now renders OK on iOS
- removed the 'Cancel' button as it doesn't work on iOS/iPadOS, and on macOS you can use the standard red 'traffic-light' button instead.

## [1.2.3] - 2023-10-02
- change to allow /quickSearch to be started from x-callback  but still ask user for search terms (for @dwertheimer)

## [1.2.2] - 2023-09-01
- ability to run FlexiSearch without closing the Dashboard and Project list windows from other plugins (requires NP v3.9.6.)

## [1.2.1] - 2023-07-14
- add 'Click to refresh' button when appending to current note (for @dvcrn)
- fix bug in /searchInPeriod when run from x-callback with date parameters

## [1.2.0] - 2023-07-01
### Added
- searching for exact multi-word phrases such as `"Bob Smith"` is now possible, and much quicker than the previous approximately-multi-word searching
- new iOS Settings editor command "/Search: update plugin settings"
### Changed
- clarified that '/searchResultsInPeriod' only returns results from calendar notes in the right time period

## [1.1.1] - 2023-06-30
- (really this is the 1.1.0 release, but I'm forced to call it 1.1.1)

## [1.1.0-beta10] - 2023-06-02
- added **/flexiSearch** command, with automatic saving of options between subsequent searches.
- allows an empty search term, which might be useful in flexiSearch to find all open tasks. It asks for confirmation first, as this might be a lengthy operation.
- if the search has no results, it now just brings up a dialog and doesn't write to a note
- should now only open a new split view for results when the results aren't already open in a split view

## [1.1.0-beta9] - 2023-05-17
- fix to allow searching with Unicode characters (thanks to the report by @haris_sav and initial diagnosis by @dwertheimer)

## [1.1.0-beta8] - 2023-02-17
- fix to scheduled items getting synced in /searchOpenTasks results, released again to go with NP v3.8.1 build 973.

## [1.1.0-beta7] - 2023-01-25
- where there are multiple copies of a line because they have been sync'd together, only one will now be shown. This will be the one in the most recently-edited note. (for @Stacey with help by @dwertheimer)
- fix to scheduled items getting synced in /searchOpenTasks results (thanks for tip by @JaredOS); but this will need a new build of NP as well.

## [1.1.0-beta6] - 2023-01-18
- fix to typo stopping refresh on /search results (thanks for tip by @DWREK)
- include new checklist open and scheduled types in /searchOpen results (thanks for tip by @KevinOBrien)

## [1.1.0-beta5] - 2022-12-23
### Changed
- the `!` character is now allowed as a search term, or in a search term, to allow for searching for `!`, `!!`, `!!!` as priority indicators.
- now allows highlighting results in 'NotePlan' style, _where the line isn't a "Synced Line"._

### Fixed
- in /searchOpenTasks sometimes "Synced Line" markers weren't carried into the results
- in /searchInPeriod the results limit was being applied too early, dropping possible results before the date check

## [1.1.0-beta3] - 2022-12-13
### New
- where there's an existing search results note, and the search is re-run, other text that you add before or after the results section is retained. (For @JPR1972)
-
### Changed
- will now give a warning to the user if more than 20 open tasks in results would result in Synced Lines being created. (This only applies if you're using the 'NotePlan' output style.)
- removed the restriction that stopped you using 1- or 2-character search terms, now that you can opt to limit the number of search results returned
- is smarter about when a new split window to show the results is needed (but it's still limited by the API)

## [1.1.0-beta2] - 2022-12-12 (unreleased)
### Changed
- search prompt box now shows more of the syntax options you can use
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

