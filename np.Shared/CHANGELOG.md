# Changes to 🤝 Shared Resources plugin

See [Shared Plugin's README](https://github.com/NotePlan/plugins/blob/main/np.Shared/README.md) for details on this plugin.

## [1.0.4] @jgclark 2026-01-09
### Changed
- Changed minAppVersion back down to 3.8.1, as the checks for v3.20.0 (mainWindow in macOS) or v3.20.1 (mainWindow on iOS) are handled in showHTMLV2() calls

## [1.0.3] @dwertheimer 2026-01-09
### Changed
- Refactored CSS architecture: Created new `Root.css` with shared color classes (`.color-info`, `.color-warn`, `.color-error`, `.color-success`, etc.) for reuse across MessageBanner, Toast, and other components. This centralizes color management and ensures consistency.
- Updated MessageBanner and Toast components to use CSS variables from theme instead of hardcoded colors, improving theme compatibility.
- Improved `showBanner()` function in Root.jsx to automatically determine color, border, and icon classes from message type if not explicitly provided, reducing boilerplate code.
- Fixed `getHeadings()` request handler to use `includeMarkdown: true` and ensure it always returns an array (never undefined/null), preventing errors in HeadingChooser.
- Updated `noteHelpers.js` to use `getNoteDecorationForReact()` helper for consistent note decoration handling.
- Fixed relative notes title handling to use `relName` directly instead of template runner value.

### Fixed
- Fixed CSS variable for toolbar height: changed `var(--noteplan-toolbar-height, 0)` to `var(--noteplan-toolbar-height, 0px)` for proper CSS unit handling in mainWindow mode.

### Dev
- Removed encoding debug logging that was added for emoji corruption investigation (no longer needed).
- Updated minAppVersion to 3.20.1 to match NotePlan requirements.

## [1.0.2] @dwertheimer 2026-01-08

- Fix Settings Dialog CSS positioning to properly center in viewport accounting for toolbar height. Removed transform-based centering and switched to direct top/left calculations for more reliable positioning.

## [1.0.1] @dwertheimer 2026-01-08

- Bump version for @jgclark to see

## [1.0.0] @dwertheimer 2026-01-06

 - Add Shared Request Router for DynamicDialog choosers (e.g. getTeamspaces, getFolders, getNotes, etc.)
 
## [0.9.0] @dwertheimer 2026-01-02

- Fix Toast notification CSS selectors: Change descendant selectors to class combinators so color and border styles apply correctly
- Fix toast positioning: Use calc(1rem + var(--noteplan-toolbar-height, 0px)) to properly account for toolbar height when variable exists
- Add debug mode to Form Builder window initialization
- Add Test Toast button in Root.jsx debug section that cycles through all toast types sequentially
- Update MessageBanner component with improved styling and functionality
- Update sendBannerMessage() function throughout codebase for consistency
- Update JSDoc comments in Root.jsx
- Update minAppVersion to 3.20.0 due to showInMainWindow requirements

## [0.8.4] @dwertheimer 2025-12-31

- Add showReloadButton option to NPReactLocal.showInMainWindow

## [0.8.3] @dwertheimer 2025-12-27

- Refactor HTML generation code to eliminate duplication between `openReactWindow` and `showInMainWindow`
- Extract shared HTML generation logic into `prepareReactWindowData` function
- Create `assembleHTMLString` function for `showInMainWindow` to build complete HTML string
- Update `addStringOrArrayItems` to properly handle `ScriptObj` types in addition to strings and arrays
- Both window functions now use shared code, reducing maintenance burden and ensuring consistency

## [0.8.2] @dwertheimer 2025-12-27

- Root bundle now includes React and ReactDOM internally (self-contained)
- Eliminated separate react.core.dev.js bundle - React/ReactDOM are bundled into Root
- Root exports React, ReactDOM, and createRoot as globals for other bundles to use
- Fixed script loading order: Root loads before plugin bundles so React/ReactDOM are available
- Plugin bundles (like Forms) now reference React/ReactDOM as external globals from Root

## [0.8.1] @dwertheimer 2025-12-24

- Add Toast notification component and option for MessageBanner to be displayed as a floating toast for transient messages in top-right corner
- Toast overlays content (doesn't push it down like MessageBanner)
- Supports INFO, WARN, ERROR, and SUCCESS types with auto-dismiss timeout
- Can be called from plugin side via `sendToastMessage()` or React side via `dispatch('SHOW_TOAST')`
- Includes slide-in animation from right and fade effects

## [0.8.0] @dwertheimer 2025-12-18

- Add request/response pattern for awaiting from React->Plugin->React
- Bring a better design to MessageBanner component
- Update MessageBanner to take a 'type' (WARN, ERROR, INFO or REMOVE), and an optional timeout
- Add separate MessageBanner.css, that removes this particular dependency on css.w3.css
- Add NP_THEME to showHTMLV2
- Fix bug in window positioning math in showHTMLV2


## [0.7.5] @dwertheimer 2025-01-24

- Remove DynamicDialog from Root (it was duplicating code and CSS)
- FormView and other components now can import DynamicDialog when they need it

## [0.7.4] @dwertheimer 2024-12-21

- Remove minified versions of Root and FormView components

## [0.7.3] @dwertheimer 2024-12-10

- Improve DashboardDialog CSS

## [0.7.2] @dwertheimer 2024-10-28

- fix bug in Root where the pluginToHTMLCommsBridge.js was not being loaded and so sendMessageToPlugin was not working

## [0.7.1] @dwertheimer 2024-10-24

- fix bug in Root where banners were not being shown anymore

## [0.7.0] @dwertheimer 2024-09-14

- Add DynamicDialog to Root to bring up a dialog

## [0.6.3] - @dwertheimer

- Reduce logging

## [0.6.2] - @dwertheimer

- Add guard for NP window closed (kills React rendering at Root)

## [0.6.1] - @dwertheimer 

- more logging to setTheme

## [0.6.0] - @dwertheimer

- add theme change route UPDATE_THEME

## [0.5.11] - @dwertheimer

- Fix banners

## [0.5.10] - @dwertheimer
## [0.5.9] - @dwertheimer

- reduce logging

## [0.5.7] - @dwertheimer
## [0.5.6] - @dwertheimer
## [0.5.5] - @dwertheimer
## [0.5.4] - @dwertheimer

- Further Work on Root React and react settings saved at root level

## [0.5.3] - 2024-04-19 @dwertheimer

- Decrease error logging

## [0.5.2] - 2024-04-12 @dwertheimer

- Improve error logging in React root component

## [0.4.8] - 2024-04-01 @jgclark

- add 'shortcut.js' script

## [0.4.7] - 2023-10-16 @dwertheimer

- minor updates to Root's WebView debug wrapper

## [0.4.6] - 2023-10-16 @dwertheimer

- update to remove CSS from React Windows if wanted

## [0.4.5] - 2023-10-16 @dwertheimer

- updates to React tooling using ShowHTMLV2 etc.

## [0.4.4] - 2023-07-15 (@jgclark)

- bugfix for 'undefined' message on plugin upgrade

## [0.4.3] - 2023-07-14 (@jgclark)

- update encode function for safe data transport to/from JS of `&` and `&amp;` strings

## [0.4.2] - 2023-06-07 (@jgclark)

- add encode and decode functions for safe data transport to/from JS

## [0.4.1] - 2023-06-02 (@dwertheimer)

- add tweaks for react

## [0.4.0] - 2023-05-29 (@dwertheimer)

- add w3.css to the shared files and update some of the React

## [0.3.1] - 2023-02-23 (@dwertheimer)

- release bugfix

## [0.3.0] - 2023-02-22 (@jgclark)

### Added

- function `checkForWantedResources(fileList?)` for plugins to use. See its jsdoc for more details.

## [0.2.0] - 2023-02-18 (@dwertheimer)

### Added

- File pluginToHTMLCommsBridge.js

## [0.1.0] - 2023-02-04 (@jgclark)

### Added

First release:

- provides the **FontAwesome** assets
- **/logShared** command: lists all shared assets in the Plugin Console.
