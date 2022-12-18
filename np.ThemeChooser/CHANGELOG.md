# np.ThemeChooser Changelog

## [1.5.7] 2022-12-15 @dwertheimer

- Fix bug in dark/light toggle

## [1.5.6] 2022-11-29 @dwertheimer

- Add /Customize Themes
- Fix bug with how themes are saved as default (use filename, not theme name)

## [1.4.0] 2022-09-15 @dwertheimer

- Allow users to change the name of the command
- Under-the-hood tweaks to genericize the presets functionality

## [1.3.0] 2022-09-01 @dwertheimer

- Change to match new API signature for theme getting/setting

## [1.2.1] 2022-06-24 @dwertheimer

- Remove testing command

## [1.2.0] 2022-06-24 @dwertheimer

### Critical bug fix

- Save preferences so that your settings get restored when plugin gets refreshed

## [1.1.1] 2022-06-24 @dwertheimer

## Features

- Added toggle light/dark (you need to set one favorite of each first) - thanks @jgclark for this idea

## Improvements

- Added note to prefs/settings telling you how to set the presets - thanks @docjulien for the suggestion
- Hide the presets that have not been set yet (reduce clutter)

## [1.0.0] 2022-06-23 @dwertheimer

- Initial release with commands:
  - `/Choose Theme`
  - `/Change Theme Preset`
