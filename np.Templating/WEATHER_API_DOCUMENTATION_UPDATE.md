# Weather API Documentation Update Guide

**Date:** October 31, 2025  
**Change:** Switched from wttr.in to OpenWeatherMap via NotePlan's built-in API

## Overview

The `weather()` function has been updated to use NotePlan's built-in OpenWeatherMap API instead of the wttr.in service, which had become unreliable. The function signature has been enhanced while maintaining backward compatibility.

---

## Required Documentation Updates

### 1. **Add Provider Change Call-out**

Add a prominent notice at the top of the weather section:

```markdown
> **📢 Provider Change (v2.2.0):**  
> The weather service has been upgraded from wttr.in to OpenWeatherMap via NotePlan's built-in API (available from NotePlan v3.19.2+). This provides more reliable service, better location detection, and additional weather data fields. All existing weather templates remain compatible.
```

---

### 2. **Update Function Signature**

**Old signature:**
```javascript
weather(format?: string)
```

**New signature:**
```javascript
weather(format?: string, units?: string, latitude?: number, longitude?: number)
```

**Parameter documentation:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `''` (uses formatted output) | Custom format string with placeholders. Use `''` for default formatted output, or `:raw:` / `:object:` to get the raw weather object for custom processing |
| `units` | string | `'metric'` | Temperature units: `"metric"` (Celsius, m/s) or `"imperial"` (Fahrenheit, mph) |
| `latitude` | number | `0` | Latitude coordinate. Use `0` for automatic IP-based location detection |
| `longitude` | number | `0` | Longitude coordinate. Use `0` for automatic IP-based location detection |

---

### 3. **Update Basic Examples**

**Default usage (no changes for users):**
```ejs
<%- weather() %>
```
Output example:
```
### San Francisco Weather for Tue, 2025-10-28
☀️ **Clear Sky** - High: **18°C**, Low: **12°C**, Wind: **8m/s**, Visibility: **10km**
🌅 Sunrise: **7:15 AM**, Sunset: **6:30 PM**, Peak UVI: **5**
```

**Custom location:**
```ejs
<%# New York City in imperial units %>
<%- weather('', 'imperial', 40.7128, -74.0060) %>

<%# London in metric units %>
<%- weather('', 'metric', 51.5074, -0.1278) %>
```

---

### 4. **Add NEW Feature: Raw Object Access**

Add a new section explaining the `:raw:` / `:object:` format option:

```markdown
#### Advanced: Access Raw Weather Object

You can access the raw weather data object for complete custom formatting:

```ejs
<%# Get the raw weather object %>
<% const weatherData = await weather(':raw:') %>

**Current Conditions in <%= weatherData.cityName %>:**
- 🌡️ Temperature: <%= weatherData.temperature %><%= weatherData.temperatureUnit %>
- 🤔 Feels like: <%= weatherData.apparentTemperature %>°
- 💧 Humidity: <%= weatherData.humidity %>%
- 💨 Wind: <%= weatherData.windSpeed %><%= weatherData.windSpeedUnit %> from <%= weatherData.windDirection %>°
- 👁️ Visibility: <%= weatherData.visibility %><%= weatherData.visibilityUnit %>
- ☀️ UV Index: <%= weatherData.uvIndex %>
- 📈 High/Low: <%= weatherData.highTemp %>° / <%= weatherData.lowTemp %>°
- 🌅 Sunrise: <%= weatherData.sunrise %> | Sunset: <%= weatherData.sunset %>

_Conditions: <%= weatherData.emoji %> <%= weatherData.condition %>_
```

**Available object properties:**
- `formatted` - Pre-formatted markdown output
- `cityName` - City name
- `temperature` - Current temperature (number)
- `temperatureUnit` - Unit symbol (°C or °F)
- `apparentTemperature` - Feels-like temperature
- `humidity` - Humidity percentage
- `windSpeed` - Wind speed
- `windSpeedUnit` - Wind speed unit (m/s or mph)
- `windDirection` - Wind direction in degrees
- `uvIndex` - UV index
- `condition` - Weather condition description
- `emoji` - Weather emoji
- `iconCode` - OpenWeatherMap icon code
- `visibility` - Visibility distance
- `visibilityUnit` - Visibility unit (km)
- `highTemp` - Today's high temperature
- `lowTemp` - Today's low temperature
- `sunrise` - Sunrise time (h:mm AM/PM)
- `sunset` - Sunset time (h:mm AM/PM)
- `location` - Object with `{ latitude, longitude, cityName }`
```

---

### 5. **Update Available Placeholders Section**

Add these **NEW** placeholders to the existing list:

