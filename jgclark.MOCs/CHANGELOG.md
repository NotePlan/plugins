# What's Changed in 🕸 Map of Contents plugin?

## [0.2.0] - 13.6.2022
### Added
- new option 'Sort order for results', and now defaults to 'alphabetical', with other options 'createdDate' and 'updatedDate' [requested by @John1]
- new option 'Case insensitive searching?', which defaults to false [suggested by @John1]

### Changed
- now matches search terms on whole words, not parts of words
- now ignores matches in paths of [markdown links](path), as well as in file:/... and https://... URLs [suggested by @John1]

## [0.1.0] - 9.6.2022
Initial release with new command to create Maps of Content (MOCs) **/make MOC**. _I regard this as experimental feature, and I particularly welcome feedback on its usefulness._
