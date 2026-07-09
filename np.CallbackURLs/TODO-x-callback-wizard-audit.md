# TODO: X-Callback Wizard audit vs NotePlan docs

Reference: [NotePlan x-callback-url scheme](https://help.noteplan.co/article/49-x-callback-url-scheme)

Compiled 2026-05-27 after fixing `/addNote` `noteText` → `text` (v1.11.1).

---

## Summary

| Status | Count |
|---|---|
| Correct / aligned | 8 actions |
| Bugs in generated URLs | 2 in `/addNote` |
| Doc vs code naming uncertainty | 1 (`filename` vs `fileName`) |
| Wizard UX gaps (valid params not offered) | Several |

---

## Priority fixes

- [ ] **`/addNote` — gate window params on `openNote=yes`**
  - Lines 266–268 always ask about floating/split/existing window.
  - If user chooses `openNote=no` but `subWindow=yes`, window params can still end up in the URL.
  - `/addText` only collects window options when `openNote=yes`.

- [ ] **`/addNote` — `useExistingSubWindow` must include `subWindow=yes`**
  - `createAddTextCallbackUrl()` and `createOpenOrDeleteNoteCallbackUrl()` both add `&subWindow=yes` when `useExistingSubWindow=yes` (required per docs/CHANGELOG).
  - `addNote()` can emit `useExistingSubWindow=yes` alone — broken URL.

- [ ] **`/addNote` — refactor to use `askOpenType()`**
  - Would match open/addText flows and fix the two bugs above.
  - Note: `/addNote` docs do not list `reuseSplitView` (only `/openNote` does).

- [ ] **`/addNote` — validate title or text required**
  - Docs: *"A new note should have either a title or a text. Empty notes are not allowed."*
  - Wizard allows both blank and still builds a URL.

- [ ] **`/search` — empty text should clear search**
  - `search()` returns `''` if user submits empty text.
  - Docs say empty `text` clears the search field — should emit `search?text=`.

---

## Lower priority / UX gaps

- [ ] **`/addText` — offer `noteTitle` path**
  - Currently only `chooseNote()` → filename, or calendar date.
  - Docs support `noteTitle` for regular notes.

- [ ] **`/deleteNote` — offer delete by title**
  - Menu label says "DELETE a note by title" but wizard only supports calendar date or pick-note (filename).

- [ ] **`/openNote` — offer open by note title**
  - Currently only `chooseNote()` → filename, or calendar date.

- [ ] **`/openNote` — ISO week calendar form**
  - Docs support `noteDate=2022-W32`; wizard only offers day dates (`today`, `yesterday`, `tomorrow`, YYYYMMDD).

- [ ] **Combined search wizard**
  - File TODO already notes: `search?text=` or `search?filter=Upcoming`.
  - Filter exists via `getFilter()` as separate menu item; could unify.

---

## Doc vs code naming (verify in NotePlan)

- [ ] **`filename` vs `fileName`**
  - Docs use `filename` for `/openNote` but `fileName` for `/addText` and `/deleteNote`.
  - Plugin consistently emits **`filename`** (lowercase) everywhere, including tests.
  - Likely works despite doc inconsistency — quick live test if anything fails.

---

## Per-action status (reference)

### `/openNote` — mostly correct

| Doc param | Wizard | Status |
|---|---|---|
| `noteDate` | today / yesterday / tomorrow / YYYYMMDD | OK |
| `timeframe` | week / month / quarter / year (calendar only) | OK |
| `noteTitle` | Heading/line links: `#heading` or `^blockId` | OK |
| `filename` | chooseNote() → note filename | OK |
| `heading` | Separate param when filename + heading | OK |
| Window params | askOpenType(); companion params in helper | OK |
| `highlightStart` / `highlightLength` | askHighlight() | OK |

Known workaround: "Open a Folder" uses `openNote?filename=<folder>` (see `NPOpenFolders.js`).

### `/addText` — correct params, UX gaps

| Doc param | Wizard | Status |
|---|---|---|
| `noteDate` | Calendar path | OK |
| `noteTitle` | Not offered | Gap |
| `fileName` | Emitted as `filename` | See naming note |
| `text`, `mode`, `openNote` | OK | OK |
| Window params | Only when openNote=yes via askOpenType() | OK |
| `reuseSplitView` | In helper; not in addText docs | Undocumented but intentional |

### `/addNote` — 2 bugs + gaps

| Doc param | Wizard | Status |
|---|---|---|
| `noteTitle`, `text`, `folder`, `openNote` | OK (text fixed 1.11.1) | OK |
| Window params | Three separate yes/no prompts | Bugs |
| `highlightStart` / `highlightLength` | When openNote=yes | OK |

### `/deleteNote` — correct, limited UX

Uses `filename` via chooseNote(); no title path.

### `/openView` — correct

`name` + `folder` via `openFolderView()`. Default folder view uses openNote hack.

### `/search`, `/selectTag`, `/installPlugin`, `/toggleSidebar` — correct

### `/runPlugin`, `/noteInfo`, heading/line links — correct

### Not NotePlan x-callback

- `runShortcut` — Apple Shortcuts URL
- Templating / TemplateRunner — plugin-specific

---

## Done

- [x] **`/addNote` — `noteText` → `text`** (v1.11.1)