| Placeholder | Description | Notes |
|-------------|-------------|-------|
| `:cityName:` | City name | New field |
| `:temperature:` | Current temperature | New field (numeric) |
| `:temperatureUnit:` | Temperature unit | New field (°C or °F) |
| `:apparentTemperature:` | Feels-like temperature | New field |
| `:humidity:` | Humidity percentage | New field |
| `:windSpeed:` | Wind speed | New field |
| `:windSpeedUnit:` | Wind speed unit | New field (m/s or mph) |
| `:windDirection:` | Wind direction in degrees | New field |
| `:uvIndex:` | UV index | New field |
| `:condition:` | Weather condition | New field (same as `:description:`) |
| `:emoji:` | Weather emoji | New field (same as `:icon:`) |
| `:visibility:` | Visibility distance | New field |
| `:highTemp:` | High temperature | New field (same as `:maxtempC:`/`:maxtempF:`) |
| `:lowTemp:` | Low temperature | New field (same as `:mintempC:`/`:mintempF:`) |
| `:sunrise:` | Sunrise time | New field |
| `:sunset:` | Sunset time | New field |
| `:areaName:` | City name | **Still works** (backward compat) |
| `:description:` | Weather description | **Still works** (backward compat) |
| `:icon:` | Weather emoji | **Still works** (backward compat) |
| `:mintempC:` / `:maxtempC:` | Min/max temp | **Still works** (backward compat) |
| `:mintempF:` / `:maxtempF:` | Min/max temp | **Still works** (backward compat) |

**Note:** Old placeholders (`:areaName:`, `:description:`, `:icon:`, etc.) still work for backward compatibility with existing templates.

---

### 6. **Update Custom Format Examples**

Add examples showing new capabilities:

```ejs
<%# Simple temperature display %>
<%- weather(':emoji: :condition: - :temperature::temperatureUnit:') %>
<!-- Output: ☀️ Clear Sky - 72°F -->

<%# Detailed format with new fields %>
<%- weather(':emoji: :condition: in :cityName: | Temp: :temperature::temperatureUnit: (feels :apparentTemperature:°) | UV: :uvIndex: | Humidity: :humidity:%') %>
<!-- Output: ☀️ Clear Sky in San Francisco | Temp: 72°F (feels 70°) | UV: 5 | Humidity: 65% -->

<%# Sunrise/sunset display %>
<%- weather('🌅 Sun rises at :sunrise: and sets at :sunset: today') %>
<!-- Output: 🌅 Sun rises at 7:15 AM and sets at 6:30 PM today -->

<%# Specific location with custom format %>
<%- weather(':emoji: :temperature::temperatureUnit: in :cityName:', 'imperial', 40.7128, -74.0060) %>
<!-- Output: ⛅ 68°F in New York -->
```

---

### 7. **Update Settings Documentation**

**No changes needed** - The `weatherFormat` setting still works exactly as before and applies when no format parameter is provided.

---

### 8. **Add Migration Notes (Optional)**

If documenting migration from old templates:

```markdown
### Migration from wttr.in

**Good news:** No changes required! All existing `weather()` calls continue to work.

**Optional enhancements you can now add:**
1. Specify location: `weather('', 'metric', 51.5074, -0.1278)`
2. Use new placeholders: `:temperature:`, `:humidity:`, `:uvIndex:`, etc.
3. Access raw data: `const data = await weather(':raw:')`

**If you were working around wttr.in failures:**
- Remove any error handling workarounds
- The new API is more reliable with better uptime
```

---

## Summary of Changes

### What Changed
- ✅ Provider: wttr.in → OpenWeatherMap (via NotePlan)
- ✅ Added location parameters (latitude, longitude)
- ✅ Added units parameter (metric/imperial)
- ✅ Added `:raw:` / `:object:` format option for raw data access
- ✅ Added many new data fields (UV index, sunrise/sunset, etc.)

### What Stayed the Same
- ✅ Function name: `weather()`
- ✅ Default behavior: `weather()` still works
- ✅ Custom formats: All existing format strings still work
- ✅ Settings: `weatherFormat` setting still respected
- ✅ All old placeholders still work (backward compatible)

### What Was Removed
- ❌ Nothing! Full backward compatibility maintained
- ❌ The separate `getWeather()` function (was never documented)

---

## Testing Recommendations

Before publishing documentation updates, test:

1. **Backward compatibility:**
   - `<%- weather() %>`
   - `<%- weather(':icon: :description: :mintempC:-:maxtempC:°C') %>`

2. **New features:**
   - `<%- weather('', 'imperial', 40.7128, -74.0060) %>`
   - `<% const data = await weather(':raw:') %>`
   - New placeholders: `:temperature:`, `:uvIndex:`, `:sunrise:`

3. **Settings integration:**
   - Verify `weatherFormat` setting still works when no format provided

---

## Files Changed (For Reference)

- `lib/support/modules/notePlanWeather.js` - New implementation
- `lib/support/modules/weather.js` - Deprecated (kept for reference)
- `lib/support/modules/weatherSummary.js` - Deprecated (kept for reference)
- `lib/globals.js` - Updated `weather()` function
- `lib/support/modules/WebModule.js` - Updated web module
- `lib/TemplatingEngine.js` - Updated templating engine
- `src/Templating.js` - Updated command handler

