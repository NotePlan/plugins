# codedungeon.Toolbox Changelog

### About codedungeon.Toolbox Plugin

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/codedungeon.Toolbox/README.md) for details on available commands and use case.

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

### Added
Initial Release

## Changelog
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Plugin Versioning Uses Semver
All NotePlan plugins follow `semver` versioning. For details, please refer to [semver website](https://semver.org/)
