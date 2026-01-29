# Todoist Noteplan Sync Changelog

## About this Plugin

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/dbludeau.TodoistNoteplanSync/README.md) for details on available commands and use cases.

## [0.4.1] - 2026-01-22 (dbludeau)
- Fix for issue pulling todays tasks from Todoist.

## [0.4.0] - 2025-09-15 (dbludeau)
- Updated plugin to use new Todoist V1 API.

## [0.3.0] - 2024-09-01 (dbludeau)
- Fixed issue caused by "Folder" setting for Sync Everything command.
    - If leading or trailing slash was included, the plugin would not recognize the folder as already existing, leading to duplication of notes.

## [0.2.0] - 2024-08-30 (dbludeau)
- Added settings to account for Todoist Teams accounts
- Fixed duplication issue that was caused by URL changes in the todoist tasks.

## [0.1.0] - 2023-08-18 (dbludeau)
- Initial version with "/todoist sync today", "/todoist sync everything", "/todoist sync project", "/todoist sync all projects" and "/todoist sync all projects and today" commands
