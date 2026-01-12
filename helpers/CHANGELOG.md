# NotePlan Plugin Helpers Changelog

### Plugin Versioning Uses Semver
All NotePlan plugins follow `semver` versioning. For details, please refer to [semver website](https://semver.org/)

### About NotePlan Plugin Helpers
See NotePlan Plugin Helpers [README](https://github.com/NotePlan/plugins/blob/main/helpers/README.md) for details on available commands and use case.

## [Unreleased] - 2026-01-12 @dwertheimer

### Fixed
- **SearchableChooser.jsx**: Fixed portal positioning when dropdown is inside a scrollable parent container - now listens for scroll events on all scrollable parent elements, not just window scroll. This fixes dropdowns appearing at incorrect positions when the parent container is scrolled.
- **NPFrontMatter.js**: Fixed `updateFrontMatterVars()` to remove empty frontmatter blocks when the last field is deleted. Previously, when deleting the last frontmatter field (e.g., `favorite: true`), the function would remove the field but leave the empty frontmatter delimiters (`---\n---`) at the top of the note. Now it properly detects when no fields remain and removes the entire frontmatter block including the separators.

### Changed
- **NoteChooser.jsx**: Enhanced `filterByType` prop to accept either a single string or an array of strings, allowing filtering by multiple frontmatter types (e.g., `filterByType={['forms-processor', 'template-runner']}`)

## [0.0.4] - 2022-02-03 (mikeerickson)

- Renamed `configuration.js` to `NPConfiguration.js` to properly align with naming conventions

## [0.0.3] - 2022-02-03 (mikeerickson)

- Removed async `configuration :: updateSettingsData

## [0.0.2] - 2022-02-03 (mikeerickson)

- Added `configuration :: updateSettingsData
- Updated `configuration :: migrateConfiguration

## [0.0.1] - 2022-02-01 (mikeerickson)

- Added `configuration :: migrateConfiguration

## Changelog
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
