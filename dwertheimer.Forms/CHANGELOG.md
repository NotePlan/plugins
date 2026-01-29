# dwertheimer.Forms Changelog

## About dwertheimer.Forms Plugin

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/dwertheimer.Forms/README.md) for details on available commands and use case.

## [1.0.23] 2026-01-27 @dwertheimer

### Changed
- **Simplified form submission response handling**: `handleSubmitButtonClick` and related functions now return only the necessary information (`success`, `formSubmissionError`, `aiAnalysisResult`) instead of the full `reactWindowData` object. This simplifies the code and avoids unnecessary data passing. The window only needs to know what happened, not all the window data.

### Edited in this release
- `dwertheimer.Forms/src/formSubmission.js` — Simplified `handleSubmitButtonClick` and processing functions to return `{ success: boolean, formSubmissionError?: string, aiAnalysisResult?: string }` instead of full `PassedData`. Removed unnecessary `withPluginDataUpdates` usage.
- `dwertheimer.Forms/src/formSubmitHandlers.js` — Updated to handle simplified return type from `handleSubmitButtonClick`.
- `dwertheimer.Forms/src/formBrowserHandlers.js` — Updated to handle simplified return type from `handleSubmitButtonClick`.

## [1.0.22] 2026-01-27 @dwertheimer

### Changed
- **ValueInsertButtons use shared constants**: The +Color, +Icon, +Pattern, and +IconStyle insert buttons (ValueInsertButtons) now import `PATTERNS`, `ICON_STYLES`, and `FA_ICON_NAMES` from `@helpers/react/DynamicDialog/valueInsertData`, so they use the same options as the color/icon/pattern/icon-style choosers in the Form Builder.

### Edited in this release
- `dwertheimer.Forms/src/components/ValueInsertButtons.jsx` — Replaced inline PATTERNS, ICON_STYLES, FA_ICON_NAMES with imports from valueInsertData.

## [1.0.21] 2026-01-27 @dwertheimer

### Fixed
- **Conditional-values excluded from form until submit**: Fields with type `conditional-values` (e.g. `bgColor` derived from a button-group) are no longer added to form state, autosave, or the submit payload until the backend runs `resolveConditionalValuesFields` in `prepareFormValuesForRendering`. Previously they appeared with empty values in the form and autosave.
- **Button-group default applied on open and submit**: When a form field has type `button-group` and an option with `isDefault: true`, that option's value is now used as the initial value when the form opens and when building the submit payload, so the source field (e.g. `theType`) is set correctly and conditional-values (e.g. `bgColor`) resolve as intended.

### Edited in this release
- `dwertheimer.Forms/src/formSubmission.js` — `ensureAllFormFieldsExist` and `handleSubmitButtonClick` skip conditional-values when adding missing fields.
- `dwertheimer.Forms/src/formBrowserHandlers.js` — `handleSubmitForm` skips conditional-values when adding missing fields.
- `helpers/react/DynamicDialog/DynamicDialog.jsx` — `getInitialItemStateObject`, "ensure all fields" effect, and `handleSave` skip conditional-values and apply button-group `isDefault` when initializing or filling missing keys.

## [1.0.20] 2026-01-26 @dwertheimer

### Fixed
- **DynamicDialog Switch compact mode**: Switch type now renders correctly in compact mode. Label is on the left and the switch on the right, matching other compactDisplay elements (InputBox, button-group, calendarpicker). Uses `input-box-container-compact` wrapper; Switch’s internal label is hidden via CSS when compact.

## [1.0.19] 2026-01-26 @dwertheimer

### Fixed
- **Create-new folder override**: When creating a new note, a form field named `folder` now overrides any folder value from the form definition (newNoteFolder, template frontmatter, etc.) when passing data to templateRunner. Empty form `folder` is ignored; form definition is used as fallback.

### Changed
- **ProcessingMethodSection**: Folder field help text now states that a form field named `folder` is used to set the folder for the new note.

