# dwertheimer.TaskSorting Changelog

## About dwertheimer.TaskSorting Plugin

See Plugin [README](https://github.com/NotePlan/plugins/blob/main/dwertheimer.TaskSorting/README.md) for details on available commands and use case.

## [1.3.1] - 2026-08-11 (@dwertheimer)

### Fixed
- **Tags and mentions containing accented, non-Latin or symbol characters were truncated when sorting** ([#776](https://github.com/NotePlan/plugins/issues/776)). The tag-matching regex only accepted `a-z`, `A-Z`, `0-9` and `/`, so `#Führung` was read as the tag `F` — which sorted wrongly and produced a `#### #F:` heading when *Include Primary Sort Key Heading in Output?* was on.
- Tag and mention matching now follows the same rule NotePlan itself uses, verified case by case against the app's own `paragraph.hashtags` / `paragraph.mentions`: letters, combining marks and digits of **any** script, plus **any** Unicode symbol (`$ + = ~ ^ < | € £ ° →` and emoji), plus the three punctuation exceptions `-`, `_` and `/`. Every other punctuation character (`. , % & ' ! ? : ; ( ) [ ] { } * @ " \ #`) and any whitespace ends the tag, so ordinary sentence punctuation is not swallowed (`#shopping.` still sorts as `shopping`).
- Consequences of the above, all matching NotePlan: `#my-tag` now sorts as `my-tag` rather than `my`; a trailing slash is trimmed (`#tag/` → `tag`); and a tag that is only digits and dashes (`#123`, `#2024-05`) is correctly not treated as a tag at all.
- Mentions get the same treatment (`@Müller` no longer becomes `@M`). As in NotePlan, the trailing `(...)` is not part of the mention, so `@estimate(2)` and `@estimate(5)` still sort together under `@estimate`.

## [1.3.0] - 2026-08-02 (@dwertheimer)

### Fixed
- **Multi-level indented subtasks are no longer flattened when sorting.** Nesting was only ever tracked one level deep: a grandchild was compared against the top-level task rather than its own parent, so it came back out as a *sibling of its own parent*, and every level below the first collapsed into one. Sorting now tracks nesting to arbitrary depth, and a sorted task carries its whole subtree with it at the original depths.
- Related: the code that removes tasks before re-inserting them in sorted order only walked one level of children, so on a deeply-nested note grandchildren were left behind and duplicated. It now walks the whole subtree.
- **`Sort tasks under heading` ignored the "Combine Related Task Types?" setting.** Its `interleaveTaskTypes` parameter defaulted to `true` and the setting was never consulted, so running the command from the menu always combined the types regardless of your preference — while `Sort tasks on the page` honoured it. The two commands disagreed about the same setting. It now falls back to the setting when no explicit argument is given; templates and x-callbacks passing an explicit value still override it.
- **Missing argument when inserting sorted tasks at the end of a heading section.** `insertParagraphAfterParagraph(content, otherParagraph, paragraphType)` was being called with only two arguments, so `paragraphType` arrived as `undefined`. The call was made through a computed function name (`note[insertFunc](...)`), which hid the fact that the two possible targets have different arities. Now split into explicit branches, with `'text'` passed to match every other insertion path in the same function. Affects sorting under a heading when the *tasks to top* setting is off.

### Notes
- Subtasks keep their **document order** within their parent; only the top level is re-ordered. This is deliberate: a parent's children include notes and quotes whose meaning depends on where they sit (e.g. a `> quote` referring to the line above it), and sorting those alphabetically moves them away from what they refer to.
- **Known NotePlan limitation:** indentation made of *spaces* is not visible to plugins. NotePlan's parser reports space-indented lines as `indents: 0` and strips the leading spaces from `rawContent`, so the nesting information is gone before any plugin runs. **Indent with tabs** for sorting to preserve your structure. Raised with @EduardMe.

## [1.2.9] - 2026-04-04 (@dwertheimer)

- **Sort tasks on the page** (`sortTasks`): optional **Note** or **Editor** as last argument (same idea as **Sort tasks under heading**), for templates/plugins when you must target the note you are editing.
- **Quick sort commands** (`tasksToTop`, `sortTasksDefault`, `sortTasksByDue`, `sortTasksByPerson`, `sortTasksByTag`, `sortTasksTagMention`): optional **Note** or **Editor** as sole extra argument when called from code.
- **README:** Plain-language guide to combined vs traditional grouping (⚪ circle vs 🔲 box tasks, with and without type headings).

## [1.2.8] - 2025-11-10 (@dwertheimer)

- Fix for sorting tasks with combined/interleaved tasks and checklists

## [1.2.7] - 2025-11-06 (@dwertheimer)

### New Features
- **NEW**: Interactive mode (`/ts`) now prompts users to choose task type grouping (combine related types or keep separate)
- **NEW**: Added plugin setting "Combine Related Task Types?" for quick sort commands (`/tsd`, `/tsm`, `/tst`, `/tsc`)
  - When enabled (default): Combines tasks (`*`) with checklists (`+`) into 4 logical groups
  - When disabled: Keeps all 8 task types completely separate (traditional mode)
- **NEW**: Customizable task type headings - 8 new settings allow you to rename headings for localization or personal preference
  - Configure in Plugin Preferences → "Task Type Heading Customization"
  - Examples: Change "Open Tasks" to "Tareas Abiertas" (Spanish) or "任務開放" (Chinese)
- **NEW**: Setting to control display of empty task category headings
  - "Show Empty Task Category Headings?" (default: off)
  - When disabled, only categories with tasks will show headings

### Bug Fixes
- **FIXED**: Task type headings (e.g. "Open Tasks:", "Completed Tasks:") no longer duplicate when running sort commands multiple times
- **FIXED**: Headings now appear correctly in interactive mode when user selects "yes" to include headings
- **FIXED**: Scheduled tasks now appear under "Scheduled Tasks" heading instead of being incorrectly grouped under "Open Tasks" when both headings and interleaving are enabled
- **FIXED**: Task type sections now output in correct order (Open → Scheduled → Done → Cancelled) instead of reversed order when using headings with interleaving
- **FIXED**: Corrected "Completed Cancelled Items" typo to "Cancelled Checklist Items"
- **FIXED**: Empty task category headings (with no tasks underneath) are now properly removed to avoid clutter

### Improvements
- **IMPROVED**: All default sort commands now respect the new "Combine Related Task Types?" setting
- **IMPROVED**: Better documentation and clearer command descriptions for task grouping feature
- **IMPROVED**: Added detailed logging for interleaving choices in debug mode

## [1.2.6] - 2025-09-23 (@dwertheimer)

- Add logging for jgclark to sortTasksUnderHeading
- Add ability to pass all params to /ts and /tsh commands
- remove sortTasksViaTemplate code which was never a published command
- change default behavior of /ts* commands to interleave task types (open/checklist together)
- **NEW**: Add `sortInHeadings` parameter to `/ts` command to override DataStore setting
  - `sortInHeadings: false` treats entire note as one unit (moves all open tasks to top)
  - `sortInHeadings: true` sorts tasks within each heading separately (default behavior)
  - Allows x-callback-url calls to specify sorting behavior regardless of user's DataStore settings 
- Fix bug where tasks were not being sorted in headings for frontmatter-only notes

## [1.2.4] - 2025-08-31 (@dwertheimer)

- Add saveEditorIfNecessary() to all commands

## [1.2.3] - 2025-08-29 (@dwertheimer)

- Add sortTasksViaTemplate command to sort tasks via a template.

## [1.2.2] - 2025-08-29 (@dwertheimer)

- Remove NotePlan popup nag on repeat deletion check using Editor.skipNextRepeatDeletionCheck

## [1.2.1] - 2025-08-29 (@dwertheimer)

- Added noteOverride parameter to sortTasksUnderHeading command for @jgclark

## [1.2.0] - 2025-01-25 (@dwertheimer)

- Added sortTasksUnderHeading command to sort tasks under a heading.
- Added /cnt command

## [1.1.0] - 2024-05-26 (@aaronpoweruser)

- Added /cnt command to copy **all** noteTags to **all** tasks in a note.
- Added an onSave trigger command for cnt.


## [1.0.0] - 2024-01-?? (@dwertheimer)

