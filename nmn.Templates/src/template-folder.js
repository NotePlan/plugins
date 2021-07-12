// @flow

import { chooseOption, showMessage } from '../../helperFunctions'

const staticTemplateFolder = '📋 Templates'

export function getTemplateFolder(): ?string {
  return DataStore.folders.find((f) => f.includes(staticTemplateFolder))
}

// get the template folder path, without leading '/'
// if it doesn't exist, offer to create it and populate it with samples
export async function getOrMakeTemplateFolder(): Promise<?string> {
  console.log('  getOrMakeTemplateFolder start')
  let folder = getTemplateFolder()

  if (folder == null) {
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

This file is used to configure how templates work. 
Use the code fence below (which comes after a line made by 3 dashes)
to set global values for template tags.

To write your configuration you can use JSON5. JSON5 is a human-friendly
superset of JSON that lets you write comments, unquoted keys and other common
patterns available in Javscript.
(NB: even JSON5 doesn't fully support multi-line strings, so to include
them you need to use "\n" for linebreaks rather than actual linebreaks.)

Just use the codeblock marked as \`javascript\` shown below to write your own
custom configurayion.

The *first* code-block within the note will always be used. So edit the default configuration below:

IMPORTANT: The configuration code blocks below are validated in realtime by Noteplan as you edit. 
If the configuration passes the validation, you will see configuration settings in color (e.g. orange, 
green, purple, black, etc.). If there is a mistake in your configuration settings, the configuration
settings below will all be black. If you have a quoted "string" that you want to have a line break
in it, insert a "\n" where you want the line break, e.g. "This\nIs\nThreelines"

\`\`\`javascript
{
  // Even though it says, "javascript" above, this is actually JSON5.

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