## [1.0.18] 2026-01-25 @dwertheimer

### Fixed
- **Form Field Focus Styles**: Updated all form field focus styles to use `--tint-color` with a heavier 2px border stroke for better visibility:
  - Input boxes, dropdowns, textareas, date pickers, and all chooser components now show a prominent `--tint-color` border when focused
  - Added consistent box-shadow glow effect for all focused fields
  - Fixed SearchableChooser focus styles to properly override base border styles using `!important` flags
- **SearchableChooser Loading State**: Fixed multiple issues with SearchableChooser when fields are loading data:
  - **Loading Spinner**: Added FontAwesome spinner icon (`fa-spinner fa-spin`) that appears in the input field when loading. Spinner is properly centered vertically and positioned on the right side of the input.
  - **Auto-Open Prevention**: Fixed issue where dropdown would auto-open when field received focus but items were still loading, showing "No Options Available" instead of loading state. Dropdown now only opens automatically when items have finished loading.
  - **Placeholder Management**: Fixed placeholder to show "Loading Values..." from initial render when loading is needed, preventing visual flip from "Type to search values..." to "Loading Values...".
  - **Focus Management**: Fixed focus behavior so that when the first field finishes loading, focus automatically moves back to it if focus was previously set on a later field (e.g., 3rd field) while the first field was loading.
  - **Empty State Blank Line**: Fixed issue where a blank, clickable line appeared in the dropdown when showing "No Options Available". Removed validation-message-placeholder div from dropdown options and made empty state non-clickable.
  - **Loading State Propagation**: Added `isLoading` prop support to `DropdownSelectChooser` and `ContainedMultiSelectChooser` to properly show loading state in all chooser variants.
- **FrontmatterKeyChooser Loading Initialization**: Fixed loading state initialization to start as `true` when a frontmatterKey is provided, ensuring "Loading Values..." placeholder appears immediately instead of showing normal placeholder first.
- **SearchableChooser Color Override**: Fixed issue where inline color styles were overriding the default CSS color (`var(--fg-main-color, #4c4f69)`) even when `optionColor` was `null`, `undefined`, or the default `'gray-500'` value. Now only applies inline color styles when an explicit non-default color is provided, allowing the CSS default to be used otherwise.

### Changed
- **SearchableChooser Loading UX**: Improved loading experience by showing spinner icon and wait cursor, preventing dropdown from opening prematurely, and ensuring proper focus management when loading completes.
- **EventChooser Icon**: Updated EventChooser dropdown icon from `fa-calendar` to `fa-solid fa-calendar-alt` for a more specific calendar-related icon that better represents event selection.
- **SearchableChooser CSS Improvements**: 
  - Fixed loading spinner vertical centering (changed from `top: 56%` to `top: 50%` with proper transform)
  - Improved spinner sizing to match arrow icon size (0.75rem) with proper line-height and height constraints
  - Fixed dropdown portal spacing issues by removing fixed min-height and ensuring no extra padding/margins
  - Fixed last option spacing to maintain consistent padding
- **SearchableChooser Filtering**: Enhanced default filter to also exclude blank/whitespace-only options in addition to templating syntax, preventing empty options from appearing in dropdown lists.

## [1.0.17] 2026-01-25 @dwertheimer

### Fixed
- **SearchableChooser Templating Field Filter**: Fixed SearchableChooser to automatically filter out options containing templating fields (e.g., containing "<%") by default. This prevents templating syntax from appearing in frontmatter key chooser and other dropdown option lists.
- **SearchableChooser Manual Entry Indicator**: Fixed issue where the pencil icon (manual entry indicator) was incorrectly appearing in empty/blank fields. The indicator now only appears when a non-empty value has been entered that is not in the items list, and only after the items list has finished loading.
- **Frontmatter Key Values Filtering**: Fixed `getFrontmatterKeyValues` to filter out templating syntax values (containing "<%") at the source, preventing templating errors when forms load. Templating syntax values are now excluded from frontmatter key chooser dropdowns.
- **ContainedMultiSelectChooser Create Mode**: Fixed issue where ContainedMultiSelectChooser was not allowing creation of new items when the list was empty. Now allows creating new items even when `items.length === 0`, as long as `allowCreate` is true and there's a search term with no matches.

