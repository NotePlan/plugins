# What's Changed in 🔎 Search Extensions plugin?
(And see the full [README](https://github.com/NotePlan/plugins/tree/main/jgclark.SearchExtensions).)
<!-- Main description: Allows searches to be saved and re-run, to use more powerful search operators, and be done over specified time periods. -->

## [1.0.0-beta2] - 2022-09-07
### Changed
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

___Your feedback is most welcome!___

<!-- 
### Todo
- [ ] tidy up display in special case of matching H1
- [ ] go through TODOs in searchHelpers.js
- [ ] go through TODOs in saveSearch.js
- [ ] go through TODOs in saveSearchPeriod.js
- [x] why ""{\"noteFilename\":\"20210519.md\",\"line\":\"- KD #picture big tap but dripping one drop at a time. Arrow pointing to tap, showing it's not turned on far at all. -> openness to Holy Spirit\"}",` getting output as an empty bullet?
-->

<!--
## Notes on earlier private 0.5.0-beta series
**Notes for beta7** (2022-08-19):
- [x] simplify command names from `saveSearch*` to just `search*`
- [x] resolve API question about `multi word` search phrases -> not supported in API
  - [x] update README to reflect NP not supporting search phrases directly
  - [x] modify code to change `"multi word"` search phrases to `+multi +word` instead
- [x] make rendering smarter by not adding ==...== around existing ==...== (for @dwertheimer)
- [-] move some searchHelper functions to helpers/search

**Notes for beta6** (2022-08-08):
- [-] check edge case of hit in URL (e.g. [callback] in note 2022-02-70) -- failed to find cause
- [x] fix [release] finding an '(error)' title note (actually: 20210830)
- [x] decide whether to support showEmptyResults option still
- [x] fix [callback] case: end may 32/20, then end not 29/20, when no not term?
- [x] check to see if notInFolder param is working
- [x] update doc to reflect NP not supporting search phrases
- [x] tested /saveSearchCalendar
  - [x] can use button to repeat same note
  - [x] can use noteType parameter
  - [x] can cope with nil results
- [x] tested /saveSearchInPeriod
  - [x] new param on writeResults()
  - [x] filtering dates out OK
  - [x] will write sensible reduced title that can be re-used
  - [x] can use button to repeat same note
  - [x] can use noteType parameter(s)
  - [x] can cope with nil results
- [x] go through FIXMEs in searchHelpers.js
- [x] go through FIXMEs in saveSearch.js
- [x] go through FIXMEs in saveSearchPeriod.js

**Notes for beta5** (2022-08-06):
- [x] rewrite to use de-normalised main data structure part (noteAndLine vs noteAndLines)
- [x] fix when results are only found in 1 note
- [x] actually use the new simplifyRawContent() function, not just test it!
- [x] update plugin.json function parameters
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

**Notes for beta4** (2022-07-30):
- [x] NP-style always start with the leading markdown
- [x] blockIDs are now removed via new simplifyRawContent() function
- [x] trimAndHighlightTermInLine() now supports multiple search terms

**Notes for beta3** (2022-07-26):
- still only really tested the /quickSearch command so far, but carried over most new logic to /saveSearchPeriod too
- added a "Style for search results" setting. This chooses the style to use:
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

