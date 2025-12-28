/**
 * Linear Calendar Plugin
 * Displays a linear year view calendar with calendar events
 */

/**
 * Main function to show the linear calendar view
 * @param {number} year - Optional year to display (defaults to current year)
 */
async function showLinearCalendar(year) {
  try {
    // Use provided year or current year
    const currentYear = year || new Date().getFullYear()

    // Load calendar events BEFORE showing HTML (so we have access to Calendar API)
    // Load events for multiple years (current year ± 2 years) to avoid reloading
    let calendarData = {}

    try {
      // Load events for a 5-year range (current year ± 2 years)
      const startYear = currentYear - 2
      const endYear = currentYear + 2
      const startDate = new Date(startYear, 0, 1) // January 1st of start year
      const endDate = new Date(endYear, 11, 31, 23, 59, 59) // December 31st of end year

      // Load events asynchronously using Calendar API
      const events = await Calendar.eventsBetween(startDate, endDate, "")

      // Process events - store full event objects with dates
      const eventsList = []
      if (events && Array.isArray(events)) {
        events.forEach((event) => {
          if (event.date) {
            const eventDate = new Date(event.date)
            const endDate = event.endDate ? new Date(event.endDate) : eventDate

            // Get color from event - now available via CalendarItemObject.color property
            // This will be the calendar's original color as a hex string
            let eventColor = event.color || "#5A9FD4" // Use calendar color or fallback to softer blue

            eventsList.push({
              title: event.title || "Event",
              startDate: eventDate.toISOString(),
              endDate: endDate.toISOString(),
              calendarTitle: event.calendar || "",
              color: eventColor,
            })
          }
        })
      }

      // Store events list for rendering (all years)
      calendarData = { events: eventsList }
    } catch (error) {
      console.log("Error loading calendar events:", error)
    }

    // Convert calendar data to JSON for embedding in HTML
    const calendarDataJson = JSON.stringify(calendarData)

    HTMLView.showInMainWindow(
      `<html>
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
          }
          
          .controls {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 20px;
            margin-bottom: 8px;
            border-bottom: 1px solid #e5e5e7;
            flex-shrink: 0;
          }
          
          .year-navigation {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-right: auto;
          }
          
          .year-button {
            background: transparent;
            border: 1px solid #e5e5e7;
            border-radius: 4px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
            color: #1d1d1f;
            transition: all 0.2s;
          }
          
          .year-button:hover {
            background: #f5f5f7;
            border-color: #007AFF;
          }
          
          .year-button:active {
            background: #e8e8ed;
          }
          
          .year-display {
            font-size: 16px;
            font-weight: 600;
            color: #1d1d1f;
            min-width: 80px;
            text-align: center;
          }
          
          .controls-section {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-left: 24px;
          }
          
          .controls-label {
            font-size: 13px;
            font-weight: 500;
            color: #1d1d1f;
            min-width: 80px;
          }
          
          .controls-slider {
            flex: 1;
            max-width: 300px;
            height: 4px;
            border-radius: 2px;
            background: #e5e5e7;
            outline: none;
            -webkit-appearance: none;
            appearance: none;
          }
          
          .controls-slider::-webkit-slider-thumb {
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
          
          .controls-slider::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #007AFF;
            cursor: pointer;
            border: 2px solid #ffffff;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          }
          
          .controls-value {
            font-size: 13px;
            color: #86868b;
            min-width: 40px;
            text-align: right;
          }
          
          .obfuscate-control {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: 24px;
          }
          
          .obfuscate-checkbox {
            width: 16px;
            height: 16px;
            cursor: pointer;
            accent-color: #007AFF;
          }
          
          .obfuscate-label {
            font-size: 13px;
            font-weight: 500;
            color: #1d1d1f;
            user-select: none;
            cursor: pointer;
          }
          
          .calendar-filter {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: 24px;
            position: relative;
          }
          
          .calendar-filter-label {
            font-size: 13px;
            font-weight: 500;
            color: #1d1d1f;
            white-space: nowrap;
          }
          
          .calendar-filter-button {
            min-width: 200px;
            padding: 6px 28px 6px 10px;
            border: 1px solid #e5e5e7;
            border-radius: 4px;
            background: #ffffff;
            font-size: 13px;
            color: #1d1d1f;
            cursor: pointer;
            outline: none;
            text-align: left;
            position: relative;
            transition: border-color 0.2s;
          }
          
          .calendar-filter-button:hover {
            border-color: #007AFF;
          }
          
          .calendar-filter-button::after {
            content: '';
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            width: 0;
            height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-top: 6px solid #1d1d1f;
            transition: transform 0.2s;
          }
          
          .calendar-filter-button.open::after {
            transform: translateY(-50%) rotate(180deg);
          }
          
          .calendar-filter-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            margin-top: 4px;
            min-width: 250px;
            max-width: 350px;
            max-height: 300px;
            overflow-y: auto;
            background: #ffffff;
            border: 1px solid #e5e5e7;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            display: none;
            padding: 4px 0;
          }
          
          .calendar-filter-dropdown.show {
            display: block;
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
          
          .calendar-wrapper {
            overflow-x: auto;
            overflow-y: auto;
            padding: 0 20px 20px 20px;
            height: calc(100vh - 60px);
            box-sizing: border-box;
          }
          
          .calendar-container {
            display: flex;
            flex-direction: column;
            gap: 0;
            min-width: 1400px;
          }
          
          .month-row {
            display: grid;
            border-bottom: 1px solid #e5e5e7;
            min-height: 60px;
            height: auto;
          }
          
          .month-label {
            padding: 6px 12px;
            font-weight: 500;
            text-align: left;
            color: #1d1d1f;
            display: flex;
            align-items: center;
            font-size: 13px;
          }
          
          .day-cell {
            padding: 4px 2px;
            text-align: center;
            cursor: pointer;
            border: none;
            background: transparent;
            transition: background-color 0.15s ease;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            justify-content: flex-start;
            min-height: 60px;
            height: auto;
            min-width: var(--cell-width);
            width: 100%;
            max-width: 100%;
            overflow: visible;
            box-sizing: border-box;
          }
          
          .day-cell:hover {
            background-color: #f5f5f7;
          }
          
          .day-cell.weekend {
            background-color: #f5f5f7;
          }
          
          .day-cell.weekend:hover {
            background-color: #e8e8ed;
          }
          
          .day-cell.today {
            background-color: #e3f2fd;
            border: 1px solid #2196F3;
            border-radius: 4px;
          }
          
          .day-cell.today:hover {
            background-color: #bbdefb;
          }
          
          .day-cell.today .day-number {
            color: #1976D2;
            font-weight: 600;
          }
          
          .day-cell.today.weekend {
            background-color: #e3f2fd;
          }
          
          .day-cell.today.weekend:hover {
            background-color: #bbdefb;
          }
          
          .day-cell.empty {
            cursor: default;
            opacity: 0.3;
          }
          
          .day-cell.empty:hover {
            background-color: transparent;
          }
          
          .day-number {
            font-size: 13px;
            font-weight: 400;
            color: #1d1d1f;
            line-height: 1.2;
          }
          
          .day-name {
            font-size: 10px;
            font-weight: 400;
            color: #86868b;
            line-height: 1;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-top: 1px;
          }
          
          .day-cell.weekend .day-name {
            color: #86868b;
          }
          
          .day-events {
            width: 100%;
            margin-top: 4px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            align-items: stretch;
            min-height: 0;
            flex: 1;
          }
          
          .event-bar {
            background-color: #5A9FD4;
            color: white;
            font-size: 9px;
            font-weight: 500;
            padding: 2px 4px;
            border-radius: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            cursor: pointer;
            line-height: 1.2;
            min-height: 14px;
            display: flex;
            align-items: center;
            transition: opacity 0.2s;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            flex-shrink: 1;
            min-width: 0;
          }
          
          /* Text color will be set dynamically via inline style for better contrast */
          
          .event-bar:hover {
            opacity: 0.8;
          }
          
          .event-bar.start {
            border-top-left-radius: 2px;
            border-bottom-left-radius: 2px;
          }
          
          .event-bar.middle {
            border-radius: 0;
          }
          
          .event-bar.end {
            border-top-right-radius: 2px;
            border-bottom-right-radius: 2px;
          }
          
          .event-bar.single {
            border-radius: 2px;
          }
          
          .day-content-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
            position: relative;
            z-index: 1;
            flex-shrink: 0;
          }
          
          /* Dark mode support */
          @media (prefers-color-scheme: dark) {
            body {
              background: #1c1c1e;
              color: #f5f5f7;
            }
            
            .controls {
              border-bottom-color: #38383a;
            }
            
            .year-button {
              border-color: #38383a;
              color: #f5f5f7;
            }
            
            .year-button:hover {
              background: #2c2c2e;
              border-color: #0a84ff;
            }
            
            .year-button:active {
              background: #3a3a3c;
            }
            
            .year-display {
              color: #f5f5f7;
            }
            
            .controls-label {
              color: #f5f5f7;
            }
            
            .controls-slider {
              background: #38383a;
            }
            
            .controls-slider::-webkit-slider-thumb {
              background: #0a84ff;
              border-color: #1c1c1e;
            }
            
            .controls-slider::-moz-range-thumb {
              background: #0a84ff;
              border-color: #1c1c1e;
            }
            
            .controls-value {
              color: #98989d;
            }
            
            .calendar-filter-label {
              color: #f5f5f7;
            }
            
            .calendar-filter-button {
              border-color: #38383a;
              background: #2c2c2e;
              color: #f5f5f7;
            }
            
            .calendar-filter-button:hover {
              border-color: #0a84ff;
            }
            
            .calendar-filter-button::after {
              border-top-color: #f5f5f7;
            }
            
            .calendar-filter-dropdown {
              background: #2c2c2e;
              border-color: #38383a;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            }
            
            .calendar-filter-item:hover {
              background-color: #38383a;
            }
            
            .calendar-filter-color-dot {
              border-color: rgba(255, 255, 255, 0.2);
            }
            
            .calendar-filter-item-label {
              color: #f5f5f7;
            }
            
            .obfuscate-label {
              color: #f5f5f7;
            }
            
            .month-row {
              border-bottom-color: #38383a;
            }
            
            .month-label {
              color: #f5f5f7;
            }
            
            .day-cell:hover {
              background-color: #2c2c2e;
            }
            
            .day-cell.weekend {
              background-color: #2c2c2e;
            }
            
            .day-cell.weekend:hover {
              background-color: #38383a;
            }
            
            .day-cell.today {
              background-color: #1a3a52;
              border-color: #0a84ff;
            }
            
            .day-cell.today:hover {
              background-color: #1e4a6a;
            }
            
            .day-cell.today .day-number {
              color: #64b5f6;
            }
            
            .day-cell.today.weekend {
              background-color: #1a3a52;
            }
            
            .day-cell.today.weekend:hover {
              background-color: #1e4a6a;
            }
            
            .day-number {
              color: #f5f5f7;
            }
            
            .day-name {
              color: #98989d;
            }
            
            .day-cell.weekend .day-name {
              color: #6e6e73;
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
          <div class="controls-section">
            <div class="controls-label">Cell Width</div>
            <input type="range" class="controls-slider" id="cellWidthSlider" min="30" max="300" value="35" step="5">
            <div class="controls-value" id="cellWidthValue">35px</div>
          </div>
          <div class="obfuscate-control">
            <input type="checkbox" class="obfuscate-checkbox" id="obfuscateCheckbox">
            <label for="obfuscateCheckbox" class="obfuscate-label">Obfuscate text</label>
          </div>
          <div class="calendar-filter">
            <div class="calendar-filter-label">Calendars:</div>
            <button class="calendar-filter-button" id="calendarFilterButton">All calendars</button>
            <div class="calendar-filter-dropdown" id="calendarFilterDropdown">
              <!-- Options will be populated by JavaScript -->
            </div>
          </div>
        </div>
        <div class="calendar-wrapper">
          <div class="calendar-container" id="calendarContainer"></div>
        </div>
        
        <script>
          let displayYear = ${currentYear};
          
          // Obfuscate text function - randomizes characters while preserving structure
          function obfuscateText(text) {
            if (!text) return text;
            
            const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const numbers = '0123456789';
            
            return text.split('').map(char => {
              // Preserve spaces, punctuation, and special characters
              if (!/[a-zA-Z0-9]/.test(char)) {
                return char;
              }
              
              // Randomize letters
              if (/[a-zA-Z]/.test(char)) {
                const isUpperCase = char === char.toUpperCase();
                const randomLetter = letters[Math.floor(Math.random() * letters.length)];
                return isUpperCase ? randomLetter.toUpperCase() : randomLetter.toLowerCase();
              }
              
              // Randomize numbers
              if (/[0-9]/.test(char)) {
                return numbers[Math.floor(Math.random() * numbers.length)];
              }
              
              return char;
            }).join('');
          }
          
          // Cell width slider functionality
          const cellWidthSlider = document.getElementById('cellWidthSlider');
          const cellWidthValue = document.getElementById('cellWidthValue');
          
          // Obfuscate checkbox functionality
          const obfuscateCheckbox = document.getElementById('obfuscateCheckbox');
          const savedObfuscate = localStorage.getItem('calendarObfuscateText');
          const initialObfuscate = savedObfuscate === 'true';
          obfuscateCheckbox.checked = initialObfuscate;
          
          // Load saved width from localStorage or use default
          const savedWidth = localStorage.getItem('calendarCellWidth');
          const initialWidth = savedWidth ? parseInt(savedWidth) : 35;
          cellWidthSlider.value = initialWidth;
          cellWidthValue.textContent = initialWidth + 'px';
          document.documentElement.style.setProperty('--cell-width', initialWidth + 'px');
          
          // Function to update grid columns based on cell width
          function updateGridColumns(width) {
            const rows = document.querySelectorAll('.month-row');
            rows.forEach(row => {
              row.style.gridTemplateColumns = \`120px repeat(31, minmax(\${width}px, 1fr))\`;
            });
            
            // Also update all day cells to ensure they adapt
            const dayCells = document.querySelectorAll('.day-cell');
            dayCells.forEach(cell => {
              cell.style.minWidth = width + 'px';
            });
            
            // Calculate and update min-width for calendar container (content inside scrollable wrapper)
            // Month label (120px) + 31 columns × cell width
            // Add some extra padding to ensure all columns are accessible
            const minWidth = 120 + (31 * width) + 20;
            const calendarContainer = document.querySelector('.calendar-container');
            if (calendarContainer) {
              calendarContainer.style.minWidth = minWidth + 'px';
            }
            
            // Force a reflow to ensure text truncation recalculates
            // This ensures event bar text adapts to new width
            document.body.offsetHeight; // Trigger reflow
          }
          
          // Update width when slider changes
          cellWidthSlider.addEventListener('input', (e) => {
            const width = parseInt(e.target.value);
            document.documentElement.style.setProperty('--cell-width', width + 'px');
            cellWidthValue.textContent = width + 'px';
            localStorage.setItem('calendarCellWidth', width.toString());
            updateGridColumns(width);
          });
          
          // Year navigation
          const yearDisplay = document.getElementById('yearDisplay');
          const yearPrev = document.getElementById('yearPrev');
          const yearNext = document.getElementById('yearNext');
          
          function changeYear(delta) {
            const newYear = displayYear + delta;
            
            // Update display immediately
            displayYear = newYear;
            yearDisplay.textContent = displayYear;
            
            // Since we loaded events for multiple years upfront, just update the indicators
            // No need to reload - events are already loaded for ±2 years
            updateCalendarIndicators();
            
            // Re-render the calendar with the new year (dates will change)
            renderCalendar();
          }
          
          yearPrev.addEventListener('click', () => changeYear(-1));
          yearNext.addEventListener('click', () => changeYear(1));
          
          // Calendar filter functionality
          const calendarFilterButton = document.getElementById('calendarFilterButton');
          const calendarFilterDropdown = document.getElementById('calendarFilterDropdown');
          let selectedCalendars = new Set();
          let calendarInfoMap = new Map(); // Map of calendar name to { name, color }
          
          // Extract unique calendar names with their colors from events
          function getUniqueCalendarsWithColors() {
            if (!calendarData.events || !Array.isArray(calendarData.events)) {
              return [];
            }
            const calendarMap = new Map();
            calendarData.events.forEach(event => {
              if (event.calendarTitle && event.calendarTitle.trim()) {
                const name = event.calendarTitle;
                if (!calendarMap.has(name)) {
                  calendarMap.set(name, {
                    name: name,
                    color: event.color || "#5A9FD4"
                  });
                }
              }
            });
            return Array.from(calendarMap.values()).sort((a, b) => a.name.localeCompare(b.name));
          }
          
          // Populate calendar filter dropdown
          function populateCalendarFilter() {
            const calendars = getUniqueCalendarsWithColors();
            calendarFilterDropdown.innerHTML = '';
            
            // Store calendar info map
            calendarInfoMap = new Map();
            calendars.forEach(cal => {
              calendarInfoMap.set(cal.name, cal);
            });
            
            // Load saved selection from localStorage or default to all selected
            const savedSelection = localStorage.getItem('calendarFilterSelection');
            if (savedSelection) {
              try {
                const saved = JSON.parse(savedSelection);
                selectedCalendars = new Set(saved);
                // Ensure any new calendars (not in saved selection) are also selected by default
                calendars.forEach(cal => {
                  if (!selectedCalendars.has(cal.name)) {
                    selectedCalendars.add(cal.name);
                  }
                });
              } catch (e) {
                // If parsing fails, default to all selected
                selectedCalendars = new Set(calendars.map(cal => cal.name));
              }
            } else {
              // Default: all calendars selected
              selectedCalendars = new Set(calendars.map(cal => cal.name));
            }
            
            calendars.forEach(calendar => {
              const item = document.createElement('div');
              item.className = 'calendar-filter-item';
              
              const colorDot = document.createElement('div');
              colorDot.className = 'calendar-filter-color-dot';
              colorDot.style.backgroundColor = calendar.color;
              
              const checkbox = document.createElement('input');
              checkbox.type = 'checkbox';
              checkbox.className = 'calendar-filter-checkbox';
              checkbox.value = calendar.name;
              checkbox.checked = selectedCalendars.has(calendar.name);
              checkbox.addEventListener('change', handleCalendarFilterChange);
              
              const label = document.createElement('span');
              label.className = 'calendar-filter-item-label';
              label.textContent = calendar.name;
              
              item.appendChild(colorDot);
              item.appendChild(checkbox);
              item.appendChild(label);
              
              // Make the whole item clickable (except the checkbox itself which handles its own click)
              item.addEventListener('click', (e) => {
                if (e.target === checkbox) {
                  // Let the checkbox handle its own change event
                  return;
                }
                e.preventDefault();
                checkbox.checked = !checkbox.checked;
                handleCalendarFilterChange({ target: checkbox });
              });
              
              calendarFilterDropdown.appendChild(item);
            });
            
            // Update filter display text
            updateCalendarFilterDisplay();
          }
          
          // Handle obfuscate checkbox changes
          obfuscateCheckbox.addEventListener('change', (e) => {
            localStorage.setItem('calendarObfuscateText', e.target.checked.toString());
            // Re-render calendar indicators to update event text
            updateCalendarIndicators();
          });
          
          // Handle calendar filter checkbox changes
          function handleCalendarFilterChange(e) {
            const calendarName = e.target.value;
            if (e.target.checked) {
              selectedCalendars.add(calendarName);
            } else {
              selectedCalendars.delete(calendarName);
            }
            
            localStorage.setItem('calendarFilterSelection', JSON.stringify(Array.from(selectedCalendars)));
            updateCalendarFilterDisplay();
            // Reload calendar indicators with filtered events
            updateCalendarIndicators();
          }
          
          // Update the filter button text to show selected count
          function updateCalendarFilterDisplay() {
            const totalCount = calendarInfoMap.size;
            const selectedCount = selectedCalendars.size;
            
            if (selectedCount === 0) {
              calendarFilterButton.textContent = 'No calendars';
            } else if (selectedCount === totalCount) {
              calendarFilterButton.textContent = 'All calendars';
            } else {
              calendarFilterButton.textContent = \`\${selectedCount} of \${totalCount} calendars\`;
            }
          }
          
          // Toggle dropdown
          calendarFilterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = calendarFilterDropdown.classList.contains('show');
            if (isOpen) {
              calendarFilterDropdown.classList.remove('show');
              calendarFilterButton.classList.remove('open');
            } else {
              calendarFilterDropdown.classList.add('show');
              calendarFilterButton.classList.add('open');
            }
          });
          
          // Close dropdown when clicking outside
          document.addEventListener('click', (e) => {
            if (!calendarFilterButton.contains(e.target) && !calendarFilterDropdown.contains(e.target)) {
              calendarFilterDropdown.classList.remove('show');
              calendarFilterButton.classList.remove('open');
            }
          });
          
          const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
          ];
          
          const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
          
          // Calendar data - pre-loaded from main script context
          let calendarData = ${calendarDataJson};
          
          // Ensure calendarData has the correct structure
          if (!calendarData || typeof calendarData !== 'object') {
            calendarData = { events: [] };
          }
          if (!calendarData.events || !Array.isArray(calendarData.events)) {
            calendarData.events = [];
          }
          
          // Debug: Check if calendarData is valid
          console.log('Calendar data loaded:', calendarData);
          console.log('Display year:', displayYear);
          
          // Function to open note via X callback URL
          function openNote(date, inSplitView = false) {
            if (!date) return;
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = \`\${year}-\${month}-\${day}\`;
            
            // Use NotePlan API if available, otherwise use X callback URL
            if (typeof Editor !== 'undefined' && Editor.openNoteByDateString) {
              Editor.openNoteByDateString(dateStr);
            } else {
              // Build x-callback-url with optional splitView parameter
              let url = \`noteplan://x-callback-url/openNote?noteDate=\${dateStr}&view=daily&timeframe=day\`;
              if (inSplitView) {
                url += '&splitView=yes';
              }
              
              // Fallback: create a link and click it to trigger the x-callback-url
              const link = document.createElement('a');
              link.href = url;
              link.style.display = 'none';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }
          
          // Get day of week (0 = Sunday, 6 = Saturday)
          function getDayOfWeek(date) {
            return date.getDay();
          }
          
          // Check if date is today
          function isToday(date) {
            const today = new Date();
            return date.getDate() === today.getDate() &&
                   date.getMonth() === today.getMonth() &&
                   date.getFullYear() === today.getFullYear();
          }
          
          // Format date as YYYY-MM-DD
          function formatDateKey(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return \`\${year}-\${month}-\${day}\`;
          }
          
          // Check if two dates are the same day
          function isSameDay(date1, date2) {
            return date1.getDate() === date2.getDate() &&
                   date1.getMonth() === date2.getMonth() &&
                   date1.getFullYear() === date2.getFullYear();
          }
          
          // Check if a date falls within an event's date range
          function isDateInEventRange(date, event) {
            try {
              const start = new Date(event.startDate);
              const end = new Date(event.endDate);
              
              // Normalize all dates to local time at midnight to avoid timezone issues
              start.setHours(0, 0, 0, 0);
              end.setHours(23, 59, 59, 999);
              date.setHours(0, 0, 0, 0);
              
              // Compare dates (ignoring time)
              return date >= start && date <= end;
            } catch (e) {
              console.error('Error checking date range:', e, event);
              return false;
            }
          }
          
          // Lighten a hex color by applying opacity (mixing with white)
          // This makes the color lighter and more readable with dark text
          // Check if dark mode is active
          function isDarkMode() {
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
          }
          
          // Convert hex color to rgba with simple alpha value
          // Uses different alpha values for light and dark mode
          function colorWithOpacity(hex) {
            // Remove # if present
            hex = hex.replace('#', '');
            
            // Parse RGB values
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            
            // Simple alpha values: lighter in light mode, darker in dark mode
            const alpha = isDarkMode() ? 0.25 : 0.3;
            
            return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
          }
          
          // Calculate the effective color after blending with background
          // Used to determine text color contrast
          function getEffectiveColor(hex, opacity) {
            // Remove # if present
            hex = hex.replace('#', '');
            
            // Parse RGB values
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            
            // Blend with background (white in light mode, dark in dark mode)
            if (isDarkMode()) {
              // Blend with dark background (#2c2c2e = rgb(44, 44, 46))
              const bgR = 44, bgG = 44, bgB = 46;
              const effectiveR = Math.round(r * opacity + bgR * (1 - opacity));
              const effectiveG = Math.round(g * opacity + bgG * (1 - opacity));
              const effectiveB = Math.round(b * opacity + bgB * (1 - opacity));
              
              const toHex = (n) => {
                const hex = n.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
              };
              
              return '#' + toHex(effectiveR) + toHex(effectiveG) + toHex(effectiveB);
            } else {
              // Blend with white background (255, 255, 255)
              const bgR = 255, bgG = 255, bgB = 255;
              const effectiveR = Math.round(r * opacity + bgR * (1 - opacity));
              const effectiveG = Math.round(g * opacity + bgG * (1 - opacity));
              const effectiveB = Math.round(b * opacity + bgB * (1 - opacity));
              
              const toHex = (n) => {
                const hex = n.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
              };
              
              return '#' + toHex(effectiveR) + toHex(effectiveG) + toHex(effectiveB);
            }
          }
          
          // Get appropriate text color for a background color
          // Returns a darker version for light backgrounds, white for dark backgrounds
          function getTextColorForBackground(hex) {
            // Remove # if present
            hex = hex.replace('#', '');
            
            // Parse RGB values
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            
            // Calculate relative luminance to determine if background is light or dark
            // Using the formula: 0.299*R + 0.587*G + 0.114*B
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            
            // If background is dark (luminance < 0.5), use white text
            if (luminance < 0.5) {
              return '#FFFFFF';
            }
            
            // If background is light, darken it significantly for text
            // Darken by 60% to ensure good contrast
            const darkenFactor = 0.6;
            const darkenedR = Math.max(0, Math.floor(r * (1 - darkenFactor)));
            const darkenedG = Math.max(0, Math.floor(g * (1 - darkenFactor)));
            const darkenedB = Math.max(0, Math.floor(b * (1 - darkenFactor)));
            
            // Convert back to hex
            const toHex = (n) => {
              const hex = n.toString(16);
              return hex.length === 1 ? '0' + hex : hex;
            };
            
            return '#' + toHex(darkenedR) + toHex(darkenedG) + toHex(darkenedB);
          }
          
          // Function to update calendar with new events (called from main context)
          function updateCalendarWithEvents(eventsData) {
            if (eventsData && eventsData.events) {
              calendarData = eventsData;
              updateCalendarIndicators();
            }
          }
          
          // Make function available globally so it can be called from main context
          window.updateCalendarWithEvents = updateCalendarWithEvents;
          
          // Debug: Log that function is available
          console.log('updateCalendarWithEvents function registered');
          
          // Update calendar with event bars (using pre-loaded data)
          function updateCalendarIndicators() {
            if (!calendarData.events || !Array.isArray(calendarData.events)) {
              return;
            }
            
            const container = document.getElementById('calendarContainer');
            const rows = container.querySelectorAll('.month-row');
            
            rows.forEach((row, monthIndex) => {
              const dayCells = row.querySelectorAll('.day-cell:not(.empty)');
              
              dayCells.forEach((dayCell, dayIndex) => {
                const day = dayIndex + 1;
                // Create date in local timezone (monthIndex is 0-based: 0=January, 11=December)
                const date = new Date(displayYear, monthIndex, day);
                // Normalize to midnight to avoid timezone issues
                date.setHours(0, 0, 0, 0);
                
                // Remove existing event bars
                const existingEvents = dayCell.querySelector('.day-events');
                if (existingEvents) {
                  existingEvents.remove();
                }
                
                // Find events for this date (filter by displayYear to only show events that overlap with current year)
                const eventsForDay = calendarData.events.filter(event => {
                  // First check if calendar is selected
                  if (selectedCalendars.size > 0 && !selectedCalendars.has(event.calendarTitle)) {
                    return false;
                  }
                  
                  const eventStart = new Date(event.startDate);
                  const eventEnd = new Date(event.endDate);
                  
                  // Check if event overlaps with the displayed year
                  // Event should be shown if it starts in, ends in, or spans across the displayed year
                  const yearStart = new Date(displayYear, 0, 1);
                  const yearEnd = new Date(displayYear, 11, 31, 23, 59, 59);
                  
                  // Event overlaps if: (starts before year ends AND ends after year starts)
                  const overlapsYear = eventStart <= yearEnd && eventEnd >= yearStart;
                  
                  if (!overlapsYear) {
                    return false;
                  }
                  
                  // Also check if this specific date falls within the event range
                  return isDateInEventRange(date, event);
                });
                
                if (eventsForDay.length > 0) {
                  // Create events container
                  const eventsContainer = document.createElement('div');
                  eventsContainer.className = 'day-events';
                  
                  // Add all event bars (no limit)
                  eventsForDay.forEach(event => {
                    const eventBar = document.createElement('div');
                    eventBar.className = 'event-bar';
                    
                    // Determine bar position classes
                    try {
                      const eventStart = new Date(event.startDate);
                      const eventEnd = new Date(event.endDate);
                      // Normalize times to avoid timezone issues
                      eventStart.setHours(0, 0, 0, 0);
                      eventEnd.setHours(0, 0, 0, 0);
                      const isStart = isSameDay(date, eventStart);
                      const isEnd = isSameDay(date, eventEnd);
                    
                      if (isStart && isEnd) {
                        eventBar.classList.add('single');
                      } else if (isStart) {
                        eventBar.classList.add('start');
                      } else if (isEnd) {
                        eventBar.classList.add('end');
                      } else {
                        eventBar.classList.add('middle');
                      }
                      
                      // Set color if available - use rgba with simple alpha
                      if (event.color) {
                        const colorWithAlpha = colorWithOpacity(event.color);
                        eventBar.style.backgroundColor = colorWithAlpha;
                        // Get appropriate text color based on background
                        const effectiveColor = getEffectiveColor(event.color, isDarkMode() ? 0.25 : 0.3);
                        const textColor = getTextColorForBackground(effectiveColor);
                        eventBar.style.color = textColor;
                      } else {
                        // Default color - use blue with opacity
                        const defaultColorWithAlpha = colorWithOpacity("#5A9FD4");
                        eventBar.style.backgroundColor = defaultColorWithAlpha;
                        const effectiveDefaultColor = getEffectiveColor("#5A9FD4", isDarkMode() ? 0.25 : 0.3);
                        eventBar.style.color = getTextColorForBackground(effectiveDefaultColor);
                      }
                      
                      // Set text - show title on start day, let CSS handle truncation
                      if (isStart) {
                        const shouldObfuscate = obfuscateCheckbox.checked;
                        const displayText = shouldObfuscate ? obfuscateText(event.title) : event.title;
                        eventBar.textContent = displayText;
                        // Always show original title in tooltip (even when obfuscated)
                        eventBar.title = event.title;
                      }
                      
                      eventsContainer.appendChild(eventBar);
                    } catch (e) {
                      console.error('Error creating event bar:', e, event);
                    }
                  });
                  
                  dayCell.appendChild(eventsContainer);
                }
              });
            });
          }
          
          // Render linear calendar
          function renderCalendar() {
            try {
              const container = document.getElementById('calendarContainer');
              if (!container) {
                console.error('Calendar container not found');
                return;
              }
              
              container.innerHTML = '';
              
              // Get current cell width (use initialWidth if slider not ready)
              const currentWidth = parseInt(cellWidthSlider?.value || initialWidth);
            
            // Create 12 rows (one for each month)
            for (let month = 0; month < 12; month++) {
              const row = document.createElement('div');
              row.className = 'month-row';
              row.style.gridTemplateColumns = \`120px repeat(31, minmax(\${currentWidth}px, 1fr))\`;
              
              // Month label
              const monthLabel = document.createElement('div');
              monthLabel.className = 'month-label';
              monthLabel.textContent = monthNames[month];
              row.appendChild(monthLabel);
              
              // Create days for this month
              const daysInMonth = new Date(displayYear, month + 1, 0).getDate();
              
              // Create 31 day cells
              for (let day = 1; day <= 31; day++) {
              const dayCell = document.createElement('div');
              dayCell.className = 'day-cell';
              
                if (day <= daysInMonth) {
                  const date = new Date(displayYear, month, day);
                  const dayOfWeek = getDayOfWeek(date);
                  
                  // Add weekend class
                  if (dayOfWeek === 0 || dayOfWeek === 6) {
                    dayCell.classList.add('weekend');
                  }
                  
                  // Add today class
                  if (isToday(date)) {
                dayCell.classList.add('today');
              }
                  
                  // Day content wrapper
                  const contentWrapper = document.createElement('div');
                  contentWrapper.className = 'day-content-wrapper';
              
              // Day number
              const dayNumber = document.createElement('div');
              dayNumber.className = 'day-number';
                  dayNumber.textContent = day;
                  contentWrapper.appendChild(dayNumber);
                  
                  // Day name
                  const dayName = document.createElement('div');
                  dayName.className = 'day-name';
                  dayName.textContent = dayNames[dayOfWeek];
                  contentWrapper.appendChild(dayName);
                  
                  dayCell.appendChild(contentWrapper);
                  
                  // Add click handler to open note with modifier key support
                  dayCell.addEventListener('click', (event) => {
                    // Check for Command (meta) or Option (alt) key
                    const inSplitView = event.metaKey || event.altKey;
                    openNote(date, inSplitView);
              });
            } else {
                  // Empty cell for days beyond month end
                  dayCell.classList.add('empty');
                }
                
                row.appendChild(dayCell);
              }
              
              container.appendChild(row);
            }
            
            // Ensure grid columns are set correctly after rendering
            updateGridColumns(currentWidth);
            
              // Update calendar with pre-loaded event data
              updateCalendarIndicators();
            } catch (error) {
              console.error('Error rendering calendar:', error);
            }
          }
          
          // Initialize calendar filter after data is loaded
          populateCalendarFilter();
          
          // Initialize calendar
          try {
            renderCalendar();
          } catch (error) {
            console.error('Error initializing calendar:', error);
          }
        </script>
      </body>
    </html>`,
      "Linear Calendar",
      { splitView: false, icon: "calendar-lines", iconColor: "green-500" }
    )
  } catch (error) {
    console.log(error)
  }
}

