# Canvas View Changelog

## [0.8.0] - 2026-09-25 (unreleased)

- New command: `/new canvas` — creates an empty `.canvas` file (in the Canvas
  folder setting, or `Canvases/` by default; a folder prefix in the name works)
  and opens it. Opening an existing name just opens it.
- All UI strings are in English for the community release.

## [0.7.0] - 2026-09-25 (unreleased)

- Copy & paste: ⌘C puts the selection on the system clipboard as a JSON Canvas
  snippet, ⌘V pastes it at the view center with fresh ids — works across canvases
  (and from any app that puts JSON Canvas on the clipboard).
- File cards refresh their note content when the canvas window regains focus, so
  edits made in the NotePlan editor show up without reopening (throttled; never
  interrupts an open card editor).
- F zooms to the selection; with nothing selected it fits the whole canvas.

## [0.6.4] - 2026-09-25 (unreleased)

Obsidian-style group interaction:

- An unselected group's interior behaves like the background: rubber-band its
  children, double-click to create a card inside; the group activates only by
  its frame (~14 px, zoom-independent) or its label.
- Once selected, the group drags from anywhere inside its bounds.
- Starting any background action (click or rubber-band) drops the old selection
  immediately; a rubber band that fully encloses a group selects the group too.

## [0.6.0] - 2026-09-24 (unreleased)

Obsidian parity push:

- Drag-to-add: grab a palette button and drop it where the card should appear
  (clicking still creates at the center).
- Note picker with autocomplete: adding a note card (or double-clicking a file
  card's header) opens a search over all NotePlan notes — arrows + Enter to pick,
  free text is kept as a raw path.
- Images: file cards pointing at png/jpg/gif/webp/svg render the image.
- Link cards embed a live website preview (iframe; sites that forbid embedding
  via X-Frame-Options show blank — see README limitations).
- The canvas now opens in a split pane inside the main NotePlan window by default
  (setting: "Open canvas in the main window").

## [0.5.0] - 2026-09-24 (unreleased)

- Groups fixed: the edges SVG layer sat above groups and swallowed their clicks —
  now clicks pass through, so groups select, drag, resize and rename normally.
- Group creation: ⌘G wraps the current selection in a group; the palette also has
  a "＋ група" button.
- New-card palette (top-left): create text, note (file) and group cards; the right
  editor opens immediately after creation. (No separate "link" button — text cards
  autolink URLs; the link node type is still read/rendered for Obsidian compatibility.)
- Obsidian-style selection: plain drag on the background draws a rubber-band
  selection (Shift+drag pans; scroll/trackpad pans as before). The selection toolbar
  gained a ⊞ button that wraps the selected cards in a group.
- Markdown: `- [ ]` / `- [x]` checkboxes render in cards.

## [0.4.1] - 2026-09-24 (unreleased)

- File cards render the linked note's CONTENT (like Obsidian) and edit it inline:
  double-click the body to write — saved straight into the NotePlan note; if the note
  doesn't exist yet, it is created on first save. Double-click the header to change
  which file the card points to. ⌘+click opens the note.
- URL/path editors are now full-card inline inputs instead of a floating box.

## [0.3.0] - 2026-09-21 (unreleased)

Editing parity push (Obsidian-like):

- Create text cards: double-click empty canvas.
- Draw edges: hover a card, drag from a side anchor dot onto another card.
- Selection: click, shift+click multi-select, shift+drag marquee; Esc clears.
- Delete (⌫), duplicate (⌘D), undo/redo (⌘Z / ⇧⌘Z).
- Resize: 8 handles on a single selected card.
- Colors: floating toolbar (6 presets + none) or keys 1–6 / 0; works for edges too.
- Edge labels: double-click an edge to add/edit; group labels editable the same way.
- Dragging a group moves everything fully inside it.
- Architecture: state now lives in the window (requiredFiles/canvasClient.js); the
  plugin persists whole documents via 'saveCanvas' (debounced 400 ms, validated
  before writing). Unknown fields from other tools survive.

## [0.2.0] - 2026-09-20 (unreleased)

- Editing: drag nodes to move them, double-click a text node to edit its markdown
  (Cmd+Enter or click away to save, Esc to cancel); changes are written back to the
  same `.canvas` file, staying compatible with Obsidian (unknown fields preserved).
- Note links (file nodes, `[[wikilinks]]`) now open via the np.Shared comms bridge —
  `noteplan://` links are blocked inside the HTML window, so clicks are relayed to the
  plugin, which calls `Editor.openNoteByTitle`. A message explains when the note
  doesn't exist in NotePlan yet.
- Edges are drawn client-side and follow nodes live while dragging.

## [0.1.0] - 2026-09-20 (unreleased)

- Initial version: `/open canvas` command — read-only viewer for JSON Canvas (`.canvas`)
  files with pan & zoom, all four node types (text, file, link, group), edges with labels
  and arrows, preset + hex colors, clickable note links.
