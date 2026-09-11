# dannymcc.GranolaSync Changelog

## About dannymcc.GranolaSync Plugin

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/dannymcc.GranolaSync/README.md) for details on available commands and use case.

## [2.1.0] - 2026-02-21 (dannymcc)

### Added
- Weekly note integration: synced meetings added to weekly note, grouped by day
- Monthly note integration: synced meetings added to monthly note, grouped by day
- Calendar event matching: links synced notes to matching NotePlan calendar events

### Changed
- Meeting time prefers calendar event start time over document created_at
- Calendar note entries include all synced documents (not just newly created ones)

## [2.0.0] - 2026-02-21 (dannymcc)

### Added
- Complete rewrite based on the Granola Sync Plus for Obsidian plugin
- Panel-based content extraction (my_notes, enhanced_notes panels)
- ProseMirror-to-Markdown converter with full formatting support
- Configurable filename templates with date/time/title tokens
- Attendee tagging with configurable tag template
- Granola URL deep links
- Granola folder mirroring into NotePlan subfolders
- Duplicate detection command
- Daily note integration with meeting times and wiki-links
- HTML comment metadata tracking (granola_id, created_at, updated_at)
- Smart update handling (skip or update based on timestamps)
- Paginated document fetching
- Transcript support via separate API endpoint
- Async thread execution to prevent UI freezes
