/**
 * Calendar Plugin
 * Apple Calendar-style view with Year, Month, Week, and Day views
 * Uses the Calendar API bridge from within HTML views
 */

/**
 * Main function to show the calendar view
 */
async function showCalendar() {
  try {
    HTMLView.showInMainWindow(getCalendarHTML(), "Calendar", {
      splitView: false,
      icon: "calendar",
      iconColor: "red-500",
    })
  } catch (error) {
    // Error handled silently
  }
}

/**
 * chrono-node v2.9.0 - Natural language date parser
 * Embedded for offline use. Source: https://cdn.jsdelivr.net/npm/chrono-node@2.9.0/+esm
 * MIT License - https://github.com/wanasit/chrono
 */

/**
 * chrono-node v2.9.0 - Natural language date parser
 * Embedded for offline use. Source: https://cdn.jsdelivr.net/npm/chrono-node@2.9.0/+esm
 * MIT License - https://github.com/wanasit/chrono
 */
function getCalendarHTML() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f5f5f7;
      --bg-tertiary: #fafafa;
      --text-primary: #1d1d1f;
      --text-secondary: #86868b;
      --text-muted: #aeaeb2;
      --border-color: #e5e5e7;
      --accent-color: #FF8800;
      --accent-light: rgba(255, 136, 0, 0.1);
      --hover-bg: rgba(0, 0, 0, 0.04);
      --active-bg: rgba(0, 0, 0, 0.08);
      --hour-height: 60px;
      --time-column-width: 56px;
      --header-height: 44px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-primary: #1c1c1e;
        --bg-secondary: #2c2c2e;
        --bg-tertiary: #232325;
        --text-primary: #f5f5f7;
        --text-secondary: #98989d;
        --text-muted: #636366;
        --border-color: #38383a;
        --accent-color: #FF7700;
        --accent-light: rgba(255, 119, 0, 0.1);
        --hover-bg: rgba(255, 255, 255, 0.08);
        --active-bg: rgba(255, 255, 255, 0.12);
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ============================================
       Header / Navigation
       ============================================ */
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-primary);
      flex-shrink: 0;
      height: var(--header-height);
    }

    .nav-buttons {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .nav-btn {
      background: transparent;
      border: none;
      border-radius: 6px;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      color: var(--text-secondary);
      transition: all 0.15s;
    }

    .nav-btn:hover {
      background: var(--hover-bg);
      color: var(--text-primary);
    }

    .nav-btn:active {
      background: var(--active-bg);
    }

    .today-circle-btn {
      background: transparent;
      border: none;
      border-radius: 6px;
      width: 28px;
      height: 28px;
      padding: 0;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      top: 1px;
    }

    .today-circle-btn::after {
      content: '';
      width: 8px;
      height: 8px;
      background: var(--text-secondary);
      border-radius: 50%;
      transition: background 0.15s;
    }

    .today-circle-btn:hover {
      background: var(--hover-bg);
    }

    .today-circle-btn:hover::after {
      background: var(--accent-color);
    }

    .today-circle-btn:active {
      background: var(--active-bg);
    }

    .nav-title {
      font-size: 17px;
      font-weight: 600;
      color: var(--text-primary);
      min-width: 180px;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    /* View Switcher */
    .view-switcher {
      display: flex;
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 2px;
    }

    .view-btn {
      background: transparent;
      border: none;
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s;
    }

    .view-btn:hover {
      color: var(--text-primary);
    }

    .view-btn.active {
      background: var(--bg-primary);
      color: var(--text-primary);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    /* Quick Add - Collapsible */
    .quick-add-container {
      position: relative;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .quick-add-toggle {
      width: 28px;
      height: 28px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-primary);
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      flex-shrink: 0;
      order: 1;
    }

    .quick-add-toggle:hover {
      background: var(--accent-color);
      border-color: var(--accent-color);
      color: white;
    }

    .quick-add-expanded {
      display: flex;
      align-items: center;
      gap: 4px;
      overflow: hidden;
      max-width: 0;
      opacity: 0;
      transition: max-width 0.25s ease, opacity 0.2s ease;
    }

    .quick-add-container.expanded .quick-add-expanded {
      max-width: 300px;
      opacity: 1;
    }

    .quick-add-input {
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 13px;
      width: 160px;
      background: var(--bg-primary);
      color: var(--text-primary);
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .quick-add-input:focus {
      border-color: var(--accent-color);
      box-shadow: 0 0 0 3px rgba(255, 136, 0, 0.1);
    }

    .quick-add-input::placeholder {
      color: var(--text-muted);
      font-size: 12px;
    }

    /* Quick Add Calendar Selector - Compact */
    .quick-add-calendar-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 28px;
      padding: 0 6px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-primary);
      cursor: pointer;
      transition: all 0.15s;
      font-size: 12px;
      color: var(--text-primary);
      white-space: nowrap;
      box-sizing: border-box;
    }

    .quick-add-calendar-btn:hover {
      background: var(--hover-bg);
      border-color: var(--text-muted);
    }

    .quick-add-cal-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .quick-add-cal-name {
      display: none;
    }

    .quick-add-cal-arrow {
      font-size: 10px;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .quick-add-calendar-dropdown {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      max-height: 200px;
      overflow-y: auto;
      min-width: 180px;
    }

    .quick-add-calendar-dropdown.visible {
      display: block;
    }

    .quick-add-calendar-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .quick-add-calendar-option:hover {
      background: var(--hover-bg);
    }

    .quick-add-calendar-option.selected {
      background: var(--accent-light);
    }

    .quick-add-calendar-option .cal-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .quick-add-calendar-option .cal-name {
      font-size: 13px;
      color: var(--text-primary);
    }

    /* Calendar Source Headers */
    .calendar-source-header {
      padding: 8px 12px 4px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-top: 1px solid var(--border-color);
    }

    .calendar-source-header:first-child {
      border-top: none;
    }

    /* Calendar Filter Dropdown */
    /* Event Filter - Collapsible */
    .event-filter {
      display: flex;
      align-items: center;
      position: relative;
      background: transparent;
      border-radius: 6px;
      height: 28px;
      overflow: hidden;
    }

    .event-filter-toggle {
      width: 28px;
      height: 28px;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s;
    }

    .event-filter-toggle:hover {
      background: var(--hover-bg);
    }

    .event-filter-icon {
      color: var(--text-secondary);
      font-size: 13px;
    }

    .event-filter.expanded .event-filter-icon,
    .event-filter.has-value .event-filter-icon {
      color: var(--accent-color);
    }

    .event-filter-input {
      border: none;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 13px;
      width: 0;
      max-width: 0;
      outline: none;
      padding: 0;
      opacity: 0;
      border-radius: 6px;
      height: 28px;
      transition: width 0.2s ease, max-width 0.2s ease, opacity 0.15s ease, padding 0.2s ease;
    }

    .event-filter.expanded .event-filter-input {
      width: 140px;
      max-width: 140px;
      padding: 0 8px;
      opacity: 1;
      margin-left: 4px;
    }

    .event-filter-input::placeholder {
      color: var(--text-muted);
      font-size: 12px;
    }

    .event-filter-clear {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 0;
      height: 18px;
      border: none;
      background: var(--bg-tertiary);
      color: var(--text-muted);
      border-radius: 50%;
      cursor: pointer;
      font-size: 10px;
      flex-shrink: 0;
      opacity: 0;
      overflow: hidden;
      transition: width 0.15s ease, opacity 0.15s ease, margin 0.15s ease;
    }

    .event-filter-clear:hover {
      background: var(--hover-bg);
      color: var(--text-primary);
    }

    .event-filter.expanded.has-value .event-filter-clear {
      width: 18px;
      opacity: 1;
      margin-left: 4px;
    }

    /* Calendar Filter */
    .calendar-filter {
      display: flex;
      align-items: center;
      position: relative;
      z-index: 100;
    }

    .calendar-filter-button {
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      outline: none;
      position: relative;
      transition: background-color 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .calendar-filter-button:hover {
      background: var(--hover-bg);
      color: var(--text-primary);
    }

    .calendar-filter-icon {
      font-size: 14px;
    }

    .calendar-filter-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      background: var(--accent-color);
      color: white;
      font-size: 9px;
      font-weight: 600;
      min-width: 14px;
      height: 14px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
    }

    .calendar-filter-badge.all-selected {
      display: none;
    }

    .calendar-filter-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      min-width: 250px;
      max-width: 350px;
      max-height: 300px;
      overflow-y: auto;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      z-index: 9999;
      display: none;
      padding: 4px 0;
    }

    .calendar-filter-dropdown.visible {
      display: block;
    }

    .calendar-filter-action-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      transition: background-color 0.15s;
      border-bottom: 1px solid var(--border-color);
      font-size: 13px;
      font-weight: 500;
      color: var(--accent-color);
    }

    .calendar-filter-action-item:hover {
      background: var(--hover-bg);
    }

    .calendar-filter-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .calendar-filter-item:hover {
      background: var(--hover-bg);
    }

    .calendar-filter-color-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
      border: 1px solid rgba(0, 0, 0, 0.1);
    }

    .calendar-filter-checkbox {
      margin: 0;
      cursor: pointer;
      width: 16px;
      height: 16px;
      accent-color: var(--accent-color);
    }

    .calendar-filter-item-label {
      flex: 1;
      font-size: 13px;
      color: var(--text-primary);
      user-select: none;
    }

    .calendar-filter-item.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .calendar-filter-item.disabled .calendar-filter-checkbox {
      cursor: not-allowed;
    }

    .calendar-filter-item.disabled .calendar-filter-item-label {
      font-style: italic;
    }

    .calendar-filter-disabled-note {
      font-size: 10px;
      color: var(--text-muted);
      margin-left: auto;
      font-style: normal;
    }

    /* ============================================
       Main Calendar Container
       ============================================ */
    .calendar-container {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ============================================
       Month View
       ============================================ */
    .month-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .weekday-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-primary);
      flex-shrink: 0;
    }

    .weekday-cell {
      padding: 8px;
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .month-weeks {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .week-row {
      flex: 1;
      min-height: 80px;
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid var(--border-color);
      overflow: hidden;
    }

    .week-day-numbers {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      flex-shrink: 0;
    }

    .day-number-cell {
      padding: 4px 6px;
      cursor: pointer;
      transition: background 0.15s;
      border-right: 1px solid var(--border-color);
    }

    .day-number-cell:last-child {
      border-right: none;
    }

    .day-number-cell:hover {
      background: var(--hover-bg);
    }

    .day-number-cell.other-month {
      background: var(--bg-tertiary);
    }

    .day-number-cell.other-month .day-num {
      color: var(--text-muted);
    }

    .day-num {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    }

    .day-number-cell.today .day-num {
      background: var(--accent-color);
      color: white;
      border-radius: 50%;
    }

    /* Per-column content grid */
    .week-days-content {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      flex: 1;
      min-height: 0;
    }

    .day-column {
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }

    /* Use pseudo-element for border so events can appear above it */
    .day-column::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      right: 0;
      width: 1px;
      background: var(--border-color);
      pointer-events: none;
      z-index: 0;
    }

    .day-column:last-child::after {
      display: none;
    }

    .day-column.other-month {
      background: var(--bg-tertiary);
    }

    .day-column:hover {
      background: var(--hover-bg);
    }

    .day-column.other-month:hover {
      background: var(--hover-bg);
    }

    /* Multi-day event slots within each column */
    .multi-day-slots {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      position: relative;
      z-index: 2;
    }

    .event-slot {
      height: 18px;
      padding: 0 6px;
      margin: 1px 4px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      transition: opacity 0.15s;
      box-sizing: border-box;
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      line-height: 1;
    }

    .event-slot:hover {
      opacity: 0.8;
    }

    .event-slot.empty {
      background: transparent !important;
      cursor: default;
    }

    .event-slot.hide-title {
      color: transparent;
    }

    /* Visual continuity - overlap borders for spanning effect */
    .event-slot.continues-left {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      margin-left: -1px;
      padding-left: 7px;
    }

    .event-slot.continues-right {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      margin-right: -1px;
      padding-right: 7px;
    }

    /* Single-day events area */
    .single-day-events {
      padding: 2px 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
      flex: 1;
      cursor: pointer;
    }

    .event-chip {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      flex-shrink: 0;
      text-overflow: ellipsis;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .event-chip:hover {
      opacity: 0.8;
    }

    /* Timed events: color bar on left, no background */
    .event-chip.timed {
      background: transparent !important;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 4px;
    }

    .event-chip.timed .event-color-bar {
      width: 3px;
      height: 14px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .event-chip.timed .event-title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 400;
    }

    .event-chip.timed .event-time {
      font-size: 10px;
      color: var(--text-secondary);
      flex-shrink: 0;
      font-weight: 400;
    }

    .event-chip.timed:hover {
      background: var(--hover-bg) !important;
    }

    /* All-day events keep colored background */
    .event-chip.all-day {
      font-weight: 500;
    }

    .more-events {
      font-size: 11px;
      color: var(--text-secondary);
      padding: 2px 4px;
      flex-shrink: 0;
      cursor: pointer;
    }

    .more-events:hover {
      color: var(--text-primary);
    }

    /* ============================================
       Week View
       ============================================ */
    .week-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .week-header {
      display: grid;
      grid-template-columns: var(--time-column-width) repeat(7, 1fr);
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-primary);
      flex-shrink: 0;
    }

    .week-header-spacer {
      border-right: 1px solid var(--border-color);
    }

    .week-header-day {
      padding: 8px;
      text-align: center;
      border-right: 1px solid var(--border-color);
      cursor: pointer;
      transition: background 0.15s;
      overflow: hidden;
      min-width: 0;
    }

    .week-header-day:hover {
      background: var(--hover-bg);
    }

    .week-header-day.today {
      background: var(--accent-light);
    }

    .week-day-name {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .week-day-number {
      font-size: 20px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .week-header-day.today .week-day-number {
      color: var(--accent-color);
    }

    /* All-day section */
    .all-day-section {
      display: grid;
      grid-template-columns: var(--time-column-width) repeat(7, 1fr);
      border-bottom: 1px solid var(--border-color);
      min-height: 28px;
      background: var(--bg-primary);
      flex-shrink: 0;
    }

    .all-day-label {
      padding: 4px 8px;
      font-size: 10px;
      color: var(--text-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      align-items: center;
    }

    .all-day-column {
      border-right: 1px solid var(--border-color);
      padding: 2px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
      min-width: 0;
    }

    /* Time grid */
    .week-body {
      flex: 1;
      overflow-y: auto;
      display: grid;
      grid-template-columns: var(--time-column-width) repeat(7, 1fr);
      position: relative;
    }

    .time-column {
      border-right: 1px solid var(--border-color);
    }

    .time-slot-label {
      height: var(--hour-height);
      padding: 0 8px;
      font-size: 10px;
      color: var(--text-secondary);
      text-align: right;
      position: relative;
      top: -6px;
    }

    .day-column {
      /* border handled by ::after pseudo-element in base .day-column */
      position: relative;
      overflow: hidden;
      min-width: 0;
    }

    .hour-line {
      position: absolute;
      left: 0;
      right: 0;
      border-top: 1px solid var(--border-color);
    }

    .half-hour-line {
      position: absolute;
      left: 0;
      right: 0;
      border-top: 1px dashed var(--border-color);
      opacity: 0.5;
    }

    .current-time-line {
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--accent-color);
      z-index: 10;
    }

    .current-time-line::before {
      content: '';
      position: absolute;
      left: -4px;
      top: -3px;
      width: 8px;
      height: 8px;
      background: var(--accent-color);
      border-radius: 50%;
    }

    .timed-event {
      position: absolute;
      left: 2px;
      right: 2px;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: 500;
      overflow: hidden;
      cursor: pointer;
      z-index: 5;
      transition: opacity 0.15s;
    }

    .timed-event:hover {
      opacity: 0.85;
    }

    .timed-event-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .timed-event-time {
      font-size: 10px;
      opacity: 0.8;
    }

    /* ============================================
       Day View
       ============================================ */
    .day-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .day-view .week-header {
      grid-template-columns: var(--time-column-width) 1fr;
    }

    .day-view .all-day-section {
      grid-template-columns: var(--time-column-width) 1fr;
    }

    .day-view .week-body {
      grid-template-columns: var(--time-column-width) 1fr;
    }

    /* ============================================
       Year View
       ============================================ */
    .year-view {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .year-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .mini-month {
      cursor: pointer;
      transition: transform 0.15s;
    }

    .mini-month:hover {
      transform: scale(1.02);
    }

    .mini-month-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
      text-align: center;
    }

    .mini-month-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }

    .mini-weekday {
      font-size: 9px;
      font-weight: 600;
      color: var(--text-muted);
      text-align: center;
      padding: 4px 0;
    }

    .mini-day {
      font-size: 11px;
      text-align: center;
      color: var(--text-primary);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1;
      position: relative;
    }

    .mini-day-number {
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }

    .mini-day.other-month {
      color: var(--text-muted);
    }

    .mini-day.today .mini-day-number {
      background: var(--accent-color);
      color: white;
      font-weight: 600;
    }

    .mini-day.has-events::after {
      content: '';
      display: block;
      width: 4px;
      height: 4px;
      background: var(--accent-color);
      border-radius: 50%;
      margin-top: 1px;
    }

    .mini-day.today.has-events::after {
      background: white;
    }

    /* ============================================
       Event Modal
       ============================================ */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .modal-overlay.visible {
      display: flex;
    }

    .modal {
      background: var(--bg-primary);
      border-radius: 12px;
      width: 380px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
    }

    .modal-title {
      font-size: 17px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .modal-close {
      background: transparent;
      border: none;
      font-size: 20px;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
      line-height: 1;
    }

    .modal-close:hover {
      color: var(--text-primary);
    }

    .modal-body {
      padding: 20px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 15px;
      background: var(--bg-primary);
      color: var(--text-primary);
      outline: none;
      transition: border-color 0.15s;
    }

    .form-input:focus {
      border-color: var(--accent-color);
    }

    .form-row {
      display: flex;
      gap: 12px;
    }

    .form-row .form-group {
      flex: 1;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .checkbox-row input {
      width: 18px;
      height: 18px;
      accent-color: var(--accent-color);
    }

    .checkbox-row label {
      font-size: 14px;
      color: var(--text-primary);
    }

    .modal-footer {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);
    }

    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      border: none;
    }

    .btn-delete {
      background: transparent;
      color: #FF3B30;
    }

    .btn-delete:hover {
      background: rgba(255, 59, 48, 0.1);
    }

    .btn-cancel {
      background: var(--bg-secondary);
      color: var(--text-primary);
      margin-left: auto;
    }

    .btn-cancel:hover {
      background: var(--active-bg);
    }

    .btn-save {
      background: var(--accent-color);
      color: white;
    }

    .btn-save:hover {
      opacity: 0.9;
    }

    /* Loading state */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-secondary);
    }

    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-secondary);
      text-align: center;
      padding: 40px;
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    /* ============================================
       Responsive Styles
       ============================================ */

    /* Medium screens - start shrinking toolbar items */
    @media (max-width: 1100px) {
      .quick-add-input {
        width: 140px;
      }

      .event-filter.expanded .event-filter-input {
        width: 120px;
        max-width: 120px;
      }
    }

    /* Smaller medium screens - wrap to second row */
    @media (max-width: 950px) {
      .header {
        flex-wrap: wrap;
        height: auto;
        gap: 8px;
      }

      .nav-title {
        flex: 1;
      }

      .header-right {
        width: 100%;
        order: 3;
        flex-wrap: wrap;
        gap: 8px;
      }

      .quick-add-container.expanded .quick-add-expanded {
        max-width: 250px;
      }

      .quick-add-input {
        width: 140px;
      }

      .event-filter {
        flex: 0 0 auto;
      }

      .event-filter.expanded .event-filter-input {
        width: 100px;
        max-width: 100px;
      }
    }

    /* Tablet and below */
    @media (max-width: 768px) {
      :root {
        --time-column-width: 48px;
      }

      .header {
        flex-wrap: wrap;
        height: auto;
        padding: 8px;
        gap: 8px;
      }

      .nav-title {
        font-size: 15px;
        min-width: auto;
        flex: 1;
      }

      .header-right {
        width: 100%;
        justify-content: space-between;
        order: 3;
      }

      .quick-add-container.expanded .quick-add-expanded {
        max-width: 220px;
      }

      .quick-add-input {
        width: 120px;
      }

      .view-btn {
        padding: 5px 8px;
        font-size: 12px;
      }

      .event-filter.expanded .event-filter-input {
        width: 100px;
        max-width: 100px;
      }

      /* Year view adjustments */
      .year-view {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 12px !important;
        padding: 12px !important;
      }

      .mini-calendar {
        padding: 8px !important;
      }

      .mini-month-title {
        font-size: 13px !important;
      }

      .mini-day {
        width: 28px !important;
        height: 28px !important;
        font-size: 11px !important;
      }

      /* Month view adjustments */
      .month-view {
        font-size: 12px;
      }

      .weekday-cell {
        padding: 6px 2px !important;
        font-size: 11px !important;
      }

      .day-column {
        min-height: 70px !important;
      }

      .day-number-cell {
        font-size: 12px !important;
      }

      .event-chip {
        font-size: 10px !important;
        padding: 1px 4px !important;
      }

      .event-chip.timed .event-color-bar {
        width: 2px !important;
        height: 12px !important;
      }

      .event-chip.timed .event-time {
        font-size: 9px !important;
      }

      /* Week view adjustments */
      .week-header .day-header {
        padding: 6px 2px !important;
        font-size: 11px !important;
      }

      .day-header .day-number {
        width: 28px !important;
        height: 28px !important;
        font-size: 13px !important;
      }

      .event-slot {
        font-size: 10px !important;
        height: 16px !important;
        padding: 1px 4px !important;
      }

      .timed-event {
        font-size: 10px !important;
        padding: 2px 4px !important;
      }

      /* Day view adjustments */
      .day-view-header {
        padding: 8px !important;
      }

      .day-view-title {
        font-size: 18px !important;
      }

      /* Modal adjustments */
      .modal {
        width: 95% !important;
        max-width: none !important;
        margin: 10px;
      }

      .form-row {
        flex-direction: column !important;
        gap: 12px !important;
      }

      .form-row .form-group {
        width: 100% !important;
      }
    }

    /* iPad specific adjustments */
    @media (min-width: 481px) and (max-width: 1024px) {
      .header {
        padding: 10px 12px;
      }

      .nav-btn, .today-circle-btn {
        width: 36px;
        height: 36px;
        font-size: 18px;
      }

      .nav-title {
        font-size: 17px;
      }

      .view-btn {
        padding: 8px 12px;
        font-size: 14px;
      }

      .quick-add-input {
        padding: 8px 12px;
        font-size: 15px;
      }

      .quick-add-calendar-btn {
        height: 34px;
        padding: 0 10px;
        font-size: 14px;
      }

      .quick-add-toggle {
        width: 34px;
        height: 34px;
        font-size: 14px;
      }

      .calendar-filter-button,
      .event-filter-toggle {
        width: 34px;
        height: 34px;
      }

      /* Month view event sizing for iPad */
      .event-slot {
        height: 20px !important;
        font-size: 12px !important;
      }

      .event-chip {
        font-size: 11px !important;
        padding: 2px 6px !important;
      }

      .day-column {
        min-height: 85px !important;
      }
    }

    /* Mobile phones */
    @media (max-width: 480px) {
      .header {
        padding: 6px;
      }

      .nav-buttons {
        gap: 0;
      }

      .nav-btn, .today-circle-btn {
        width: 32px;
        height: 32px;
      }

      .nav-title {
        font-size: 14px;
      }

      .header-right {
        flex-wrap: nowrap;
        gap: 6px;
      }

      /* Move quick-add to bottom of screen - always expanded on mobile */
      .quick-add-container {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--bg-primary);
        border-top: 1px solid var(--border-color);
        padding: 8px;
        padding-bottom: max(8px, env(safe-area-inset-bottom));
        z-index: 100;
        display: flex;
        gap: 6px;
      }

      /* Always show expanded state on mobile */
      .quick-add-expanded {
        max-width: none !important;
        opacity: 1 !important;
        flex: 1;
      }

      .quick-add-toggle {
        order: 0;
        width: 40px;
        height: 40px;
      }

      .calendar-container {
        padding-bottom: 60px !important;
      }

      .quick-add-input {
        font-size: 16px;
        padding: 10px 12px;
        flex: 1;
        width: auto !important;
      }

      .quick-add-input::placeholder {
        font-size: 13px;
      }

      .quick-add-calendar-btn {
        padding: 6px 10px;
        max-width: 80px;
        height: 40px;
      }

      .quick-add-cal-arrow {
        display: none;
      }

      .quick-add-calendar-dropdown {
        bottom: 100%;
        top: auto;
        margin-bottom: 4px;
        margin-top: 0;
      }

      .view-switcher {
        order: 1;
      }

      .view-btn {
        padding: 6px 6px;
        font-size: 11px;
      }

      .event-filter {
        order: 2;
      }

      .event-filter.expanded .event-filter-input {
        width: 100px;
        max-width: 100px;
      }

      .calendar-filter {
        order: 3;
      }

      /* Year view - single column on small phones */
      .year-view {
        grid-template-columns: 1fr !important;
        gap: 8px !important;
        padding: 8px !important;
      }

      /* Month view - remove vertical dividers, keep horizontal */
      .day-column::after {
        display: none !important;
      }

      .day-number-cell {
        border-right: none !important;
      }

      .day-column {
        min-height: 70px !important;
        padding: 2px 0 !important;
      }

      .multi-day-slots {
        margin-top: 1px !important;
      }

      /* Multi-day events - edge to edge, continuous across days */
      .event-slot {
        height: 14px !important;
        font-size: 9px !important;
        padding: 0 3px !important;
        margin: 0 0 1px 0 !important;
        border-radius: 0 !important;
      }

      /* Start of event (no left continuation) */
      .event-slot:not(.continues-left) {
        margin-left: 2px !important;
        border-top-left-radius: 3px !important;
        border-bottom-left-radius: 3px !important;
      }

      /* End of event (no right continuation) */
      .event-slot:not(.continues-right) {
        margin-right: 2px !important;
        border-top-right-radius: 3px !important;
        border-bottom-right-radius: 3px !important;
      }

      .single-day-events {
        gap: 1px !important;
        padding: 0 2px !important;
      }

      .event-chip {
        font-size: 9px !important;
        padding: 0 3px !important;
        height: 14px !important;
        line-height: 14px !important;
      }

      .event-chip.timed .event-color-bar {
        width: 2px !important;
        height: 10px !important;
      }

      .event-chip.timed .event-time {
        display: none !important;
      }

      .more-events {
        font-size: 9px !important;
        padding: 0 3px !important;
      }

      /* Week view - show only 3 days */
      .week-grid {
        display: flex !important;
        overflow-x: auto !important;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
      }

      .week-grid .day-column {
        min-width: 33.33% !important;
        flex-shrink: 0;
        scroll-snap-align: start;
      }

      .week-header {
        display: flex !important;
        overflow-x: auto !important;
      }

      .week-header .day-header {
        min-width: 33.33% !important;
        flex-shrink: 0;
      }

      /* Day view */
      .day-view-header {
        padding: 6px !important;
      }

      .day-view-title {
        font-size: 16px !important;
      }

      .day-view-subtitle {
        font-size: 12px !important;
      }

      /* Modal - full screen on mobile */
      .modal-overlay {
        align-items: flex-end;
      }

      .modal {
        width: 100% !important;
        max-height: 90vh !important;
        border-radius: 16px 16px 0 0 !important;
        margin: 0 !important;
      }

      .modal-header {
        padding: 16px !important;
      }

      .modal-body {
        padding: 0 16px 16px !important;
        max-height: calc(90vh - 120px);
        overflow-y: auto;
      }

      .modal-footer {
        padding: 12px 16px !important;
        padding-bottom: max(12px, env(safe-area-inset-bottom));
      }

      .form-input, .form-select, .form-textarea {
        font-size: 16px !important; /* Prevents iOS zoom on focus */
      }
    }

    /* Very small phones */
    @media (max-width: 360px) {
      .view-btn {
        padding: 5px 4px;
        font-size: 10px;
      }

      .nav-title {
        font-size: 13px;
      }

      .mini-day {
        width: 24px !important;
        height: 24px !important;
        font-size: 10px !important;
      }
    }

    /* Landscape orientation on mobile */
    @media (max-height: 500px) and (orientation: landscape) {
      .header {
        padding: 4px 8px;
      }

      .modal {
        max-height: 95vh !important;
      }

      .modal-body {
        max-height: calc(95vh - 100px);
      }
    }

    /* Touch device optimizations */
    @media (hover: none) and (pointer: coarse) {
      .nav-btn, .today-circle-btn, .view-btn, .quick-add-toggle, .quick-add-calendar-btn, .calendar-filter-button, .event-filter-toggle {
        min-height: 44px;
        min-width: 44px;
      }

      .nav-btn, .today-circle-btn {
        min-width: 44px;
      }

      .day-column, .day-number-cell, .mini-day {
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      /* Increase touch target for day/week view timed events */
      .timed-event {
        padding: 6px 8px !important;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="nav-buttons">
      <button class="nav-btn" id="prevBtn" title="Previous">&#8249;</button>
      <button class="today-circle-btn" id="todayBtn" title="Today"></button>
      <button class="nav-btn" id="nextBtn" title="Next">&#8250;</button>
    </div>
    <div class="nav-title" id="navTitle">January 2026</div>

    <div class="header-right">
      <div class="quick-add-container" id="quickAddContainer">
        <div class="quick-add-expanded">
          <input type="text" id="quickAddInput" class="quick-add-input"
                 placeholder="meeting tomorrow 3pm">
          <button class="quick-add-calendar-btn" id="quickAddCalendarBtn" title="Select calendar">
            <span class="quick-add-cal-dot" id="quickAddCalDot"></span>
            <span class="quick-add-cal-name" id="quickAddCalName">Calendar</span>
            <i class="fa-solid fa-chevron-down quick-add-cal-arrow"></i>
          </button>
        </div>
        <button id="quickAddToggle" class="quick-add-toggle" title="Add event">
          <i class="fa-solid fa-plus"></i>
        </button>
        <div class="quick-add-calendar-dropdown" id="quickAddCalendarDropdown"></div>
      </div>
      <div class="view-switcher">
        <button class="view-btn" data-view="year">Year</button>
        <button class="view-btn active" data-view="month">Month</button>
        <button class="view-btn" data-view="week">Week</button>
        <button class="view-btn" data-view="day">Day</button>
      </div>

      <div class="event-filter" id="eventFilterContainer">
        <button class="event-filter-toggle" id="eventFilterToggle" title="Filter events (⌘F)">
          <i class="fa-solid fa-magnifying-glass event-filter-icon"></i>
        </button>
        <input type="text" id="eventFilterInput" class="event-filter-input" placeholder="Filter events...">
        <button class="event-filter-clear" id="eventFilterClear" title="Clear filter">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="calendar-filter">
        <button class="calendar-filter-button" id="filterBtn" title="Filter calendars">
          <i class="far fa-calendar calendar-filter-icon"></i>
          <span class="calendar-filter-badge" id="calendarFilterBadge"></span>
        </button>
        <div class="calendar-filter-dropdown" id="filterDropdown">
          <div class="calendar-filter-action-item" id="toggleAllCalendars">Select All</div>
        </div>
      </div>
    </div>
  </div>

  <div class="calendar-container" id="calendarContainer">
    <div class="loading">Loading calendars...</div>
  </div>

  <!-- Event Modal -->
  <div class="modal-overlay" id="eventModal">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title" id="modalTitle">New Event</span>
        <button class="modal-close" id="modalClose">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Title</label>
          <input type="text" class="form-input" id="eventTitle" placeholder="Event title">
        </div>
        <div class="form-group">
          <div class="checkbox-row">
            <input type="checkbox" id="eventAllDay" checked>
            <label for="eventAllDay">All-day</label>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Start</label>
            <input type="date" class="form-input" id="eventStartDate">
          </div>
          <div class="form-group" id="startTimeGroup">
            <label class="form-label">Time</label>
            <input type="time" class="form-input" id="eventStartTime" value="09:00">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">End</label>
            <input type="date" class="form-input" id="eventEndDate">
          </div>
          <div class="form-group" id="endTimeGroup">
            <label class="form-label">Time</label>
            <input type="time" class="form-input" id="eventEndTime" value="10:00">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Calendar</label>
          <select class="form-input" id="eventCalendar"></select>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-input" id="eventNotes" rows="3" placeholder="Add notes..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-delete" id="deleteBtn" style="display: none;">Delete</button>
        <button class="btn btn-cancel" id="cancelBtn">Cancel</button>
        <button class="btn btn-save" id="saveBtn">Save</button>
      </div>
    </div>
  </div>

  <script>
    // ============================================
    // State Management
    // ============================================
    const state = {
      currentView: 'month',
      viewDate: new Date(),
      events: [],
      allCalendars: [],
      selectedCalendars: new Set(),
      writableCalendars: [],
      editingEvent: null,
      filterText: '',
      use12HourFormat: false,
      settings: {
        firstDayOfWeek: parseInt(localStorage.getItem('calendar_firstDayOfWeek') || '0')
      }
    };

    // Detect user's time format preference (12h vs 24h) using system locale
    function detectTimeFormat() {
      try {
        const testDate = new Date(2000, 0, 1, 13, 0);  // 1 PM
        const formatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
        const parts = formatter.formatToParts(testDate);
        return parts.some(function(part) { return part.type === 'dayPeriod'; });
      } catch (e) {
        console.error('Failed to detect time format:', e);
        return false;  // Default to 24-hour format
      }
    }

    const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];

    // ============================================
    // Utility Functions
    // ============================================
    function formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return year + '-' + month + '-' + day;
    }

    function parseDate(str) {
      const [year, month, day] = str.split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    function formatTime(date) {
      const minutes = String(date.getMinutes()).padStart(2, '0');
      if (state.use12HourFormat) {
        let hours = date.getHours();
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;  // Convert 0 to 12 for midnight
        return hours + ':' + minutes + ' ' + period;
      } else {
        const hours = String(date.getHours()).padStart(2, '0');
        return hours + ':' + minutes;
      }
    }

    function parseTime(timeStr, baseDate) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const date = new Date(baseDate);
      date.setHours(hours, minutes, 0, 0);
      return date;
    }

    function isSameDay(d1, d2) {
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
    }

    function isToday(date) {
      return isSameDay(date, new Date());
    }

    function getDaysInMonth(year, month) {
      return new Date(year, month + 1, 0).getDate();
    }

    function getFirstDayOfMonth(year, month) {
      return new Date(year, month, 1).getDay();
    }

    function getWeekDates(date) {
      const d = new Date(date);
      const day = d.getDay();
      const diff = day - state.settings.firstDayOfWeek;
      const adjustedDiff = diff < 0 ? diff + 7 : diff;
      d.setDate(d.getDate() - adjustedDiff);

      const dates = [];
      for (let i = 0; i < 7; i++) {
        dates.push(new Date(d));
        d.setDate(d.getDate() + 1);
      }
      return dates;
    }

    function getEventColor(event) {
      return event.color || '#5856D6';
    }

    function isDarkMode() {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function parseHexColor(hex) {
      if (!hex) return null;
      hex = hex.replace('#', '');
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
      };
    }

    function colorWithOpacity(hex, alpha) {
      const rgb = parseHexColor(hex);
      if (!rgb) return 'rgba(90, 159, 212, 0.35)';
      return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + alpha + ')';
    }

    function getTextColorForBackground(hex, alpha) {
      const rgb = parseHexColor(hex);
      if (!rgb) return isDarkMode() ? '#f5f5f7' : '#1d1d1f';
      const r = rgb.r, g = rgb.g, b = rgb.b;
      // Blend with background
      const bgR = isDarkMode() ? 28 : 255;
      const bgG = isDarkMode() ? 28 : 255;
      const bgB = isDarkMode() ? 30 : 255;
      const effectiveR = r * alpha + bgR * (1 - alpha);
      const effectiveG = g * alpha + bgG * (1 - alpha);
      const effectiveB = b * alpha + bgB * (1 - alpha);
      const luminance = (0.299 * effectiveR + 0.587 * effectiveG + 0.114 * effectiveB) / 255;

      if (luminance < 0.5) {
        return '#FFFFFF';
      }
      // Darken the original color for text
      const darkenFactor = 0.5;
      const textR = Math.max(0, Math.floor(r * (1 - darkenFactor)));
      const textG = Math.max(0, Math.floor(g * (1 - darkenFactor)));
      const textB = Math.max(0, Math.floor(b * (1 - darkenFactor)));
      const toHex = function(n) { return n.toString(16).padStart(2, '0'); };
      return '#' + toHex(textR) + toHex(textG) + toHex(textB);
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function openNote(date, options) {
      if (!date) return;
      options = options || {};
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = year + '-' + month + '-' + day;
      let url = 'noteplan://x-callback-url/openNote?noteDate=' + dateStr + '&view=daily&timeframe=day';

      if (options.newWindow) {
        url += '&subWindow=yes';
      } else if (options.splitView) {
        url += '&splitView=yes&reuseSplitView=yes';
      }

      // Use hidden link click workaround for WebView URL schemes
      const link = document.createElement('a');
      link.href = url;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(function() {
        document.body.removeChild(link);
      }, 100);
    }

    // ============================================
    // Calendar API Functions
    // ============================================
    async function loadCalendars() {
      try {
        state.allCalendars = await Calendar.availableCalendars({}) || [];
        state.writableCalendars = await Calendar.availableCalendars({ writeOnly: true, enabledOnly: true }) || [];

        const saved = localStorage.getItem('calendar_selectedCalendars');
        if (saved) {
          const savedArray = JSON.parse(saved);
          state.selectedCalendars = new Set(
            state.allCalendars
              .filter(function(c) { return savedArray.includes(c.title); })
              .map(function(c) { return c.title; })
          );
        } else {
          state.selectedCalendars = new Set(state.allCalendars.map(function(c) { return c.title; }));
        }

        populateCalendarFilter();
      } catch (error) {
        console.error('Failed to load calendars:', error);
        state.allCalendars = [];
        state.writableCalendars = [];
      }
    }

    async function loadEventsForRange(startDate, endDate) {
      try {
        const events = await Calendar.eventsBetween(startDate, endDate, "") || [];
        state.events = events.filter(function(e) { return state.selectedCalendars.has(e.calendar); });
      } catch (error) {
        console.error('Failed to load events:', error);
        state.events = [];
      }
    }

    function getViewDateRange() {
      const year = state.viewDate.getFullYear();
      const month = state.viewDate.getMonth();

      switch (state.currentView) {
        case 'year':
          return {
            start: new Date(year, 0, 1),
            end: new Date(year, 11, 31, 23, 59, 59)
          };
        case 'month':
          const firstDay = getFirstDayOfMonth(year, month);
          const paddingDays = (firstDay - state.settings.firstDayOfWeek + 7) % 7;
          const start = new Date(year, month, 1 - paddingDays);
          const end = new Date(year, month + 1, 7);
          return { start: start, end: end };
        case 'week':
          const weekDates = getWeekDates(state.viewDate);
          return {
            start: weekDates[0],
            end: new Date(weekDates[6].getTime() + 24 * 60 * 60 * 1000 - 1)
          };
        case 'day':
          const dayStart = new Date(year, month, state.viewDate.getDate());
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
          return { start: dayStart, end: dayEnd };
        default:
          return { start: new Date(), end: new Date() };
      }
    }

    async function refreshEvents() {
      const range = getViewDateRange();
      await loadEventsForRange(range.start, range.end);
      render();
    }

    // ============================================
    // Event CRUD
    // ============================================
    async function createEvent(eventData) {
      const eventObject = {
        title: eventData.title,
        date: eventData.start,
        endDate: eventData.end,
        type: 'event',
        isAllDay: eventData.isAllDay,
        calendar: eventData.calendar,
        isCompleted: false,
        notes: eventData.notes || '',
        url: '',
        availability: 0
      };

      try {
        const result = await Calendar.add(eventObject);
        await refreshEvents();
        return result;
      } catch (error) {
        console.error('Failed to create event:', error);
        return null;
      }
    }

    async function updateEvent(eventId, eventData) {
      try {
        const existingEvent = await Calendar.eventByID(eventId);
        if (!existingEvent) return false;

        const updateObject = {
          id: eventId,
          title: eventData.title,
          date: eventData.start,
          endDate: eventData.end,
          type: 'event',
          isAllDay: eventData.isAllDay,
          calendar: eventData.calendar,
          isCompleted: existingEvent.isCompleted || false,
          notes: eventData.notes || existingEvent.notes || '',
          url: existingEvent.url || '',
          availability: existingEvent.availability || 0,
          isRecurring: existingEvent.isRecurring || false
        };

        await Calendar.update(updateObject);
        await refreshEvents();
        return true;
      } catch (error) {
        console.error('Failed to update event:', error);
        return false;
      }
    }

    async function deleteEvent(eventId) {
      try {
        const event = await Calendar.eventByID(eventId);
        if (!event) return false;

        const deleteObject = {
          id: eventId,
          title: event.title || '',
          date: new Date(event.date),
          endDate: new Date(event.endDate),
          type: 'event',
          isAllDay: event.isAllDay !== undefined ? event.isAllDay : true,
          calendar: event.calendar || '',
          isCompleted: false,
          isRecurring: event.isRecurring || false
        };

        await Calendar.remove(deleteObject);
        await refreshEvents();
        return true;
      } catch (error) {
        console.error('Failed to delete event:', error);
        return false;
      }
    }

    // ============================================
    // Navigation Functions
    // ============================================
    function navigatePrevious() {
      switch (state.currentView) {
        case 'year':
          state.viewDate.setFullYear(state.viewDate.getFullYear() - 1);
          break;
        case 'month':
          state.viewDate.setMonth(state.viewDate.getMonth() - 1);
          break;
        case 'week':
          state.viewDate.setDate(state.viewDate.getDate() - 7);
          break;
        case 'day':
          state.viewDate.setDate(state.viewDate.getDate() - 1);
          break;
      }
      refreshEvents();
    }

    function navigateNext() {
      switch (state.currentView) {
        case 'year':
          state.viewDate.setFullYear(state.viewDate.getFullYear() + 1);
          break;
        case 'month':
          state.viewDate.setMonth(state.viewDate.getMonth() + 1);
          break;
        case 'week':
          state.viewDate.setDate(state.viewDate.getDate() + 7);
          break;
        case 'day':
          state.viewDate.setDate(state.viewDate.getDate() + 1);
          break;
      }
      refreshEvents();
    }

    function navigateToday() {
      state.viewDate = new Date();
      refreshEvents();
    }

    function switchView(view) {
      state.currentView = view;
      document.querySelectorAll('.view-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.view === view);
      });
      refreshEvents();
    }

    function getNavigationTitle() {
      const d = state.viewDate;
      switch (state.currentView) {
        case 'year':
          return d.getFullYear().toString();
        case 'month':
          return MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
        case 'week':
          const weekDates = getWeekDates(d);
          const start = weekDates[0];
          const end = weekDates[6];
          if (start.getMonth() === end.getMonth()) {
            return MONTH_NAMES[start.getMonth()] + ' ' + start.getDate() + '-' + end.getDate() + ', ' + start.getFullYear();
          } else {
            return MONTH_NAMES[start.getMonth()].substr(0, 3) + ' ' + start.getDate() + ' - ' +
                   MONTH_NAMES[end.getMonth()].substr(0, 3) + ' ' + end.getDate() + ', ' + end.getFullYear();
          }
        case 'day':
          return WEEKDAY_NAMES[d.getDay()] + ', ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
        default:
          return '';
      }
    }

    // ============================================
    // Calendar Filter Functions
    // ============================================
    function populateCalendarFilter() {
      const dropdown = document.getElementById('filterDropdown');
      const existingItems = dropdown.querySelectorAll('.calendar-filter-item, .calendar-source-header');
      existingItems.forEach(function(el) { el.remove(); });

      const bySource = {};
      state.allCalendars.forEach(function(cal) {
        const source = cal.source || 'Other';
        if (!bySource[source]) bySource[source] = [];
        bySource[source].push(cal);
      });

      const sources = Object.keys(bySource).sort(function(a, b) {
        if (a === 'iCloud') return -1;
        if (b === 'iCloud') return 1;
        return a.localeCompare(b);
      });

      sources.forEach(function(source) {
        // Add source header
        const header = document.createElement('div');
        header.className = 'calendar-source-header';
        header.textContent = source;
        dropdown.appendChild(header);

        bySource[source].forEach(function(cal) {
          const item = document.createElement('div');
          const isDisabled = cal.isEnabled === false;
          item.className = 'calendar-filter-item' + (isDisabled ? ' disabled' : '');

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'calendar-filter-checkbox';
          checkbox.dataset.calendar = cal.title;
          checkbox.checked = state.selectedCalendars.has(cal.title) && !isDisabled;
          checkbox.disabled = isDisabled;

          const colorDot = document.createElement('div');
          colorDot.className = 'calendar-filter-color-dot';
          colorDot.style.backgroundColor = cal.color || '#5856D6';

          const label = document.createElement('span');
          label.className = 'calendar-filter-item-label';
          label.textContent = cal.title;

          item.appendChild(checkbox);
          item.appendChild(colorDot);
          item.appendChild(label);

          // Add "disabled" note for calendars disabled in NotePlan settings
          if (isDisabled) {
            const note = document.createElement('span');
            note.className = 'calendar-filter-disabled-note';
            note.textContent = 'off';
            note.title = 'Disabled in NotePlan Settings';
            item.appendChild(note);
          }

          if (!isDisabled) {
            checkbox.addEventListener('change', function(e) {
              if (e.target.checked) {
                state.selectedCalendars.add(cal.title);
              } else {
                state.selectedCalendars.delete(cal.title);
              }
              saveCalendarSelection();
              updateToggleAllText();
              updateCalendarFilterText();
              refreshEvents();
            });
          }

          dropdown.appendChild(item);
        });
      });

      updateToggleAllText();
      updateCalendarFilterText();
    }

    function updateToggleAllText() {
      const toggleBtn = document.getElementById('toggleAllCalendars');
      const enabledCalendars = state.allCalendars.filter(function(c) { return c.isEnabled !== false; });
      const allSelected = enabledCalendars.length > 0 && enabledCalendars.every(function(c) { return state.selectedCalendars.has(c.title); });
      toggleBtn.textContent = allSelected ? 'Unselect All' : 'Select All';
    }

    function updateCalendarFilterText() {
      const enabledCalendars = state.allCalendars.filter(function(c) { return c.isEnabled !== false; });
      const selectedCount = enabledCalendars.filter(function(c) { return state.selectedCalendars.has(c.title); }).length;
      const totalCount = enabledCalendars.length;
      const badge = document.getElementById('calendarFilterBadge');
      const filterBtn = document.getElementById('filterBtn');

      if (!badge) return;

      // Show badge with selected count, hide if all selected
      if (selectedCount === totalCount && selectedCount > 0) {
        badge.classList.add('all-selected');
        badge.textContent = '';
        if (filterBtn) filterBtn.title = 'All ' + totalCount + ' calendars selected';
      } else {
        badge.classList.remove('all-selected');
        badge.textContent = selectedCount;
        if (filterBtn) filterBtn.title = selectedCount + ' of ' + totalCount + ' calendars';
      }
    }

    function toggleAllCalendars() {
      const enabledCalendars = state.allCalendars.filter(function(c) { return c.isEnabled !== false; });
      const allSelected = enabledCalendars.length > 0 && enabledCalendars.every(function(c) { return state.selectedCalendars.has(c.title); });

      if (allSelected) {
        state.selectedCalendars.clear();
      } else {
        enabledCalendars.forEach(function(c) { state.selectedCalendars.add(c.title); });
      }

      document.querySelectorAll('.calendar-filter-checkbox:not(:disabled)').forEach(function(cb) {
        cb.checked = state.selectedCalendars.has(cb.dataset.calendar);
      });

      saveCalendarSelection();
      updateToggleAllText();
      updateCalendarFilterText();
      refreshEvents();
    }

    function saveCalendarSelection() {
      localStorage.setItem('calendar_selectedCalendars', JSON.stringify(Array.from(state.selectedCalendars)));
    }

    // ============================================
    // Event Modal Functions
    // ============================================
    function openEventModal(options) {
      options = options || {};
      const modal = document.getElementById('eventModal');
      const title = document.getElementById('eventTitle');
      const allDay = document.getElementById('eventAllDay');
      const startDate = document.getElementById('eventStartDate');
      const startTime = document.getElementById('eventStartTime');
      const endDate = document.getElementById('eventEndDate');
      const endTime = document.getElementById('eventEndTime');
      const calendar = document.getElementById('eventCalendar');
      const notes = document.getElementById('eventNotes');
      const deleteBtn = document.getElementById('deleteBtn');
      const modalTitle = document.getElementById('modalTitle');

      state.editingEvent = options.event || null;

      modalTitle.textContent = state.editingEvent ? 'Edit Event' : 'New Event';
      deleteBtn.style.display = state.editingEvent ? 'inline-block' : 'none';

      calendar.innerHTML = '';
      const bySource = {};
      state.writableCalendars.forEach(function(cal) {
        const source = cal.source || 'Other';
        if (!bySource[source]) bySource[source] = [];
        bySource[source].push(cal);
      });

      const sources = Object.keys(bySource).sort(function(a, b) {
        if (a === 'iCloud') return -1;
        if (b === 'iCloud') return 1;
        return a.localeCompare(b);
      });

      sources.forEach(function(source) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = source;
        bySource[source].forEach(function(cal) {
          const option = document.createElement('option');
          option.value = cal.title;
          option.textContent = cal.title;
          optgroup.appendChild(option);
        });
        calendar.appendChild(optgroup);
      });

      if (state.editingEvent) {
        const event = state.editingEvent;
        title.value = event.title || '';
        allDay.checked = event.isAllDay !== false;

        const eventStart = new Date(event.date || event.startDate);
        const eventEnd = new Date(event.endDate);

        startDate.value = formatDate(eventStart);
        startTime.value = formatTime(eventStart);
        endDate.value = formatDate(eventEnd);
        endTime.value = formatTime(eventEnd);

        const calName = event.calendar || event.calendarTitle;
        for (let i = 0; i < calendar.options.length; i++) {
          if (calendar.options[i].value === calName) {
            calendar.selectedIndex = i;
            break;
          }
        }

        notes.value = event.notes || '';
      } else {
        title.value = '';
        allDay.checked = true;

        const date = options.date || new Date();
        startDate.value = formatDate(date);
        startTime.value = '09:00';
        endDate.value = formatDate(date);
        endTime.value = '10:00';
        notes.value = '';

        if (calendar.options.length > 0) {
          calendar.selectedIndex = 0;
        }
      }

      updateTimeFieldsVisibility();
      modal.classList.add('visible');
      setTimeout(function() { title.focus(); }, 100);
    }

    function closeEventModal() {
      document.getElementById('eventModal').classList.remove('visible');
      state.editingEvent = null;
    }

    function updateTimeFieldsVisibility() {
      const allDay = document.getElementById('eventAllDay').checked;
      document.getElementById('startTimeGroup').style.display = allDay ? 'none' : 'block';
      document.getElementById('endTimeGroup').style.display = allDay ? 'none' : 'block';
    }

    async function handleSaveEvent() {
      const title = document.getElementById('eventTitle').value.trim() || 'New Event';
      const allDay = document.getElementById('eventAllDay').checked;
      const startDateStr = document.getElementById('eventStartDate').value;
      const startTimeStr = document.getElementById('eventStartTime').value;
      const endDateStr = document.getElementById('eventEndDate').value;
      const endTimeStr = document.getElementById('eventEndTime').value;
      const calendar = document.getElementById('eventCalendar').value;
      const notes = document.getElementById('eventNotes').value;

      let start = parseDate(startDateStr);
      let end = parseDate(endDateStr);

      if (allDay) {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else {
        start = parseTime(startTimeStr, start);
        end = parseTime(endTimeStr, end);
      }

      if (end < start) {
        end = new Date(start);
        if (allDay) {
          end.setHours(23, 59, 59, 999);
        } else {
          end.setHours(end.getHours() + 1);
        }
      }

      const eventData = {
        title: title,
        start: start,
        end: end,
        isAllDay: allDay,
        calendar: calendar,
        notes: notes
      };

      if (state.editingEvent && state.editingEvent.id) {
        await updateEvent(state.editingEvent.id, eventData);
      } else {
        await createEvent(eventData);
      }

      closeEventModal();
    }

    async function handleDeleteEvent() {
      if (state.editingEvent && state.editingEvent.id) {
        await deleteEvent(state.editingEvent.id);
        closeEventModal();
      }
    }

    // ============================================
    // Render Functions
    // ============================================
    function render() {
      document.getElementById('navTitle').textContent = getNavigationTitle();

      const container = document.getElementById('calendarContainer');

      switch (state.currentView) {
        case 'year':
          container.innerHTML = renderYearView();
          attachYearViewListeners();
          break;
        case 'month':
          container.innerHTML = renderMonthView();
          attachMonthViewListeners();
          break;
        case 'week':
          container.innerHTML = renderWeekView();
          attachWeekViewListeners();
          scrollToCurrentTime();
          break;
        case 'day':
          container.innerHTML = renderDayView();
          attachDayViewListeners();
          scrollToCurrentTime();
          break;
      }
    }

    // ============================================
    // Year View
    // ============================================
    function renderYearView() {
      const year = state.viewDate.getFullYear();
      let html = '<div class="year-view"><div class="year-grid">';

      for (let month = 0; month < 12; month++) {
        html += renderMiniMonth(year, month);
      }

      html += '</div></div>';
      return html;
    }

    function renderMiniMonth(year, month) {
      const firstDay = getFirstDayOfMonth(year, month);
      const daysInMonth = getDaysInMonth(year, month);
      const today = new Date();

      const monthEvents = state.events.filter(function(e) {
        const eventStart = new Date(e.date || e.startDate);
        const eventEnd = new Date(e.endDate);
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
        return eventStart <= monthEnd && eventEnd >= monthStart;
      });

      const daysWithEvents = new Set();
      monthEvents.forEach(function(e) {
        const start = new Date(e.date || e.startDate);
        const end = new Date(e.endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.getMonth() === month && d.getFullYear() === year) {
            daysWithEvents.add(d.getDate());
          }
        }
      });

      let html = '<div class="mini-month" data-month="' + month + '">';
      html += '<div class="mini-month-title">' + MONTH_NAMES[month] + '</div>';
      html += '<div class="mini-month-grid">';

      for (let i = 0; i < 7; i++) {
        const dayIndex = (i + state.settings.firstDayOfWeek) % 7;
        html += '<div class="mini-weekday">' + WEEKDAY_NAMES[dayIndex].substr(0, 1) + '</div>';
      }

      const startOffset = (firstDay - state.settings.firstDayOfWeek + 7) % 7;

      for (let i = 0; i < startOffset; i++) {
        html += '<div class="mini-day other-month"><span class="mini-day-number"></span></div>';
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isTodayDate = isSameDay(date, today);
        const hasEvents = daysWithEvents.has(day);

        let classes = 'mini-day';
        if (isTodayDate) classes += ' today';
        if (hasEvents) classes += ' has-events';

        html += '<div class="' + classes + '" data-date="' + formatDate(date) + '"><span class="mini-day-number">' + day + '</span></div>';
      }

      html += '</div></div>';
      return html;
    }

    function attachYearViewListeners() {
      document.querySelectorAll('.mini-day[data-date]').forEach(function(dayEl) {
        dayEl.addEventListener('click', function(e) {
          e.stopPropagation();
          const date = parseDate(dayEl.dataset.date);
          if (e.metaKey) {
            openNote(date, { newWindow: true });
          } else if (e.altKey) {
            openNote(date, { splitView: true });
          } else {
            state.viewDate = date;
            switchView('month');
          }
        });
      });

      document.querySelectorAll('.mini-month').forEach(function(miniMonth) {
        miniMonth.addEventListener('click', function(e) {
          if (e.target.closest('.mini-day[data-date]')) return;
          const month = parseInt(miniMonth.dataset.month);
          state.viewDate.setMonth(month);
          switchView('month');
        });
      });
    }

    // ============================================
    // Month View
    // ============================================
    function renderMonthView() {
      const year = state.viewDate.getFullYear();
      const month = state.viewDate.getMonth();

      let html = '<div class="month-view">';

      html += '<div class="weekday-header">';
      for (let i = 0; i < 7; i++) {
        const dayIndex = (i + state.settings.firstDayOfWeek) % 7;
        html += '<div class="weekday-cell">' + WEEKDAY_NAMES[dayIndex] + '</div>';
      }
      html += '</div>';

      // Get all weeks for this month view
      const weeks = getWeeksInMonthView(year, month);

      html += '<div class="month-weeks">';
      weeks.forEach(function(weekDates) {
        html += renderWeekRow(weekDates, month);
      });
      html += '</div>';

      html += '</div>';
      return html;
    }

    function getWeeksInMonthView(year, month) {
      const weeks = [];
      const firstDay = getFirstDayOfMonth(year, month);
      const daysInMonth = getDaysInMonth(year, month);

      const startOffset = (firstDay - state.settings.firstDayOfWeek + 7) % 7;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevMonthYear = month === 0 ? year - 1 : year;
      const daysInPrevMonth = getDaysInMonth(prevMonthYear, prevMonth);

      // Build all dates for the month view
      const allDates = [];

      // Previous month padding
      for (let i = startOffset - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        allDates.push(new Date(prevMonthYear, prevMonth, day));
      }

      // Current month
      for (let day = 1; day <= daysInMonth; day++) {
        allDates.push(new Date(year, month, day));
      }

      // Next month padding
      const totalCells = startOffset + daysInMonth;
      const remainingCells = (7 - (totalCells % 7)) % 7 + (totalCells <= 35 ? 7 : 0);
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextMonthYear = month === 11 ? year + 1 : year;

      for (let day = 1; day <= remainingCells; day++) {
        allDates.push(new Date(nextMonthYear, nextMonth, day));
      }

      // Group into weeks
      for (let i = 0; i < allDates.length; i += 7) {
        weeks.push(allDates.slice(i, i + 7));
      }

      return weeks;
    }

    function renderWeekRow(weekDates, currentMonth) {
      const weekStart = new Date(weekDates[0]);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekDates[6]);
      weekEnd.setHours(23, 59, 59, 999);

      // Get all events for this week
      const weekEvents = getEventsForDateRange(weekStart, weekEnd);

      // Separate multi-day and single-day events
      const multiDayEvents = [];
      const singleDayEventsByDate = {};

      weekEvents.forEach(function(event) {
        const eventStart = new Date(event.date || event.startDate);
        const eventEnd = new Date(event.endDate);
        eventStart.setHours(0, 0, 0, 0);
        eventEnd.setHours(0, 0, 0, 0);

        if (eventEnd.getTime() > eventStart.getTime()) {
          multiDayEvents.push(event);
        } else {
          const dateKey = formatDate(eventStart);
          if (!singleDayEventsByDate[dateKey]) singleDayEventsByDate[dateKey] = [];
          singleDayEventsByDate[dateKey].push(event);
        }
      });

      // Assign lanes to multi-day events and build per-column layout
      const columnLayout = buildColumnLayout(multiDayEvents, weekDates);

      let html = '<div class="week-row">';

      // Day numbers row
      html += '<div class="week-day-numbers">';
      weekDates.forEach(function(date) {
        const isOtherMonth = date.getMonth() !== currentMonth;
        const isTodayDate = isToday(date);
        let classes = 'day-number-cell';
        if (isOtherMonth) classes += ' other-month';
        if (isTodayDate) classes += ' today';
        html += '<div class="' + classes + '" data-date="' + formatDate(date) + '">';
        html += '<span class="day-num">' + date.getDate() + '</span>';
        html += '</div>';
      });
      html += '</div>';

      // Per-column content area
      html += '<div class="week-days-content">';
      weekDates.forEach(function(date, colIndex) {
        const dateKey = formatDate(date);
        const isOtherMonth = date.getMonth() !== currentMonth;
        const dayEvents = singleDayEventsByDate[dateKey] || [];
        const colData = columnLayout.columns[colIndex];

        // Check if column has any events (single-day or multi-day)
        const hasMultiDayEvents = colData.slots.some(function(slot) { return !slot.empty; });
        const hasEvents = dayEvents.length > 0 || hasMultiDayEvents;

        let columnClasses = 'day-column';
        if (isOtherMonth) columnClasses += ' other-month';
        if (hasEvents) columnClasses += ' has-events';

        html += '<div class="' + columnClasses + '" data-date="' + dateKey + '">';

        // Multi-day event slots for this column
        if (colData.slots.length > 0) {
          html += '<div class="multi-day-slots">';
          colData.slots.forEach(function(slot) {
            if (slot.empty) {
              // Empty slot to maintain lane alignment
              html += '<div class="event-slot empty"></div>';
            } else {
              const color = getEventColor(slot.event);
              const bgColor = colorWithOpacity(color, 0.35);
              const textColor = slot.showTitle ? getTextColorForBackground(color, 0.35) : 'transparent';

              let slotClasses = 'event-slot';
              if (slot.continuesLeft) slotClasses += ' continues-left';
              if (slot.continuesRight) slotClasses += ' continues-right';

              html += '<div class="' + slotClasses + '" data-event-id="' + slot.event.id + '" ' +
                      'style="background: ' + bgColor + '; color: ' + textColor + ';">' +
                      escapeHtml(slot.event.title || 'No Title') + '</div>';
            }
          });
          html += '</div>';
        }

        // Single-day events - render all, CSS will handle overflow
        html += '<div class="single-day-events" data-total-events="' + dayEvents.length + '">';
        dayEvents.forEach(function(event) {
          const color = getEventColor(event);
          const isAllDay = event.isAllDay;

          if (isAllDay) {
            // All-day events: colored background
            const bgColor = colorWithOpacity(color, 0.35);
            const textColor = getTextColorForBackground(color, 0.35);
            html += '<div class="event-chip all-day" data-event-id="' + event.id + '" ' +
                    'style="background: ' + bgColor + '; color: ' + textColor + ';">' +
                    escapeHtml(event.title || 'No Title') + '</div>';
          } else {
            // Timed events: left color bar + title + time
            const eventDate = new Date(event.date || event.startDate);
            const timeStr = formatTime(eventDate);
            html += '<div class="event-chip timed" data-event-id="' + event.id + '">' +
                    '<span class="event-color-bar" style="background: ' + color + ';"></span>' +
                    '<span class="event-title">' + escapeHtml(event.title || 'No Title') + '</span>' +
                    '<span class="event-time">' + timeStr + '</span>' +
                    '</div>';
          }
        });
        // More indicator - will be updated after render based on visible events
        if (dayEvents.length > 0) {
          html += '<div class="more-events" style="display:none;"></div>';
        }
        html += '</div>';

        html += '</div>'; // close day-column
      });
      html += '</div>'; // close week-days-content

      html += '</div>';
      return html;
    }

    function getEventsForDateRange(startDate, endDate) {
      return state.events.filter(function(e) {
        const eventStart = new Date(e.date || e.startDate);
        const eventEnd = new Date(e.endDate);
        return eventStart <= endDate && eventEnd >= startDate;
      }).sort(function(a, b) {
        const aStart = new Date(a.date || a.startDate);
        const bStart = new Date(b.date || b.startDate);
        if (aStart.getTime() !== bStart.getTime()) return aStart - bStart;
        // Longer events first
        const aDuration = new Date(a.endDate).getTime() - aStart.getTime();
        const bDuration = new Date(b.endDate).getTime() - bStart.getTime();
        return bDuration - aDuration;
      });
    }

    function buildColumnLayout(events, weekDates) {
      // Initialize result with 7 columns
      const result = {
        columns: weekDates.map(function() {
          return { slots: [] };
        }),
        maxLanes: 0
      };

      if (events.length === 0) return result;

      const weekStart = new Date(weekDates[0]);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekDates[6]);
      weekEnd.setHours(23, 59, 59, 999);
      const dayMs = 24 * 60 * 60 * 1000;

      // First pass: assign lanes to events
      const eventInfos = [];
      const lanes = []; // lanes[laneIndex] = array of { startCol, endCol }

      events.forEach(function(event) {
        const eventStart = new Date(event.date || event.startDate);
        var eventEnd = new Date(event.endDate);
        eventStart.setHours(0, 0, 0, 0);

        // For all-day events, endDate is often exclusive (day after event ends)
        eventEnd.setTime(eventEnd.getTime() - 1);
        eventEnd.setHours(0, 0, 0, 0);

        // Ensure end is not before start
        if (eventEnd.getTime() < eventStart.getTime()) {
          eventEnd = new Date(eventStart.getTime());
        }

        // Clamp to week boundaries
        const visibleStart = new Date(Math.max(eventStart.getTime(), weekStart.getTime()));
        const visibleEnd = new Date(Math.min(eventEnd.getTime(), weekEnd.getTime()));

        // Calculate column positions (0-6)
        const startCol = Math.floor((visibleStart.getTime() - weekStart.getTime()) / dayMs);
        const endCol = Math.floor((visibleEnd.getTime() - weekStart.getTime()) / dayMs);

        const continuesLeft = eventStart.getTime() < weekStart.getTime();
        const continuesRight = eventEnd.getTime() > weekEnd.getTime();

        // Find a lane where this event fits
        let laneIndex = 0;
        while (true) {
          if (!lanes[laneIndex]) lanes[laneIndex] = [];

          const canFit = lanes[laneIndex].every(function(existing) {
            return endCol < existing.startCol || startCol > existing.endCol;
          });

          if (canFit) {
            lanes[laneIndex].push({ startCol: startCol, endCol: endCol });
            eventInfos.push({
              event: event,
              lane: laneIndex,
              startCol: startCol,
              endCol: endCol,
              continuesLeft: continuesLeft,
              continuesRight: continuesRight
            });
            break;
          }
          laneIndex++;
        }
      });

      result.maxLanes = lanes.length;

      // Second pass: build per-column slot data
      // For each column, determine which lanes have events and create slots
      for (let col = 0; col < 7; col++) {
        // Find the max lane for this specific column
        let maxLaneForCol = -1;
        eventInfos.forEach(function(info) {
          if (col >= info.startCol && col <= info.endCol) {
            if (info.lane > maxLaneForCol) maxLaneForCol = info.lane;
          }
        });

        // Create slots for lanes 0 to maxLaneForCol
        for (let lane = 0; lane <= maxLaneForCol; lane++) {
          // Find if there's an event in this lane for this column
          const eventInfo = eventInfos.find(function(info) {
            return info.lane === lane && col >= info.startCol && col <= info.endCol;
          });

          if (eventInfo) {
            result.columns[col].slots.push({
              event: eventInfo.event,
              lane: lane,
              showTitle: col === eventInfo.startCol, // Show title at start of each week
              continuesLeft: col > eventInfo.startCol || eventInfo.continuesLeft,
              continuesRight: col < eventInfo.endCol || eventInfo.continuesRight,
              empty: false
            });
          } else {
            // Empty slot to maintain lane alignment
            result.columns[col].slots.push({
              lane: lane,
              empty: true
            });
          }
        }
      }

      return result;
    }

    function getEventsForDay(date) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      return state.events.filter(function(e) {
        const eventStart = new Date(e.date || e.startDate);
        const eventEnd = new Date(e.endDate);
        return eventStart <= dayEnd && eventEnd >= dayStart;
      }).sort(function(a, b) {
        const aStart = new Date(a.date || a.startDate);
        const bStart = new Date(b.date || b.startDate);
        return aStart - bStart;
      });
    }

    function adjustMoreIndicators() {
      // After render, calculate available height and hide events that don't fit
      document.querySelectorAll('.single-day-events').forEach(function(container) {
        const totalEvents = parseInt(container.dataset.totalEvents) || 0;
        if (totalEvents === 0) return;

        const chips = Array.from(container.querySelectorAll('.event-chip'));
        const moreEl = container.querySelector('.more-events');
        if (!moreEl || chips.length === 0) return;

        // Hide everything first to get accurate container size
        chips.forEach(function(chip) { chip.style.display = 'none'; });
        moreEl.style.display = 'none';

        // Get available height from parent day-column
        const dayColumn = container.closest('.day-column');
        if (!dayColumn) return;

        const dayColumnRect = dayColumn.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Available height for single-day events
        const availableHeight = dayColumnRect.bottom - containerRect.top - 4; // 4px padding

        if (availableHeight <= 0) return;

        // Measure chip height by showing first one temporarily
        chips[0].style.display = '';
        const chipHeight = chips[0].offsetHeight + 2; // +2 for gap
        chips[0].style.display = 'none';

        if (chipHeight <= 0) return;

        // Calculate how many events fit
        const moreElHeight = 18; // Height reserved for "+X more"
        let visibleCount = 0;

        for (let i = 0; i < chips.length; i++) {
          const heightWithThisChip = (i + 1) * chipHeight;
          const needsMoreIndicator = i < chips.length - 1;
          const heightNeeded = heightWithThisChip + (needsMoreIndicator ? moreElHeight : 0);

          if (heightNeeded <= availableHeight) {
            visibleCount++;
          } else {
            break;
          }
        }

        // Ensure at least 1 event shows if there's any space
        if (visibleCount === 0 && availableHeight >= chipHeight) {
          visibleCount = 1;
        }

        // Show visible events
        chips.forEach(function(chip, index) {
          chip.style.display = index < visibleCount ? '' : 'none';
        });

        // Show "+X more" if there are hidden events
        const hiddenCount = totalEvents - visibleCount;
        if (hiddenCount > 0) {
          moreEl.textContent = '+' + hiddenCount + ' more';
          moreEl.style.display = '';
        }
      });
    }

    function attachMonthViewListeners() {
      // Adjust "+X more" indicators after layout is complete
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          adjustMoreIndicators();
        });
      });

      // Day number cells - for navigation
      document.querySelectorAll('.day-number-cell').forEach(function(cell) {
        cell.addEventListener('click', function(e) {
          const date = parseDate(cell.dataset.date);
          if (e.metaKey) {
            openNote(date, { newWindow: true });
          } else if (e.altKey) {
            openNote(date, { splitView: true });
          } else {
            state.viewDate = date;
            switchView('day');
          }
        });
      });

      // Day columns - for creating events (clicking on empty space)
      document.querySelectorAll('.day-column').forEach(function(column) {
        column.addEventListener('click', function(e) {
          // Ignore if clicking on an event
          if (e.target.classList.contains('event-chip') ||
              e.target.classList.contains('event-slot')) return;
          const date = parseDate(column.dataset.date);
          if (e.metaKey) {
            openNote(date, { newWindow: true });
          } else if (e.altKey) {
            openNote(date, { splitView: true });
          } else {
            openEventModal({ date: date });
          }
        });
      });

      // Event slots (multi-day) and chips (single-day)
      document.querySelectorAll('.event-slot:not(.empty), .event-chip').forEach(function(el) {
        el.addEventListener('click', async function(e) {
          e.stopPropagation();
          const eventId = el.dataset.eventId;
          try {
            const event = await Calendar.eventByID(eventId);
            if (event) {
              openEventModal({ event: event });
            }
          } catch (error) {
            // Error handled silently
          }
        });
      });
    }

    // ============================================
    // Week View
    // ============================================
    function renderWeekView() {
      const weekDates = getWeekDates(state.viewDate);
      const today = new Date();

      let html = '<div class="week-view">';

      html += '<div class="week-header">';
      html += '<div class="week-header-spacer"></div>';

      weekDates.forEach(function(date) {
        const isTodayDate = isSameDay(date, today);
        html += '<div class="week-header-day' + (isTodayDate ? ' today' : '') + '" data-date="' + formatDate(date) + '">';
        html += '<div class="week-day-name">' + WEEKDAY_NAMES[date.getDay()] + '</div>';
        html += '<div class="week-day-number">' + date.getDate() + '</div>';
        html += '</div>';
      });
      html += '</div>';

      html += '<div class="all-day-section">';
      html += '<div class="all-day-label">All-day</div>';

      weekDates.forEach(function(date) {
        const allDayEvents = getEventsForDay(date).filter(function(e) { return e.isAllDay; });
        html += '<div class="all-day-column" data-date="' + formatDate(date) + '">';
        allDayEvents.forEach(function(event) {
          const color = getEventColor(event);
          const bgColor = colorWithOpacity(color, 0.35);
          const textColor = getTextColorForBackground(color, 0.35);
          html += '<div class="event-chip" data-event-id="' + event.id + '" ' +
                  'style="background: ' + bgColor + '; color: ' + textColor + ';">' +
                  escapeHtml(event.title || 'No Title') + '</div>';
        });
        html += '</div>';
      });
      html += '</div>';

      html += '<div class="week-body">';

      html += '<div class="time-column">';
      for (let hour = 0; hour < 24; hour++) {
        const label = hour === 0 ? '12 AM' : hour < 12 ? hour + ' AM' : hour === 12 ? '12 PM' : (hour - 12) + ' PM';
        html += '<div class="time-slot-label">' + label + '</div>';
      }
      html += '</div>';

      weekDates.forEach(function(date) {
        html += renderDayColumn(date);
      });

      html += '</div></div>';
      return html;
    }

    function renderDayColumn(date) {
      const timedEvents = getEventsForDay(date).filter(function(e) { return !e.isAllDay; });
      const today = new Date();
      const isTodayDate = isSameDay(date, today);

      let html = '<div class="day-column" data-date="' + formatDate(date) + '">';

      for (let hour = 0; hour < 24; hour++) {
        html += '<div class="hour-line" style="top: ' + (hour * 60) + 'px;"></div>';
        html += '<div class="half-hour-line" style="top: ' + (hour * 60 + 30) + 'px;"></div>';
      }

      if (isTodayDate) {
        const now = new Date();
        const minutes = now.getHours() * 60 + now.getMinutes();
        html += '<div class="current-time-line" style="top: ' + minutes + 'px;"></div>';
      }

      const layoutEvents = layoutOverlappingEvents(timedEvents);
      layoutEvents.forEach(function(event) {
        const start = new Date(event.date || event.startDate);
        const end = new Date(event.endDate);
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const endMinutes = end.getHours() * 60 + end.getMinutes();
        const duration = Math.max(endMinutes - startMinutes, 30);

        const color = getEventColor(event);
        const bgColor = colorWithOpacity(color, 0.35);
        const textColor = getTextColorForBackground(color, 0.35);
        const width = (100 / event.totalColumns) - 1;
        const left = event.column * (100 / event.totalColumns);

        html += '<div class="timed-event" data-event-id="' + event.id + '" ' +
                'style="top: ' + startMinutes + 'px; height: ' + duration + 'px; ' +
                'background: ' + bgColor + '; color: ' + textColor + '; ' +
                'width: ' + width + '%; left: ' + left + '%;">';
        html += '<div class="timed-event-title">' + escapeHtml(event.title || 'No Title') + '</div>';
        if (duration >= 45) {
          html += '<div class="timed-event-time">' + formatTime(start) + ' - ' + formatTime(end) + '</div>';
        }
        html += '</div>';
      });

      html += '</div>';
      return html;
    }

    function layoutOverlappingEvents(events) {
      if (events.length === 0) return [];

      const sorted = events.slice().sort(function(a, b) {
        const aStart = new Date(a.date || a.startDate);
        const bStart = new Date(b.date || b.startDate);
        return aStart - bStart;
      });

      const groups = [];
      let currentGroup = [sorted[0]];

      for (let i = 1; i < sorted.length; i++) {
        const event = sorted[i];
        const eventStart = new Date(event.date || event.startDate);

        const overlaps = currentGroup.some(function(e) {
          const eEnd = new Date(e.endDate);
          return eventStart < eEnd;
        });

        if (overlaps) {
          currentGroup.push(event);
        } else {
          groups.push(currentGroup);
          currentGroup = [event];
        }
      }
      groups.push(currentGroup);

      const result = [];
      groups.forEach(function(group) {
        const columns = [];
        group.forEach(function(event) {
          const eventStart = new Date(event.date || event.startDate);

          let column = 0;
          while (columns[column] && new Date(columns[column].endDate) > eventStart) {
            column++;
          }

          columns[column] = event;
          const eventCopy = Object.assign({}, event);
          eventCopy.column = column;
          eventCopy.totalColumns = group.length;
          result.push(eventCopy);
        });
      });

      return result;
    }

    function attachWeekViewListeners() {
      document.querySelectorAll('.week-header-day').forEach(function(header) {
        header.addEventListener('click', function(e) {
          const date = parseDate(header.dataset.date);
          if (e.metaKey) {
            openNote(date, { newWindow: true });
          } else if (e.altKey) {
            openNote(date, { splitView: true });
          } else {
            state.viewDate = date;
            switchView('day');
          }
        });
      });

      document.querySelectorAll('.day-column').forEach(function(column) {
        column.addEventListener('click', function(e) {
          if (e.target.classList.contains('timed-event')) return;
          const date = parseDate(column.dataset.date);
          if (e.metaKey) {
            openNote(date, { newWindow: true });
          } else if (e.altKey) {
            openNote(date, { splitView: true });
          } else {
            const rect = column.getBoundingClientRect();
            const y = e.clientY - rect.top + column.parentElement.scrollTop;
            const hour = Math.floor(y / 60);
            date.setHours(hour, 0, 0, 0);
            openEventModal({ date: date });
          }
        });
      });

      document.querySelectorAll('.all-day-column').forEach(function(column) {
        column.addEventListener('click', function(e) {
          if (e.target.classList.contains('event-chip')) return;
          const date = parseDate(column.dataset.date);
          if (e.metaKey) {
            openNote(date, { newWindow: true });
          } else if (e.altKey) {
            openNote(date, { splitView: true });
          } else {
            openEventModal({ date: date });
          }
        });
      });

      document.querySelectorAll('.event-chip, .timed-event').forEach(function(el) {
        el.addEventListener('click', async function(e) {
          e.stopPropagation();
          const eventId = el.dataset.eventId;
          try {
            const event = await Calendar.eventByID(eventId);
            if (event) {
              openEventModal({ event: event });
            }
          } catch (error) {
            // Error handled silently
          }
        });
      });
    }

    function scrollToCurrentTime() {
      const weekBody = document.querySelector('.week-body');
      if (weekBody) {
        const now = new Date();
        const scrollTo = Math.max(0, (now.getHours() - 1) * 60);
        weekBody.scrollTop = scrollTo;
      }
    }

    // ============================================
    // Day View
    // ============================================
    function renderDayView() {
      const date = state.viewDate;
      const today = new Date();
      const isTodayDate = isSameDay(date, today);

      let html = '<div class="day-view">';

      html += '<div class="week-header">';
      html += '<div class="week-header-spacer"></div>';
      html += '<div class="week-header-day' + (isTodayDate ? ' today' : '') + '" data-date="' + formatDate(date) + '">';
      html += '<div class="week-day-name">' + WEEKDAY_NAMES[date.getDay()] + '</div>';
      html += '<div class="week-day-number">' + date.getDate() + '</div>';
      html += '</div>';
      html += '</div>';

      const allDayEvents = getEventsForDay(date).filter(function(e) { return e.isAllDay; });
      html += '<div class="all-day-section">';
      html += '<div class="all-day-label">All-day</div>';
      html += '<div class="all-day-column" data-date="' + formatDate(date) + '">';
      allDayEvents.forEach(function(event) {
        const color = getEventColor(event);
        const bgColor = colorWithOpacity(color, 0.35);
        const textColor = getTextColorForBackground(color, 0.35);
        html += '<div class="event-chip" data-event-id="' + event.id + '" ' +
                'style="background: ' + bgColor + '; color: ' + textColor + ';">' +
                escapeHtml(event.title || 'No Title') + '</div>';
      });
      html += '</div></div>';

      html += '<div class="week-body">';

      html += '<div class="time-column">';
      for (let hour = 0; hour < 24; hour++) {
        const label = hour === 0 ? '12 AM' : hour < 12 ? hour + ' AM' : hour === 12 ? '12 PM' : (hour - 12) + ' PM';
        html += '<div class="time-slot-label">' + label + '</div>';
      }
      html += '</div>';

      html += renderDayColumn(date);

      html += '</div></div>';
      return html;
    }

    function attachDayViewListeners() {
      attachWeekViewListeners();
    }

    // ============================================
    // Event Filter
    // ============================================
    function initEventFilter() {
      const input = document.getElementById('eventFilterInput');
      const clearBtn = document.getElementById('eventFilterClear');
      const toggle = document.getElementById('eventFilterToggle');
      const container = document.getElementById('eventFilterContainer');

      if (!input || !container) return;

      function expandFilter() {
        container.classList.add('expanded');
        input.focus();
      }

      function collapseFilter() {
        if (!input.value.trim()) {
          container.classList.remove('expanded');
        }
      }

      // Toggle button expands filter
      if (toggle) {
        toggle.addEventListener('click', function(e) {
          e.stopPropagation();
          if (container.classList.contains('expanded')) {
            input.focus();
          } else {
            expandFilter();
          }
        });
      }

      // Cmd+F / Ctrl+F to expand and focus
      document.addEventListener('keydown', function(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
          e.preventDefault();
          expandFilter();
        }
      });

      input.addEventListener('input', function() {
        state.filterText = this.value.trim().toLowerCase();

        // Toggle has-value class for clear button visibility
        container.classList.toggle('has-value', this.value.length > 0);

        applyEventFilter();
      });

      input.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          this.value = '';
          state.filterText = '';
          container.classList.remove('has-value');
          container.classList.remove('expanded');
          applyEventFilter();
          this.blur();
        }
      });

      // Collapse on blur if empty and focus left the container
      input.addEventListener('blur', function() {
        setTimeout(function() {
          // Don't collapse if focus is still within the event filter
          // (e.g., user clicked the toggle button or clear button)
          if (document.activeElement && document.activeElement.closest('.event-filter')) {
            return;
          }
          collapseFilter();
        }, 150);
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', function() {
          input.value = '';
          state.filterText = '';
          container.classList.remove('has-value');
          applyEventFilter();
          input.focus();
        });
      }
    }

    function applyEventFilter() {
      const filterText = state.filterText;

      // Find all event elements
      const eventElements = document.querySelectorAll('.event-slot:not(.empty), .event-chip, .timed-event');

      eventElements.forEach(function(el) {
        const eventTitle = (el.textContent || '').toLowerCase();
        const matches = !filterText || eventTitle.includes(filterText);

        if (matches) {
          el.style.display = '';
          el.style.visibility = '';
        } else {
          // Use visibility hidden to maintain layout for multi-day events
          if (el.classList.contains('event-slot')) {
            el.style.visibility = 'hidden';
          } else {
            el.style.display = 'none';
          }
        }
      });

      // Update more indicators after filtering
      if (state.currentView === 'month') {
        updateMoreIndicatorsAfterFilter();
      }
    }

    function updateMoreIndicatorsAfterFilter() {
      document.querySelectorAll('.more-events').forEach(function(indicator) {
        const dayColumn = indicator.closest('.day-column');
        if (!dayColumn) return;

        const visibleChips = dayColumn.querySelectorAll('.event-chip:not([style*="display: none"])');
        const hiddenCount = dayColumn.querySelectorAll('.event-chip[style*="display: none"]').length;

        // Update or hide the more indicator based on visible events
        const totalHidden = parseInt(indicator.dataset.originalCount || '0') - hiddenCount;
        if (totalHidden > 0 && !state.filterText) {
          indicator.textContent = '+' + totalHidden + ' more';
          indicator.style.display = '';
        } else {
          indicator.style.display = 'none';
        }
      });
    }

    // ============================================
    // Quick Add (Natural Language Event Input)
    // ============================================
    let pendingQuickAddEvent = null;
    let isQuickAddProcessing = false;
    let selectedQuickAddCalendar = null;

    function initQuickAdd() {
      const input = document.getElementById('quickAddInput');
      const toggle = document.getElementById('quickAddToggle');
      const container = document.getElementById('quickAddContainer');
      const calBtn = document.getElementById('quickAddCalendarBtn');

      if (!input || !container) return;

      // Initialize calendar selector
      initQuickAddCalendarSelector();

      function expandQuickAdd() {
        container.classList.add('expanded');
        input.focus();
      }

      function collapseQuickAdd() {
        if (!input.value.trim()) {
          container.classList.remove('expanded');
          hideQuickAddCalendarDropdown();
        }
      }

      async function submitQuickAdd() {
        if (input.value.trim() && !isQuickAddProcessing) {
          isQuickAddProcessing = true;
          try {
            await handleQuickAdd(input.value.trim());
            // Only collapse if event was created (input is cleared by createQuickAddEvent)
            if (!input.value.trim()) {
              container.classList.remove('expanded');
            }
          } finally {
            isQuickAddProcessing = false;
          }
        }
      }

      // Toggle button: expand if collapsed, submit if expanded with value
      if (toggle) {
        toggle.addEventListener('click', async function(e) {
          e.stopPropagation();
          if (container.classList.contains('expanded')) {
            if (input.value.trim()) {
              await submitQuickAdd();
            } else {
              input.focus();
            }
          } else {
            expandQuickAdd();
          }
        });
      }

      input.addEventListener('keydown', async function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          await submitQuickAdd();
        } else if (e.key === 'Escape') {
          this.value = '';
          hideQuickAddCalendarDropdown();
          container.classList.remove('expanded');
          this.blur();
        }
      });

      // Collapse on blur if empty and focus left the container
      input.addEventListener('blur', function() {
        setTimeout(function() {
          // Don't collapse if focus is still within the quick-add container
          // (e.g., user clicked the toggle button or calendar selector)
          if (document.activeElement && document.activeElement.closest('.quick-add-container')) {
            return;
          }
          collapseQuickAdd();
        }, 200);
      });

      // Calendar selector button
      if (calBtn) {
        calBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          toggleQuickAddCalendarDropdown();
        });
      }

      // Close dropdown when clicking outside
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.quick-add-container')) {
          hideQuickAddCalendarDropdown();
          collapseQuickAdd();
        }
      });
    }

    function initQuickAddCalendarSelector() {
      const calendars = state.writableCalendars;
      if (calendars.length === 0) return;

      // Try to restore saved calendar
      const savedCalendarTitle = localStorage.getItem('calendar_quickAddCalendar');
      let defaultCalendar = null;

      if (savedCalendarTitle) {
        defaultCalendar = calendars.find(function(c) { return c.title === savedCalendarTitle; });
      }

      // If no saved or saved not found, use first calendar
      if (!defaultCalendar) {
        defaultCalendar = calendars[0];
      }

      selectQuickAddCalendar(defaultCalendar);
      populateQuickAddCalendarDropdown();
    }

    function selectQuickAddCalendar(calendar) {
      selectedQuickAddCalendar = calendar;

      // Update UI
      const dot = document.getElementById('quickAddCalDot');
      const name = document.getElementById('quickAddCalName');

      if (dot && calendar) {
        dot.style.background = calendar.color;
      }
      if (name && calendar) {
        name.textContent = calendar.title;
      }

      // Save to localStorage
      if (calendar) {
        localStorage.setItem('calendar_quickAddCalendar', calendar.title);
      }

      // Update dropdown selection
      document.querySelectorAll('.quick-add-calendar-option').forEach(function(opt) {
        opt.classList.toggle('selected', opt.dataset.calendarTitle === calendar.title);
      });
    }

    function populateQuickAddCalendarDropdown() {
      const dropdown = document.getElementById('quickAddCalendarDropdown');
      if (!dropdown) return;

      dropdown.innerHTML = '';

      // Group calendars by source
      const bySource = {};
      state.writableCalendars.forEach(function(cal) {
        const source = cal.source || 'Other';
        if (!bySource[source]) bySource[source] = [];
        bySource[source].push(cal);
      });

      // Render grouped calendars
      Object.keys(bySource).sort().forEach(function(source) {
        // Source header
        const header = document.createElement('div');
        header.className = 'calendar-source-header';
        header.textContent = source;
        dropdown.appendChild(header);

        // Calendars in this source
        bySource[source].forEach(function(cal) {
          const option = document.createElement('div');
          option.className = 'quick-add-calendar-option';
          option.dataset.calendarTitle = cal.title;

          if (selectedQuickAddCalendar && selectedQuickAddCalendar.title === cal.title) {
            option.classList.add('selected');
          }

          const dot = document.createElement('span');
          dot.className = 'cal-dot';
          dot.style.background = cal.color;

          const name = document.createElement('span');
          name.className = 'cal-name';
          name.textContent = cal.title;

          option.appendChild(dot);
          option.appendChild(name);

          option.addEventListener('click', function(e) {
            e.stopPropagation();
            selectQuickAddCalendar(cal);
            hideQuickAddCalendarDropdown();
          });

          dropdown.appendChild(option);
        });
      });
    }

    function toggleQuickAddCalendarDropdown() {
      const dropdown = document.getElementById('quickAddCalendarDropdown');
      if (dropdown) {
        dropdown.classList.toggle('visible');
      }
    }

    function hideQuickAddCalendarDropdown() {
      const dropdown = document.getElementById('quickAddCalendarDropdown');
      if (dropdown) {
        dropdown.classList.remove('visible');
      }
    }

    async function handleQuickAdd(inputText) {
      // Try to use NotePlan's Calendar.parseDateText API
      if (typeof Calendar === 'undefined' || typeof Calendar.parseDateText !== 'function') {
        // Fallback to simple parsing
        var parseResult = simpleParseDate(inputText);
        if (!parseResult) {
          showQuickAddError('Could not parse date. Try: "meeting tomorrow at 3pm"');
          return;
        }

        pendingQuickAddEvent = {
          title: parseResult.title,
          date: parseResult.date,
          endDate: parseResult.endDate,
          isAllDay: parseResult.isAllDay
        };
      } else {
        // Use NotePlan's native parser
        try {
          var results = await Calendar.parseDateText(inputText);

          // API returns an array of parsed date results
          if (!results || !Array.isArray(results) || results.length === 0 || !results[0].start) {
            showQuickAddError('Could not parse date. Try: "meeting tomorrow at 3pm"');
            return;
          }

          var parsed = results[0];
          var startDate = new Date(parsed.start);
          var endDate = parsed.end ? new Date(parsed.end) : new Date(startDate.getTime() + 60 * 60 * 1000);

          // Extract title by removing the parsed date text from input
          var title = inputText;
          if (parsed.text) {
            title = inputText.replace(parsed.text, '').trim();
            title = title.replace(/^(on|at|for)\s+/i, '').trim();
            title = title.replace(/\s+(on|at|for)$/i, '').trim();
          }
          if (!title) title = 'New Event';

          // Check if it's an all-day event
          var isAllDay = parsed.isAllDay || false;

          // If end equals start, add 1 hour duration
          if (endDate.getTime() === startDate.getTime()) {
            endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
          }

          pendingQuickAddEvent = {
            title: title,
            date: startDate,
            endDate: endDate,
            isAllDay: isAllDay
          };
        } catch (err) {
          showQuickAddError('Could not parse date. Try: "meeting tomorrow at 3pm"');
          return;
        }
      }

      // Use pre-selected calendar
      if (!selectedQuickAddCalendar) {
        showQuickAddError('No calendar selected');
        return;
      }

      await createQuickAddEvent(selectedQuickAddCalendar.title);
    }

    // Simple fallback date parser
    function simpleParseDate(input) {
      var now = new Date();
      var result = { date: null, endDate: null, title: '', isAllDay: false };
      var text = input.toLowerCase();

      // Extract time first (e.g., "at 3pm", "at 15:00", "3pm", "11 am")
      var timeMatch = text.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      var hours = null;
      var minutes = 0;

      if (timeMatch) {
        hours = parseInt(timeMatch[1]);
        minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        var ampm = timeMatch[3];

        if (ampm) {
          if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
          if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
        }

        // Remove time from text for title extraction
        text = text.replace(timeMatch[0], ' ').trim();
      }

      // Parse date keywords
      var targetDate = new Date(now);
      var dateFound = false;

      if (text.includes('today')) {
        dateFound = true;
        text = text.replace('today', ' ').trim();
      } else if (text.includes('tomorrow')) {
        targetDate.setDate(targetDate.getDate() + 1);
        dateFound = true;
        text = text.replace('tomorrow', ' ').trim();
      } else if (text.includes('yesterday')) {
        targetDate.setDate(targetDate.getDate() - 1);
        dateFound = true;
        text = text.replace('yesterday', ' ').trim();
      } else {
        // Check for "next [weekday]"
        var weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        var nextMatch = text.match(/next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
        if (nextMatch) {
          var targetDay = weekdays.indexOf(nextMatch[1].toLowerCase());
          var daysUntil = (targetDay - now.getDay() + 7) % 7;
          if (daysUntil === 0) daysUntil = 7;
          targetDate.setDate(targetDate.getDate() + daysUntil);
          dateFound = true;
          text = text.replace(nextMatch[0], ' ').trim();
        } else {
          // Check for just weekday name
          for (var i = 0; i < weekdays.length; i++) {
            if (text.includes(weekdays[i])) {
              var daysUntilDay = (i - now.getDay() + 7) % 7;
              if (daysUntilDay === 0) daysUntilDay = 7;
              targetDate.setDate(targetDate.getDate() + daysUntilDay);
              dateFound = true;
              text = text.replace(weekdays[i], ' ').trim();
              break;
            }
          }
        }
      }

      // If no date found but time found, assume today
      if (!dateFound && hours !== null) {
        dateFound = true;
      }

      if (!dateFound) {
        return null;
      }

      // Set time
      if (hours !== null) {
        targetDate.setHours(hours, minutes, 0, 0);
        result.isAllDay = false;
        result.endDate = new Date(targetDate.getTime() + 60 * 60 * 1000); // 1 hour duration
      } else {
        targetDate.setHours(0, 0, 0, 0);
        result.isAllDay = true;
        result.endDate = new Date(targetDate);
        result.endDate.setHours(23, 59, 59, 999);
      }

      result.date = targetDate;

      // Clean up title
      var title = text.replace(/\s+/g, ' ').trim();
      title = title.replace(/^(on|at|for)\s+/i, '').trim();
      title = title.replace(/\s+(on|at|for)$/i, '').trim();
      result.title = title || 'New Event';

      return result;
    }

    async function createQuickAddEvent(calendarTitle) {
      if (!pendingQuickAddEvent) return;

      // Save data locally before clearing pending state
      const eventData = {
        title: pendingQuickAddEvent.title,
        start: pendingQuickAddEvent.date,
        end: pendingQuickAddEvent.endDate,
        isAllDay: pendingQuickAddEvent.isAllDay,
        calendar: calendarTitle
      };
      const navigateToDate = new Date(pendingQuickAddEvent.date);

      // Clear UI state first
      document.getElementById('quickAddInput').value = '';
      hideQuickAddCalendarDropdown();

      // Navigate to the event's date
      state.viewDate = navigateToDate;

      // Use existing createEvent function for consistency
      const result = await createEvent(eventData);
      if (!result) {
        showQuickAddError('Failed to create event');
      }
    }

    function showQuickAddError(message) {
      alert(message);
    }

    // ============================================
    // Initialization
    // ============================================
    async function initialize() {
      // Detect user's time format preference (12h vs 24h)
      state.use12HourFormat = detectTimeFormat();

      await loadCalendars();
      await refreshEvents();
      initQuickAdd();

      document.getElementById('prevBtn').addEventListener('click', navigatePrevious);
      document.getElementById('nextBtn').addEventListener('click', navigateNext);
      document.getElementById('todayBtn').addEventListener('click', navigateToday);

      document.querySelectorAll('.view-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { switchView(btn.dataset.view); });
      });

      document.getElementById('filterBtn').addEventListener('click', function() {
        document.getElementById('filterDropdown').classList.toggle('visible');
      });

      document.getElementById('toggleAllCalendars').addEventListener('click', toggleAllCalendars);

      // Event filter handlers
      initEventFilter();

      document.addEventListener('click', function(e) {
        if (!e.target.closest('.calendar-filter')) {
          document.getElementById('filterDropdown').classList.remove('visible');
        }
      });

      document.getElementById('modalClose').addEventListener('click', closeEventModal);
      document.getElementById('cancelBtn').addEventListener('click', closeEventModal);
      document.getElementById('saveBtn').addEventListener('click', handleSaveEvent);
      document.getElementById('deleteBtn').addEventListener('click', handleDeleteEvent);
      document.getElementById('eventAllDay').addEventListener('change', updateTimeFieldsVisibility);

      document.getElementById('eventModal').addEventListener('click', function(e) {
        if (e.target.id === 'eventModal') closeEventModal();
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          closeEventModal();
          document.getElementById('filterDropdown').classList.remove('visible');
        }
      });

      setInterval(function() {
        if (state.currentView === 'week' || state.currentView === 'day') {
          const line = document.querySelector('.current-time-line');
          if (line) {
            const now = new Date();
            const minutes = now.getHours() * 60 + now.getMinutes();
            line.style.top = minutes + 'px';
          }
        }
      }, 60000);

      // Recalculate event visibility on resize
      let resizeTimeout;
      window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
          if (state.currentView === 'month') {
            adjustMoreIndicators();
          }
        }, 150);
      });

      // Re-render when color scheme changes (light/dark mode)
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
        switchView(state.currentView);
      });
    }

    if (typeof Calendar !== 'undefined') {
      initialize();
    } else {
      window.addEventListener('notePlanBridgeReady', function() {
        if (typeof Calendar !== 'undefined') {
          initialize();
        } else {
          document.getElementById('calendarContainer').innerHTML =
            '<div class="empty-state">' +
            '<div class="empty-state-icon">📅</div>' +
            '<div>Calendar API not available</div>' +
            '</div>';
        }
      }, { once: true });

      setTimeout(function() {
        if (typeof Calendar === 'undefined') {
          document.getElementById('calendarContainer').innerHTML =
            '<div class="empty-state">' +
            '<div class="empty-state-icon">📅</div>' +
            '<div>Calendar API not available</div>' +
            '</div>';
        }
      }, 2000);
    }
  </script>
</body>
</html>`;
}

/**
 * Plugin initialization - called by NotePlan when the plugin loads
 * Checks for updates in the background
 */
function init() {
  try {
    // Check for plugin updates silently in the background
    // Parameters: (pluginIDs, showPromptIfSuccessful, showProgressPrompt, showFailedPrompt)
    DataStore.installOrUpdatePluginsByID(['emetzger.Calendar'], false, false, false);
  } catch (error) {
    // Silently ignore update check failures
  }
}

/**
 * Called after the plugin is updated or installed
 * Can be used for settings migrations or user notifications
 */
function onUpdateOrInstall() {
  // Plugin updated successfully
}
