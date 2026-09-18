# Agent writing style

Rules for plans, docs, changelogs, comments, and other markdown the agent writes.

Cursor injects short always-on reminders via `.cursor/rules/no-emdash.mdc`,
`no-bullet-characters.mdc`, and `raw-markdown-output.mdc` -- this file is the
canonical full text.

## Plain ASCII punctuation

Do not use smart / curly quotes or emdash / endash.

| Avoid | Use |
| --- | --- |
| `“` `”` | `"` |
| `‘` `’` | `'` |
| `—` (emdash) or `–` (endash) | spaced double hyphen: ` -- ` |

A single hyphen (`-`) is fine for list markers, compound words, and simple separators.
Apostrophes in contractions use straight `'` (e.g. `don't`, `Dashboard's`).

```markdown
<!-- BAD -->
Status: design only — not implemented
schema mixes “who changed” with “done counts”

<!-- GOOD -->
Status: design only -- not implemented
schema mixes "who changed" with "done counts"
```

Mid-sentence subclause: a pair of spaced double hyphens:

```markdown
The filter -- when enabled -- hides completed items.
```

## Lists

Never use Unicode bullet characters (`•`, `●`, `◦`, etc.).

Always write Markdown lists as `- ` then the item text.

## Raw markdown for written deliverables

When the user wants written output meant to be read or copied as markdown source
(CHANGELOG summaries, release notes, docs drafts, etc.), show the **actual
markdown characters**, not a rendered version.

Put that content in a fenced code block (e.g. ` ```markdown `) so `#`, `-`, and
other markup stay visible. Apply this to final deliverable prose, not to normal
conversational replies or tool traces.
