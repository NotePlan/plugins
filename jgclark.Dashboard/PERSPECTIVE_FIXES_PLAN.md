# Perspective settings — fix plan and implementation log

**Date:** 2026-05-15  
**Plugin:** `jgclark.Dashboard` v2.4.0.b35  
**Context:** Architecture review found seven bugs in how perspectives are loaded, saved, and switched. This document is the plan that was executed; detailed release notes are in `CHANGELOG.md` under `[2.4.0.b35]`.

> **Note:** Perspective logic lives in the Dashboard plugin only. Changelog entries are in `jgclark.Dashboard/CHANGELOG.md`, not Window Tools.

---

## Goals

1. Persist perspective operations reliably to `settings.json`.
2. Keep top-level `dashboardSettings` in sync with the active perspective when it matters for reopen/switch.
3. Avoid React/plugin races (especially Save+Switch).
4. Stop “success with no save” paths when dashboard settings change but perspective diff is empty.

---

## Fix 1 — `doCopyPerspective` must persist

**Problem:** Copy only called `setPluginData`; reload lost the change.

**Change:** Call `savePerspectiveSettings(revisedDefs)` before updating the WebView.

**Files:** `src/perspectiveClickHandlers.js`

---

## Fix 2 — `doSavePerspectiveSettingsFromBridge` dashboard merge

**Problem:** Spread full `getSettings()` into `dashboardSettings`, polluting the object with `perspectiveSettings` and other top-level keys.

**Change:** New helper `mergeDashboardSettingsForPerspectiveDef()` (same rules as perspective switch: strip tag sections / `includedTeamspaces` from previous, apply defaults, `removeInvalidTagSections`). Use it when the active named perspective is applied to live dashboard settings.

**Files:** `src/perspectiveHelpers.js`, `src/perspectiveClickHandlers.js`

---

## Fix 3 — `addNewPerspective` syncs top-level `dashboardSettings`

**Problem:** Only `perspectiveSettings` was saved; reopening the Dashboard could load stale top-level `dashboardSettings` while the dropdown showed the new active perspective.

**Change:** After saving defs, merge dashboard for the new active def, `saveSettings()` both blobs, `setPluginData` with `pushFromServer`. `doAddNewPerspective` reloads both from disk for the WebView.

**Files:** `src/perspectiveHelpers.js`, `src/perspectiveClickHandlers.js`

---

## Fix 4 — Save+Switch single bridge command

**Problem:** UI sent `savePerspective` then `switchToPerspective` without waiting; switch could clear `isModified` before save completed.

**Change:** New handler `doSavePerspectiveAndSwitchToPerspective` and bridge action `savePerspectiveAndSwitch`. `PerspectiveSelector` uses it for Save+Switch and returns early (no second switch call).

**Files:** `src/perspectiveClickHandlers.js`, `src/pluginToHTMLBridge.js`, `src/types.js`, `src/react/components/Header/PerspectiveSelector.jsx`

---

## Fix 5 — `resolvePerspectivesWhenDashboardSettingsWithoutPerspectivePayload` empty diff

**Problem:** Empty perspective diff returned `kind: 'done'` and skipped all of `doSaveDashboardSettingsFromBridge`, so toggles like `usePerspectives` (stripped before compare) never reached disk.

**Change:** Empty diff → `kind: 'continue'` so `dashboardSettings` still save; do not set `isModified`.

**Files:** `src/perspectiveSettingsOnDashboardSave.js`

---

## Fix 6 — `updateCurrentPerspectiveDef` cleans settings

**Problem:** Command saved raw `getDashboardSettings()` into the perspective def (FFlags, `lastChange`, etc.).

**Change:** Use `cleanDashboardSettingsInAPerspective()` before assign.

**Files:** `src/perspectiveHelpers.js`

---

## Fix 7 — `deletePerspective` pushes correct defs to React

**Problem:** After deleting the active perspective, `setPluginData` used pre-`switchToPerspective` array (wrong `isActive` flags).

**Change:** `setPluginData` with result of `switchToPerspective('-', …)` when delete was active. Guard `deleteAllNamedPerspectiveSettings` when switch fails.

**Files:** `src/perspectiveHelpers.js`

---

## Shared helper

```text
mergeDashboardSettingsForPerspectiveDef(perspectiveDef, prevDashboardSettings, defaults, lastChange?)
```

Used by: `doSwitchToPerspective`, `doSavePerspectiveSettingsFromBridge`, `addNewPerspective`.

---

## Testing suggestions

1. **Copy settings to…** — copy, quit Dashboard, reopen; target perspective should retain copied filters.
2. **Save as New Perspective** — add, close window, reopen; filters match new perspective (not previous).
3. **Save+Switch** — modify named perspective, Save+Switch; target loads saved values.
4. **usePerspectives** — on named perspective, toggle perspectives off/on; setting persists.
5. **/update current perspective** (if used) — def on disk has no `FFlag_*` / `lastChange` noise.
6. **Delete active perspective** — dropdown shows `-` active; `isActive` correct without manual refresh.

---

## Not in this pass (known follow-ups)

- Duplicate name guard on rename/copy.
- PerspectivesTable cancel/`isModified` UI desync (see TODO in `PerspectivesTable.jsx`).
- `ensureDefaultPerspectiveExists` / multiple `isActive` repair.
- Refactor `getDashboardSettingsFromPerspective` in `reactMain.js` to use `mergeDashboardSettingsForPerspectiveDef` (optional DRY).