### Changed
- **GenericDatePicker Calendar Auto-Close**: Improved date picker UX by automatically closing the calendar picker immediately after selecting a date. Previously, users had to click the date and then click outside the picker to close it. Now a single click on a date both selects it and closes the calendar.
- **SearchableChooser Debug Logging**: Added comprehensive debug logging to SearchableChooser to help diagnose manual entry indicator issues. Logs include value checks, placeholder matching, and manual entry determination logic.
- **FormBuilder Create-New Mode Fields**: Split "Content to Insert" into two separate fields when processing method is "Create New Note":
  - **New Note Frontmatter**: Separate field for frontmatter content (saved to `template:ignore newNoteFrontmatter` codeblock)
  - **New Note Body Content**: Renamed from "Content to Insert" to clarify it's the body content (saved to `template:ignore templateBody` codeblock)
  - Frontmatter and body content are automatically combined with `--` delimiters when sending to TemplateRunner
  - Fields are ordered with Frontmatter above Body Content for better workflow
- **TemplateTagEditor Raw Mode**: All template tag editor fields (NewNoteTitle, Content to Insert, New Note Frontmatter, New Note Body Content) now default to raw mode with the toggle hidden, showing monospace text directly instead of pill/chip display for better readability

## [1.0.16] 2026-01-19 @dwertheimer

### Added
- **NoteChooser Output Formats**: Added new output format options for note chooser fields:
  - **Multi-select mode**: Added `'title'` and `'filename'` output formats (in addition to existing `'wikilink'`, `'pretty-link'`, `'raw-url'`). These return plain note titles or filenames without any formatting.
  - **Single-select mode**: Added `singleSelectOutputFormat` option to choose between outputting the note title (default) or filename when a single note is selected.
- **NoteChooser Filtering Options**: Added advanced filtering capabilities to note chooser fields:
  - **Start Folder**: Filter notes to only show those in a specific folder and its subfolders (e.g., `'@Templates'`).
  - **Include Regex**: Optional regex pattern to include only notes whose title or filename matches (case-insensitive).
  - **Exclude Regex**: Optional regex pattern to exclude notes whose title or filename matches (case-insensitive).
- **SearchableChooser ShortDescription Optimization**: Added automatic shortening of short descriptions to just the final folder name when the option row is too narrow, ensuring the label text takes precedence and remains fully visible.

### Changed
- **FormView CSS**: Reverted compact label width to 10rem (from 20rem) while keeping input width at 360px (2x the original 180px). This provides better balance between label and input field sizing.

## [1.0.15] 2026-01-18 @dwertheimer

