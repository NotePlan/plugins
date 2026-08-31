---
name: noteplan-plugin-note-editing
description: >-
  NotePlan plugin patterns for editing open notes: paragraph updates, frontmatter,
  metadata lines, re-run/refresh flows, and Editor scroll position. Use when search
  results or note intro metadata is stale, paragraph edits do not persist,
  ensureFrontmatter clobbers changes, frontmatter title is wiped on re-run, or
  writing to DataStore vs Editor.
---

# NotePlan plugin note editing

## Symptom → likely cause

| Symptom | Likely cause |
|--------|----------------|
| Results section updates; intro line (counts/date) stays old | Metadata path not calling `updateParagraph()` on **`Editor`**, or `note.content` rewrite after paragraph edit |
| Frontmatter `title` missing after re-run | Title set only on API setter, no `title:` YAML line; or `removeParagraph` re-parse dropped it |
| Title appears briefly then vanishes | `setNoteFrontmatterAttributes` without YAML sync; then H1 removal / re-parse |
| Re-run updates wrong note or nothing visible | Writing to `DataStore` / `Editor.note` while user has note open — use **`Editor`** via `getFrontmatterWriteTarget` |
| Results note opens scrolled to bottom after re-run | `replaceSection` / `insertParagraph` / `note.content = …` on open note; call `scrollEditorToStartOfActiveNote` after writes |

## Rules

### 1. Use `getFrontmatterWriteTarget(note)` for **all** writes when the note may be open

When `note.filename === Editor.note.filename`, paragraph and frontmatter writes must go to **`Editor`**, not `Editor.note`:

- `updateParagraph`, `insertParagraph`, `removeParagraph`, `removeParagraphAtIndex`
- `frontmatterAttributes` (via `setNoteFrontmatterAttributes`)

`Editor.note` is a separate object; mutations on it often **do not persist** in the UI.

```javascript
const writeTarget = getFrontmatterWriteTarget(note)
const para = writeTarget.paragraphs[index]
para.content = newLine
writeTarget.updateParagraph(para)
```

On re-run, pass **`Editor`** (not `Editor.note`) as `targetNote` to `writeSearchResultsToNote`.

### 2. Frontmatter title needs YAML **and** API

`setNoteFrontmatterAttributes` (in `@helpers/NPFrontMatter`):

1. Merges attributes from parsed YAML + existing API
2. **Syncs `title:` / `icon:` lines into the YAML block** (`syncFrontmatterAttributeLines`)
3. Sets `Editor.frontmatterAttributes` (and `Editor.note` when open)

API-only `title` is lost when NotePlan re-parses frontmatter from body after `removeParagraph` or `updateParagraph`.

### 3. Never let `note.content = …` run after paragraph edits (except targeted H1 strip)

`ensureFrontmatter()` may assign stale `note.content` and undo paragraph edits.

**Safe order when updating a results note:**

1. Replace result sections (`replaceSection`, `removeSection`) on `getFrontmatterWriteTarget(note)`
2. Update metadata intro line (`insertOrReplaceMetadataLine` → `updateParagraph`)
3. Set frontmatter title (`finaliseSpecificSearchResultNote` / `setNoteFrontmatterAttributes`)
4. Set icon (`setIconForNote` — merges, does not replace)
5. Remove legacy body H1 (`removeBodyH1IfTitleInFrontmatter`) — **last** body change
6. Scroll to top (`scrollEditorToStartOfActiveNote`)

`updateParagraph()` on metadata can wipe a frontmatter block added earlier in the same run — do not run `ensureFrontmatter` / finalise **before** metadata.

### 4. H1 removal on open notes

`removeParagraph*` on `Editor` often does not remove the line. `removeBodyH1IfTitleInFrontmatter` falls back to stripping the `# Title` line from `note.content`, then re-calls `setNoteFrontmatterAttributes`.

Detect H1 by `headingLevel === 1`, raw `#` prefix, or content matching frontmatter title (paragraph `type` varies).

### 5. Scroll to top after bulk edits

`replaceSection`, large `insertParagraph`, and `note.content = …` leave the open Editor scrolled to the **bottom**.

After writing search results:

```javascript
scrollEditorToStartOfActiveNote(note) // uses Editor.highlightByIndex at start of active body
```

When **opening** a results note in split view, pass start-of-body char index to `openNoteByFilename` (not `0, 0`):

```javascript
const charIndex = getStartOfActiveContentCharIndex(resultsNote)
await Editor.openNoteByFilename(filename, false, charIndex, charIndex, true)
```

Pattern from `jgclark.WindowTools/src/openers.js`.

### 6. Find metadata by paragraph index, not `lineIndex`

Use `findFirstSectionHeadingParagraphIndex` and paragraph array index. Detect metadata with a tolerant matcher (re-run link + `from N notes`).

### 7. Match section headings consistently

Saved search sections use `[KeyChanges]`. Try legacy formats when replacing: `'term'`, `term`, `[term]`.

### 8. Re-run (`destination: 'refresh'`) routing

If `Editor.note` is a dedicated results note (`[searchTerms] ${config.searchHeading}`), route to `writeToSearchSpecificNote`, not a generic current-note path that skips frontmatter finalisation.

### `ensureFrontmatter` — not deprecated

Use when creating the initial `---` block (legacy H1-only notes). **Avoid** after paragraph-level body edits in the same run; use `setNoteFrontmatterAttributes` instead.

## Checklist for “update intro + results in existing note”

- [ ] `getFrontmatterWriteTarget(note)` for all paragraph writes
- [ ] Pass `Editor` as `targetNote` when results note is open on re-run
- [ ] Section replaced using full `[term]` heading text
- [ ] Metadata line updated (`updateParagraph` on write target)
- [ ] Frontmatter title finalised after metadata (`setNoteFrontmatterAttributes`)
- [ ] Icon after finalise (`setIconForNote`)
- [ ] H1 removed last (`removeBodyH1IfTitleInFrontmatter`)
- [ ] View scrolled to top (`scrollEditorToStartOfActiveNote`)

## Reference implementations in this repo

- `helpers/NPFrontMatter.js` — `getFrontmatterWriteTarget`, `setNoteFrontmatterAttributes`, `syncFrontmatterAttributeLines`
- `helpers/NPnote.js` — `scrollEditorToStartOfActiveNote`, `getStartOfActiveContentCharIndex`
- `jgclark.SearchExtensions/src/searchHelpers.js` — `insertOrReplaceMetadataLine`, `finaliseSpecificSearchResultNote`, `removeBodyH1IfTitleInFrontmatter`, `writeSearchResultsToNote`
- `jgclark.SearchExtensions/src/saveSearch.js` — `refresh` routing, `writeToSearchSpecificNote`
- `jgclark.Reviews/src/reviewHelpers.js` — `updateMetadataInEditor` / `updateParagraph` pattern
- `jgclark.WindowTools/src/openers.js` — open note at start of active content
