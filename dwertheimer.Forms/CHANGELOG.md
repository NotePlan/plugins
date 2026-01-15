# dwertheimer.Forms Changelog

## About dwertheimer.Forms Plugin

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/dwertheimer.Forms/README.md) for details on available commands and use case.

## [1.0.11] 2026-01-17 @dwertheimer

### Added
- **Multi-select NoteChooser**: Added ability to select multiple notes in a note-chooser field with configurable output format (wikilink, pretty-link, raw-url) and separator (space, comma, newline)
- **Calendar Picker Button Control**: Added setting in FieldEditor to control visibility of calendar picker button in note-chooser fields
- **Form Tester Examples**: Added multi-select note chooser examples to Form Tester with different output formats and separators
- **Calendar Picker Date Format Setting**: Added configurable output format for calendarpicker fields using moment.js formatting:
  - Default format is ISO 8601 (YYYY-MM-DD) instead of returning Date object
  - Choose from 30+ date format options (US format, European format, long format, date & time, etc.)
  - Use `[Object]` option to return Date object for backward compatibility
  - Formatting applies when selecting from calendar picker or typing directly in the input field
  - Supports locale-aware formatting using moment-with-locales based on NotePlan environment settings

### Fixed
- Fixed calendar picker button showing when "Include Calendar Notes" is disabled - now only shows when calendar notes are included (or explicitly enabled via setting)
- Fixed multi-select NoteChooser not rendering correctly - now properly detects `allowMultiSelect` prop and renders ContainedMultiSelectChooser instead of dropdown
- Fixed syntax error in NoteChooser.jsx that prevented Rollup from building (replaced Flow type guard with explicit array building)

### Changed
- **NoteChooser**: Calendar picker button now respects "Include Calendar Notes" setting by default - only appears when calendar notes are included
- **FieldEditor**: Added "Show Calendar Picker Button" checkbox in note-chooser field editor for explicit control
- **NoteChooser**: Multi-select mode uses ContainedMultiSelectChooser component with checkboxes for better UX
- **CalendarPicker**: Default behavior changed from returning Date object to returning ISO 8601 formatted string (YYYY-MM-DD) - use `dateFormat: '__object__'` to return Date object
- **CalendarPicker**: Dates typed directly in the input field are now parsed and formatted according to the selected dateFormat option

## [1.0.10] 2026-01-14 @dwertheimer

### Added
- **Comprehensive Tailwind CSS color palette support**: Added full Tailwind color mapping (gray, red, orange, yellow, green, blue, indigo, purple, pink with shades 50-950) to `helpers/colors.js`
- **Color support for chooser icons and descriptions**: NoteChooser and SpaceChooser now display colored icons and short descriptions matching `chooseNoteV2` behavior
- **New `getColorStyle()` helper function**: Centralized color conversion utility that handles CSS variables, Tailwind color names, and direct hex/rgb colors with proper fallbacks

### Fixed
- Fixed empty label showing "?" in read-only text elements (now shows empty string)
- Fixed SpaceChooser using incorrect icons - now uses `fa-regular fa-cube` for teamspaces and `fa-solid fa-user` for private (matching Dashboard, Filer, NoteHelpers)
- Fixed teamspace colors appearing gray - now correctly displays green using `--teamspace-color` CSS variable with proper fallback
- Fixed default comment field not appearing when creating a new form - now explicitly passes `isNewForm: true` to FormBuilder (works for both command bar and FormBrowserView creation)
- Fixed NoteChooser calendar picker displaying filename (e.g., "20260117.md") instead of ISO date format (e.g., "2026-01-17") - now displays ISO 8601 format (YYYY-MM-DD) in the field

### Changed
- **SpaceChooser**: Updated to use proper Font Awesome icon classes (`TEAMSPACE_FA_ICON`, `PRIVATE_FA_ICON`) instead of generic icon names
- **Color system**: All Tailwind color names (e.g., `gray-500`, `blue-500`, `orange-500`, `green-700`) now automatically convert to their hex values via comprehensive palette mapping
- **Special color mappings**: `green-700` and `green-800` prefer `--teamspace-color` CSS variable when available, with Tailwind hex fallback
- **SearchableChooser**: Hide short description when it's identical to the label text to avoid redundant display

