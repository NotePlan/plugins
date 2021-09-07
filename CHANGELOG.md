# NotePlan Plugin Framework Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## About NotePlan Plugin Framework

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/README.md) for details on available commands and use case.

## [3.0.0] - 2021-09-06 (mikeerickson)

### added
- Added testing framework (using [Jest](https://jestjs.io/))
- Added build command `run build [plugin]`
- Added CLI command `noteplan-cli plugin:dev`
  - Review `noteplan-cli plugin:dev --help` for all options
- Added CLI command `noteplan-cli plugin:release`
- Added CLI command `noteplan-cli plugin:test`

### changed
- Adjusted NotePlan Plugin initalization task
- Moved `np.plugin.starter` into CLI templates to remove root exposure

## [2.2.0] - 2021-09-06 (@mikeerickson)

### Fixed
- fixed `plugin:create` command to use latest `@codedungeon/gunner`
- fixed `plugin:info` command to use latest `@codedungeon/gunner`

## [2.0.0] - 2021-08-21 (mikeerickson)

### Added
- Added NotePlan CLI
  - Added plugin:create
  - Added plugin:info
- Adjusted `scripts/rollup`
- Adjusted `scripts/releases`
