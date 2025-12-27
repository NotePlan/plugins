# dwertheimer.Forms Changelog

## About dwertheimer.Forms Plugin

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/dwertheimer.Forms/README.md) for details on available commands and use case.

## [1.0.6] 2025-12-19 @dwertheimer

- UI improvements for template tag editor:
  - Moved +Field and +Date buttons to the left side of the editor
  - Moved "Show RAW template code" toggle switch to the right side
  - Double-click any pill (tag or text) to switch to RAW mode

## [1.0.5] 2025-12-19 @dwertheimer

- Add `folder-chooser` field type: Select folders from a searchable dropdown with smart path truncation (shows beginning and end of long paths with "..." in the middle)
- Add `note-chooser` field type: Select notes from a searchable dropdown with smart text truncation
- Both chooser types include intelligent truncation that preserves the start and end of long paths/titles for better readability

## [1.0.4] 2025-12-18 @dwertheimer

- Add Form Builder

## [1.0.3] 2025-12-18 @dwertheimer

- Add readme with basic instructions

## [1.0.2] 2025-03-06 @dwertheimer

- Add validation for reserved fields (will log a warning if a reserved field is used)
- Add validation for receivingTemplateTitle in template frontmatter

## [1.0.1] 2025-03-06 @dwertheimer

- Workaround for frontmatter UI and CSV strings

## Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Plugin Versioning Uses Semver

All NotePlan plugins follow `semver` versioning. For details, please refer to [semver website](https://semver.org/)
