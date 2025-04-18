---
title: Weather 5-Day (dbw key)
step1: go to OpenWeatherMap and sign up for a free account https://home.openweathermap.org/users/sign_up
step2: get an API KEY https://home.openweathermap.org/api_keys and paste it below after where it says API_KEY
step3: find the lat/long for your location by going to google maps https://www.google.com/maps, searching for an address and then right-clicking that address on a map. Insert your the latitude (the first number) and longitude (the second number) below
step4: set what type of units you want your result returned in - metric (for °C) or imperial (for °F)
API_KEY: 11634c5bc8f3ac1841442085146b969a
LAT: 34.0588
LONG: -118.4439
UNITS: imperial
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
    // Adjust the timestamp by the timezone offset
    const localTimestamp = timestamp + timezoneOffset;
    const date = new Date(localTimestamp * 1000);

    // Extract hours and minutes
    let hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'

    // Format minutes to always be two digits
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;

    return `${hours}:${minutesStr} ${ampm}`;
}

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
            const description = entry.weather[0].description;
            const windSpeed = Math.round(entry.wind.speed);
            const windDirection = entry.wind.deg;

            const forecastLine = `**${dayName}, ${day}**: ${capitalizeFirstLetterOfEachWord(description)}, ${temp}°F, Feels like: ${feelsLike}°F, Wind: ${windSpeed} mph`;
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

const weatherURL = `https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LONG}&units=imperial&appid=${API_KEY}`;
console.log(`Weather Calling: "${weatherURL}"`);

const jsonIn = await fetch(weatherURL);
const weatherData = JSON.parse(jsonIn);

if (!weatherData || !weatherData.list) return `Error received from server: ${weatherData.message}`;

clo(weatherData,`Template weatherData`);

const cityName = weatherData.city?.name || ''
const weatherLine = generateWeatherForecast(weatherData);

const sunriseTimestamp = weatherData.city.sunrise; 
const sunsetTimestamp = weatherData.city.sunset; 
const timezoneOffset = weatherData.city.timezone; 


const sunriseLine = `**Sunrise:** ${getLocalTimeFromTimestamp(sunriseTimestamp, timezoneOffset)}, **Sunset:** ${getLocalTimeFromTimestamp(sunsetTimestamp, timezoneOffset)}`

```
## <%- cityName %> Weather Forecast
<%- sunriseLine %>
<%- weatherLine %>
