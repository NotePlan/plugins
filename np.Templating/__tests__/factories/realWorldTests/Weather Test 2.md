---
title: Weather Test
step1: go to OpenWeatherMap and sign up for a free account https://home.openweathermap.org/users/sign_up
step2: get an API KEY https://home.openweathermap.org/api_keys and paste it below after where it says API_KEY
step3: find the lat/long for your location by going to google maps https://www.google.com/maps, searching for an address and then right-clicking that address on a map. Insert your the latitude (the first number) and longitude (the second number) below
step4: set what type of units you want your result returned in - metric (for °C) or imperial (for °F)
API_KEY: xxxxxxxxxxxxxxxxxx
LAT: 40.662102
LONG: -73.955223
UNITS: imperial
type: ignore
---
```javascript
const weatherURL = `https://api.openweathermap.org/data/2.5/onecall?lat=${encodeURIComponent(LAT)}&lon=${encodeURIComponent(LONG)}&exclude=current,hourly,minutely&units=${encodeURIComponent(UNITS)}&appid=${encodeURIComponent(API_KEY)}`; 
// console.log(`Weather Calling: "${weatherURL}"`);

const jsonIn = await fetch(weatherURL);
const weatherObj = JSON.parse(jsonIn);
if (!weatherObj.daily) return `Error received from server: ${weatherObj.message}`;
// console.log(JSON.stringify(weatherObj,null,2))
const weatherTodayAll = weatherObj.daily['0'];
const fMax = weatherTodayAll.feels_like.day.toFixed(0);
const fMin = weatherTodayAll.feels_like.night.toFixed(0);
const minTemp = weatherTodayAll.temp.min.toFixed(0);
const maxTemp = weatherTodayAll.temp.max.toFixed(0);
const weatherDesc = weatherTodayAll.weather['0'].description ?? '';
const units = UNITS === 'imperial' ? '°F' : '°C';
const timezone = weatherObj;
const weatherLine = `Weather: ${weatherDesc} ${minTemp}${units}-${maxTemp}${units}; Feels like: ${fMin}${units}-${fMax}${units}`;
```
<%- weatherLine %>
