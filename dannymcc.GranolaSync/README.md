# Granola Sync for NotePlan

A NotePlan plugin that syncs your [Granola AI](https://granola.ai) meeting notes into NotePlan with full customization options.

> Based on the [Granola Sync Plus for Obsidian](https://github.com/dannymcc/Granola-to-Obsidian) plugin, adapted for NotePlan's plugin environment.

## Features

- **Manual Sync**: Sync notes from Granola AI on demand via Command Bar
- **Separate Notes**: Create individual notes for each meeting in a configurable folder
- **Calendar Note Integration**: Add meetings to your daily, weekly, and monthly notes with times and wiki-links
- **Content Conversion**: Converts ProseMirror content to clean Markdown (bold, italic, code, links, lists, blockquotes, code blocks)
- **Attendee Tagging**: Extract meeting attendees as organised tags (e.g. `#person/john-smith`) with a configurable template
- **Granola URL Links**: Add direct links back to original Granola notes
- **Granola Folder Mirroring**: Organise notes into subfolders matching your Granola folder structure
- **Duplicate Detection**: Find and review duplicate notes
- **Smart Update Handling**: Updates existing notes or skips them based on timestamps
- **Flexible Filenames**: Customise note filenames with date, time, and title tokens
- **Transcript Support**: Include full meeting transcripts (optional, extra API call per note)

## Commands

| Command | Description |
|---------|-------------|
| `/Sync recent notes from Granola AI` | Sync recent meetings (up to the configured limit) |
| `/Sync ALL historical notes from Granola AI` | Sync all meetings regardless of limit |
| `/Find duplicate Granola notes` | Scan vault for notes with duplicate Granola IDs |

## Configuration

Access plugin settings via **NotePlan > Preferences > Plugins > Granola Sync**

### Authentication

Your Granola API access token is required. To find it:
1. Open `~/Library/Application Support/Granola/supabase.json`
2. Find `workos_tokens` (or `cognito_tokens`)
3. Copy the `access_token` value
4. Paste it into the plugin settings

### Settings Overview

| Setting | Default | Description |
|---------|---------|-------------|
| Sync Folder | `Granola` | NotePlan folder for synced notes |
| Filename Template | `{created_date}_{title}` | Template for note filenames |
| Date Format | `YYYY-MM-DD` | Date format used in filenames |
| Document Sync Limit | `100` | Max documents per sync run |
| Skip Existing Notes | `true` | Skip notes matched by Granola ID |
| Include My Notes | `true` | Include personal notes section |
| Include Enhanced Notes | `true` | Include AI-generated notes section |
| Include Transcript | `false` | Include full meeting transcript |
| Include Granola URL | `false` | Add link to original Granola document |
| Include Attendee Tags | `false` | Add attendees as hashtags |
| Mirror Granola Folders | `false` | Match Granola folder structure |
| Daily Note Integration | `true` | Add today's meetings to daily note |
| Weekly Note Integration | `false` | Add this week's meetings to weekly note |
| Monthly Note Integration | `false` | Add this month's meetings to monthly note |

### Filename Template Tokens

`{title}`, `{id}`, `{created_date}`, `{updated_date}`, `{created_time}`, `{updated_time}`, `{created_datetime}`, `{updated_datetime}`

## Requirements

- NotePlan v3.5.2+
- Active Granola AI account
- Granola desktop app installed and authenticated (macOS)

## Support

- [GitHub Issues](https://github.com/dannymcc/Granola-to-NotePlan/issues)
- [Source Repository](https://github.com/dannymcc/Granola-to-NotePlan)

## Acknowledgments

- [Joseph Thacker](https://josephthacker.com/) for discovering the Granola API access method
- [Granola AI](https://granola.ai) for creating an amazing meeting assistant
- The NotePlan community for plugin development resources
