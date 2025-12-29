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
      padding: 8px 16px;
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
      background: #f5f5f7;
      border: none;
      border-radius: 8px;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            color: #1d1d1f;
      transition: background-color 0.15s;
      opacity: 1;
    }
    
    .settings-button:hover {
      background: #e8e8ed;
    }
    
    .settings-icon {
      width: 14px;
      height: 14px;
      display: inline-block;
      opacity: 0.7;
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
            background: #007AFF;
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
          }
          
    .settings-checkbox {
            width: 16px;
            height: 16px;
            cursor: pointer;
            accent-color: #007AFF;
          }
          
    .settings-checkbox-label {
            font-size: 13px;
            color: #1d1d1f;
            user-select: none;
            cursor: pointer;
          }
          
    /* Calendar filter dropdown */
          .calendar-filter {
            display: flex;
            align-items: center;
            position: relative;
      z-index: 100;
    }
    
    .calendar-filter-button {
      min-width: 140px;
      padding: 6px 28px 6px 12px;
      border: none;
      border-radius: 8px;
      background: #f5f5f7;
            font-size: 13px;
            font-weight: 500;
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
    }
    
    .calendar-filter-icon {
      width: 14px;
      height: 14px;
      display: inline-block;
      opacity: 0.7;
      flex-shrink: 0;
          }
          
          .calendar-filter-button:hover {
      background: #e8e8ed;
          }
          
          .calendar-filter-button::after {
            content: '';
            position: absolute;
      right: 10px;
            top: 50%;
            transform: translateY(-50%);
            width: 0;
            height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
      border-top: 5px solid #86868b;
            transition: transform 0.2s;
          }
          
          .calendar-filter-button.open::after {
            transform: translateY(-50%) rotate(180deg);
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
            accent-color: #007AFF;
          }
          
          .calendar-filter-item-label {
            flex: 1;
            font-size: 13px;
            color: #1d1d1f;
            user-select: none;
          }
          
    /* ============================================
       Calendar Layout
       ============================================ */
          .calendar-wrapper {
            overflow-x: auto;
            overflow-y: auto;
      padding: 0 0 20px 0;
      height: calc(100vh - 48px);
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
    
    .day-header:hover {
            background-color: #f5f5f7;
          }
          
    .day-header.weekend {
            background-color: #fafafa;
          }
          
    .day-header.weekend:hover {
            background-color: #f5f5f7;
          }
          
    .day-header.today .day-number {
      color: #007AFF;
            font-weight: 600;
          }
          
    .day-header.today .day-name {
      color: #007AFF;
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
      border-radius: 3px;
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
        background: #2c2c2e;
              color: #f5f5f7;
            }
            
      .calendar-filter-button:hover,
      .settings-button:hover {
              background: #38383a;
            }
            
            .calendar-filter-button::after {
        border-top-color: #98989d;
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
            
      .settings-slider {
        background: #38383a;
      }
      
      .settings-slider::-webkit-slider-thumb {
        background: #0a84ff;
        border-color: #2c2c2e;
      }
      
      .settings-checkbox-label {
              color: #f5f5f7;
            }
            
            .month-row {
              border-bottom-color: #38383a;
            }
            
            .month-label {
              color: #f5f5f7;
        background: #2a3440;
        border-right-color: #38383a;
            }
            
      .day-header:hover {
              background-color: #2c2c2e;
            }
            
      .day-header.weekend {
        background-color: #252527;
      }
      
      .day-header.weekend:hover {
        background-color: #2a2a2c;
      }
      
      .day-header.today .day-number {
        color: #0a84ff;
      }
      
      .day-header.today .day-name {
        color: #0a84ff;
            }
            
            .day-number {
              color: #f5f5f7;
            }
            
            .day-name {
              color: #98989d;
            }
            
      .api-unavailable-title {
        color: #f5f5f7;
      }
      
      .api-unavailable-message {
        color: #98989d;
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
          <svg class="calendar-filter-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="4" width="10" height="9" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/>
            <path d="M5 2v3M11 2v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M3 7h10" stroke="currentColor" stroke-width="1.2"/>
            <circle cx="6" cy="10" r="0.8" fill="currentColor"/>
            <circle cx="8" cy="10" r="0.8" fill="currentColor"/>
            <circle cx="10" cy="10" r="0.8" fill="currentColor"/>
          </svg>
          <span id="calendarFilterText">Loading...</span>
        </button>
        <div class="calendar-filter-dropdown" id="calendarFilterDropdown"></div>
          </div>
      <div class="settings-container">
        <button class="settings-button" id="settingsButton" onclick="toggleSettingsDropdown(event)" title="Display">
          <svg class="settings-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="10" cy="12" r="1.5" fill="currentColor"/>
          </svg>
          <span>Display</span>
        </button>
        <div class="settings-dropdown" id="settingsDropdown">
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
    
    function openNote(date, inSplitView = false) {
      if (!date) return;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = \`\${year}-\${month}-\${day}\`;
      let url = \`noteplan://x-callback-url/openNote?noteDate=\${dateStr}&view=daily&timeframe=day\`;
      if (inSplitView) {
        url += '&splitView=yes';
      }
      window.location.href = url;
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
            eventId: event.id,
            title: event.title,
            color: event.color,
            lane: event.lane,
            month: month,
            startDay: startDayOfMonth,
            endDay: endDayOfMonth,
            continuesLeft: segStart > event.displayStart,
            continuesRight: segEnd < event.displayEnd,
            // Only show title on first segment of each event
            showTitle: month === startMonth
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
                title: event.title || "Event",
                startDate: eventDate.toISOString(),
                endDate: eventEndDate.toISOString(),
                calendarTitle: event.calendar || "",
                color: event.color || "#5A9FD4",
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
            
            calendars.forEach(calendar => {
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
              
              item.appendChild(colorDot);
              item.appendChild(checkbox);
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
        calendarFilterText.textContent = \`\${selectedCount} of \${totalCount}\`;
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
      return rawEvents.filter(event => {
        if (selectedCalendars.size > 0 && !selectedCalendars.has(event.calendarTitle)) {
          return false;
        }
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);
        const yearStart = new Date(displayYear, 0, 1);
        const yearEnd = new Date(displayYear, 11, 31, 23, 59, 59);
        return eventStart <= yearEnd && eventEnd >= yearStart;
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
            
            dayHeader.addEventListener('click', (event) => {
              const inSplitView = event.metaKey || event.altKey;
              openNote(date, inSplitView);
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
        row.appendChild(eventsLayer);
        
        container.appendChild(row);
      }
      
      // Update min-width for horizontal scroll (label + 31 days + spacer)
      const minWidth = 30 + (31 * currentWidth) + 10;
      container.style.minWidth = minWidth + 'px';
    }
    
    function renderEventSegments(segmentsByMonth, maxLanesPerMonth) {
      const shouldObfuscate = document.getElementById('obfuscateCheckbox')?.checked || false;
      const alpha = isDarkMode() ? 0.35 : 0.35;
      
      // Calculate global maximum lanes across all months to ensure consistent height
      const globalMaxLanes = getGlobalMaxLanes(maxLanesPerMonth);
      
      // Calculate fixed height based on global maximum
      const laneHeight = parseInt(getComputedStyle(document.body).getPropertyValue('--lane-height')) || 16;
      const laneGap = parseInt(getComputedStyle(document.body).getPropertyValue('--lane-gap')) || 2;
      const headerHeight = 28; // Day headers
      const eventsHeight = globalMaxLanes * (laneHeight + laneGap) + 8;
      const fixedMonthHeight = headerHeight + eventsHeight;
      
      for (let month = 0; month < 12; month++) {
        const eventsLayer = document.getElementById(\`events-layer-\${month}\`);
        if (!eventsLayer) continue;
        
        eventsLayer.innerHTML = '';
        
        const segments = segmentsByMonth[month];
        
        // Use global maximum for all months to ensure consistent height
        eventsLayer.style.minHeight = (globalMaxLanes * (laneHeight + laneGap) + 4) + 'px';
        
        // Set fixed height for month row (same for all months)
        const monthRow = eventsLayer.parentElement;
        if (monthRow) {
          monthRow.style.minHeight = fixedMonthHeight + 'px';
          monthRow.style.height = fixedMonthHeight + 'px'; // Fixed height, not just min
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
          
          // CSS Grid positioning: +2 because column 1 is label, and grid is 1-indexed
          // endDay + 2 because grid-column-end is exclusive
          segmentEl.style.gridColumn = \`\${segment.startDay + 1} / \${segment.endDay + 2}\`;
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
      
      document.getElementById('yearPrev').addEventListener('click', () => changeYear(-1));
      document.getElementById('yearNext').addEventListener('click', () => changeYear(1));
      
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
