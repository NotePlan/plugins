# CHANGELOG

### v0.8.0 @dwertheimer
- Bringing back the OG /dayStart as /todayStart ;) 

### v0.7.1, 7.8.2021
- now supporting macOS back to v10.13

### v0.7.0, 6.8.2021
- the commands now work on whatever daily calendar note is open, not only on today's note

### v0.6.9, 30.7.2021 @dwertheimer
- changes to weather() template macro to add more fields and use string replacements

### v0.6.8, 28.7.2021
- under-the-hood changes responding to underlying API and framework changes

### v0.6.7, 8.7.2021
- add ability to check for `<number>` as well as `<int>` values in daily review questions

### v0.6.6, 6.7.2021
- on first use it now offers to populate default configuration (as shown above) into the _configuration file
- more informative pop ups as it works

### v0.6.4, 29.6.2021
- internal code changes only, responding to other plugins' changes

### v0.6.2, 12.6.2021 -- includes **BREAKING CHANGES**
- now `/dayStart` calls the Templates plugin to apply the `Daily Note Template` template. To include a weather forecast, now include the `{{weather()}}` tag in that template, and configure the OpenWeather calls as described in the `Templates/_configuration` file. 
- now `/dayReview` also uses the `Templates/_configuration` file to get settings for this command.

### v0.5.0, 27.5.2021
- change: use Template system (from '**NoteHelpers**' plugin) to provide the `Daily Note Template`. This template title defaults to 'Daily Note Template', but can be configured in `pref_templateText ` (as above).
- update code to use newer NotePlan APIs

### v0.4.1, 16.5.2021
- add this README.md

### v0.4.0, 24.4.2021
- first main release