## [1.0.9] 2026-01-13 @dwertheimer

### Added
- Auto-focus first field when form opens for faster data entry
- Enter key reopens dropdown when closed (allows changing selection after initial choice)
- Tab key closes dropdown and moves to next field when dropdown is open
- ResizeObserver for portal dropdown positioning to handle dynamic form height changes

### Fixed
- Fixed click selection not working after programmatic refocus (dropdown was reopening immediately)
- Fixed tab navigation blocked when dropdown is open
- Fixed portal dropdown position when form layout shifts due to async data loading
- Fixed ContainedMultiSelectChooser preventing "is:checked" from being saved as a value
- Fixed bottom element clipping in scrolling dialogs (added extra padding)

### Changed
- Improved ContainedMultiSelectChooser header: narrower filter field (40% reduction), icon-only buttons (All/None/Filter/New)
- Refactored template-form CSS to use nested namespace selectors for better maintainability
- Improved compact mode label alignment using CSS variables for customizable widths

## [1.0.8] 2026-01-12 @dwertheimer

### Fixed
- Fixed calendar picker showing incorrectly in Processing Template note chooser - now suppressed via `showCalendarChooserIcon={false}`
- Fixed "Open" button not working after creating a new processing template - now reloads notes and retries if note not immediately found
- Fixed infinite loop crash when saving forms - prevented recursive updates when saving processing templates that have their own `receivingTemplateTitle`
- Fixed Processing Template note chooser showing empty - added `includeTemplatesAndForms={true}` to allow notes from `@Forms` and `@Templates` folders to be displayed
- Fixed Processing Template note chooser filtering too aggressively - now accepts both `forms-processor` and `template-runner` types using array syntax, and searches across all folders (not just @Forms)
- Improved Processing Template note chooser display - now shows note title on line 1 and folder path on line 2 for better readability in small fields (via `shortDescriptionOnLine2={true}`)

### Changed
- **NoteChooser**: Enhanced `filterByType` prop to accept either a single string or an array of strings, allowing filtering by multiple frontmatter types (e.g., `filterByType={['forms-processor', 'template-runner']}`)

## [1.0.7] 2026-01-11 @dwertheimer

### Fixed
- **CRITICAL**: Fixed potential request timeout issues by removing outdated local copy of `routerUtils.js` and switching to shared version from `@helpers/react/routerUtils`
- All three routers (`formBrowserRouter`, `formBuilderRouter`, `formSubmitRouter`) now use the shared router utilities with proper `pluginJson` parameter
- This prevents silent failures when sending responses back to React components and improves error logging

## [1.0.6] 2025-12-19 @dwertheimer

- UI improvements for template tag editor:
  - Moved +Field and +Date buttons to the left side of the editor
  - Moved "Show RAW template code" toggle switch to the right side
  - Double-click any pill (tag or text) to switch to RAW mode

## [1.0.5] 2025-12-19 @dwertheimer

- Add `folder-chooser` field type: Select folders from a searchable dropdown with smart path truncation (shows beginning and end of long paths with "..." in the middle)
- Add `note-chooser` field type: Select notes from a searchable dropdown with smart text truncation
- Both chooser types include intelligent truncation that preserves the start and end of long paths/titles for better readability

## [1.0.4] 2025-12-18 @dwertheimer

- Add Form Builder

## [1.0.3] 2025-12-18 @dwertheimer

- Add readme with basic instructions

## [1.0.2] 2025-03-06 @dwertheimer

- Add validation for reserved fields (will log a warning if a reserved field is used)
- Add validation for receivingTemplateTitle in template frontmatter

## [1.0.1] 2025-03-06 @dwertheimer

- Workaround for frontmatter UI and CSV strings

## Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Plugin Versioning Uses Semver

All NotePlan plugins follow `semver` versioning. For details, please refer to [semver website](https://semver.org/)
