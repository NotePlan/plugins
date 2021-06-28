// @flow

import { chooseOption, showMessage } from '../../nmn.sweep/src/userInput'

const staticTemplateFolder = '📋 Templates'

export function getTemplateFolder(): ?string {
  return DataStore.folders.find((f) => f.includes(staticTemplateFolder))
}

export async function getOrMakeTemplateFolder(): Promise<?string> {
  console.log('getOrMakeTemplateFolder')
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

    const subfolder = await chooseOption<string>(
      'Select a location for the templates folder.',
      DataStore.folders.map((folder) => ({
        label: folder,
        value: folder + (folder.endsWith('/') ? '' : '/'),
      })),
      '',
    )
    folder = subfolder + staticTemplateFolder

    // Now create a sample note in that folder, then we got the folder also created
    DataStore.newNote(DAILY_NOTE_TEMPLATE, folder)
    DataStore.newNote(MEETING_NOTE_TEMPLATE, folder)
    DataStore.newNote(TAGS_TEMPLATE, folder)
    DataStore.newNote(CONFIG, folder)
    console.log(`-> "${staticTemplateFolder}" folder created with samples`)
    await showMessage(`"${staticTemplateFolder}" folder created with samples`)
    // FIXME: hopefully can remove this after API cache fix.
    await showMessage(`Please re-start command.`)
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

## Journal
`

const MEETING_NOTE_TEMPLATE = `Meeting Note Template
---
## Project X Meeting on [[date]] with @Y and @Z

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

This file is used to configure how templates work. \
Use the code fence below to set global values for template tags.

To write your configuration you can use JSON5. JSON5 is a human-friendly
superset of JSON that lets you write comments, unquoted keys and other common
patterns available in Javscript.

Just use the codeblock marked as \`javascript\` shown below to write your own
custom configurayion.

The first code-block within the note will always be used. So edit the default configuration below:

\`\`\`javascript
{
  // Even though it says, "javacsript" above, this actually just JSON5.

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

  // configuration for weather data
  weather: {
    // API key for https://openweathermap.org/
    // !!REQUIRED!!
    openWeatherAPIKey: '... put your API key here ...',
    // Default location for weather forcast
    latPosition: 0.0,
    longPosition: 0.0,
    // Default units. Can be 'metric' (for Celsius), or 'metric' (for Fahrenheit)
    openWeatherUnits: 'metric',
    // When using a weather tag, you can customize these options.
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
