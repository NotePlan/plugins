---
title: Weather 5-Day (dbw key - Germany)
step1: go to OpenWeatherMap and sign up for a free account https://home.openweathermap.org/users/sign_up
step2: get an API KEY https://home.openweathermap.org/api_keys and paste it below after where it says API_KEY
step3: find the lat/long for your location by going to google maps https://www.google.com/maps, searching for an address and then right-clicking that address on a map. Insert your the latitude (the first number) and longitude (the second number) below
step4: set what type of units you want your result returned in - metric (for °C) or imperial (for °F)
API_KEY: 11634c5bc8f3ac1841442085146b969a
LAT: 49.7586
LONG: 9.5129
UNITS: metric
LANGUAGE: german
type: empty-note
---
```templatejs
/**
 * Adjusts a timestamp by a given timezone offset.
 * @param {number} timestamp - The original timestamp in seconds.
 * @param {number} timezoneOffset - The timezone offset in seconds.
 * @returns {Date} The adjusted Date object.
 */
function adjustTimestampByTimezone(timestamp, timezoneOffset) {
    const localTimestamp = timestamp + timezoneOffset;
    return new Date(localTimestamp * 1000);
}

/**
 * Gets the day of the week for a given Date object.
 * @param {Date} date - The Date object.
 * @returns {string} The name of the day of the week.
 */
function getDayOfWeek(date) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[date.getUTCDay()];
}

/**
 * Capitalizes the first letter of each word in a given string.
 * @param {string} str - The input string.
 * @returns {string} The string with each word's first letter capitalized.
 */
function capitalizeFirstLetterOfEachWord(str) {
    return str.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Converts a Unix timestamp to a local time string (HH:MM AM/PM).
 * @param {number} timestamp - The Unix timestamp in seconds.
 * @param {number} timezoneOffset - The timezone offset in seconds.
 * @returns {string} The local time in HH:MM AM/PM format.
 */
function getLocalTimeFromTimestamp(timestamp, timezoneOffset) {
    const localTimestamp = timestamp + timezoneOffset;
    const date = new Date(localTimestamp * 1000);
    let hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Simple template localization helper.
 * Replaces placeholders of the form {key} in the template with values from data.
 * @param {string} template - The template string.
 * @param {Object} data - An object containing keys and their replacement values.
 * @returns {string} The localized string.
 */
function localize(template, data) {
    return template.replace(/{([^}]+)}/g, (_, key) => data[key] !== undefined ? data[key] : '');
}

/**
 * Lookup table for localized strings.
 */
const translations = {
    english: {
        forecast: '**{dayName}, {day}**: {description}, {temp}°F, Feels like: {feelsLike}°F, Wind: {windSpeed} mph',
        sunTimes: '**Sunrise:** {sunrise}, **Sunset:** {sunset}'
    },
    german: {
        forecast: '**{dayName}, {day}**: {description}, {temp}°F, Fühlt sich an wie: {feelsLike}°F, Wind: {windSpeed} mph',
        sunTimes: '**Sonnenaufgang:** {sunrise}, **Sonnenuntergang:** {sunset}'
    },
    french: {
        forecast: '**{dayName}, {day}**: {description}, {temp}°F, Ressenti: {feelsLike}°F, Vent: {windSpeed} mph',
        sunTimes: '**Lever du soleil:** {sunrise}, **Coucher du soleil:** {sunset}'
    }
};

/**
 * Generates a 5-day weather forecast from the given weather data.
 * @param {Object} weatherData - The JSON response from the weather API.
 * @returns {string} A formatted 5-day weather forecast.
 */
function generateWeatherForecast(weatherData) {
    const forecastLines = [];
    const daysProcessed = new Set();

    weatherData.list.forEach((entry) => {
        const date = adjustTimestampByTimezone(entry.dt, weatherData.city.timezone);
        const dayName = getDayOfWeek(date);
        const day = date.toISOString().split('T')[0]; // Extract the date part

        if (!daysProcessed.has(day)) {
            const temp = Math.round(entry.main.temp);
            const feelsLike = Math.round(entry.main.feels_like);
            const description = capitalizeFirstLetterOfEachWord(entry.weather[0].description);
            const windSpeed = Math.round(entry.wind.speed);

            // Use the localized forecast template
            const forecastTemplate = translations[LANGUAGE].forecast;
            const forecastLine = localize(forecastTemplate, {
                dayName,
                day,
                description,
                temp,
                feelsLike,
                windSpeed
            });

            forecastLines.push(forecastLine);
            daysProcessed.add(day);
        }

        // Stop after processing 5 days
        if (daysProcessed.size >= 5) {
            return;
        }
    });

    return forecastLines.join('\n');
}

// Build the weather URL from externally set all-caps variables.
const weatherURL = `https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LONG}&units=${UNITS}&appid=${API_KEY}`;
console.log(`Weather Calling: "${weatherURL}"`);

const jsonIn = await fetch(weatherURL);
const weatherData = JSON.parse(jsonIn);

if (!weatherData || !weatherData.list) {
    return `Error received from server: ${weatherData.message}`;
}

clo(weatherData, 'Template weatherData');

const cityName = weatherData.city?.name || '';
const weatherLine = generateWeatherForecast(weatherData);

const sunriseTimestamp = weatherData.city.sunrise;
const sunsetTimestamp = weatherData.city.sunset;
const timezoneOffset = weatherData.city.timezone;

// Use the localized sunrise/sunset template.
const sunTimesTemplate = translations[LANGUAGE].sunTimes;
const sunriseLine = localize(sunTimesTemplate, {
    sunrise: getLocalTimeFromTimestamp(sunriseTimestamp, timezoneOffset),
    sunset: getLocalTimeFromTimestamp(sunsetTimestamp, timezoneOffset)
});

```
## <%- cityName %> Weather Forecast
<%- sunriseLine %>
<%- weatherLine %>


## Wertheim am Main Weather Forecast
**Sonnenaufgang:** 7:30 AM, **Sonnenuntergang:** 5:41 PM
**Sunday, 2025-02-16**: Scattered Clouds, -2°F, Fühlt sich an wie: -6°F, Wind: 4 mph
**Monday, 2025-02-17**: Scattered Clouds, -3°F, Fühlt sich an wie: -7°F, Wind: 3 mph
**Tuesday, 2025-02-18**: Clear Sky, -4°F, Fühlt sich an wie: -7°F, Wind: 2 mph
**Wednesday, 2025-02-19**: Clear Sky, -4°F, Fühlt sich an wie: -9°F, Wind: 4 mph
**Thursday, 2025-02-20**: Scattered Clouds, -3°F, Fühlt sich an wie: -7°F, Wind: 2 mph
**Friday, 2025-02-21**: Broken Clouds, 2°F, Fühlt sich an wie: 2°F, Wind: 1 mph


