# Package.json Changelog

## About Plugins/package.json / package-lock.json

## [3.19.0] - 2024-01-13 (@dwertheimer)

- removed an errant import of libcurl that was crashing builds with node-gyp errors

## [3.18.0] - 2023-01-08 (@dwertheimer)

- edits to rollup & releases to help with "plugin.requiredFiles" and the requiredFiles folder (files to be copied to the Plugins folder and to releases for React, etc.)
- add fast-glob module for rollup (to watch for changes in files outside the build tree of index.js)

## [3.17.0] - 2022-12-17 (@dwertheimer)

### Additions to the plugin template for new plugins:

- add hooks and stubs for: onOpen, onEditorWillSave
- add fetch mocking import and instructions on how to use it
- moved pre-existing hooks to the new NPTriggers-Hooks.js file

## [3.16.0] - 2022-09-13 (@dwertheimer)

- added fsevents to try to reduce CPU usage of node on the autowatch per [article](https://medium.com/@manusajith/fix-for-100-cpu-usage-by-node-js-529916100aa6)

## [3.15.0] - 2022-08-30 (@akrabat)

- updated node-libcurl to 2.3.4 for Apple Silicon compatibility

## [3.14.0] - 2022-08-19 (@dwertheimer)

- added columnify for columnar output

## [3.13.0] - 2022-08-19 (@dwertheimer)

- added mathjs module for math calculations
- added -m | --minify option to build process to minify/mangle output for large plugins

## [3.12.0] - 2022-07-24 (@codedungeon)

- fixed `maximum stack call` error with new log level implementation
- all tests are currently passing, with the exception of 3 (@jgclark has been notified)
- fixed all core linting errors (individual plugins from @dwertheimer or @jgbclark still need some more at time of this release)

## [3.11.0] - 2022-07-24 (@codedungeon)

- Added `logInfo`, `logError`, `logWarn`, `logDebug` helpers, support plugin `Debugging` section (@dwertheimer)
- Updated plugin starter (`npc plugin:create`) to include `Debugging` section in settings (@codedungeon)

## [3.10.2] - 2022-07-10 (@codedungeon)

- added `np.Templating/lib/support/ejs.js` to `.eslintrc :: ignorePatterns`

## [3.10.1] - 2022-07-10 (@codedungeon)

- Fixed linting errors
- Updated `.eslintrc` to define max-len to match prettier setting in `package.json`
  > I am hoping you all will be cool with the updated max-len value
  > I work on a 30" most of the time so a longer line length is easier to read, if this becomes an issue I will try and get used to someting smaller (we used to have 120)
- Updated `test:dev` and `test:watch` npm scripts
  > Run `test:dev` to perform a single test run of all specs in `__tests__` directories
  > Run `test:watch` to perform a run test for all specs in `__tests__` using watch mode
- Updated `test` npm script to also call `test:dev`
- small refactor to `np.plugin-flow-skeleton`

## [3.10.0] - 2022-07-07 (@codedungeon)

- added `--force` option to `npc plugin:create` which will skip all network lookups (when retrieving github user information) (@dwertheimer)
- added task to `npc plugin:release` which remove previous releases for same pluginId (@jgclark)

> you can use the `--noDelete` flag to skip delete tasks (this will rarely be used, but added for completeness)

## [3.9.0] - 2022-06-17 (@jgclark)

- removed luxon
- (unmentioned here but I believe @nmn remove luxon-business-days about 2022-06-12)

## [3.8.0] - 2022-06-15 (@nmn)

- added eslint-plugin-no-floating-promise to package.json
- added package-lock back into git
- added .watchmanconfig

## [3.6.0] - 2022-06-08 (@codedungeon)

- added `documentation` module back in and edited the `npm run docs` command

- Updated @codedungeon/gunner CLI library
- added example of new "arguments: {}" fields in `plugin.json` when there are arguments that can be passed in when calling a plugin command from x-callback

## [3.5.0] - 2022-06-01 (@codedungeon)

- updated [#205](https://github.com/NotePlan/plugins/issues/205) `npc plugin:release` to include `CHANGELOG.md` if exists ()
- updated `npc plugin:create` to include extended plugin skeleton (@dwertheimer)
  > Added more skeleton tests (thank you @dwertheimer)
- restored 180 character width in `prettier` settings
  > If we continue to toggle this setting, my suggestion would be to remove it as a base setting and integrate personal `prettier.config.js` configuration

## [3.4.1] - 2022-05-24 (@codedungeon)

- fixed `npc plugin:release`

## [3.4.1] - 2022-05-15 (@codedungeon)

- removed `dayjs` dependency
  - You can remove as you see fit, but it was not being used anywhere so it should not be causing any issues

## [3.4.0] - 2022-05-15 (@jgclark)

- add `luxon` depedency
  - luxon-business-days

## [3.3.0] - 2022-05-06 (@dwertheimer)

- added support for searching notes using packages:
  - fuse.js
  - bqpjs

## [3.2.6] - 2022-04-23 (@mikeerickson)

- added support for using aliases in jest tests
  - configured in `jest.config.js` which matches configuration in `plugins.config.js`

## [3.2.5] - 2022-04-16 (@mikeerickson)

- fix `npc plugin:relase` command to properly include `plugin.name` (@jgclark)

## [3.2.4] - 2022-03-20 (@mikeerickson)

- Fixed `helpers/NPConfiguration.js :: getSetting` completed implementation
- Fixed `helpers/NPConfiguration.js :: getSettings` completed implementation

## [3.2.3] - 2022-03-20 (@mikeerickson)

- Extended `helpers/dev :: clo` to output raw value if not object (allow passing non-object without having to change method call)

## [3.2.2] - 2022-03-18 (@mikeerickson)

- Removed `fetchWithTimeout` helper that was added in 3.2.1

## [3.2.1] - 2022-03-18 (@mikeerickson)

- removed `--verbose false` flag from `test:dev` and `test:watch` scripts

## [3.2.0] - 2022-03-16 (@mikeerickson)

- added `fetchWithTimeout` helper to `./helpers/dev`

## [3.1.2] - 2022-02-27 (@mikeerickson)

- fixed issue with `npc plugin:release` build test command
- removed test execution when running test build (addresses item test imports)

## [3.1.1] - 2022-02-23 (@mikeerickson)

- updated `date-fns` dependency to `^2.23.0` (requested by @m1well)
- added `eslin-plugin-unused-imports: 1.1.5` (requested by @m1well)
- updated CLI command description and examples

## [3.1.0] - 2022-02-19 (@mikeerickson)

- fixed issue with release script
- refactored release validation in CLI `npc plugin:release`
- add guard to make sure releasing from plugins directory

## [3.0.2] - 2022-02-17 (@mikeerickson)

- restored `docs` command

## [3.0.1] - 2022-02-17 (@mikeerickson)

- updated Plugins v3.0

## [2.2.0] - 2021-09-06 (@mikeerickson)

### Fixed

- fixed `plugin:create` command to use latest `@codedungeon/gunner`
- fixed `plugin:info` command to use latest `@codedungeon/gunner`

## [2.1.0] - 2021-08-26 (@mikeerickson)

### Added

- added `showdown` node dependency
- added `codedungeon.Toolbox` v1.0.0

## [2.0.1] - 2021-08-26 (@mikeerickson)

### Changed

- modified `.flowconfig` configuration, address error messsage for node_modules which do not contain type definitions

## [2.0.0] - 2021-08-16 (@mikeerickson)

Initial Release

## Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Plugin Versioning Uses Semver

All NotePlan plugins follow `semver` versioning. For details, please refer to [semver website](https://semver.org/)