### Fixed
- **CRITICAL: Null Value Handling**: Fixed `TypeError: null is not an object (evaluating 'Object.getOwnPropertyNames')` error that occurred when templating plugin tried to process form data containing null values. Added explicit null checks in `JSP`, `getFilteredProps`, and `getAllPropertyNames` helper functions to handle null values correctly (since `typeof null === 'object'` in JavaScript).
- **Form Submission Success Detection**: Fixed issue where successful form submissions were incorrectly flagged as errors. When `templateRunner` successfully creates a note via `templateNew`, it returns `undefined` (which is valid), but the code was treating this as an error. Now only `null` or empty strings are treated as errors.
- **Deep Null Sanitization**: Added comprehensive deep sanitization of null/undefined values throughout form data processing. All null/undefined values are now converted to empty strings recursively before being passed to the templating engine, preventing errors in nested data structures.
- **setTimeout Removal**: Removed `setTimeout` usage in form submission handlers (not available in NotePlan's JSContext). Replaced with proactive cleanup mechanism using a Map to manage debouncing without timeouts.

### Changed
- **templateNew Return Value**: Updated `templateNew` to return the filename (string) on success or `null` on failure, making the API more consistent and explicit. Previously returned `undefined`, which made it difficult to distinguish success from failure.
- **templateRunner Return Value**: Updated `templateRunner` to return the filename when a note is successfully created, instead of returning `undefined`. This provides explicit feedback about successful operations.
- **Error Messages**: Improved error messages to be more specific about null value issues and provide better guidance for debugging template execution problems.

## [1.0.14] 2026-01-19 @dwertheimer

### Changed
- **Default Window Width**: Changed default window width for new forms from 25% to 50% when creating a new form in the form builder
- **Default Compact Field Sizes**: Doubled the default compact field sizes - labels now default to 20rem (was 10rem) and inputs default to 360px (was 180px)

## [1.0.13] 2026-01-18 @dwertheimer

### Changed
- **CSS Color Variables**: Updated FormBrowserView.css, SimpleDialog.css, DynamicDialog.css, and FormBuilder.css to use only valid NotePlan theme color variables, removing non-existent variables and hard-coded color fallbacks. All colors now properly reference the theme system with appropriate fallback values. Variations on theme colors use `color-mix()` for hover states and semi-transparent overlays.
- **FormPreview**: Added `showScaledDisclaimer` prop to control when the scaled preview warning toast is shown. The toast now only appears in FormBuilder (when `showScaledDisclaimer={true}` is passed), not in FormBrowserView or other contexts.
- **Form Browser**: Replaced SimpleDialog success message with Toast notification. Success messages now appear as non-intrusive toasts, and notes are automatically opened after successful submission.

### Fixed
- **Form Browser**: Updated `getFormTemplates` to search for forms in both `@Forms` and `@Templates` folders, making it consistent with other parts of the plugin (e.g., Form Builder). Previously, the Form Browser only found forms in `@Forms` folder.
- **Form Submission**: Fixed issue where empty form fields were not included in form submission. All fields from the form definition are now included in `formValues`, even if left blank, ensuring templates receive all expected variables. This fix applies to both FormView and FormPreview via DynamicDialog.
- **Form Builder - Target Note Field**: Fixed issue where selecting special options like "Current Note" or "Choose Note" in the Target Note field was submitting the display label (e.g., "Current Note") instead of the template value (e.g., "<current>"). Now correctly uses the template value for special options while preserving note titles for regular notes.

## [1.0.12] 2026-01-17 @dwertheimer

### Added

### Fixed

### Changed
- **FormView**: Set text color of dialog to main color for better readability
Under the hood changes to move all window opening code to the windowManagement.js file.


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
- **FolderChooser**: Static options (like `<select>`) now always appear at the top of the dropdown, regardless of search term
- **FormBuilder**: Space and Folder choosers in left sidebar now extend to 100% width for better layout
- **FolderChooser**: Fixed folder icon class to use complete Font Awesome class name (`fa-solid fa-folder`) for proper rendering
- **FolderChooser**: Static option icon now uses complete Font Awesome class name (`fa-solid fa-circle-question`) for proper rendering

### Fixed
- Fixed calendar picker button showing when "Include Calendar Notes" is disabled - now only shows when calendar notes are included (or explicitly enabled via setting)
- Fixed multi-select NoteChooser not rendering correctly - now properly detects `allowMultiSelect` prop and renders ContainedMultiSelectChooser instead of dropdown
- Fixed syntax error in NoteChooser.jsx that prevented Rollup from building (replaced Flow type guard with explicit array building)
- Fixed folder chooser width constraint in FormBuilder left sidebar - now respects `width="100%"` prop
- Fixed manual entry indicator showing incorrectly in DropdownSelectChooser (FrontmatterKeyChooser) - now only shows when value is actually a manual entry, not for empty values or during loading
- Fixed infinite loop in GenericDatePicker when typing or tabbing through input field - added value change detection to prevent unnecessary re-renders

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
