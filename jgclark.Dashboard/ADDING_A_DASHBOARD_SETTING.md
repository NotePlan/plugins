# Adding a New Dashboard Setting

When you add a new setting that lives in `dashboardSettings` (or might be confused with it), work through these three decisions and the checklist below.

## Plugin-global vs Dashboard-global vs per-perspective

**Plugin-global** settings live in the **plugin’s settings object** (NotePlan Settings: NotePlan > Settings > AI & Plugins > Dashboard > ⚙️). They are **reserved for values that NotePlan or plugin commands need** when running outside the Dashboard UI (e.g. how to open the window). Declare them in **`plugin.json`** under `plugin.settings` (e.g. `preferredWindowType`). They are **not** part of the `dashboardSettings` object and are **not** in `cleanDashboardSettingsInAPerspective()`.

**Dashboard-global** settings apply to the Dashboard as a whole and are the same for all perspectives, but **do not need to be read by NotePlan or commands**—only by Dashboard code. They live **inside** the `dashboardSettings` object and must be stripped from each perspective’s copy (see (a) below).

**Per-perspective** settings can differ per Perspective and are stored in each perspective’s `dashboardSettings`.

## (a) Per-perspective vs Dashboard-global (both live in `dashboardSettings`)

**Per-perspective:** The setting can differ per Perspective (e.g. "Folders to Include", "Tags to show"). When the user switches perspectives, this value changes.

**Dashboard-global:** The setting is the same for all perspectives and is only used by the Dashboard (e.g. "Enable Perspectives", feature flags like `FFlag_*`). It is not stored inside any perspective’s `dashboardSettings` copy.

- **If Dashboard-global:**  
  - Add the key to the **remove list** in `cleanDashboardSettingsInAPerspective()` in **`src/perspectiveHelpers.js`** (in `patternsToRemove`), so it is never saved into any perspective’s `dashboardSettings`.  
  - Declare it in **`src/types.js`** in the "GLOBAL SETTINGS WHICH APPLY TO ALL PERSPECTIVES" section (with a comment that it must be in `cleanDashboardSettingsInAPerspective()`).
- **If per-perspective:**  
  - Do **not** add it to that remove list. It will be stored in each perspective’s `dashboardSettings` and in the merged “current” dashboard settings.
- **If Plugin-global:**  
  - Do **not** put it in `dashboardSettings`. Add it to **`plugin.json`** under `plugin.settings` and read it from the plugin settings object (e.g. `settings.preferredWindowType`). No change to `cleanDashboardSettingsInAPerspective()` or to the Dashboard settings UI unless you also expose it there.

## (b) Normalizing each perspective on update/install

**Default merge behavior:** When loading or switching perspectives, code merges **defaults** with stored settings (e.g. `getDashboardSettingsDefaults()` in `dashboardHelpers.js`, and in `perspectiveClickHandlers.js` / `clickHandlers.js`). So if the new key has a **default** in `dashboardSettingDefs` or `dashboardFilterDefs` in **`src/dashboardSettings.js`**, existing perspectives will effectively get that default when their settings are merged at runtime. You do **not** need to change `onUpdateOrInstall()` for that.

**When you do need `onUpdateOrInstall()`:**  
- Renaming a key (migration): implement the rename in **`src/index.js`** in `onUpdateOrInstall()` (and update the checklist in `types.js` for renames).  
- Backfilling a new key into **every** stored perspective’s `dashboardSettings` (so saved JSON is updated, not just runtime merge): add logic in `onUpdateOrInstall()` to load `perspectiveSettings`, iterate each perspective, set the new key (e.g. from defaults), and save back.  
- Fixing types (e.g. number-vs-string): `onUpdateOrInstall()` already normalizes some number settings; add similar logic there if needed for the new key.

## (c) Where the value lives

