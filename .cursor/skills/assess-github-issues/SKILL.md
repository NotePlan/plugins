---
name: assess-github-issues
description: >-
  Assess open GitHub issues for triage (close vs keep), map each to a plugin or
  scope, and write a CSV report. Use when the user asks to assess, triage, or
  review open GitHub issues, especially NotePlan/plugins issues, or to produce
  an issues assessment CSV in docs/.
---

# Assess GitHub Issues

Triage open GitHub issues and write a CSV assessment for reuse.

## When to use

- Assess / triage open issues (optionally filtered by assignee, date, labels)
- Decide close vs keep for old Feature Requests and Bug Reports
- Map issues to plugins or core API/UI scope
- Produce `docs/*-issues-assessment.csv`

## Inputs (ask if missing)

1. **Repo** — default: current `gh` remote (for this workspace usually `NotePlan/plugins`)
2. **Filter** — assignee, created-before/after, labels, or “all open”
3. **Exclude** — issue numbers already assessed (e.g. prior CSV)
4. **Output path** — default: `docs/<filter>-open-issues-assessment.csv`

## Workflow

1. Resolve repo: `gh repo view --json nameWithOwner -q .nameWithOwner`
2. Fetch issues (paginate if needed):

```bash
gh issue list --state open --limit 500 \
  --json number,title,assignees,labels,createdAt,updatedAt,body,url
```

Optional filters:
- `--assignee LOGIN`
- Then `jq` for date windows, e.g. `select(.createdAt < "2025-01-01")`
- Exclude prior numbers: `select(.number as $n | ($exclude | index($n) | not))`

3. Sort by `createdAt` ascending unless the user asks otherwise.
4. For each issue, assess using the categories below. Prefer evidence over age alone:
   - Search codebase: `flow-typed/Noteplan.js`, plugin `CHANGELOG.md`, helpers, `plugin.json`
   - Read issue comments when status is unclear: `gh issue view N --comments`
5. Write CSV (UTF-8) with the columns below.
6. Reply with path + short summary counts by assessment category.

## Assessment categories (use exactly one)

| Assessment | When |
|---|---|
| `Closed (too old)` | Stale and no longer relevant; abandoned tooling/plugin; no clear supersession but not worth keeping |
| `Closed (superseded)` | Clearly implemented or replaced (API exists, feature shipped, plugin removed/replaced) — cite evidence in comments |
| `Still useful - Feature Request` | Valid enhancement still worth doing |
| `Still useful - Bug Report` | Defect still plausible / unreproduced fix |
| `Still useful - Question/Docs` | Docs, how-to, or clarification |
| `Still useful - Housekeeping` | Cleanup, rationalisation, tooling/deps |

**Rules**
- Do **not** close solely because an issue is old if the request is still valid.
- Use `Closed (superseded)` only with evidence (API in typings, changelog, code path, removed plugin).
- Be conservative: when unsure between superseded and still useful, keep as still useful and note uncertainty.
- Correct title/number mapping carefully when batching; never swap fields across issues.

## CSV columns

```
issue_number,title,url,created_date,updated_date,assignee,assessment,plugin_or_scope,comments
```

- `created_date` / `updated_date`: `YYYY-MM-DD`
- `assignee`: semicolon-separated GitHub logins (empty if none)
- `plugin_or_scope`: plugin id (e.g. `np.Templating`, `jgclark.Dashboard`) or scope (`NotePlan core API`, `Plugin Settings UI`, `noteplan-cli`, `helpers/userInput`, `Plugin ecosystem`)
- `comments`: 1–2 sentences; mention evidence for supersession

## NotePlan/plugins scope hints

| Signal in title/body | Likely scope |
|---|---|
| CommandBar, DataStore, Editor, HTMLView, triggers, settings schema | NotePlan core API / UI |
| Templating, `<%`, frontmatter templates | `np.Templating` |
| Dashboard, perspectives | `jgclark.Dashboard` |
| Meeting note, MEETINGNOTE | `np.MeetingNotes` / `jgclark.EventHelpers` |
| Search Extensions | `jgclark.SearchExtensions` |
| Filer / move paragraphs | `jgclark.Filer` |
| Reviews / project list | `jgclark.Reviews` |
| Repeat / @repeat | `jgclark.RepeatExtensions` |
| AutoTimeBlocking / ATB | `dwertheimer.EventAutomations` |
| Task Automations / mat | `dwertheimer.TaskAutomations` |
| noteplan-cli / npc | `noteplan-cli` |
| chooseFolder / helpers | `helpers/userInput` |

Common supersession checks:
- `DataStore.fileExists`, `keyModifiers`, `HTMLView.showWindowWithOptions` / `customId` → often supersede older API asks
- `nmn.Templates` → replaced by `np.Templating`
- Dashboard TAG section → may supersede “todos by #tag” requests (check whether *multiple* tag sections were requested)

## Output quality checklist

- [ ] Every filtered issue appears exactly once
- [ ] Assignees match live issue JSON
- [ ] Titles match issue numbers (no swapped rows)
- [ ] Superseded items have concrete evidence in `comments`
- [ ] Summary counts reported to the user
- [ ] CSV written under `docs/` unless user chose another path
