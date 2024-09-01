# dbludeau.TodoistNoteplanSync Changelog

## About dbludeau.TodoistNoteplanSync Plugin

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/dbludeau.TodoistNoteplanSync/README.md) for details on available commands and use case.

## [0.1.0] - 2023-08-18 (dbludeau)
- Initial version with "/todoist sync today", "/todoist sync everything", "/todoist sync project", "/todoist sync all projects" and "/todoist sync all projects and today" commands

## [0.2.0] - 2024-08-30 (dbludeau)
- Added settings to account for Todoist Teams accounts
- Fixed duplication issue that was caused by URL changes in the todoist tasks.

## [0.3.0] - 2024-09-01 (dbludeau)
- Fixed issue caused by "Folder" setting for Sync Everything command.
    - If leading or trailing slash was included, the plugin would not recognize the folder as already existing, leading to duplication of notes.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Plugin Versioning Uses Semver

All NotePlan plugins follow `semver` versioning. For details, please refer to [semver website](https://semver.org/)
