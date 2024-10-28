# Changes to 🤝 Shared Resources plugin

See [Shared Plugin's README](https://github.com/NotePlan/plugins/blob/main/np.Shared/README.md) for details on this plugin.

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
