---
title: Weather 5-Day (with AI translation)
step1: go to OpenWeatherMap and sign up for a free account https://home.openweathermap.org/users/sign_up
step2: get an API KEY https://home.openweathermap.org/api_keys and paste it next to where it says API_KEY
step3: find the lat/long for your location by going to google maps https://www.google.com/maps, searching for an address and then right-clicking that address on a map. Insert your the latitude (the first number) and longitude (the second number) below
step4: set what type of units you want your result returned in - metric (for °C) or imperial (for °F)
API_KEY: xxxxxxxxxxxx
LAT: 49.7586
LONG: 9.5129
UNITS: metric
LANGUAGE: german
type: empty-note
---
```templatejs

/*
 * The weather API returns English, so the forecast is constructed in English and then if you 
 * specify another language in the LANGUAGE field above, the weather is translated into
 * that language using NotePlan.ai
 */

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
    const u = UNITS === "imperial" ? "°F" : "°C"
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

            const forecastLine = `**${dayName}, ${day}**: ${capitalizeFirstLetterOfEachWord(description)}, ${temp}${u}, Feels like: ${feelsLike}${u}, Wind: ${windSpeed} mph`;
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

const weatherURL = `https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LONG}&units=${UNITS}&appid=${API_KEY}`;
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


const output = `## ${cityName} Weather Forecast\n${sunriseLine}\n${weatherLine}`

```
<%- /english/i.test(LANGUAGE) ? output : await NotePlan.ai(`translate this text to ${LANGUAGE}. Return the translated text, maintaining the newlines in the text.\n\n${output}`) %>

## Wertheim am Main Weather Forecast
**Sunrise:** 7:30 AM, **Sunset:** 5:41 PM
**Sunday, 2025-02-16**: Clear Sky, -1°C, Feels like: -5°C, Wind: 4 mph
**Monday, 2025-02-17**: Clear Sky, -2°C, Feels like: -6°C, Wind: 3 mph
**Tuesday, 2025-02-18**: Clear Sky, -4°C, Feels like: -7°C, Wind: 2 mph
**Wednesday, 2025-02-19**: Clear Sky, -4°C, Feels like: -9°C, Wind: 4 mph
**Thursday, 2025-02-20**: Scattered Clouds, -3°C, Feels like: -7°C, Wind: 2 mph
**Friday, 2025-02-21**: Broken Clouds, 2°C, Feels like: 2°C, Wind: 1 mph

## Wertheim am Main Wettervorhersage
**Sonnenaufgang:** 7:30 Uhr, **Sonnenuntergang:** 17:41 Uhr
**Sonntag, 2025-02-16**: Klarer Himmel, -1°C, Gefühlte Temperatur: -5°C, Wind: 4 mph
**Montag, 2025-02-17**: Klarer Himmel, -2°C, Gefühlte Temperatur: -6°C, Wind: 3 mph
**Dienstag, 2025-02-18**: Klarer Himmel, -4°C, Gefühlte Temperatur: -7°C, Wind: 2 mph
**Mittwoch, 2025-02-19**: Klarer Himmel, -4°C, Gefühlte Temperatur: -9°C, Wind: 4 mph
**Donnerstag, 2025-02-20**: Vereinzelte Wolken, -3°C, Gefühlte Temperatur: -7°C, Wind: 2 mph
**Freitag, 2025-02-21**: Aufgelockerte Bewölkung, 2°C, Gefühlte Temperatur: 2°C, Wind: 1 mph

## Prévisions météorologiques pour Wertheim am Main
**Lever du soleil :** 07h30, **Coucher du soleil :** 17h41  
**Dimanche, 2025-02-16** : Ciel clair, -1°C, Ressenti : -5°C, Vent : 4 mph  
**Lundi, 2025-02-17** : Ciel clair, -2°C, Ressenti : -6°C, Vent : 3 mph  
**Mardi, 2025-02-18** : Ciel clair, -4°C, Ressenti : -7°C, Vent : 2 mph  
**Mercredi, 2025-02-19** : Ciel clair, -4°C, Ressenti : -9°C, Vent : 4 mph  
**Jeudi, 2025-02-20** : Nuages dispersés, -3°C, Ressenti : -7°C, Vent : 2 mph  
**Vendredi, 2025-02-21** : Nuages fragmentés, 2°C, Ressenti : 2°C, Vent : 1 mph
