# Agent instructions (NotePlan plugins)

Hub for AI agents working in this repository. Read this first; follow links for
depth. Do not duplicate these rules into chat replies.

## Layout

| Path | Role |
| --- | --- |
| [`agents/skills/`](agents/skills/) | On-demand workflows (read the matching `SKILL.md` when relevant) |
| [`agents/docs/`](agents/docs/) | Canonical conventions and reference |
| [`.cursor/rules/`](.cursor/rules/) | Cursor always-on short rules (point here for full text) |
| [`.cursor/agents/`](.cursor/agents/) | Cursor specialized subagents |
| [`scripts/nplog/`](scripts/nplog/) | Log tool: [`README.md`](scripts/nplog/README.md) (usage), [`AGENTS.md`](scripts/nplog/AGENTS.md) (maintainer / parser) |

Root [`docs/`](docs/) is generated helper API HTML -- not agent instructions.

## Skills (use when relevant)

- **[nplog](agents/skills/nplog/SKILL.md)** -- read NotePlan plugin logs via
  `nplog --json`. Never grep the raw log. After an x-callback, use
  `--follow --wait-idle 5`.
- **[debugging-freezes](agents/skills/debugging-freezes/SKILL.md)** -- freezes,
  hangs, infinite loops, JSContext stalls.

Cursor also loads these from `.cursor/skills/` (`SKILL.md` file symlinks into
`agents/skills/`). Claude Code: same under `.claude/skills/`. Specialized Dashboard
debugging: [`.cursor/agents/dashboard-log-debugger.md`](.cursor/agents/dashboard-log-debugger.md).

## Docs (canonical conventions)

- **[programming.md](agents/docs/programming.md)** -- imports, domain facts,
  style, helpers, testing, settings path, changelog
- **[react-html.md](agents/docs/react-html.md)** -- React memoization, Promise
  polyfills, DynamicDialog, theme CSS variables
- **[writing-style.md](agents/docs/writing-style.md)** -- plain ASCII punctuation,
  Markdown lists, raw markdown for deliverables

## Non-negotiables (always)

1. Static `import` only -- no `require`, no dynamic imports (Rollup).
2. Do not `npm run build` plugins; leave builds to the programmer.
3. Do not commit or push unless the user explicitly asks.
4. Never grep the raw NotePlan log -- use the nplog skill.
5. Prefer `npx flow` for typecheck; always pass `--no-watch` to jest.
6. Wrap React context/child callbacks in `useCallback`; memoize AppContext with
   `useMemo` (see react-html doc).

## Tooling pointers

- Plugin APIs: `@flow-typed/Noteplan.js` (prefer over the public website)
- React communication patterns:
  `dwertheimer.ReactSkeleton/REACT_COMMUNICATION_PATTERNS.md`
- DynamicDialog field types:
  `helpers/react/DynamicDialog/CREATING_NEW_DYNAMICDIALOG_FIELD_TYPES.md`
- Human contrib / Flow primers: `GithubFlow.md`, `Flow_Guide.md` (not agent rules)
