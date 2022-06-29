# What's Changed in 🔎 Search Extensions plugin?
(And see the full [README](https://github.com/NotePlan/plugins/tree/main/jgclark.SearchExtensions).)

## [0.1.0] - 2022-06-27 (@@@ unreleased)
First release, with commands from earlier Summaries plugin.
### Changes
- speeded up the **/saveSearchResults** **/saveSearchResultsInPeriod** commands significantly. (Under the hood the plugin now uses an API that takes advantage of caching.)
- now trims the display of matching results in search output, but still highlights the matched terms
