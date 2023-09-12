# "🧩 Link Creator Change Log

## About np.CallbackURLs Plugin

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/np.CallbackURLs/README.md) for details on available commands and use cases.

## [1.6.1] - 2023-09-12 @dwertheimer

- Bug fix for calling np.Templating (can't pull plugin.json)

## [1.6.0] - 2023-08-27 @dwertheimer

- Adding passpack for /favorite commands (see Favorites Plugin)

## [1.5.0] - 2023-06-10 (@dwertheimer)

- Adding ability to open links in a note for open tasks (under the hood uses new helpers/urls functions for consistency)

## [1.4.1] - 2022-01-19 (@dwertheimer)

- Make default pretty link the title

## [1.4.0] - 2022-01-19 (@dwertheimer)

- Add dialog box on URL creation for creating pretty links (thx @stacey)

## [1.3.0] - 2022-12-21 (@dwertheimer)

- Fix bug when selecting self-running template
- Include ability to create self-running template
- Hide x-success behind a preference field

## [1.2.1] - 2022-12-08 (@dwertheimer)

- @jgclark changed self-running templates to use semicolons to separate variables. Updated the URL maker to match

## [1.2.0] - 2022-12-04 (@dwertheimer)

- Added links to lines
- Updated the way hashtags in titles are encoded (which changed in NotePlan) -- strip out hashtags in headings

## [1.1.2] - 2022-10-02 (@dwertheimer)

- Renamed plugin to Link Creator

## [1.1.1] - 2022-09-20 (@dwertheimer)

- Fix bug with parentheses in URL which were not urlencoded

## [1.1.0] - 2022-07-16 (@dwertheimer)

- Added TemplateRunner code to run templates from links
  
## [1.0.0] - 2022-07-11 (@dwertheimer)

- Changed plugin Name to: "🧩 External Links, X-Callback-URLs, RunPlugin Creator"
- Added command "Create Link to Current Note+Heading" with direct access from command bar

## [0.6.0] = 2022-07-02 (@dwertheimer)

- Added noteInfo command
- Added deleteNote command
- Addex x-success return capability on all commands
- Added DataStore.installOrUpdatePluginsByID to init

## [0.5.0] - 2022-07-01 (@dwertheimer)

- Added addNote command

- ## [0.4.0] - 2022-06-28 (@dwertheimer)

- Added callback URLs for Shortcuts

## [0.3.0] - 2022-06-25 (@dwertheimer)

- Add callbacks for FILTER and SEARCH
-

## [0.2.0] - 2022-06-22 (@dwertheimer)

- Add Templating invokePlugin output type

## [0.1.2] - 2022-06-05 (@dwertheimer)

### Added

- Open documentation URL

## [0.1.1] - 2022-06-05 (@dwertheimer)

### Fixed

- Endless loop on cancel
- Cancel stops flow
- Improved messaging on arguments dialog

## [0.1.0] - 2022-06-05 (@dwertheimer)

- Initial release, includes openNote, addText and runPlugin
