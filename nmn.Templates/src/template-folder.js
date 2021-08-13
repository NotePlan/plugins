// @flow

import { chooseOption, showMessage } from '../../helperFunctions'

const staticTemplateFolder = '📋 Templates'

/**
 * Get the Templates folder path, if it exists
 * @author @nmn
 * @return { ?string } - folder pathname
 */
export function getTemplateFolder(): ?string {
  return DataStore.folders.find((f) => f.includes(staticTemplateFolder))
}

/**
 * Write out a new _configuration file
 * @author @jgclark
 */
export function createDefaultConfigNote(): void {
  const folder = getTemplateFolder()
  if (folder != null) {
    DataStore.newNote(CONFIG, folder)
  }
}

/**
 * Get the Templates folder path, without leading '/'
 * If it doesn't exist, offer to create it and populate it with samples
 * @author @nmn
 * @return { ?string } - relative folder pathname (without leading '/')
 */
export async function getOrMakeTemplateFolder(): Promise<?string> {
  // console.log('  getOrMakeTemplateFolder start')
  let folder = getTemplateFolder()

  if (folder == null) {
    console.log('  getOrMakeTemplateFolder: no folder found')
    // No template folder yet, so offer to make it and populate it
    const shouldCreateFolder = await chooseOption<boolean, boolean>(
      'No templates folder found.',
      [
        {
          label: `✅ Create ${staticTemplateFolder} with samples`,
          value: true,
        },
        {
          label: '❌ Cancel command',
          value: false,
        },
      ],
      false,
    )

    if (!shouldCreateFolder) {
      return
    }

    const subFolder = await chooseOption<string>(
      'Select a location for the templates folder.',
      DataStore.folders.map((folder) => ({
        label: folder,
        value: folder + (folder.endsWith('/') ? '' : '/'), // ensure ends with '/'
      })),
      '',
    )
    folder = subFolder + staticTemplateFolder

    // Now create a sample note in that folder, then we got the folder also created
    DataStore.newNote(DAILY_NOTE_TEMPLATE, folder)
    DataStore.newNote(MEETING_NOTE_TEMPLATE, folder)
    DataStore.newNote(TAGS_TEMPLATE, folder)
    DataStore.newNote(CONFIG, folder)
    // for 'folder' to be useful straight away we need to strip off any leading '/'
    folder = folder.startsWith('/') ? folder.slice(1) : folder
    console.log(`-> "${folder}" folder created with samples`)
    await showMessage(`"${folder}" folder created with samples`)
  }
  return folder
}

/*

DEFAULT TEMPLATE NOTES FOLLOW

*/

const DAILY_NOTE_TEMPLATE = `Daily Note Template
---
## Tasks

## Media
> {{quote()}}

## Journal
Weather: {{weather()}}
`

const MEETING_NOTE_TEMPLATE = `Meeting Note Template
---
## Project X Meeting on [[{{date-as-YYYY-MM-DD}}]] with {{people list}}

## Notes

## Actions
`

const TAGS_TEMPLATE = `Tags Template
---
# {{title}}

Created on {{date({locale: 'en-US', dateStyle: 'short'})}}
`

const CONFIG = ` _configuration
---
# Template Tag Configuration

This note provides a central location where you can configure various plugin options:

- Use the fenced code block below (which comes after a line made by 3 dashes) to customize global values for the various template tags.

- NotePlan plugin configuration uses JSON5 [JSON5 | JSON for Humans](https://json5.org/), which is a human-friendly superset of JSON, providing things such as comments, unquoted keys and other common patterns available in standard JavaScript objects.

	*Note: Despite JSON5 enhancements, multi-line strings are not supported, therefore to include*
	*them you need to use "\n" (new line) for line breaks rather than actual line breaks.*

- Use the code block marked as \`javascript\` shown below to write your own custom custom configurations.

While it is possible to have multiple \`javascript\` code blocks in this document, only the **first** code block will be used.

## Validating Configuration
The configuration code blocks below are validated in **realtime** by NotePlan as you edit:

- If there is a configuration mistake, all code below will all be a single color (based on theme).
- If the configuration passes the validation, you will see configuration settings will be formatted based on your current theme (e.g., orange, green, purple, black, etc.).

**TIP:** If your configuration is invalid, you can copy/paste the configuration block to [JSON5 Validator Online - JSON5 lint Tool to validate JSON5 data](https://codebeautify.org/json5-validator) which will provide details about the error(s) in your code block, indicating which line(s) contain the error(s).

### Line Breaks
If you have a quoted "string" which you want to have a line break, insert a "\n" where you want the line break, e.g., "This\nIs\nThreelines"

### Reporting Plugin Issues
Should you run into an issue with a NotePlan plugin, you can use one of the following methods (in order of priority)

🐞 [NotePlan Plugin Issues](https://github.com/NotePlan/plugins/issues/new/choose)
🧩 [Discord](https://discord.com/channels/763107030223290449/784376250771832843)
📪 [NotePlan Support](hello@noteplan.io)
*****
## Plugin Configuration
*Note: While the following code block is marked as \`javascript\` it is actually \`JSON5\` and is only marked as \`javascript\` so that your theme will provide the appropriate syntax highlighting.*

\`\`\`javascript

{
  // Note Even though it is fenced as "javascript", this configuration is actually JSON5.

  // configuration for dates, heavily based on javascript's Intl module
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat

  date: {
    // Default timezone for date and time.
    timezone: 'automatic',
    // Default locale to format date and time.
    // e.g. en-US will result in mm/dd/yyyy, while en_GB will be dd/mm/yyyy
    locale: 'en-US',
    // can be "short", "medium", "long" or "full"
    dateStyle: 'short',
    // optional key, can be "short", "medium", "long" or "full"
    timeStyle: 'short',
  },


  // configuration for weather data (used in Daily Note Template, for example)
  weather: {
    // API key for https://openweathermap.org/
    // !!REQUIRED!!
    openWeatherAPIKey: '... put your API key here ...',
    // Required location for weather forecast
    latPosition: 0.0,
    longPosition: 0.0,
    // Default units. Can be 'metric' (for Celsius), or 'metric' (for Fahrenheit)
    openWeatherUnits: 'metric',
  },


  // configuration for daily quote (used in Daily Note Template, for example)
  quote: {
    // Available modes: [random (default), today, author]
    mode: 'today',
    // API key required, available authors: https://premium.zenquotes.io/available-authors/
    author: 'anne-frank',
    // Required for mode: 'author' (from https://premium.zenquotes.io/)
    apiKey: '... put your API key here ...',
  },


  // default values for custom tags.
  // These tags cannot be functions, but you may choose to have nested objects.
  // feel free to edit this value however you see fit.
  tagValue: {
    me: {
      // Can be used as {{me.firstName}}
      firstName: 'John',
      // Can be used as {{me.lastName}}
      lastName: 'Doe',
    }
    // ...
  },
}

\`\`\`

`
