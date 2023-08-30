# np.ThemeChooser Changelog

## [1.7.2] 2023-08-24 @dwertheimer

- Fix presets bug where presets were empty - found by @clayrussell

## [1.7.1] 2023-08-22 @dwertheimer

- Add theme choosing to frontmatter-based theme setting

## [1.7.0] 2023-08-22 @dwertheimer

- Added frontmatter setting of theme on a per-note basis

## [1.6.2] 2023-07-09 @dwertheimer

- Remove background color from code blocks which was causing selections to fail.

## [1.6.1] 2023-03-31 @dwertheimer

- Adding fancier version of inline comment hide

## [1.6.0] 2023-03-31 @dwertheimer

- Adding end-of-line-comment-hide

## [1.5.10] 2023-03-27 @dwertheimer

- Added messaging about shouldOverwriteFont

## [1.5.9] 2023-03-27 @dwertheimer

- Fix bug with boolean settings

## [1.5.8] 2023-03-27 @dwertheimer

- Add underline style to all titles

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
