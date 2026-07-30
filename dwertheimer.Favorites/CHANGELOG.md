# Favorites Plugin Changelog

## [1.4.2] - 2026-07-30 @dwertheimer

- **Fixed**: Re-syncing presets (`onUpdateOrInstall`) threw a `TypeError: undefined is not an object (evaluating 'DataStore.settings = ...')` twice per preset — 40 JS exceptions in the log for a 20-preset install. `rememberPresetsAfterInstall()` assigned `DataStore.settings` once per preset, and each assignment made NotePlan fire `onSettingsUpdated` re-entrantly mid-statement. The presets themselves were always restored correctly, so this was log noise rather than data loss, but it buried genuine errors and did 20x the necessary work. Presets are now re-applied to `plugin.json` in a single read/write, with no settings write at all (the settings are the source being read from).
- **Fixed**: `plugin.settings` had a section-heading entry with no `key` and no `type`, producing `plugin.settings[26] has no valid key; skipping` on every settings update. Marked it as a `separator`, like the entry below it.

## [1.4.1] - 2026-07-21 @dwertheimer

- **Fixed**: The unfavorite star icon on each note row was getting clipped at the top of the row.
- **Feature**: Added a "Group favorites by folder" plugin setting (bool). This controls the initial state of the Notes list's "group by folder" toggle when the Favorites browser window opens; users can still switch modes from the toggle itself within the session.

## [1.4.0] - 2026-07-21 @dwertheimer

- **Feature**: Added a "Group by folder" toggle to the Favorites browser Notes view (next to the Notes/Commands segmented control). When enabled, favorite notes are grouped under folder headers instead of a flat list, making it easier to scan favorites when you have many of them across different folders.

## [1.3.6] - 2026-04-13 @dwertheimer

- **PluginRequestEnvelope**: Favorites browser `requestFromPlugin` resolves with `@helpers/react/pluginRequestEnvelope` (`unwrapPluginRequestData` / explicit `success` + `data` + `message`). **Release together with np.Shared 1.0.7+** (or matching Root bundle).

## [1.3.5] - 2026-01-20 @dwertheimer

- Fixed sidebar icon colour issue by using proper css variables for colors.

## [1.3.4] - 2026-01-18 @dwertheimer    

- Fixed dark mode issues with favorites browser window by using proper css variables for colors.

## [1.3.3 - waiting for np 3.20.1 release (change showReloadButton to true)] - 2026-01-11 @dwertheimer

- Added reload button to favorites browser window to allow for easy reloading of the window when changes are made to the plugin or the underlying note data.

## [1.3.2] - 2026-01-11 @dwertheimer

### Fixed
- Fixed bug where removing a favorite note would remove the star from the title but not remove the frontmatter field. Now properly passes `deleteMissingAttributes: true` to `updateFrontMatterVars()` to ensure the frontmatter key is actually deleted. Thanks @stacey for the detailed bug report!


## [1.3.1] - 2026-01-11 @dwertheimer

### Fixed
- **CRITICAL**: Fixed request timeout issue by removing outdated local copy of `routerUtils.js` and switching to shared version from `@helpers/react/routerUtils`
- The local copy was missing the `pluginJson` parameter required by the shared router, which could cause silent failures when sending responses back to React
- Router now properly passes `pluginJson` parameter to `newCommsRouter` for correct logging and response handling

## [1.3.0] - 2025-01-10 @dwertheimer

- Feature: Add new `/favorites-browser` command to open a sidebar window to view and open favorite notes and commands. This provides a persistent browser interface for managing and accessing your favorites.

## [1.2.10] - 2025-04-10 @dwertheimer

- Bugfix: Fix issue with frontmatter not being visible immediately after setting a favorite

## [1.2.9] - 2025-02-20 @dwertheimer

- Bugfix: Fix Stacey issue with writing title above frontmatter when only one field and no title
- Bugfix: Fix issue with duplicate notes in favorites list

## [1.2.7] - 2025-02-19 @dwertheimer

- Bugfix: quoteText() now handles null, boolean, number and undefined values correctly

## [1.2.6] - 2025-02-19 @dwertheimer

- Add "Favorite Key" setting to allow for customizing the frontmatter key used to identify favorites.

## [1.2.5] - 2025-02-15 @dwertheimer

- Favorites now works with frontmatter

## [1.2.4] - 2024-06-12 @dwertheimer

- bump version for rerelease (plugin was missing from github)

## [1.2.3] - 2023-09-29 @dwertheimer

- change the default to not add a space in front of the default tag

## [1.2.2] - 2023-08 @dwertheimer

- Bugfix: allow for escaping and leaving command intact.

## [1.2.1] - 2023-08 @dwertheimer

- Add "rename" capability

## [1.2.0] - 2023-08-27 @dwertheimer

- Add prepended characters for favorite saved commands & xcallback creator inline. Thx for the idea @clayrussell

## [1.1.3] - 2023-08 @dwertheimer

- Add remember-presets-after-update code

## [1.1.0] - 2023-08-25 @dwertheimer

- Add capability to set a preset to run a favorite URL/X-Callback

## [1.0.1] - 2021-11-30 (@dwertheimer)

- Minor tweak to the plugin.json to be more descriptive in Description

## [1.0.0] - 2021-11-16 (@dwertheimer)

- Initial plugin functions: `/fave`, `/unfave`, `/faves`