| Location | What it is |
|----------|------------|
| **Plugin settings** (DataStore.settings / settings.json) | The plugin’s settings object. **Plugin-global** keys (e.g. `preferredWindowType`, `pluginID`) live at **top level** here and are defined in **`plugin.json`** under `plugin.settings`—reserved for things NotePlan or commands need. The same object also contains `dashboardSettings` (object) and `perspectiveSettings` (array of `TPerspectiveDef`). Originally, dashboardSettings and perspectiveSettings were stringified JSON; in 2025 they were changed to objects and continue to work. |
| **dashboardSettings** | A single object **inside** plugin settings. It holds **Dashboard-global** keys (same for all perspectives, stripped from each perspective’s copy) and, when perspectives are off, is the only source. When perspectives are **on**, the “current” dashboard settings are built by merging the **active perspective’s** `dashboardSettings` with those Dashboard-global keys (see `getDashboardSettingsFromPerspective()` in `reactMain.js`). Dashboard-global keys are stripped from each perspective’s copy by `cleanDashboardSettingsInAPerspective()`. |
| **perspectiveSettings** | Array of `TPerspectiveDef`. Each item has `dashboardSettings` (per-perspective keys only; Dashboard-global keys are removed before saving here). So: **per-perspective** value → stored in `perspectiveSettings[i].dashboardSettings`; **Dashboard-global** value → stored only in the top-level `dashboardSettings` object. |

So: **Plugin-global** = top-level keys on the plugin settings object (not inside `dashboardSettings`). **Dashboard-global** = keys inside the top-level `dashboardSettings` object only. **Per-perspective** = each `TPerspectiveDef.dashboardSettings` (and reflected in the merged “current” dashboard settings when that perspective is active).

---

## Checklist when adding a new setting

Use this together with the notes in **`src/types.js`** (around the `TDashboardSettings` type).

1. **Decide scope:** Plugin-global (plugin settings, for NotePlan/commands), Dashboard-global (same for all perspectives, Dashboard-only), or per-perspective. If **Dashboard-global**, add to `cleanDashboardSettingsInAPerspective()` in **`src/perspectiveHelpers.js`** and to the global section in **`src/types.js`**. If **Plugin-global**, add to **`plugin.json`** under `plugin.settings` and do not put in `dashboardSettings`.
2. **Define the setting** (Dashboard-global or per-perspective only; Plugin-global uses `plugin.json` only):  
   - Add to **`src/dashboardSettings.js`**: either `dashboardSettingDefs` or `dashboardFilterDefs` (with `key`, `type`, `default`, etc.).  
   - Add the key (and type) to **`src/types.js`** in `TDashboardSettings` (Dashboard-global block or per-perspective block as decided).
3. **Defaults:** The default from `dashboardSettingDefs` / `dashboardFilterDefs` is used by `getDashboardSettingsDefaults()` (in **`src/dashboardHelpers.js`**) and by **`src/react/support/settingsHelpers.js`** (`dashboardSettingsDefaults`). So adding a default there is enough for (b) for normal “merge at runtime” behavior.
4. **Numbers:** If the setting is numeric and might be stored as a string, ensure **`src/dashboardHelpers.js`** `getDashboardSettings()` (and optionally **`src/index.js`** `onUpdateOrInstall()`) normalizes it, consistent with existing number settings.
5. **Renames only:** If you are **renaming** an existing key, update **`src/index.js`** `onUpdateOrInstall()` for migration, and update **`src/types.js`**, **`src/dashboardSettings.js`**, and **`src/perspectiveHelpers.js`** `cleanDashboardSettingsInAPerspective()` as in the comments in `types.js`.

---

## Reference: where things are implemented

- **Types and checklist comments:** `src/types.js` (`TDashboardSettings`, “GLOBAL SETTINGS”, “if you add a new setting”, “if you change a setting name”).
- **Plugin-global (NotePlan/commands):** `plugin.json` → `plugin.settings`; read via plugin settings object (e.g. in `reactMain.js` for `preferredWindowType`).
- **Dashboard-global vs per-perspective (strip list):** `src/perspectiveHelpers.js` → `cleanDashboardSettingsInAPerspective()` → `patternsToRemove`.
- **Setting definitions and UI:** `src/dashboardSettings.js` (`dashboardSettingDefs`, `dashboardFilterDefs`, `createDashboardSettingsItems()`).
- **Defaults used at runtime:** `src/dashboardHelpers.js` → `getDashboardSettingsDefaults()`; `src/react/support/settingsHelpers.js` → `dashboardSettingsDefaults`.
- **Merge order (defaults + perspective):** e.g. `src/reactMain.js` (“Merge order: defaults -> prevDashboardSettings -> perspective settings”), `src/react/components/WebView.jsx` (`dashboardSettingsOrDefaults`), and perspective switch/load paths that use `getDashboardSettingsDefaults()`.
- **Update/install and migration:** `src/index.js` → `onUpdateOrInstall()`.
- **Where settings are stored:** `_Architecture-How_Stuff_Works.md` (Settings, PerspectiveSettings).
