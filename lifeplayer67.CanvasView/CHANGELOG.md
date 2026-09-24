# Canvas View Changelog

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
