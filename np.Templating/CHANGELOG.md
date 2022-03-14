# np.Templating Changelog

### About np.Templating Plugin
See Plugin [README](https://github.com/NotePlan/plugins/blob/main/np.Templating/README.md) for details on available commands and use case.

## [1.0.0-beta.06] - 2022-03-14 (mikeerickson)

- removed `docs` directory, moved to [np.Templating Docs](https://nptemplating-docs.netlify.app/)
- fixed issue when selecting `Cancel` in prompt message, throwing incorrect error

## [1.0.0-beta.05] - 2022-03-14 (mikeerickson)

- fix `__tests__/fronmatter-module.test.js` using new fixtures
- added `np:qtn` to replace current `/qtn` and will be adding `/qtn` when `nmn.Templates` is deprecated
- fixed several issues with prompt interface, including display multiple prompts for same key

## [1.0.0-beta.04] - 2022-02-26 (mikeerickson)

- added support for new template format introduced by `NotePlan 3.4.1` and frontmatter formatted templates
- fixed issue where templates were sometimes being loaded from old "Templates" directory, it should now ONLY use `@Templates`
- renamed **globals** helper `date` to `currentDate` as `date` is a reserved work for internal Date Module
- fixed issues with **globals** date methods, including

```html
**pickdate:**
- <%- pickDate() %>
- <%- pickDate({question:'Please enter a date:'}) %>
- <%- pickDateInterval() %>
- <%- pickDateInterval({question:'Date interval to use:'}) %>
```

## [1.0.0-beta.03] - 2022-02-24 (mikeerickson)

- added template migration to `onUpdateOrInstall` method which will run first time `np.Templating` is installed
- added `np:templating-migration` command which can be used to run migration method on command
- updated to use `@Templates` instead of `:clipboard: Templates`

## [1.0.0-beta.02] - 2022-02-22 (mikeerickson)

### Added
- Added generic formatting (removed pipe format from templates)

### Changed
- Implemented advanced `getWeather` (this may be removed in a future release)
- Reviewing use of `globals.js` and many (or all) of these functions may be removed - proceed accordingly

## [1.0.0-beta.01] - 2022-02-15 (mikeerickson)

### Added
Initial Release

## Changelog
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Plugin Versioning Uses Semver
All NotePlan plugins follow `semver` versioning. For details, please refer to [semver website](https://semver.org/)
