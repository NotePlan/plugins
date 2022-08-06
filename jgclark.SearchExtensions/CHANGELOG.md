# What's Changed in 🔎 Search Extensions plugin?
(And see the full [README](https://github.com/NotePlan/plugins/tree/main/jgclark.SearchExtensions).)
<!-- 
- searches now run over Weekly Notes as well (now the underlying API has been extended)
-->

## [0.5.0] - 2022-08-???
### Added
- Major new version, that now supports + and - search operators for terms that _must_ appear, and _must not_ appear, respectively.  For example `+"must have me" may could -"cannot have me"` has 4 search terms, the first must be present, the last mustn't be present, and the middle two (may, could) can be.
- you can now refresh results in a single click, with the 'button link' under the heading on each search page
- the test for + and - is done per line in notes. If you wish to ignore the whole note that has a term, you can use the ! operator, e.g. `+must !not-me`. (thanks @dwertheimer for this suggestion)
- provides x-callback entry points for these searches -- see README for details.
- added an API call for this that also allows restricting search to one or more paragraph types (e.g. 'open' for incomplete tasks), through the last parameter on `runSearchV2(...)`.

**Notes for beta5** (2022-08-06):
- [x] rewrite to use de-normalised main data structure part (noteAndLine vs noteAndLines)
- [x] fix when results are only found in 1 note
- [x] actually use the new simplifyRawContent() function, not just test it!
- [x] tested /quickSearch
  - [x] basic user command
  - [x] can use button to repeat to same note
  - [x] can use single noteType parameter
  - [x] can use multiple noteType parameters
  - [x] can cope with nil results
- [x] tested /saveSearch
  - [x] basic user command
  - [x] writing to correct note title
  - [x] can use button to repeat same note
  - [x] can cope with nil results
  - [x] can use noteType parameter/s
- [x] tested /saveSearchNotes
  - [x] writing to correct note title
  - [x] can use button to repeat same note
  - [x] can cope with nil results
  - [x] can use noteType parameter/s
- [ ] tested /saveSearchInPeriod
  - [ ] can use button to repeat same note
    - [ ] new param on writeResults()?
    - [ ] destination changes to Quick
  - [ ] can use noteType parameter
  - [ ] can cope with nil results
- [ ] tested /saveSearchCalendar
  - [ ] can use button to repeat same note
  - [ ] can use noteType parameter
  - [ ] can cope with nil results
- [ ] check [callback] empty result for note 20220270
- [ ] check [release] finding an '(error)' title note (actually: 20210830)
- [ ] check to see if notInFolder param is working

**Notes for beta4** (2022-07-30):
- [x] NP-style always start with the leading markdown
- [x] blockIDs are now removed via new simplifyRawContent() function
- [x] trimAndHighlightTermInLine() now supports multiple search terms

**Notes for beta3** (2022-07-26):
- still only really tested the /quickSearch command so far, but carried over most new logic to /saveSearchPeriod too
- - added a "Style for search results" setting. This chooses the style to use:
  - Normal "NotePlan" styling, tweaked slightly for matching headings
  - Use "Simplified" text (like Google results)
- added support for un-grouped results (a simple list with appended date context or title)
- added support for highlighting search terms
 
**Notes for beta2** (2022-07-23):
- fixed ordering of result lines within a note
- added support for search strings using older `x AND y AND z` or `x OR y OR z` or `x, y, z` styles. (Note: you can't mix AND and OR style, as it's hard to then be clear what the right logic is. The newer syntax is clearer.)
- added support for `"multi word search terms"` -- though I now discover that NotePlan might not support this :-(

**Notes for beta1** (2022-07-22):
- I've only really tested the /quickSearch command so far

**Still TODO:**:
- finish test for applySearchOperators
- resolve API question about multi-word search phrases
- support `"multi-word terms"`
- decide whether to support case insensitivity option still
- decide whether to support showEmptyResults option still, or just turn on?
- hook up x-callback for calendar-only searching
- properly test x-callbacks
- update plugin.json function parameters
- update README
- shift some functions and tests to helpers/search.
- tidy up display in special case of matching H1

___your feedback is most welcome!___

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

## [0.1.1..0.1.2] - 2022-07-05
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