/**
 * Helper function to load calendar events for a given year range
 * @param {number} currentYear - The year to center the range around
 * @returns {Promise<Object>} Object containing events array
 */
async function loadCalendarEvents(currentYear) {
  // Load events for a 5-year range (current year ± 2 years)
  const startYear = currentYear - 2
  const endYear = currentYear + 2
  const startDate = new Date(startYear, 0, 1) // January 1st of start year
  const endDate = new Date(endYear, 11, 31, 23, 59, 59) // December 31st of end year

  // Load events asynchronously using Calendar API
  const events = await Calendar.eventsBetween(startDate, endDate, "")

  // Process events - store full event objects with dates
  const eventsList = []
  if (events && Array.isArray(events)) {
    events.forEach((event) => {
      if (event.date) {
        const eventDate = new Date(event.date)
        const endDate = event.endDate ? new Date(event.endDate) : eventDate

        // Get color from event - uses calendar's original color as a hex string
        let eventColor = event.color || "#5A9FD4" // Use calendar color or fallback to blue

        eventsList.push({
          title: event.title || "Event",
          startDate: eventDate.toISOString(),
          endDate: endDate.toISOString(),
          calendarTitle: event.calendar || "",
          color: eventColor,
        })
      }
    })
  }

  return { events: eventsList }
}
