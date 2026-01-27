/**
 * Linear Calendar Plugin
 * Displays a linear year view calendar with calendar events
 * Uses the Calendar API bridge from within HTML views
 *
 * Layout approach:
 * - 12 month rows, each with 1 label column + 31 day columns
 * - Events are assigned lanes globally across the entire year
 * - Multi-day events are split into per-month segments preserving lane
 * - CSS Grid is used for proper column spanning
 */

/**
 * Main function to show the linear calendar view
 * @param {number} year - Optional year to display (defaults to current year)
 */
async function showLinearCalendar(year) {
  try {
    const currentYear = year || new Date().getFullYear()
    HTMLView.showInMainWindow(getCalendarHTML(currentYear), "Linear Calendar", {
      splitView: false,
      icon: "calendar-lines",
      iconColor: "green-500",
    })
  } catch (error) {
    console.log("Error showing linear calendar:", error)
  }
}

/**
 * Generates the HTML for the linear calendar view
 * @param {number} currentYear - The year to display
 * @returns {string} HTML string
 */
function getCalendarHTML(currentYear) {
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
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
            background: #ffffff;
            color: #1d1d1f;
            height: 100vh;
            overflow: hidden;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            --cell-width: 35px;
      --event-text-size: 10px;
      --lane-height: 16px;
      --lane-gap: 2px;
          }
          
    /* ============================================
       Controls / Navigation Bar
       ============================================ */
          .controls {
            display: flex;
            align-items: center;
      gap: 8px;
      padding: 1px 6px 1px 6px;
      margin-bottom: 0;
      border-bottom: 1px solid rgba(229, 229, 231, 0.8);
            flex-shrink: 0;
      overflow: visible;
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(255, 255, 255, 0.85);
      -webkit-backdrop-filter: blur(20px);
      backdrop-filter: blur(20px);
      pointer-events: auto;
          }
          
          .year-navigation {
            display: flex;
            align-items: center;
      gap: 4px;
          }
          
          .year-button {
            background: transparent;
      border: none;
            border-radius: 4px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
      font-weight: 500;
      color: #86868b;
      transition: all 0.15s;
      opacity: 1;
      padding: 0;
      margin-bottom: 2px;
          }
          
          .year-button:hover {
      background: rgba(0, 0, 0, 0.06);
      color: #1d1d1f;
          }
          
          .year-button:active {
      background: rgba(0, 0, 0, 0.1);
          }
          
          .year-display {
      font-size: 18px;
            font-weight: 600;
            color: #1d1d1f;
      min-width: auto;
      text-align: left;
      opacity: 1;
      letter-spacing: -0.2px;
    }
    
    .controls-right {
            display: flex;
            align-items: center;
      gap: 8px;
      margin-left: auto;
    }
    
    /* Settings dropdown */
    .settings-container {
      position: relative;
    }
    
    .settings-button {
      background: transparent;
      border: none;
      border-radius: 8px;
      padding: 4px 12px;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
            font-size: 14px;
            font-weight: 400;
            color: #1d1d1f;
      transition: background-color 0.15s;
      opacity: 1;
    }
    
    .settings-button:hover {
      background: #f5f5f7;
    }
    
    .settings-icon {
      font-size: 14px;
      display: inline-block;
    }
    
    .settings-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      min-width: 280px;
      background: #ffffff;
      border: 1px solid #e5e5e7;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      display: none;
      padding: 12px;
    }
    
    .settings-section {
      margin-bottom: 16px;
    }
    
    .settings-section:last-child {
      margin-bottom: 0;
    }
    
    .settings-label {
      font-size: 12px;
      font-weight: 500;
      color: #86868b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    
    .settings-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .settings-slider {
            flex: 1;
            height: 4px;
            border-radius: 2px;
            background: #e5e5e7;
            outline: none;
            -webkit-appearance: none;
            appearance: none;
          }
          
    .settings-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #FF8800;
            cursor: pointer;
            border: 2px solid #ffffff;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          }
          
    .settings-value {
      font-size: 12px;
            color: #86868b;
      min-width: 36px;
            text-align: right;
          }
          
    .settings-checkbox-row {
            display: flex;
            align-items: center;
            gap: 8px;
      cursor: pointer;
      margin-bottom: 8px;
          }

    .settings-checkbox-row:last-child {
      margin-bottom: 0;
    }
          
    .settings-checkbox {
            width: 16px;
            height: 16px;
            cursor: pointer;
            accent-color: #FF8800;
          }
          
    .settings-checkbox-label {
            font-size: 13px;
            color: #1d1d1f;
            user-select: none;
            cursor: pointer;
          }
          
    .layout-button,
    .first-day-button {
      flex: 1;
      padding: 6px 12px;
      border: 1px solid #e5e5e7;
      border-radius: 6px;
      background: #ffffff;
      font-size: 13px;
      font-weight: 400;
      color: #1d1d1f;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .layout-button:hover,
    .first-day-button:hover {
      background: #f5f5f7;
      border-color: #d1d1d6;
    }
    
    .layout-button.active,
    .first-day-button.active {
      background: #FF8800;
      border-color: #FF8800;
      color: #ffffff;
    }
          
    /* Calendar filter dropdown */
          .calendar-filter {
            display: flex;
            align-items: center;
            position: relative;
      z-index: 100;
    }
    
    .calendar-filter-button {
      padding: 4px 12px;
      margin-bottom: 2px;
      border: none;
      border-radius: 8px;
      background: transparent;
            font-size: 14px;
            font-weight: 400;
            color: #1d1d1f;
            cursor: pointer;
            outline: none;
            text-align: left;
            position: relative;
      transition: background-color 0.15s;
      opacity: 1;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    
    .calendar-filter-icon {
      font-size: 14px;
      display: inline-block;
      flex-shrink: 0;
          }
          
          .calendar-filter-button:hover {
      background: #f5f5f7;
          }
          
          .calendar-filter-dropdown {
            position: absolute;
      top: calc(100% + 4px);
            left: 0;
            min-width: 250px;
            max-width: 350px;
            max-height: 300px;
            overflow-y: auto;
            background: #ffffff;
            border: 1px solid #e5e5e7;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      z-index: 9999;
            display: none;
            padding: 4px 0;
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
            background-color: #f5f5f7;
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
            accent-color: #FF8800;
          }
          
          .calendar-filter-item-label {
            flex: 1;
            font-size: 13px;
            color: #1d1d1f;
            user-select: none;
          }
          
          .calendar-filter-action-item {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            cursor: pointer;
            transition: background-color 0.15s;
            border-bottom: 1px solid #e5e5e7;
            font-size: 13px;
            font-weight: 500;
            color: #FF8800;
          }
          
          .calendar-filter-action-item:hover {
            background-color: #f5f5f7;
          }
          
    /* ============================================
       Calendar Layout
       ============================================ */
          .calendar-wrapper {
            overflow-x: auto;
            overflow-y: auto;
      padding: 0 0 20px 0;
      height: calc(100vh - 38px);
            box-sizing: border-box;
      position: relative;
          }
          
          .calendar-container {
            display: flex;
            flex-direction: column;
            gap: 0;
            min-width: 1200px;
          }
          
    /* ============================================
       Month Row - CSS Grid Layout
       Each row has: 1 label column + 31 day columns
       Events are rendered in an overlay grid
       ============================================ */
          .month-row {
      position: relative;
            display: grid;
      /* Label (30px) + 31 day columns + spacer (10px) */
      grid-template-columns: 30px repeat(31, minmax(var(--cell-width), 1fr)) 10px;
      grid-template-rows: auto; /* Will expand based on content */
            border-bottom: 1px solid #e5e5e7;
      min-height: 50px;
      /* Height will be set via JavaScript to ensure all months have the same height */
          }
          
          .month-label {
      grid-column: 1;
      grid-row: 1 / -1; /* Span all rows */
            padding: 6px 4px;
            font-weight: 500;
            text-align: center;
            color: #1d1d1f;
            display: flex;
            align-items: center;
      justify-content: center;
            font-size: 11px;
      background: #e8f0f8;
      border-right: 1px solid #e5e5e7;
      position: sticky;
      left: 0;
      z-index: 10;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
    }
    
    /* Day header row */
    .day-headers {
      display: contents; /* Children participate in parent grid */
    }
    
    .day-header {
      grid-row: 1;
            padding: 4px 2px;
            text-align: center;
            cursor: pointer;
            border: none;
            background: transparent;
            transition: background-color 0.15s ease;
            display: flex;
      flex-direction: row;
      align-items: baseline;
      justify-content: center;
      gap: 2px;
      min-height: 24px;
    }
    
    .day-header:hover,
    .day-header.hovered {
            background-color: #f5f5f7;
          }
          
    .day-header.weekend {
            background-color: #fafafa;
          }
          
    .day-header.weekend:hover {
            background-color: #f5f5f7;
          }
          
    .day-header.today .day-number {
      color: #FF8800;
            font-weight: 600;
          }
          
    .day-header.today .day-name {
      color: #FF8800;
    }
    
    .day-header.empty {
            cursor: default;
            opacity: 0.3;
          }
          
    .day-header.empty:hover {
            background-color: transparent;
          }
    
    .day-header.spacer {
            cursor: default;
            opacity: 0;
            pointer-events: none;
            background: transparent !important;
            border: none;
            min-width: 10px;
            width: 10px;
          }
    
    /* Weekday header row for Fixed Week layout */
    .weekday-header-row {
      display: grid;
      /* grid-template-columns set via JavaScript */
      border-bottom: 1px solid #e5e5e7;
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(255, 255, 255, 0.95);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
    }
    
    .weekday-header-spacer {
      background: transparent;
    }
    
    /* Weekday header for Fixed Week layout */
    .weekday-header {
      padding: 4px 2px;
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: #1d1d1f;
      background: #f5f5f7;
      border-bottom: 1px solid #e5e5e7;
    }
          
          .day-number {
      font-size: 12px;
            font-weight: 400;
            color: #1d1d1f;
            line-height: 1.2;
          }
          
          .day-name {
      font-size: 9px;
            font-weight: 400;
            color: #86868b;
            line-height: 1;
            text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    
    /* ============================================
       Events Layer - Absolute overlay with CSS Grid
       ============================================ */
    .events-layer {
      position: absolute;
      top: 28px; /* Below day headers */
      left: 0;
      right: 0;
      display: grid;
      /* Same columns as month-row: label (30px) + 31 days + spacer (10px) */
      grid-template-columns: 30px repeat(31, minmax(var(--cell-width), 1fr)) 10px;
      grid-auto-rows: var(--lane-height);
      gap: var(--lane-gap) 0;
      padding: 2px 0 4px 0;
      pointer-events: none; /* Allow clicks to pass through to day headers */
    }
    
    /* ============================================
       Event Segment - Spans columns using CSS Grid
       ============================================ */
    .event-segment {
      pointer-events: auto;
      /* grid-column and grid-row set via inline style */
      background-color: rgba(90, 159, 212, 0.3);
      color: #1d1d1f;
      font-size: var(--event-text-size);
            font-weight: 500;
      padding: 1px 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
      line-height: 1.3;
      border-radius: 6px;
      margin: 0 1px;
            display: flex;
            align-items: center;
            transition: opacity 0.2s;
          }
          
    .event-segment:hover {
            opacity: 0.8;
          }
          
    /* Continuation styling for multi-month events */
    .event-segment.continues-left {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      margin-left: 0;
    }
    
    .event-segment.continues-right {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      margin-right: 0;
    }
    
    /* ============================================
       Loading & Error States
       ============================================ */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: #86868b;
      font-size: 14px;
    }
    
    .api-unavailable {
            display: flex;
            flex-direction: column;
            align-items: center;
      justify-content: center;
      height: 100%;
      padding: 40px;
      text-align: center;
    }
    
    .api-unavailable-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    
    .api-unavailable-title {
      font-size: 18px;
      font-weight: 600;
      color: #1d1d1f;
      margin-bottom: 8px;
    }
    
    .api-unavailable-message {
      font-size: 14px;
      color: #86868b;
      max-width: 400px;
      line-height: 1.5;
    }
    
    /* ============================================
       Event Modal Dialog
       ============================================ */
    .event-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
    }
    
    .event-modal-overlay.visible {
      opacity: 1;
      visibility: visible;
    }
    
    .event-modal {
      background: #ffffff;
      border-radius: 12px;
      width: 340px;
      max-width: 90vw;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      transform: scale(0.95);
      transition: transform 0.2s;
    }
    
    .event-modal-overlay.visible .event-modal {
      transform: scale(1);
    }
    
    .event-modal-header {
      padding: 16px 20px 12px 20px;
      border-bottom: 1px solid #e5e5e7;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .event-modal-title {
      font-size: 16px;
      font-weight: 600;
      color: #1d1d1f;
    }
    
    .event-modal-close {
      background: none;
      border: none;
      font-size: 20px;
      color: #86868b;
      cursor: pointer;
      padding: 4px 8px;
      line-height: 1;
      border-radius: 4px;
    }
    
    .event-modal-close:hover {
      background: #f5f5f7;
      color: #1d1d1f;
    }
    
    .event-modal-body {
      padding: 16px 20px;
    }
    
    .event-form-group {
      margin-bottom: 16px;
    }
    
    .event-form-group:last-child {
      margin-bottom: 0;
    }
    
    .event-form-label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #86868b;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .event-form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e5e5e7;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      color: #1d1d1f;
      background: #ffffff;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    
    .event-form-input:focus {
      outline: none;
      border-color: #FF8800;
      box-shadow: 0 0 0 3px rgba(255, 136, 0, 0.15);
    }
    
    .event-form-input::placeholder {
      color: #c7c7cc;
    }
    
    .event-form-row {
      display: flex;
      gap: 12px;
    }
    
    .event-form-row .event-form-group {
      flex: 1;
    }
    
    .event-form-select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e5e5e7;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      color: #1d1d1f;
      background: #ffffff;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2386868b' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 32px;
    }
    
    .event-form-select:focus {
      outline: none;
      border-color: #FF8800;
      box-shadow: 0 0 0 3px rgba(255, 136, 0, 0.15);
    }
    
    .event-modal-footer {
      padding: 12px 20px 16px 20px;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      border-top: 1px solid #e5e5e7;
    }
    
    .event-modal-btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: background-color 0.15s, opacity 0.15s;
    }
    
    .event-modal-btn-cancel {
      background: #f5f5f7;
      color: #1d1d1f;
    }
    
    .event-modal-btn-cancel:hover {
      background: #e8e8ed;
    }
    
    .event-modal-btn-delete {
      background: #ff3b30;
      color: #ffffff;
    }
    
    .event-modal-btn-delete:hover {
      background: #e0342b;
    }
    
    .event-modal-btn-save {
      background: #FF8800;
      color: #ffffff;
    }
    
    .event-modal-btn-save:hover {
      background: #e67a00;
    }
    
    .event-modal-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    /* Dummy event for drag creation */
    .event-segment.dummy-event {
      background-color: rgba(0, 122, 255, 0.4) !important;
      color: #ffffff !important;
      pointer-events: none;
      animation: pulse-dummy 1s ease-in-out infinite;
    }
    
    @keyframes pulse-dummy {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    
    /* Calendar color indicator in select */
    .calendar-option-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .calendar-color-dot-option {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    
    /* Calendar source group headers */
    .calendar-source-header {
      padding: 8px 12px 4px 12px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #86868b;
      background: #f5f5f7;
      border-bottom: 1px solid #e5e5e7;
      margin-top: 4px;
    }
    
    .calendar-source-header:first-of-type {
      margin-top: 0;
    }
    
    /* Optgroup styling for select dropdown */
    .event-form-select optgroup {
      font-weight: 600;
      font-style: normal;
      color: #86868b;
      background: #f5f5f7;
    }
    
    .event-form-select option {
      font-weight: 400;
      color: #1d1d1f;
      background: #ffffff;
      padding: 4px 8px;
    }
    
    /* ============================================
       Dark Mode Support
       ============================================ */
          @media (prefers-color-scheme: dark) {
            body {
              background: #1c1c1e;
              color: #f5f5f7;
            }
            
            .controls {
        background: rgba(28, 28, 30, 0.85);
        border-bottom-color: rgba(56, 56, 58, 0.8);
            }
            
            .year-button {
        color: #98989d;
            }
            
            .year-button:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #f5f5f7;
            }
            
            .year-button:active {
        background: rgba(255, 255, 255, 0.15);
            }
            
            .year-display {
              color: #f5f5f7;
            }
            
      .calendar-filter-button,
      .settings-button {
        background: transparent;
              color: #f5f5f7;
            }
            
      .calendar-filter-button:hover,
      .settings-button:hover {
              background: #2c2c2e;
            }
            
      .calendar-filter-dropdown,
      .settings-dropdown {
              background: #2c2c2e;
              border-color: #38383a;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
            }
            
            .calendar-filter-item:hover {
              background-color: #38383a;
            }
            
            .calendar-filter-item-label {
              color: #f5f5f7;
            }
            
            .calendar-filter-action-item {
              border-bottom-color: #38383a;
              color: #FF7700;
            }
            
            .calendar-filter-action-item:hover {
              background-color: #38383a;
            }
            
      .settings-slider {
        background: #38383a;
      }
      
      .settings-slider::-webkit-slider-thumb {
        background: #FF7700;
        border-color: #2c2c2e;
      }
      
      .settings-checkbox-label {
              color: #f5f5f7;
            }
            
      .layout-button,
      .first-day-button {
        background: #2c2c2e;
        border-color: #38383a;
        color: #f5f5f7;
      }
      
      .layout-button:hover,
      .first-day-button:hover {
        background: #38383a;
        border-color: #48484a;
      }
      
      .layout-button.active,
      .first-day-button.active {
        background: #FF7700;
        border-color: #FF7700;
        color: #ffffff;
      }
            
            .month-row {
              border-bottom-color: #38383a;
            }
            
            .month-label {
              color: #f5f5f7;
        background: #2a3440;
        border-right-color: #38383a;
            }
            
      .day-header:hover,
      .day-header.hovered {
              background-color: #2c2c2e;
            }
            
      .day-header.weekend {
        background-color: #252527;
      }
      
      .day-header.weekend:hover {
        background-color: #2a2a2c;
      }
      
      .day-header.today .day-number {
        color: #FF7700;
      }
      
      .day-header.today .day-name {
        color: #FF7700;
            }
            
            .day-number {
              color: #f5f5f7;
            }
            
            .day-name {
              color: #98989d;
            }
            
      .weekday-header-row {
        background: rgba(28, 28, 30, 0.95);
        border-bottom-color: #38383a;
      }
      
      .weekday-header {
        background: #2c2c2e;
        border-bottom-color: #38383a;
        color: #f5f5f7;
      }
            
      .api-unavailable-title {
        color: #f5f5f7;
      }
      
      .api-unavailable-message {
        color: #98989d;
            }
            
      /* Event Modal - Dark Mode */
      .event-modal-overlay {
        background: rgba(0, 0, 0, 0.6);
      }
      
      .event-modal {
        background: #2c2c2e;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      }
      
      .event-modal-header {
        border-bottom-color: #38383a;
      }
      
      .event-modal-title {
        color: #f5f5f7;
      }
      
      .event-modal-close {
        color: #98989d;
      }
      
      .event-modal-close:hover {
        background: #38383a;
        color: #f5f5f7;
      }
      
      .event-form-label {
        color: #98989d;
      }
      
      .event-form-input,
      .event-form-select {
        background: #1c1c1e;
        border-color: #38383a;
        color: #f5f5f7;
      }
      
      .event-form-input:focus,
      .event-form-select:focus {
        border-color: #FF7700;
        box-shadow: 0 0 0 3px rgba(255, 119, 0, 0.2);
      }
      
      .event-form-input::placeholder {
        color: #636366;
      }
      
      .event-modal-footer {
        border-top-color: #38383a;
      }
      
      .event-modal-btn-cancel {
        background: #38383a;
        color: #f5f5f7;
      }
      
      .event-modal-btn-cancel:hover {
        background: #48484a;
      }
      
      .event-modal-btn-save {
        background: #FF7700;
      }
      
      .event-modal-btn-save:hover {
        background: #e66a00;
      }
      
      /* Calendar source headers - Dark Mode */
      .calendar-source-header {
        background: #2c2c2e;
        border-bottom-color: #38383a;
        color: #98989d;
      }
      
      .event-form-select optgroup {
        background: #2c2c2e;
        color: #98989d;
      }
      
      .event-form-select option {
        background: #1c1c1e;
        color: #f5f5f7;
      }
          }
        </style>
      </head>
      <body>
        <div class="controls">
          <div class="year-navigation">
            <button class="year-button" id="yearPrev">‹</button>
            <div class="year-display" id="yearDisplay">${currentYear}</div>
            <button class="year-button" id="yearNext">›</button>
          </div>
    <div class="controls-right">
      <div class="calendar-filter">
        <button class="calendar-filter-button" id="calendarFilterButton" onclick="toggleCalendarDropdown(event)">
          <i class="far fa-calendar calendar-filter-icon"></i>
          <span id="calendarFilterText">Loading...</span>
        </button>
        <div class="calendar-filter-dropdown" id="calendarFilterDropdown"></div>
          </div>
      <div class="settings-container">
        <button class="settings-button" id="settingsButton" onclick="toggleSettingsDropdown(event)" title="Display">
          <i class="far fa-sliders settings-icon"></i>
          <span>Display</span>
        </button>
        <div class="settings-dropdown" id="settingsDropdown">
          <div class="settings-section">
            <div class="settings-label">Layout</div>
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <button class="layout-button" id="layoutDateGrid" data-layout="dateGrid">
                <i class="far fa-th" style="margin-right: 4px;"></i>
                Date Grid
              </button>
              <button class="layout-button" id="layoutFixedWeek" data-layout="fixedWeek">
                <i class="far fa-calendar-week" style="margin-right: 4px;"></i>
                Fixed Week
              </button>
            </div>
          </div>
          <div class="settings-section" id="firstDayOfWeekSection" style="display: none;">
            <div class="settings-label">First Day of Week</div>
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <button class="first-day-button" id="firstDaySunday" data-day="0">
                Sunday
              </button>
              <button class="first-day-button" id="firstDayMonday" data-day="1">
                Monday
              </button>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-label">Cell Width</div>
            <div class="settings-row">
              <input type="range" class="settings-slider" id="cellWidthSlider" min="30" max="300" value="35" step="5">
              <div class="settings-value" id="cellWidthValue">35px</div>
          </div>
          </div>
          <div class="settings-section">
            <div class="settings-label">Event Text Size</div>
            <div class="settings-row">
              <input type="range" class="settings-slider" id="eventTextSizeSlider" min="7" max="14" value="10" step="1">
              <div class="settings-value" id="eventTextSizeValue">10px</div>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-label">Maximum Event Rows</div>
            <div class="settings-row">
              <input type="range" class="settings-slider" id="maxEventRowsSlider" min="3" max="15" value="7" step="1">
              <div class="settings-value" id="maxEventRowsValue">7</div>
            </div>
          </div>
          <div class="settings-section">
            <label class="settings-checkbox-row">
              <input type="checkbox" class="settings-checkbox" id="obfuscateCheckbox">
              <span class="settings-checkbox-label">Obfuscate event text</span>
            </label>
            <label class="settings-checkbox-row">
              <input type="checkbox" class="settings-checkbox" id="hideSingleDayEventsCheckbox">
              <span class="settings-checkbox-label">Hide single-day events</span>
            </label>
            <label class="settings-checkbox-row">
              <input type="checkbox" class="settings-checkbox" id="showOnlyAllDayEventsCheckbox">
              <span class="settings-checkbox-label">Show only all-day events</span>
            </label>
            <label class="settings-checkbox-row">
              <input type="checkbox" class="settings-checkbox" id="dynamicRowHeightCheckbox">
              <span class="settings-checkbox-label">Dynamic row height</span>
            </label>
          </div>
        </div>
            </div>
          </div>
        </div>
        <div class="calendar-wrapper">
    <div class="calendar-container" id="calendarContainer">
      <div class="loading">Loading calendar events...</div>
    </div>
        </div>
        
        <!-- Event Creation/Editing Modal -->
        <div class="event-modal-overlay" id="eventModalOverlay">
          <div class="event-modal">
            <div class="event-modal-header">
              <span class="event-modal-title" id="eventModalTitle">New Event</span>
              <button class="event-modal-close" id="eventModalClose">&times;</button>
            </div>
            <div class="event-modal-body">
              <div class="event-form-group">
                <label class="event-form-label" for="eventTitleInput">Title</label>
                <input type="text" class="event-form-input" id="eventTitleInput" placeholder="Event title" autocomplete="off">
              </div>
              <div class="event-form-row">
                <div class="event-form-group">
                  <label class="event-form-label" for="eventStartDate">Start Date</label>
                  <input type="date" class="event-form-input" id="eventStartDate">
                </div>
                <div class="event-form-group">
                  <label class="event-form-label" for="eventEndDate">End Date</label>
                  <input type="date" class="event-form-input" id="eventEndDate">
                </div>
              </div>
              <div class="event-form-group">
                <label class="event-form-label" for="eventCalendarSelect">Calendar</label>
                <select class="event-form-select" id="eventCalendarSelect"></select>
              </div>
            </div>
            <div class="event-modal-footer">
              <button class="event-modal-btn event-modal-btn-delete" id="eventDeleteBtn" style="display: none;">Delete</button>
              <div style="flex: 1;"></div>
              <button class="event-modal-btn event-modal-btn-cancel" id="eventCancelBtn">Cancel</button>
              <button class="event-modal-btn event-modal-btn-save" id="eventSaveBtn">Save</button>
            </div>
          </div>
        </div>
        
        <script>
    // ============================================
    // State Management
    // ============================================
          let displayYear = ${currentYear};
    let rawEvents = []; // Raw events from API
    let normalizedEvents = []; // Events with dayOfYear indices and lanes
    let selectedCalendars = new Set();
    let calendarInfoMap = new Map();
    let loadedYearRange = null;
    let calendarDropdownOpen = false;
    let settingsDropdownOpen = false;
    let layoutMode = 'dateGrid'; // 'dateGrid' or 'fixedWeek'
    let firstDayOfWeek = 0; // 0 = Sunday, 1 = Monday
    
    // Event creation/editing state
    let isDragging = false;
    let dragStartDate = null;
    let dragEndDate = null;
    let dragStartMonth = null;
    let dummyEventElement = null;
    let editingEvent = null; // null for new event, CalendarItem for editing
    let writableCalendars = []; // Calendars user can write to
    
    // ============================================
    // Dropdown Toggle Functions
    // ============================================
    function toggleCalendarDropdown(e) {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      const dropdown = document.getElementById('calendarFilterDropdown');
      calendarDropdownOpen = !calendarDropdownOpen;
      dropdown.style.display = calendarDropdownOpen ? 'block' : 'none';
      if (calendarDropdownOpen) closeSettingsDropdown();
    }
    
    function closeCalendarDropdown() {
      calendarDropdownOpen = false;
      const dropdown = document.getElementById('calendarFilterDropdown');
      if (dropdown) dropdown.style.display = 'none';
    }
    
    function toggleSettingsDropdown(e) {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      const dropdown = document.getElementById('settingsDropdown');
      settingsDropdownOpen = !settingsDropdownOpen;
      dropdown.style.display = settingsDropdownOpen ? 'block' : 'none';
      if (settingsDropdownOpen) closeCalendarDropdown();
    }
    
    function closeSettingsDropdown() {
      settingsDropdownOpen = false;
      const dropdown = document.getElementById('settingsDropdown');
      if (dropdown) dropdown.style.display = 'none';
    }
    
    document.addEventListener('click', (e) => {
      const calendarButton = document.getElementById('calendarFilterButton');
      const calendarDropdown = document.getElementById('calendarFilterDropdown');
      const settingsButton = document.getElementById('settingsButton');
      const settingsDropdown = document.getElementById('settingsDropdown');
      
      if (calendarButton && calendarDropdown && 
          !calendarButton.contains(e.target) && !calendarDropdown.contains(e.target)) {
        closeCalendarDropdown();
      }
      if (settingsButton && settingsDropdown && 
          !settingsButton.contains(e.target) && !settingsDropdown.contains(e.target)) {
        closeSettingsDropdown();
      }
    });
    
    // ============================================
    // Utility Functions
    // ============================================
    
          function obfuscateText(text) {
            if (!text) return text;
            const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const numbers = '0123456789';
            return text.split('').map(char => {
        if (!/[a-zA-Z0-9]/.test(char)) return char;
              if (/[a-zA-Z]/.test(char)) {
                const isUpperCase = char === char.toUpperCase();
                const randomLetter = letters[Math.floor(Math.random() * letters.length)];
                return isUpperCase ? randomLetter.toUpperCase() : randomLetter.toLowerCase();
              }
              if (/[0-9]/.test(char)) {
                return numbers[Math.floor(Math.random() * numbers.length)];
              }
              return char;
            }).join('');
          }
          
    function getDayOfYear(date) {
      const start = new Date(date.getFullYear(), 0, 0);
      const diff = date - start;
      const oneDay = 1000 * 60 * 60 * 24;
      return Math.floor(diff / oneDay);
    }
    
    function getDaysInMonth(year, month) {
      return new Date(year, month + 1, 0).getDate();
    }
    
    function isToday(date) {
      const today = new Date();
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
    }
    
    function isDarkMode() {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    function colorWithOpacity(hex, alpha) {
      if (!hex) return 'rgba(90, 159, 212, 0.3)';
      hex = hex.replace('#', '');
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return \`rgba(\${r}, \${g}, \${b}, \${alpha})\`;
    }
    
    function getTextColorForBackground(hex, alpha) {
      if (!hex) return '#1d1d1f';
      hex = hex.replace('#', '');
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
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
      const toHex = (n) => n.toString(16).padStart(2, '0');
      return '#' + toHex(textR) + toHex(textG) + toHex(textB);
    }
    
    function openNote(date, inSplitView = false, inNewWindow = false) {
      if (!date) return;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = \`\${year}-\${month}-\${day}\`;
      let url = \`noteplan://x-callback-url/openNote?noteDate=\${dateStr}&view=daily&timeframe=day\`;
      if (inNewWindow) {
        url += '&subWindow=yes';
      } else if (inSplitView) {
        url += '&splitView=yes&reuseSplitView=yes';
      }
      console.log('openNote: Opening URL: ' + url);

      // Use hidden link click to trigger xcallback URL (WebView workaround)
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
    // Event Normalization & Lane Assignment
    // ============================================
    
    /**
     * Normalizes events to a layout-friendly form with day indices
     * @param {Array} events - Raw events from API
     * @param {number} year - The display year
     * @returns {Array} Normalized events with startIndex, endIndex, duration
     */
    function normalizeEvents(events, year) {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      
      return events.map((event, idx) => {
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        
        // Clamp to year boundaries for display purposes
        const displayStart = startDate < yearStart ? yearStart : startDate;
        const displayEnd = endDate > yearEnd ? yearEnd : endDate;
        
        // Calculate day-of-year indices (0-based, 0 = Jan 1)
        const startIndex = getDayOfYear(displayStart);
        const endIndex = getDayOfYear(displayEnd);
        const duration = endIndex - startIndex + 1;
        
        return {
          id: idx,
          eventId: event.id, // Original event ID from calendar API
          title: event.title,
          startDate: startDate,
          endDate: endDate,
          displayStart: displayStart,
          displayEnd: displayEnd,
          startIndex: startIndex,
          endIndex: endIndex,
          duration: duration,
          color: event.color,
          calendarTitle: event.calendarTitle,
          lane: -1 // Will be assigned
        };
      });
    }
    
    /**
     * Assigns lanes to events using greedy first-fit algorithm
     * Sort: start ascending, then duration descending (longer events first)
     * @param {Array} events - Normalized events
     * @returns {Array} Events with lane assignments
     */
    function assignLanes(events) {
      if (!events || events.length === 0) return [];
      
      // Sort: start ascending, duration descending, then by id for stability
      const sorted = [...events].sort((a, b) => {
        if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
        if (b.duration !== a.duration) return b.duration - a.duration;
        return a.id - b.id;
      });
      
      // lanesEnd[i] = last occupied day index in lane i
      const lanesEnd = [];
      
      for (const event of sorted) {
        // Find first lane where this event fits (no overlap)
        let lane = lanesEnd.findIndex(endIndex => endIndex < event.startIndex);
        
        if (lane === -1) {
          // No existing lane has space, create new lane
          lane = lanesEnd.length;
          lanesEnd.push(-1);
        }
        
        event.lane = lane;
        lanesEnd[lane] = event.endIndex;
      }
      
      return sorted;
    }
    
    /**
     * Creates per-month segments from events
     * Each segment represents the portion of an event within a single month
     * @param {Array} events - Events with lane assignments
     * @param {number} year - Display year
     * @returns {Array} Segments grouped by month
     */
    function createMonthSegments(events, year) {
      const segmentsByMonth = Array.from({ length: 12 }, () => []);
      
      for (const event of events) {
        // Determine which months this event touches
        const startMonth = event.displayStart.getMonth();
        const endMonth = event.displayEnd.getMonth();
        
        for (let month = startMonth; month <= endMonth; month++) {
          const monthStart = new Date(year, month, 1);
          const monthEnd = new Date(year, month + 1, 0); // Last day of month
          
          // Segment boundaries within this month
          const segStart = event.displayStart > monthStart ? event.displayStart : monthStart;
          const segEnd = event.displayEnd < monthEnd ? event.displayEnd : monthEnd;
          
          const startDayOfMonth = segStart.getDate(); // 1-31
          const endDayOfMonth = segEnd.getDate(); // 1-31
          
          const segment = {
            eventId: event.eventId, // Original calendar API event ID
            title: event.title,
            color: event.color,
            lane: event.lane,
            month: month,
            startDay: startDayOfMonth,
            endDay: endDayOfMonth,
            continuesLeft: segStart > event.displayStart,
            continuesRight: segEnd < event.displayEnd,
            // Only show title on first segment of each event
            showTitle: month === startMonth,
            // Original event data for editing
            originalStartDate: event.startDate,
            originalEndDate: event.endDate,
            calendarTitle: event.calendarTitle
          };
          
          segmentsByMonth[month].push(segment);
        }
      }
      
      return segmentsByMonth;
    }
    
    /**
     * Calculates max lane used per month (for sizing)
     * @param {Array} segmentsByMonth - Segments grouped by month
     * @returns {Array} Max lane index per month
     */
    function getMaxLanesPerMonth(segmentsByMonth) {
      return segmentsByMonth.map(segments => {
        if (segments.length === 0) return 0;
        return Math.max(...segments.map(s => s.lane)) + 1;
      });
    }
    
    function getGlobalMaxLanes(maxLanesPerMonth) {
      // Get user-defined maximum event rows from slider
      const maxEventRowsSlider = document.getElementById('maxEventRowsSlider');
      let userMaxRows = 7; // Default
      
      if (maxEventRowsSlider) {
        userMaxRows = parseInt(maxEventRowsSlider.value) || 7;
      } else {
        // Fallback to localStorage if slider not yet initialized
        const saved = localStorage.getItem('calendarMaxEventRows');
        if (saved) {
          userMaxRows = parseInt(saved) || 7;
        }
      }
      
      // Always use the user's maximum for consistent height across all months
      // This ensures all months have the same height regardless of event count
      // If there are more events than the user's maximum, some events won't be visible
      // If there are fewer events, the extra space will be empty
      return userMaxRows;
    }
    
    // ============================================
    // Calendar API Functions
    // ============================================
    
    let loadingMonths = new Set();
    let loadedMonths = new Set();
    
    // Force reload events for specific months (used after adding/updating/deleting events)
    async function forceReloadEventsForMonths(startDate, endDate) {
      const startMonth = startDate.getMonth();
      const startYear = startDate.getFullYear();
      const endMonth = endDate.getMonth();
      const endYear = endDate.getFullYear();
      
      console.log('Force reloading events from ' + startYear + '-' + startMonth + ' to ' + endYear + '-' + endMonth);
      
      // Clear cache for affected months
      let currentYear = startYear;
      let currentMonth = startMonth;
      
      while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const monthKey = currentYear + '-' + currentMonth;
        loadedMonths.delete(monthKey);
        loadingMonths.delete(monthKey);
        
        // Also remove events from rawEvents for this month so they can be re-added
        rawEvents = rawEvents.filter(e => {
          const eventDate = new Date(e.startDate);
          return !(eventDate.getFullYear() === currentYear && eventDate.getMonth() === currentMonth);
        });
        
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }
      
      // Reload affected months
      currentYear = startYear;
      currentMonth = startMonth;
      
      while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const events = await loadEventsForMonth(currentYear, currentMonth);
        if (events.length > 0) {
          const existingIds = new Set(rawEvents.map(e => e.title + '-' + e.startDate));
          const newEvents = events.filter(e => !existingIds.has(e.title + '-' + e.startDate));
          rawEvents = [...rawEvents, ...newEvents];
        }
        
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }
      
      // Update display
      updateCalendarDisplay();
    }
    
    async function loadEventsForMonth(year, month) {
      const monthKey = \`\${year}-\${month}\`;
      if (loadingMonths.has(monthKey) || loadedMonths.has(monthKey)) {
              return [];
            }
      
      loadingMonths.add(monthKey);
      
      try {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);
        
        const events = await Calendar.eventsBetween(startDate, endDate, "");
        
        const eventsList = [];
        if (events && Array.isArray(events)) {
          events.forEach((event) => {
            if (event.date) {
              const eventDate = new Date(event.date);
              const eventEndDate = event.endDate ? new Date(event.endDate) : eventDate;
              eventsList.push({
                id: event.id, // Store the event ID for editing/deleting
                title: event.title || "Event",
                startDate: eventDate.toISOString(),
                endDate: eventEndDate.toISOString(),
                calendarTitle: event.calendar || "",
                color: event.color || "#5A9FD4",
                isAllDay: event.isAllDay || false,
                isRecurring: event.isRecurring || false,
                notes: event.notes || "",
                url: event.url || "",
                availability: event.availability || 0
              });
            }
          });
        }
        
        loadedMonths.add(monthKey);
        loadingMonths.delete(monthKey);
        return eventsList;
      } catch (error) {
        console.error(\`Error loading events for \${year}-\${month + 1}:\`, error);
        loadingMonths.delete(monthKey);
        return [];
      }
    }
    
    async function loadCalendarEventsProgressively(year) {
      const startYear = year - 1;
      const endYear = year + 1;
      
      if (!loadedYearRange || loadedYearRange.start !== startYear || loadedYearRange.end !== endYear) {
        loadedMonths.clear();
        rawEvents = [];
        loadedYearRange = { start: startYear, end: endYear };
      }
      
      // Load current year first
      for (let month = 0; month < 12; month++) {
        const events = await loadEventsForMonth(year, month);
        if (events.length > 0) {
          const existingIds = new Set(rawEvents.map(e => \`\${e.title}-\${e.startDate}\`));
          const newEvents = events.filter(e => !existingIds.has(\`\${e.title}-\${e.startDate}\`));
          rawEvents = [...rawEvents, ...newEvents];
          updateCalendarDisplay();
        }
      }
      
      // Then adjacent years
      for (let y of [year - 1, year + 1]) {
        for (let month = 0; month < 12; month++) {
          const events = await loadEventsForMonth(y, month);
          if (events.length > 0) {
            const existingIds = new Set(rawEvents.map(e => \`\${e.title}-\${e.startDate}\`));
            const newEvents = events.filter(e => !existingIds.has(\`\${e.title}-\${e.startDate}\`));
            rawEvents = [...rawEvents, ...newEvents];
            updateCalendarDisplay();
          }
        }
      }
    }
    
    async function loadAvailableCalendars() {
      try {
        const calendars = await Calendar.availableCalendars({});
        return calendars || [];
      } catch (error) {
        console.error('Error loading calendars:', error);
        return [];
      }
    }
    
    // ============================================
    // Calendar Filter Functions
    // ============================================
    
    function updateToggleAllButton() {
      const toggleAllItem = document.getElementById('toggleAllCalendars');
      if (!toggleAllItem) return;
      
      const calendars = Array.from(calendarInfoMap.keys());
      const allSelected = calendars.length > 0 && calendars.every(cal => selectedCalendars.has(cal));
      toggleAllItem.textContent = allSelected ? 'Unselect All' : 'Select All';
    }
    
    async function populateCalendarFilter() {
      try {
        const calendars = await loadAvailableCalendars();
        const calendarFilterDropdown = document.getElementById('calendarFilterDropdown');
            calendarFilterDropdown.innerHTML = '';
            
            calendarInfoMap = new Map();
            calendars.forEach(cal => {
          calendarInfoMap.set(cal.title, {
            name: cal.title,
            color: cal.color || "#5A9FD4"
          });
            });
            
            // Load saved selection from localStorage or default to all selected
            const savedSelection = localStorage.getItem('calendarFilterSelection');
            console.log('Loading calendar selection from localStorage:', savedSelection);
            if (savedSelection) {
              try {
                const saved = JSON.parse(savedSelection);
                console.log('Parsed saved selection:', saved);
                // Use saved selection exactly as-is to preserve user's explicit choices
                selectedCalendars = new Set(saved);
                // Filter out any calendars that no longer exist in the system
                const existingCalendarTitles = new Set(calendars.map(cal => cal.title));
                selectedCalendars = new Set([...selectedCalendars].filter(title => existingCalendarTitles.has(title)));
                console.log('Final selected calendars after filtering:', Array.from(selectedCalendars));
                // Don't add missing calendars back - they were either unchecked or are new
                // User can manually check new calendars if they want to see them
              } catch (e) {
                console.error('Error parsing saved calendar selection:', e);
                // If parsing fails, default to all selected
                selectedCalendars = new Set(calendars.map(cal => cal.title));
              }
            } else {
              // No saved selection, default to all selected
              console.log('No saved selection found, defaulting to all calendars selected');
              selectedCalendars = new Set(calendars.map(cal => cal.title));
            }
            
            // Add toggle "Select All" / "Unselect All" action item at the top
            const toggleAllItem = document.createElement('div');
            toggleAllItem.className = 'calendar-filter-action-item';
            toggleAllItem.id = 'toggleAllCalendars';
            
            // Set initial text content directly
            const allSelected = calendars.length > 0 && calendars.every(cal => selectedCalendars.has(cal.title));
            toggleAllItem.textContent = allSelected ? 'Unselect All' : 'Select All';
            
            toggleAllItem.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              const allSelected = calendars.length > 0 && calendars.every(cal => selectedCalendars.has(cal.title));
              
              if (allSelected) {
                // Unselect all calendars
                selectedCalendars.clear();
                const checkboxes = calendarFilterDropdown.querySelectorAll('.calendar-filter-checkbox');
                checkboxes.forEach(checkbox => {
                  checkbox.checked = false;
                });
              } else {
                // Select all calendars
                calendars.forEach(cal => {
                  selectedCalendars.add(cal.title);
                });
                const checkboxes = calendarFilterDropdown.querySelectorAll('.calendar-filter-checkbox');
                checkboxes.forEach(checkbox => {
                  checkbox.checked = true;
                });
              }
              
              // Save and update display
              const selectionArray = Array.from(selectedCalendars);
              localStorage.setItem('calendarFilterSelection', JSON.stringify(selectionArray));
              updateToggleAllButton();
              updateCalendarFilterDisplay();
              updateCalendarDisplay();
            });
            
            // Append the toggle button first
            calendarFilterDropdown.appendChild(toggleAllItem);
            
            // Initialize the button text after it's in the DOM
            updateToggleAllButton();
            
            // Group calendars by source
            const calendarsBySource = {};
            calendars.forEach(calendar => {
              const source = calendar.source || 'Other';
              if (!calendarsBySource[source]) {
                calendarsBySource[source] = [];
              }
              calendarsBySource[source].push(calendar);
            });
            
            // Sort sources alphabetically, but put "iCloud" first if present
            const sortedSources = Object.keys(calendarsBySource).sort((a, b) => {
              if (a === 'iCloud') return -1;
              if (b === 'iCloud') return 1;
              return a.localeCompare(b);
            });
            
            // Render calendars grouped by source
            sortedSources.forEach(source => {
              // Add source header
              const sourceHeader = document.createElement('div');
              sourceHeader.className = 'calendar-source-header';
              sourceHeader.textContent = source;
              calendarFilterDropdown.appendChild(sourceHeader);
              
              // Add calendars for this source
              calendarsBySource[source].forEach(calendar => {
                const item = document.createElement('div');
                item.className = 'calendar-filter-item';
                
                const colorDot = document.createElement('div');
                colorDot.className = 'calendar-filter-color-dot';
                colorDot.style.backgroundColor = calendar.color || "#5A9FD4";
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'calendar-filter-checkbox';
                checkbox.value = calendar.title;
                checkbox.checked = selectedCalendars.has(calendar.title);
                checkbox.addEventListener('change', handleCalendarFilterChange);
                
                const label = document.createElement('span');
                label.className = 'calendar-filter-item-label';
                label.textContent = calendar.title;
                
                item.appendChild(checkbox);
                item.appendChild(colorDot);
                item.appendChild(label);
                
                item.addEventListener('click', (e) => {
                  if (e.target === checkbox) return;
                  e.preventDefault();
                  e.stopPropagation();
                  // Toggle checkbox state
                  checkbox.checked = !checkbox.checked;
                  // Create a proper event-like object with the updated checked state
                  const syntheticEvent = {
                    target: {
                      value: checkbox.value,
                      checked: checkbox.checked
                    }
                  };
                  handleCalendarFilterChange(syntheticEvent);
                });
                
                calendarFilterDropdown.appendChild(item);
              });
            });
            
            // Ensure toggle button is properly initialized after all calendars are added
            updateToggleAllButton();
            updateCalendarFilterDisplay();
      } catch (error) {
        console.error('Error populating calendar filter:', error);
      }
    }
    
          function handleCalendarFilterChange(e) {
            const calendarName = e.target.value;
            const isChecked = e.target.checked;
            
            if (isChecked) {
              selectedCalendars.add(calendarName);
            } else {
              selectedCalendars.delete(calendarName);
            }
            
            // Save to localStorage
            const selectionArray = Array.from(selectedCalendars);
            localStorage.setItem('calendarFilterSelection', JSON.stringify(selectionArray));
            console.log('Saved calendar selection:', selectionArray);
            
            updateToggleAllButton();
            updateCalendarFilterDisplay();
            updateCalendarDisplay();
          }
          
          function updateCalendarFilterDisplay() {
            const totalCount = calendarInfoMap.size;
            const selectedCount = selectedCalendars.size;
      const calendarFilterText = document.getElementById('calendarFilterText');
      
      if (!calendarFilterText) return;
            
            if (selectedCount === 0) {
        calendarFilterText.textContent = 'No calendars';
            } else if (selectedCount === totalCount) {
        calendarFilterText.textContent = 'All calendars';
            } else {
        calendarFilterText.textContent = \`\${selectedCount} of \${totalCount} calendars\`;
      }
    }
    
    // ============================================
    // Calendar Rendering
    // ============================================
    
    /**
     * Updates the font size of all event segments
     */
    function updateEventTextSize(size) {
      // Update CSS variable
      document.documentElement.style.setProperty('--event-text-size', size + 'px');
      
      // Update all existing event segments directly
      const eventSegments = document.querySelectorAll('.event-segment');
      eventSegments.forEach(segment => {
        segment.style.fontSize = size + 'px';
      });
    }
    
    function getFilteredEvents() {
      // If no calendars are selected, show no events
      if (selectedCalendars.size === 0) {
        return [];
      }
      
      const hideSingleDayEventsCheckbox = document.getElementById('hideSingleDayEventsCheckbox');
      const hideSingleDayEvents = hideSingleDayEventsCheckbox?.checked || false;

      const showOnlyAllDayEventsCheckbox = document.getElementById('showOnlyAllDayEventsCheckbox');
      const showOnlyAllDayEvents = showOnlyAllDayEventsCheckbox?.checked || false;

      return rawEvents.filter(event => {
        // Filter by selected calendars
        if (!selectedCalendars.has(event.calendarTitle)) {
          return false;
        }
        // Filter by date range
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);
        const yearStart = new Date(displayYear, 0, 1);
        const yearEnd = new Date(displayYear, 11, 31, 23, 59, 59);
        if (!(eventStart <= yearEnd && eventEnd >= yearStart)) {
          return false;
        }
        // Filter out single-day events if option is enabled
        if (hideSingleDayEvents) {
          const startDateOnly = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());
          const endDateOnly = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
          const isSingleDay = startDateOnly.getTime() === endDateOnly.getTime();
          if (isSingleDay) {
            return false;
          }
        }
        // Filter out non-all-day events if option is enabled
        if (showOnlyAllDayEvents && !event.isAllDay) {
          return false;
        }
        return true;
      });
    }
    
    function renderCalendar() {
      const container = document.getElementById('calendarContainer');
      if (!container) return;
      
      container.innerHTML = '';
      
      const cellWidthSlider = document.getElementById('cellWidthSlider');
      const currentWidth = parseInt(cellWidthSlider?.value || 35);
          const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
          ];
      const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      // Reorder day names based on firstDayOfWeek
      const orderedDayNames = firstDayOfWeek === 1 
        ? ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
        : ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      
      if (layoutMode === 'fixedWeek') {
        renderFixedWeekLayout(container, currentWidth, monthNames, orderedDayNames, dayNames);
      } else {
        renderDateGridLayout(container, currentWidth, monthNames, dayNames);
      }
    }
    
    function renderDateGridLayout(container, currentWidth, monthNames, dayNames) {
      for (let month = 0; month < 12; month++) {
        const row = document.createElement('div');
        row.className = 'month-row';
        row.dataset.month = month;
        row.style.setProperty('--cell-width', currentWidth + 'px');
        
        // Month label
        const monthLabel = document.createElement('div');
        monthLabel.className = 'month-label';
        monthLabel.textContent = monthNames[month];
        row.appendChild(monthLabel);
        
        // Day headers
        const daysInMonth = getDaysInMonth(displayYear, month);
        
        for (let day = 1; day <= 31; day++) {
          const dayHeader = document.createElement('div');
          dayHeader.className = 'day-header';
          dayHeader.style.gridColumn = day + 1; // +1 for label column
          dayHeader.style.gridRow = 1;
          
          if (day <= daysInMonth) {
            const date = new Date(displayYear, month, day);
            const dayOfWeek = date.getDay();
            
            if (dayOfWeek === 0 || dayOfWeek === 6) {
              dayHeader.classList.add('weekend');
            }
            
            if (isToday(date)) {
              dayHeader.classList.add('today');
            }
            
            const dayNumber = document.createElement('span');
            dayNumber.className = 'day-number';
            dayNumber.textContent = day;
            
            const dayName = document.createElement('span');
            dayName.className = 'day-name';
            dayName.textContent = dayNames[dayOfWeek];
            
            dayHeader.appendChild(dayNumber);
            dayHeader.appendChild(dayName);
            
            // Store day and month data on the header for hover/click handling
            dayHeader.dataset.day = day;
            dayHeader.dataset.month = month;
            
            dayHeader.addEventListener('click', (event) => {
              if (event.metaKey) {
                // Command+click opens note in new window
                openNote(date, false, true);
              } else if (event.altKey) {
                // Option+click opens note in split view
                openNote(date, true, false);
              } else {
                // Normal click creates event
                const clickedDate = new Date(displayYear, month, day);
                openEventModal(clickedDate, clickedDate, null);
              }
            });
          } else {
            dayHeader.classList.add('empty');
          }
          
          row.appendChild(dayHeader);
        }
        
        // Spacer cell at the end (for scrollbar space)
        const spacerCell = document.createElement('div');
        spacerCell.className = 'day-header spacer';
        spacerCell.style.gridColumn = 33; // 1 (label) + 31 (days) + 1 (spacer) = 33
        spacerCell.style.gridRow = 1;
        row.appendChild(spacerCell);
        
        // Events layer (will be populated separately)
        const eventsLayer = document.createElement('div');
        eventsLayer.className = 'events-layer';
        eventsLayer.id = \`events-layer-\${month}\`;
        // Explicitly set grid template for Date Grid (31 day columns)
        eventsLayer.style.gridTemplateColumns = \`30px repeat(31, minmax(var(--cell-width), 1fr)) 10px\`;
        
        // Add drag-to-create event handlers
        const currentMonth = month;
        eventsLayer.addEventListener('mousedown', (e) => handleEventsLayerMouseDown(e, currentMonth));
        eventsLayer.addEventListener('mousemove', (e) => {
          handleEventsLayerMouseMove(e, currentMonth);
          handleEventsLayerHover(e, currentMonth, row);
        });
        eventsLayer.addEventListener('mouseup', (e) => handleEventsLayerMouseUp(e, currentMonth));
        eventsLayer.addEventListener('mouseleave', () => clearDayHeaderHover(row));
        eventsLayer.style.pointerEvents = 'auto';
        
        row.appendChild(eventsLayer);
        
        container.appendChild(row);
      }
      
      // Update min-width for horizontal scroll (label + 31 days + spacer)
      const minWidth = 30 + (31 * currentWidth) + 10;
      container.style.minWidth = minWidth + 'px';
    }
    
    function renderFixedWeekLayout(container, currentWidth, monthNames, orderedDayNames, dayNames) {
      // Fixed Week layout: 37 columns (5 weeks + 2 days) with repeating weekday headers
      // This accommodates any month (max 31 days starting on any weekday)
      const totalColumns = 37; // 5 weeks * 7 + 2 = 37
      
      // Create single weekday header row at the top
      const headerRow = document.createElement('div');
      headerRow.className = 'weekday-header-row';
      headerRow.style.setProperty('--cell-width', currentWidth + 'px');
      headerRow.style.gridTemplateColumns = \`30px repeat(\${totalColumns}, minmax(var(--cell-width), 1fr)) 10px\`;
      headerRow.style.display = 'grid';
      // Border is set via CSS to support dark mode
      
      // Empty cell for month label column
      const labelSpacer = document.createElement('div');
      labelSpacer.className = 'weekday-header-spacer';
      headerRow.appendChild(labelSpacer);
      
      // Repeating weekday headers (37 columns)
      for (let col = 0; col < totalColumns; col++) {
        const weekdayIndex = col % 7;
        const weekdayHeader = document.createElement('div');
        weekdayHeader.className = 'weekday-header';
        weekdayHeader.style.gridColumn = col + 2; // +1 for label, +1 for 1-indexed
        weekdayHeader.textContent = orderedDayNames[weekdayIndex];
        headerRow.appendChild(weekdayHeader);
      }
      
      // Spacer at the end
      const endSpacer = document.createElement('div');
      endSpacer.className = 'weekday-header-spacer';
      endSpacer.style.gridColumn = totalColumns + 2;
      headerRow.appendChild(endSpacer);
      
      container.appendChild(headerRow);
      
      // Render month rows
      for (let month = 0; month < 12; month++) {
        const row = document.createElement('div');
        row.className = 'month-row';
        row.dataset.month = month;
        row.style.setProperty('--cell-width', currentWidth + 'px');
        // Grid: label (30px) + 37 day columns + spacer (10px)
        row.style.gridTemplateColumns = \`30px repeat(\${totalColumns}, minmax(var(--cell-width), 1fr)) 10px\`;
        
        // Month label
        const monthLabel = document.createElement('div');
        monthLabel.className = 'month-label';
        monthLabel.textContent = monthNames[month];
        row.appendChild(monthLabel);
        
        // Find the starting weekday of day 1 of this month
        const firstDayOfMonth = new Date(displayYear, month, 1);
        let startWeekday = firstDayOfMonth.getDay();
        // Adjust for firstDayOfWeek setting
        if (firstDayOfWeek === 1) {
          startWeekday = (startWeekday + 6) % 7; // Convert Sunday=0 to Monday=0
        }
        
        const daysInMonth = getDaysInMonth(displayYear, month);
        
        // Add empty cells before day 1
        for (let emptyCol = 0; emptyCol < startWeekday; emptyCol++) {
          const emptyCell = document.createElement('div');
          emptyCell.className = 'day-header empty';
          emptyCell.style.gridColumn = emptyCol + 2; // +1 for label, +1 for 1-indexed
          emptyCell.style.gridRow = 1;
          row.appendChild(emptyCell);
        }
        
        // Add day cells starting at the correct column
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(displayYear, month, day);
          const col = startWeekday + day - 1; // Column position (0-indexed)
          
          const dayCell = document.createElement('div');
          dayCell.className = 'day-header';
          dayCell.style.gridColumn = col + 2; // +1 for label, +1 for 1-indexed
          dayCell.style.gridRow = 1;
          
          const originalDayOfWeek = date.getDay();
          
          if (originalDayOfWeek === 0 || originalDayOfWeek === 6) {
            dayCell.classList.add('weekend');
          }
          
          if (isToday(date)) {
            dayCell.classList.add('today');
          }
          
          const dayNumber = document.createElement('span');
          dayNumber.className = 'day-number';
          dayNumber.textContent = day;
          
          const dayName = document.createElement('span');
          dayName.className = 'day-name';
          dayName.textContent = dayNames[originalDayOfWeek];
          
          dayCell.appendChild(dayNumber);
          dayCell.appendChild(dayName);
          
          // Store day and month data on the cell for hover/click handling
          dayCell.dataset.day = day;
          dayCell.dataset.month = month;
          
          dayCell.addEventListener('click', (event) => {
            if (event.metaKey) {
              // Command+click opens note in new window
              openNote(date, false, true);
            } else if (event.altKey) {
              // Option+click opens note in split view
              openNote(date, true, false);
            } else {
              // Normal click creates event
              const clickedDate = new Date(displayYear, month, day);
              openEventModal(clickedDate, clickedDate, null);
            }
          });
          
          row.appendChild(dayCell);
        }
        
        // Add empty cells after the last day (fill remaining columns)
        const lastColumn = startWeekday + daysInMonth;
        for (let emptyCol = lastColumn; emptyCol < totalColumns; emptyCol++) {
          const emptyCell = document.createElement('div');
          emptyCell.className = 'day-header empty';
          emptyCell.style.gridColumn = emptyCol + 2;
          emptyCell.style.gridRow = 1;
          row.appendChild(emptyCell);
        }
        
        // Spacer cell
        const spacerCell = document.createElement('div');
        spacerCell.className = 'day-header spacer';
        spacerCell.style.gridColumn = totalColumns + 2;
        spacerCell.style.gridRow = 1;
        row.appendChild(spacerCell);
        
        // Events layer
        const eventsLayer = document.createElement('div');
        eventsLayer.className = 'events-layer';
        eventsLayer.id = \`events-layer-\${month}\`;
        eventsLayer.style.gridTemplateColumns = \`30px repeat(\${totalColumns}, minmax(var(--cell-width), 1fr)) 10px\`;
        
        // Add drag-to-create event handlers
        const currentMonth = month;
        eventsLayer.addEventListener('mousedown', (e) => handleEventsLayerMouseDown(e, currentMonth));
        eventsLayer.addEventListener('mousemove', (e) => {
          handleEventsLayerMouseMove(e, currentMonth);
          handleEventsLayerHover(e, currentMonth, row);
        });
        eventsLayer.addEventListener('mouseup', (e) => handleEventsLayerMouseUp(e, currentMonth));
        eventsLayer.addEventListener('mouseleave', () => clearDayHeaderHover(row));
        eventsLayer.style.pointerEvents = 'auto';
        
        row.appendChild(eventsLayer);
        
        container.appendChild(row);
      }
      
      // Update min-width for horizontal scroll
      const minWidth = 30 + (totalColumns * currentWidth) + 10;
      container.style.minWidth = minWidth + 'px';
    }
    
    function renderEventSegments(segmentsByMonth, maxLanesPerMonth) {
      const shouldObfuscate = document.getElementById('obfuscateCheckbox')?.checked || false;
      const alpha = isDarkMode() ? 0.35 : 0.35;
      const dynamicRowHeight = document.getElementById('dynamicRowHeightCheckbox')?.checked || false;

      // Calculate global maximum lanes across all months to ensure consistent height
      const globalMaxLanes = getGlobalMaxLanes(maxLanesPerMonth);

      // Calculate height constants
      const laneHeight = parseInt(getComputedStyle(document.body).getPropertyValue('--lane-height')) || 16;
      const laneGap = parseInt(getComputedStyle(document.body).getPropertyValue('--lane-gap')) || 2;
      const headerHeight = 28; // Day headers

      for (let month = 0; month < 12; month++) {
        const eventsLayer = document.getElementById(\`events-layer-\${month}\`);
        if (!eventsLayer) continue;

        eventsLayer.innerHTML = '';

        const segments = segmentsByMonth[month];

        // Calculate lanes for this month: use per-month lanes if dynamic, otherwise global
        let monthLanes;
        if (dynamicRowHeight) {
          // Use actual lanes for this month, minimum 1 for clickability
          monthLanes = Math.max(1, Math.min(maxLanesPerMonth[month] || 0, globalMaxLanes));
        } else {
          monthLanes = globalMaxLanes;
        }

        const eventsHeight = monthLanes * (laneHeight + laneGap) + 8;
        const monthHeight = headerHeight + eventsHeight;

        eventsLayer.style.minHeight = (monthLanes * (laneHeight + laneGap) + 4) + 'px';

        // Set height for month row
        const monthRow = eventsLayer.parentElement;
        if (monthRow) {
          monthRow.style.minHeight = monthHeight + 'px';
          monthRow.style.height = dynamicRowHeight ? 'auto' : monthHeight + 'px';
        }

        // For Fixed Week layout, calculate the weekday offset for this month
        let weekdayOffset = 0;
        if (layoutMode === 'fixedWeek') {
          const firstDayOfMonth = new Date(displayYear, month, 1);
          weekdayOffset = firstDayOfMonth.getDay();
          // Adjust for firstDayOfWeek setting
          if (firstDayOfWeek === 1) {
            weekdayOffset = (weekdayOffset + 6) % 7;
          }
        }
        
        for (const segment of segments) {
          // Filter out events in lanes beyond the user's maximum
          // Lane is 0-indexed, so if max is 4, we show lanes 0, 1, 2, 3 (4 total)
          if (segment.lane >= globalMaxLanes) {
            continue; // Skip this segment
          }
          
          const segmentEl = document.createElement('div');
          segmentEl.className = 'event-segment';
          
          if (segment.continuesLeft) {
            segmentEl.classList.add('continues-left');
          }
          if (segment.continuesRight) {
            segmentEl.classList.add('continues-right');
          }
          
          // CSS Grid positioning
          // For Date Grid: day 1 = column 2 (after label column)
          // For Fixed Week: day 1 = column (weekdayOffset + 2) because of the offset
          let startCol, endCol;
          if (layoutMode === 'fixedWeek') {
            // In Fixed Week, columns are shifted by the weekday offset
            startCol = segment.startDay + weekdayOffset + 1; // +1 for label column
            endCol = segment.endDay + weekdayOffset + 2; // +2 because grid-column-end is exclusive
          } else {
            // Date Grid: simple day-based positioning
            startCol = segment.startDay + 1; // +1 for label column
            endCol = segment.endDay + 2; // +2 because grid-column-end is exclusive
          }
          
          segmentEl.style.gridColumn = \`\${startCol} / \${endCol}\`;
          segmentEl.style.gridRow = segment.lane + 1; // 1-indexed
          
          // Colors
          const bgColor = colorWithOpacity(segment.color, alpha);
          const textColor = getTextColorForBackground(segment.color, alpha);
          segmentEl.style.backgroundColor = bgColor;
          segmentEl.style.color = textColor;
          
          // Font size - use CSS variable (will be applied via CSS)
          // The CSS variable is already set, but we ensure it's applied
          const eventTextSize = getComputedStyle(document.documentElement).getPropertyValue('--event-text-size') || '10px';
          segmentEl.style.fontSize = eventTextSize;
          
          // Title (only on first segment of multi-segment events)
          if (segment.showTitle) {
            const displayText = shouldObfuscate ? obfuscateText(segment.title) : segment.title;
            segmentEl.textContent = displayText;
          }
          segmentEl.title = segment.title; // Tooltip
          
          // Add click handler for editing
          segmentEl.addEventListener('click', (e) => {
            e.stopPropagation();
            // Find the original event data to edit
            const eventData = {
              id: segment.eventId,
              title: segment.title,
              startDate: segment.originalStartDate,
              endDate: segment.originalEndDate,
              calendarTitle: segment.calendarTitle,
              isAllDay: true
            };
            handleEventSegmentClick(e, eventData);
          });
          
          eventsLayer.appendChild(segmentEl);
        }
      }
    }
    
    function updateCalendarDisplay() {
      // Get filtered events
      const filteredEvents = getFilteredEvents();
      
      // Normalize events
      const normalized = normalizeEvents(filteredEvents, displayYear);
      
      // Assign lanes globally
      const withLanes = assignLanes(normalized);
      
      // Create per-month segments
      const segmentsByMonth = createMonthSegments(withLanes, displayYear);
      
      // Get max lanes per month
      const maxLanesPerMonth = getMaxLanesPerMonth(segmentsByMonth);
      
      // Render event segments
      renderEventSegments(segmentsByMonth, maxLanesPerMonth);
    }
    
    function updateGridColumns(width) {
      const rows = document.querySelectorAll('.month-row');
      rows.forEach(row => {
        row.style.setProperty('--cell-width', width + 'px');
      });
      
      const minWidth = 30 + (31 * width) + 10;
      const container = document.getElementById('calendarContainer');
      if (container) {
        container.style.minWidth = minWidth + 'px';
      }
    }
    
    function changeYear(delta) {
      displayYear += delta;
      document.getElementById('yearDisplay').textContent = displayYear;
      
      renderCalendar();
      
      const needsReload = !loadedYearRange || 
                         displayYear < loadedYearRange.start || 
                         displayYear > loadedYearRange.end;
      
      if (needsReload) {
        loadCalendarEventsProgressively(displayYear);
                      } else {
        updateCalendarDisplay();
      }
    }
    
    // ============================================
    // Event Creation/Editing Modal Functions
    // ============================================
    
    function openEventModal(startDate, endDate, existingEvent = null) {
      const overlay = document.getElementById('eventModalOverlay');
      const titleInput = document.getElementById('eventTitleInput');
      const startInput = document.getElementById('eventStartDate');
      const endInput = document.getElementById('eventEndDate');
      const calendarSelect = document.getElementById('eventCalendarSelect');
      const deleteBtn = document.getElementById('eventDeleteBtn');
      const modalTitle = document.getElementById('eventModalTitle');
      
      editingEvent = existingEvent;
      
      // Set modal title
      modalTitle.textContent = existingEvent ? 'Edit Event' : 'New Event';
      
      // Show/hide delete button
      deleteBtn.style.display = existingEvent ? 'inline-block' : 'none';
      
      // Populate calendar dropdown with writable calendars only, grouped by source
      calendarSelect.innerHTML = '';
      
      const filteredCalendars = writableCalendars.filter(cal => cal.isWritable !== false);
      
      // Group by source
      const calendarsBySource = {};
      filteredCalendars.forEach(cal => {
        const source = cal.source || 'Other';
        if (!calendarsBySource[source]) {
          calendarsBySource[source] = [];
        }
        calendarsBySource[source].push(cal);
      });
      
      // Sort sources alphabetically, but put "iCloud" first if present
      const sortedSources = Object.keys(calendarsBySource).sort((a, b) => {
        if (a === 'iCloud') return -1;
        if (b === 'iCloud') return 1;
        return a.localeCompare(b);
      });
      
      // Render calendars grouped by source using optgroup
      sortedSources.forEach(source => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = source;
        
        calendarsBySource[source].forEach(cal => {
          const option = document.createElement('option');
          option.value = cal.title;
          option.textContent = cal.title;
          option.style.color = cal.color || '#007AFF';
          optgroup.appendChild(option);
        });
        
        calendarSelect.appendChild(optgroup);
      });
      
      if (existingEvent) {
        // Editing existing event
        titleInput.value = existingEvent.title || '';
        // CalendarItem uses 'date' for start, raw event data uses 'startDate'
        const eventStart = existingEvent.date || existingEvent.startDate;
        const eventEnd = existingEvent.endDate;
        startInput.value = formatDateForInput(new Date(eventStart));
        endInput.value = formatDateForInput(new Date(eventEnd));
        
        // Select the calendar - CalendarItem uses 'calendar', segment data uses 'calendarTitle'
        const calendarName = existingEvent.calendar || existingEvent.calendarTitle;
        for (let i = 0; i < calendarSelect.options.length; i++) {
          if (calendarSelect.options[i].value === calendarName) {
            calendarSelect.selectedIndex = i;
            break;
          }
        }
      } else {
        // New event
        titleInput.value = '';
        startInput.value = formatDateForInput(startDate);
        endInput.value = formatDateForInput(endDate);
        
        // Select first calendar by default
        if (calendarSelect.options.length > 0) {
          calendarSelect.selectedIndex = 0;
        }
      }
      
      // Show modal
      overlay.classList.add('visible');
      
      // Focus title input
      setTimeout(() => titleInput.focus(), 100);
    }
    
    function closeEventModal() {
      const overlay = document.getElementById('eventModalOverlay');
      overlay.classList.remove('visible');
      
      // Remove dummy event if exists
      removeDummyEvent();
      
      editingEvent = null;
    }
    
    function formatDateForInput(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return \`\${year}-\${month}-\${day}\`;
    }
    
    function parseDateFromInput(dateString) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    
    async function saveEvent() {
      const titleInput = document.getElementById('eventTitleInput');
      const startInput = document.getElementById('eventStartDate');
      const endInput = document.getElementById('eventEndDate');
      const calendarSelect = document.getElementById('eventCalendarSelect');
      
      const title = titleInput.value.trim() || 'New Event';
      let startDate = parseDateFromInput(startInput.value);
      let endDate = parseDateFromInput(endInput.value);
      const calendarTitle = calendarSelect.value;
      
      // Ensure end date is not before start date
      if (endDate < startDate) {
        endDate = new Date(startDate.getTime());
      }
      
      // For all-day events, set appropriate times
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      try {
        if (editingEvent && editingEvent.id) {
          // Update existing event - build a proper object for the bridge
          console.log('Updating event - id: ' + editingEvent.id + ' title: ' + title + ' calendar: ' + calendarTitle);
          console.log('Original editingEvent: ' + JSON.stringify(editingEvent));
          
          const updateObject = {
            id: editingEvent.id,
            title: title,
            date: startDate,
            endDate: endDate,
            type: 'event',
            isAllDay: true,
            calendar: calendarTitle,
            isCompleted: false,
            notes: editingEvent.notes || '',
            url: editingEvent.url || '',
            availability: editingEvent.availability || 0,
            isRecurring: editingEvent.isRecurring || false
          };
          
          console.log('Update object: ' + JSON.stringify(updateObject));
          console.log('Calling Calendar.update...');
          
          const updateResult = await Calendar.update(updateObject);
          console.log('Calendar.update result: ' + (updateResult ? 'success' : 'returned undefined'));
        } else {
          // Create new event by passing a plain object to Calendar.add()
          // The bridge converts dictionaries to CalendarItem internally
          console.log('Creating event - title: ' + title + ' start: ' + startDate.toISOString() + ' end: ' + endDate.toISOString() + ' calendar: ' + calendarTitle);
          
          // Build event object with required properties
          const eventObject = {
            title: title,
            date: startDate,
            endDate: endDate,
            type: 'event',
            isAllDay: true,
            calendar: calendarTitle,
            isCompleted: false,
            notes: '',
            url: '',
            availability: 0
          };
          
          console.log('Calling Calendar.add with event object...');
          const result = await Calendar.add(eventObject);
          console.log('Calendar.add returned: ' + (result ? JSON.stringify(result) : 'undefined/null'));
          
          if (!result) {
            console.log('WARNING: Calendar.add returned undefined - event may not have been created');
          } else {
            console.log('Event created successfully with id: ' + (result.id || 'no id'));
          }
        }
        
        // Save isRecurring before closing modal (which sets editingEvent = null)
        const wasRecurring = editingEvent && editingEvent.isRecurring;

        // Close modal
        closeEventModal();

        // Force reload events for affected months to show the new/updated event
        // For recurring events, reload the entire displayed year since changes
        // may affect occurrences throughout the year
        let reloadStartDate = startDate;
        let reloadEndDate = endDate;
        if (wasRecurring) {
          reloadStartDate = new Date(displayYear, 0, 1);
          reloadEndDate = new Date(displayYear, 11, 31);
          console.log('Recurring event update - reloading entire year');
        }
        await forceReloadEventsForMonths(reloadStartDate, reloadEndDate);
        
      } catch (error) {
        console.log('ERROR saving event: ' + String(error));
        console.log('Error name: ' + (error && error.name ? error.name : 'none'));
        console.log('Error message: ' + (error && error.message ? error.message : 'none'));
        alert('Failed to save event: ' + String(error));
      }
    }
    
    async function deleteEvent() {
      console.log('deleteEvent called');
      console.log('editingEvent: ' + JSON.stringify(editingEvent));
      
      if (!editingEvent) {
        console.log('No editingEvent - returning');
        return;
      }
      
      if (!editingEvent.id) {
        console.log('No event id - cannot delete');
        return;
      }
      
      // Note: confirm() doesn't work in WebViews, so we delete directly
      // TODO: Add a custom confirmation modal if needed
      try {
        // Get event dates before deleting
        const eventStart = new Date(editingEvent.date || editingEvent.startDate);
        const eventEnd = new Date(editingEvent.endDate || eventStart);
        
        console.log('Deleting event - id: ' + editingEvent.id);
        console.log('Event dates: ' + eventStart.toISOString() + ' to ' + eventEnd.toISOString());
        
        // Build proper object for the bridge
        const deleteObject = {
          id: editingEvent.id,
          title: editingEvent.title || '',
          date: eventStart,
          endDate: eventEnd,
          type: 'event',
          isAllDay: editingEvent.isAllDay !== undefined ? editingEvent.isAllDay : true,
          calendar: editingEvent.calendar || editingEvent.calendarTitle || '',
          isCompleted: false,
          isRecurring: editingEvent.isRecurring || false
        };
        
        console.log('Delete object: ' + JSON.stringify(deleteObject));
        console.log('Calling Calendar.remove...');
        
        // Save isRecurring before closing modal (which sets editingEvent = null)
        const wasRecurring = editingEvent.isRecurring || false;

        const removeResult = await Calendar.remove(deleteObject);
        console.log('Calendar.remove result: ' + (removeResult ? 'success' : 'returned undefined'));

        closeEventModal();

        // Force reload affected months
        // For recurring events, reload the entire displayed year since the original
        // event date may be from a different year than what's being displayed
        console.log('Reloading events...');
        console.log('wasRecurring = ' + wasRecurring);
        let reloadStartDate = eventStart;
        let reloadEndDate = eventEnd;
        if (wasRecurring) {
          reloadStartDate = new Date(displayYear, 0, 1);
          reloadEndDate = new Date(displayYear, 11, 31);
          console.log('Recurring event - reloading entire year: ' + reloadStartDate.toISOString() + ' to ' + reloadEndDate.toISOString());
        } else {
          console.log('NOT a recurring event - reloading only affected months: ' + reloadStartDate.toISOString() + ' to ' + reloadEndDate.toISOString());
        }
        await forceReloadEventsForMonths(reloadStartDate, reloadEndDate);
        console.log('Delete complete');
      } catch (error) {
        console.log('ERROR deleting event: ' + String(error));
        console.log('Error name: ' + (error && error.name ? error.name : 'none'));
        console.log('Error message: ' + (error && error.message ? error.message : 'none'));
      }
    }
    
    // ============================================
    // Drag-to-Create Event Functions
    // ============================================
    
    function createDummyEvent(month, startDay, endDay) {
      removeDummyEvent();
      
      const eventsLayer = document.getElementById(\`events-layer-\${month}\`);
      if (!eventsLayer) return;
      
      const dummy = document.createElement('div');
      dummy.className = 'event-segment dummy-event';
      dummy.textContent = 'New Event';
      
      // Calculate column positions based on layout mode
      let startCol, endCol;
      if (layoutMode === 'fixedWeek') {
        const firstDayOfMonth = new Date(displayYear, month, 1);
        let weekdayOffset = firstDayOfMonth.getDay();
        if (firstDayOfWeek === 1) {
          weekdayOffset = (weekdayOffset + 6) % 7;
        }
        startCol = startDay + weekdayOffset + 1;
        endCol = endDay + weekdayOffset + 2;
      } else {
        startCol = startDay + 1;
        endCol = endDay + 2;
      }
      
      dummy.style.gridColumn = \`\${startCol} / \${endCol}\`;
      dummy.style.gridRow = '1';
      
      eventsLayer.appendChild(dummy);
      dummyEventElement = dummy;
    }
    
    function removeDummyEvent() {
      if (dummyEventElement && dummyEventElement.parentNode) {
        dummyEventElement.parentNode.removeChild(dummyEventElement);
      }
      dummyEventElement = null;
    }
    
    function handleEventsLayerMouseDown(event, month) {
      // Don't start drag if clicking on an existing event
      if (event.target.classList.contains('event-segment') && !event.target.classList.contains('dummy-event')) {
        return;
      }

      const eventsLayer = event.currentTarget;
      const dayCell = getDayCellFromPosition(event, eventsLayer, month);

      if (!dayCell || dayCell.day < 1 || dayCell.day > getDaysInMonth(displayYear, month)) {
        return;
      }

      const clickedDate = new Date(displayYear, month, dayCell.day);

      // Debug logging for modifier keys
      console.log('=== MouseDown Event Debug ===');
      console.log('event.type: ' + event.type);
      console.log('event.metaKey (Command): ' + event.metaKey);
      console.log('event.altKey (Option): ' + event.altKey);
      console.log('event.ctrlKey (Control): ' + event.ctrlKey);
      console.log('event.shiftKey (Shift): ' + event.shiftKey);
      console.log('event.button: ' + event.button);
      console.log('clickedDate: ' + clickedDate.toISOString());

      // Handle modifier keys to open notes instead of creating events
      if (event.metaKey) {
        console.log('→ Action: Command+click → opening in new window');
        openNote(clickedDate, false, true);
        event.preventDefault();
        return;
      } else if (event.altKey) {
        console.log('→ Action: Option+click → opening in split view');
        openNote(clickedDate, true, false);
        event.preventDefault();
        return;
      } else {
        console.log('→ Action: Normal click → starting drag/event creation');
      }

      isDragging = true;
      dragStartMonth = month;
      dragStartDate = clickedDate;
      dragEndDate = clickedDate;

      createDummyEvent(month, dayCell.day, dayCell.day);

      event.preventDefault();
    }
    
    function handleEventsLayerMouseMove(event, month) {
      if (!isDragging || dragStartMonth !== month) return;
      
      const eventsLayer = event.currentTarget;
      const dayCell = getDayCellFromPosition(event, eventsLayer, month);
      
      if (!dayCell || dayCell.day < 1 || dayCell.day > getDaysInMonth(displayYear, month)) {
        return;
      }
      
      dragEndDate = new Date(displayYear, month, dayCell.day);
      
      // Update dummy event to span from start to current position
      const startDay = Math.min(dragStartDate.getDate(), dragEndDate.getDate());
      const endDay = Math.max(dragStartDate.getDate(), dragEndDate.getDate());
      
      createDummyEvent(month, startDay, endDay);
    }
    
    function handleEventsLayerMouseUp(event, month) {
      if (!isDragging) return;
      
      isDragging = false;
      
      // Ensure dates are in correct order
      let startDate = dragStartDate;
      let endDate = dragEndDate;
      if (endDate < startDate) {
        [startDate, endDate] = [endDate, startDate];
      }
      
      // Open modal with the selected date range
      openEventModal(startDate, endDate, null);
    }
    
    function handleEventsLayerHover(event, month, row) {
      // Don't update hover when dragging
      if (isDragging) return;
      
      const eventsLayer = event.currentTarget;
      const dayCell = getDayCellFromPosition(event, eventsLayer, month);
      
      if (!dayCell || dayCell.day < 1 || dayCell.day > getDaysInMonth(displayYear, month)) {
        clearDayHeaderHover(row);
        return;
      }
      
      // Find the day header with matching day number
      const dayHeaders = row.querySelectorAll('.day-header');
      dayHeaders.forEach(header => {
        if (header.dataset.day === String(dayCell.day) && header.dataset.month === String(month)) {
          header.classList.add('hovered');
        } else {
          header.classList.remove('hovered');
        }
      });
    }
    
    function clearDayHeaderHover(row) {
      const dayHeaders = row.querySelectorAll('.day-header.hovered');
      dayHeaders.forEach(header => {
        header.classList.remove('hovered');
      });
    }
    
    function getDayCellFromPosition(event, eventsLayer, month) {
      const rect = eventsLayer.getBoundingClientRect();
      const x = event.clientX - rect.left;
      
      const labelWidth = 30; // Month label width
      const spacerWidth = 10; // Spacer at the end
      
      // Calculate actual cell width from container width
      // Grid: labelWidth + N columns + spacerWidth = total width
      const numColumns = layoutMode === 'fixedWeek' ? 37 : 31;
      const availableWidth = rect.width - labelWidth - spacerWidth;
      const cellWidth = availableWidth / numColumns;
      
      // Calculate which column was clicked (0-indexed)
      const clickedColumn = Math.floor((x - labelWidth) / cellWidth);
      
      if (layoutMode === 'fixedWeek') {
        // For fixed week, we need to convert column back to day
        const firstDayOfMonth = new Date(displayYear, month, 1);
        let weekdayOffset = firstDayOfMonth.getDay();
        if (firstDayOfWeek === 1) {
          weekdayOffset = (weekdayOffset + 6) % 7;
        }
        // Column 0 = weekdayOffset day 1, so day = column - weekdayOffset + 1
        const day = clickedColumn - weekdayOffset + 1;
        return { day };
      } else {
        // Date Grid: column 0 = day 1
        return { day: clickedColumn + 1 };
      }
    }
    
    async function handleEventSegmentClick(event, eventData) {
      event.stopPropagation();
      
      console.log('Event segment clicked');
      console.log('eventData: ' + JSON.stringify(eventData));
      
      try {
        // Fetch the actual CalendarItem from the API
        if (eventData.id) {
          console.log('Fetching event by ID: ' + eventData.id);
          const calendarItem = await Calendar.eventByID(eventData.id);
          console.log('Calendar.eventByID returned: ' + JSON.stringify(calendarItem));
          
          if (calendarItem) {
            console.log('Opening modal with fetched calendarItem');
            console.log('calendarItem.isRecurring = ' + calendarItem.isRecurring);
            console.log('calendarItem properties: ' + Object.keys(calendarItem).join(', '));
            openEventModal(new Date(calendarItem.date || calendarItem.startDate),
                          new Date(calendarItem.endDate),
                          calendarItem);
            return;
          } else {
            console.log('calendarItem was null/undefined');
          }
        } else {
          console.log('No event ID in eventData');
        }
      } catch (error) {
        console.log('Error fetching event: ' + String(error));
      }
      
      // Fallback: use the segment data if we couldn't fetch the actual event
      console.log('Using fallback - opening modal with segment data');
      console.log('eventData.isRecurring = ' + eventData.isRecurring);
      console.log('eventData properties: ' + Object.keys(eventData).join(', '));
      openEventModal(new Date(eventData.startDate), new Date(eventData.endDate), eventData);
    }
    
    async function loadWritableCalendars() {
      try {
        const allCalendars = await Calendar.availableCalendars({ writeOnly: true, enabledOnly: true });
        // Filter to only writable calendars (extra safety)
        writableCalendars = (allCalendars || []).filter(cal => cal.isWritable !== false);
        console.log('Loaded ' + writableCalendars.length + ' writable calendars');
      } catch (error) {
        console.log('Error loading writable calendars: ' + String(error));
        writableCalendars = [];
      }
    }
    
    function setupEventModalListeners() {
      const overlay = document.getElementById('eventModalOverlay');
      const closeBtn = document.getElementById('eventModalClose');
      const cancelBtn = document.getElementById('eventCancelBtn');
      const saveBtn = document.getElementById('eventSaveBtn');
      const deleteBtn = document.getElementById('eventDeleteBtn');
      
      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeEventModal();
        }
      });
      
      // Close button
      closeBtn.addEventListener('click', closeEventModal);
      
      // Cancel button
      cancelBtn.addEventListener('click', closeEventModal);
      
      // Save button
      saveBtn.addEventListener('click', saveEvent);
      
      // Delete button
      deleteBtn.addEventListener('click', deleteEvent);
      
      // ESC key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('visible')) {
          closeEventModal();
        }
      });
      
      // Enter key to save (when in title input)
      document.getElementById('eventTitleInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          saveEvent();
        }
      });
      
      // Global mouse up to handle drag end outside events layer
      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          // If we ended outside, still open the modal with current selection
          if (dragStartDate && dragEndDate) {
            let startDate = dragStartDate;
            let endDate = dragEndDate;
            if (endDate < startDate) {
              [startDate, endDate] = [endDate, startDate];
            }
            openEventModal(startDate, endDate, null);
          }
        }
      });
    }
    
    // ============================================
    // Layout Helper Functions
    // ============================================
    
    function updateLayoutButtons() {
      const dateGridBtn = document.getElementById('layoutDateGrid');
      const fixedWeekBtn = document.getElementById('layoutFixedWeek');
      const firstDaySection = document.getElementById('firstDayOfWeekSection');
      
      if (dateGridBtn) {
        dateGridBtn.classList.toggle('active', layoutMode === 'dateGrid');
      }
      if (fixedWeekBtn) {
        fixedWeekBtn.classList.toggle('active', layoutMode === 'fixedWeek');
      }
      if (firstDaySection) {
        firstDaySection.style.display = layoutMode === 'fixedWeek' ? 'block' : 'none';
      }
    }
    
    function updateFirstDayButtons() {
      const sundayBtn = document.getElementById('firstDaySunday');
      const mondayBtn = document.getElementById('firstDayMonday');
      
      if (sundayBtn) {
        sundayBtn.classList.toggle('active', firstDayOfWeek === 0);
      }
      if (mondayBtn) {
        mondayBtn.classList.toggle('active', firstDayOfWeek === 1);
      }
    }
    
    // ============================================
    // Initialization
    // ============================================
    
    async function initialize() {
      const cellWidthSlider = document.getElementById('cellWidthSlider');
      const cellWidthValue = document.getElementById('cellWidthValue');
      const eventTextSizeSlider = document.getElementById('eventTextSizeSlider');
      const eventTextSizeValue = document.getElementById('eventTextSizeValue');
      const maxEventRowsSlider = document.getElementById('maxEventRowsSlider');
      const maxEventRowsValue = document.getElementById('maxEventRowsValue');
      const obfuscateCheckbox = document.getElementById('obfuscateCheckbox');
      
      // Load saved settings from localStorage
      const savedWidth = localStorage.getItem('calendarCellWidth');
      const initialWidth = savedWidth ? parseInt(savedWidth) : 35;
      cellWidthSlider.value = initialWidth;
      cellWidthValue.textContent = initialWidth + 'px';
      document.documentElement.style.setProperty('--cell-width', initialWidth + 'px');
      
      const savedTextSize = localStorage.getItem('calendarEventTextSize');
      const initialTextSize = savedTextSize ? parseInt(savedTextSize) : 10;
      eventTextSizeSlider.value = initialTextSize;
      eventTextSizeValue.textContent = initialTextSize + 'px';
      document.documentElement.style.setProperty('--event-text-size', initialTextSize + 'px');
      
      const savedMaxRows = localStorage.getItem('calendarMaxEventRows');
      const initialMaxRows = savedMaxRows ? parseInt(savedMaxRows) : 7;
      maxEventRowsSlider.value = initialMaxRows;
      maxEventRowsValue.textContent = initialMaxRows;
      
      const savedObfuscate = localStorage.getItem('calendarObfuscateText');
      obfuscateCheckbox.checked = savedObfuscate === 'true';
      
      const hideSingleDayEventsCheckbox = document.getElementById('hideSingleDayEventsCheckbox');
      const savedHideSingleDay = localStorage.getItem('calendarHideSingleDayEvents');
      // Default: unchecked (show single-day events by default)
      hideSingleDayEventsCheckbox.checked = savedHideSingleDay === 'true';

      const showOnlyAllDayEventsCheckbox = document.getElementById('showOnlyAllDayEventsCheckbox');
      const savedShowOnlyAllDay = localStorage.getItem('calendarShowOnlyAllDayEvents');
      // Default: unchecked (show all events by default)
      showOnlyAllDayEventsCheckbox.checked = savedShowOnlyAllDay === 'true';

      const dynamicRowHeightCheckbox = document.getElementById('dynamicRowHeightCheckbox');
      const savedDynamicRowHeight = localStorage.getItem('calendarDynamicRowHeight');
      // Default: unchecked (fixed height by default)
      dynamicRowHeightCheckbox.checked = savedDynamicRowHeight === 'true';

      // Load layout mode and first day of week
      const savedLayoutMode = localStorage.getItem('calendarLayoutMode');
      if (savedLayoutMode === 'fixedWeek' || savedLayoutMode === 'dateGrid') {
        layoutMode = savedLayoutMode;
      }
      
      const savedFirstDay = localStorage.getItem('calendarFirstDayOfWeek');
      if (savedFirstDay === '0' || savedFirstDay === '1') {
        firstDayOfWeek = parseInt(savedFirstDay);
      }
      
      // Update layout button states
      updateLayoutButtons();
      updateFirstDayButtons();
      
      // Event listeners for layout buttons
      document.getElementById('layoutDateGrid').addEventListener('click', () => {
        layoutMode = 'dateGrid';
        localStorage.setItem('calendarLayoutMode', layoutMode);
        updateLayoutButtons();
        renderCalendar();
        updateCalendarDisplay();
      });
      
      document.getElementById('layoutFixedWeek').addEventListener('click', () => {
        layoutMode = 'fixedWeek';
        localStorage.setItem('calendarLayoutMode', layoutMode);
        updateLayoutButtons();
        renderCalendar();
        updateCalendarDisplay();
      });
      
      // Event listeners for first day of week buttons
      document.getElementById('firstDaySunday').addEventListener('click', () => {
        firstDayOfWeek = 0;
        localStorage.setItem('calendarFirstDayOfWeek', firstDayOfWeek.toString());
        updateFirstDayButtons();
        renderCalendar();
        updateCalendarDisplay();
      });
      
      document.getElementById('firstDayMonday').addEventListener('click', () => {
        firstDayOfWeek = 1;
        localStorage.setItem('calendarFirstDayOfWeek', firstDayOfWeek.toString());
        updateFirstDayButtons();
        renderCalendar();
        updateCalendarDisplay();
      });
      
      // Event listeners
      cellWidthSlider.addEventListener('input', (e) => {
        const width = parseInt(e.target.value);
        document.documentElement.style.setProperty('--cell-width', width + 'px');
        cellWidthValue.textContent = width + 'px';
        localStorage.setItem('calendarCellWidth', width.toString());
        updateGridColumns(width);
      });
      
      eventTextSizeSlider.addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        eventTextSizeValue.textContent = size + 'px';
        localStorage.setItem('calendarEventTextSize', size.toString());
        document.documentElement.style.setProperty('--event-text-size', size + 'px');
        // Update all existing event segments with new text size
        updateEventTextSize(size);
        updateCalendarDisplay();
      });
      
      maxEventRowsSlider.addEventListener('input', (e) => {
        const maxRows = parseInt(e.target.value);
        maxEventRowsValue.textContent = maxRows;
        localStorage.setItem('calendarMaxEventRows', maxRows.toString());
        // Update calendar display to apply new maximum height
        updateCalendarDisplay();
      });
      
      obfuscateCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('calendarObfuscateText', e.target.checked.toString());
        updateCalendarDisplay();
      });
      
      hideSingleDayEventsCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('calendarHideSingleDayEvents', e.target.checked.toString());
        updateCalendarDisplay();
      });

      showOnlyAllDayEventsCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('calendarShowOnlyAllDayEvents', e.target.checked.toString());
        updateCalendarDisplay();
      });

      dynamicRowHeightCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('calendarDynamicRowHeight', e.target.checked.toString());
        updateCalendarDisplay();
      });

      document.getElementById('yearPrev').addEventListener('click', () => changeYear(-1));
      document.getElementById('yearNext').addEventListener('click', () => changeYear(1));

      // Listen for dark mode changes to update event label colors
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        updateCalendarDisplay();
      });

      // Setup event modal listeners
      setupEventModalListeners();
      
      // Load writable calendars for event creation
      await loadWritableCalendars();
      
      // Render initial calendar
      renderCalendar();
      
      // Load calendars for filter
      await populateCalendarFilter();
      
      // Load events progressively
      loadCalendarEventsProgressively(displayYear);
    }
    
    function showAPIUnavailableMessage() {
      const container = document.getElementById('calendarContainer');
      container.innerHTML = \`
        <div class="api-unavailable">
          <div class="api-unavailable-icon">📅</div>
          <div class="api-unavailable-title">Calendar API Not Available</div>
          <div class="api-unavailable-message">
            This plugin requires a newer version of NotePlan with the integrated Calendar API.
            Please update NotePlan to the latest version to use this feature.
          </div>
        </div>
      \`;
    }
    
    function checkBridgeAndInitialize() {
      // Check if bridge is ready and Calendar API is available
      if (typeof Calendar !== 'undefined') {
        initialize();
      } else {
        showAPIUnavailableMessage();
      }
    }
    
    // Initialize when bridge is ready
    // The bridge sets window.__notePlanBridgeReady and dispatches 'notePlanBridgeReady' event
    if (typeof Calendar !== 'undefined') {
      // Bridge already ready
      initialize();
    } else {
      // Wait for bridge ready event
      window.addEventListener('notePlanBridgeReady', () => {
        checkBridgeAndInitialize();
      }, { once: true });
      
      // Fallback: check after a delay in case event was missed
      setTimeout(() => {
        if (typeof Calendar === 'undefined') {
          showAPIUnavailableMessage();
        } else {
          // Bridge became available, initialize
          initialize();
        }
      }, 2000);
    }
        </script>
      </body>
</html>`
}

/**
 * Plugin initialization - called by NotePlan when the plugin loads
 * Checks for updates in the background
 */
function init() {
  try {
    // Check for plugin updates silently in the background
    // Parameters: (pluginIDs, showPromptIfSuccessful, showProgressPrompt, showFailedPrompt)
    DataStore.installOrUpdatePluginsByID(['emetzger.LinearCalendar'], false, false, false);
  } catch (error) {
    // Silently ignore update check failures
    console.log('LinearCalendar: Update check failed:', error);
  }
}

/**
 * Called after the plugin is updated or installed
 * Can be used for settings migrations or user notifications
 */
function onUpdateOrInstall() {
  console.log('LinearCalendar: Plugin updated to latest version');
}
