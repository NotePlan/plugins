# Demo Video Script: Habits and Summaries v1.1.0

TODO: work out how to switch in and out of Demo mode, and also to have Demo settings that can be shown.

**Focus:** `/chart progress summary` (new in 1.1.0) vs the existing `/progress update`, plus how to configure it.  
**Target length:** under ~3 minutes spoken (~500 words).  
**Audience:** NotePlan users who already track habits with `#tags` and `@mentions` (or who might start).

**Prep before recording:**
- Plugin updated to **1.1.0** (Habits and Summaries).
- Daily notes contain realistic sample tags (e.g. `@sleep(7:42)`, `@run(5.3)`, `#prayed`, `#closedrings`) for at least the last few weeks.
- Progress item settings already filled so the charts window looks full on first open.
- NotePlan theme readable on camera; window large enough to show several charts.

**On-screen style:**
- Prefer full-screen NotePlan; zoom UI slightly if text is small.
- Pause ~1 second after each major UI change so viewers can register it.
- Spoken lines are under **Spoken** headings. Directions in *italics* are for you only - do not read them aloud.

---

## 1. Cold open (~15s)

*[Show a daily note with a few habit tags visible. Hover briefly over `@sleep(...)` and a yes/no tag like `#prayed`.]*

**Spoken:**  
If you track habits in NotePlan with hashtags and @mentions, the Summaries plugin can already turn those into a text progress block in a note. Version 1.1.0 adds something new: a full chart view of the same data.

---

## 2. What you already know: `/progress update` (~25s)

*[Open Command Bar, type `progress update`, run it. Show the resulting section in a daily or weekly note - sparklines and yes/no rows if available.]*

**Spoken:**  
You may already use progress update. It counts, averages, or totals the tags you configure, and writes a compact summary into a note - useful for weekly review. That command still works. What was missing was a glanceable, visual overview - without scrolling a long note.

---

## 3. The new command: `/chart progress summary` (~45s)

*[Command bar → type `chart progress summary` (or alias `hsc` / `habits`). Run it. Let the Habit & Summary Charts window open and settle.]*  

*[Slowly scroll: totals/averages at top or headers, yes/no grids, then day-by-day bar charts. Hover a bar for the tooltip if tooltips are on.]*

**Spoken:**  
In 1.1.0, open the command bar and run chart progress summary - aliases include hsc and habits.  

You get a Habit and Summary Charts window: totals and averages where you configured them, grids for yes-or-no habits, and bar charts day by day. Time-based tags like sleep can show as hours and minutes, not only decimals. Same tags as progress update - a different presentation.

---

## 4. Period selector and custom range (~30s)

*[At the top of the window, open the period dropdown. Switch from e.g. last 7 days to last 4 weeks or month-to-date. Wait for reload.]*  

*[Optional: choose Custom range…, pick a from/to range, confirm - only if it demos cleanly on your machine.]*

**Spoken:**  
At the top is the period selector - week to date, last seven days, month to date, last few weeks or months, and more. Changing it updates the shared progress period setting, so Reload keeps your choice.  

There is also Custom range for a one-off from and to date. Pick the window you care about and the charts refresh for that span.

---

## 5. Sidebar access (~15s)

*[If the sidebar plugin list is visible: show Habit & Summary Charts (chart-line icon). Open from sidebar, or point at it while the window is already open.]*

**Spoken:**  
You can also open the same view from the NotePlan sidebar - Habit and Summary Charts - so it is one click away during the day, not only from the command bar.

---

## 6. How to configure (~70s)

*[Preferences → Plugins → Habits and Summaries → Settings.]*  

*[Scroll to “What progress items to summarize?”. Point at: time period; Yes/No items; hashtags/mentions to count, average, total. Do not edit live unless a quick, obvious change reads well on camera.]*  

*[Scroll to “'/Chart progress summary' display settings”: Chart height, Colors, Chart average line (none / moving / weekly). Optionally mention significant figures and non-zero Y-axis JSON only if time allows.]*

**Spoken:**  
Configuration is in Plugin Settings for Habits and Summaries.  

Under progress items, choose the default time period, then list what to track: yes-or-no tags like hashtag prayed; tags or mentions to count, average, or total - for example average at-sleep, total at-run. Use leading hash or at signs. Progress update and the charts share this list - set it once.  

Below that, chart display settings: bar chart height, colour list, and whether average lines use a seven-day moving average, weekly blocks, or none.  

After you save, run chart progress summary again - or Reload in the window - and your choices appear as charts.

---

## 7. Closing (~20s)

*[Return to a full view of the charts window for a beat. Optional cut to plugin card showing version 1.1.0.]*

**Spoken:**  
That is chart progress summary in Habits and Summaries 1.1.0 - visual habit charts on top of the same setup you may already use for progress update. Tag it in daily notes, configure once, open the window or sidebar any time. Thanks for watching - full detail is in the plugin README and changelog.

---

## Timing notes

| Section | ~Spoken words | ~Time at ~140 wpm |
|--------|---------------|-------------------|
| Cold open | ~40 | 15s |
| Progress update | ~55 | 25s |
| New charts command | ~75 | 35–45s |
| Period / custom | ~55 | 25–30s |
| Sidebar | ~30 | 15s |
| Configure | ~120 | 50–70s |
| Close | ~50 | 20s |
| **Total** | **~425 words** | **~3 min** |

## Optional B-roll only (if longer cut)

- Brief cut of H:MM on a tag in a daily note (`@sleep(7:42)`) while charts show HH:MM stats.
- Hover chart legend / average line if **Chart average line** is set to `moving` or `weekly`.

Do not demo heatmaps-for-tasks or `/period stats` in this short video unless you extend past three minutes - they are not the headline of 1.1.0.
