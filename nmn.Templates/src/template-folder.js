// @flow

import { chooseOption, showMessage } from '../../nmn.sweep/src/userInput'

const staticTemplateFolder = '📋 Templates'

export function getTemplateFolder(): ?string {
  return DataStore.folders.find((f) => f.includes(staticTemplateFolder))
}

export async function makeTemplateFolder(): Promise<void> {
  let folder = getTemplateFolder()

  if (folder == null) {
    const shouldCreateFolder = await chooseOption<boolean, boolean>(
      'No templates folder found.',
      [
        {
          label: `✅ Create ${staticTemplateFolder} with samples`,
          value: true,
        },
        {
          label: '❌ Cancel',
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

    await showMessage(`"${staticTemplateFolder}" folder created with samples `)
  }
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

You can one of the following languages for your configuration:

**javascript**: Actually, *[JSON5](https://json5.org)*. If you write a codeblock tagged as javascript, \
make sure you write valid JSON5. Anything else will cause an error.
**json**: If you don't mind losing the ability to write comments etc, you can use regular JSON as well.
**yaml**: If you prefer the syntax of YAML, that is supported too.
**ini**: If you would like to use the TOML format, mark your codeblock with \`ini\` and it will \
be treated as TOML.

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

If you prefer YAML format, delete the code-block above and edit this one instead:

\`\`\`yaml
---
# configuration for dates, heavily based on javascript's Intl module
# https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat
date:
  # Default timezone for date and time.
  timezone: automatic
  # Default locale to format date and time.
  # e.g. en-US will result in mm/dd/yyyy, while en_GB will be dd/mm/yyyy
  locale: en-US
  # can be "short", "medium", "long" or "full"
  dateStyle: short
  # can be null (to skip time), "short", "medium", "long" or "full"
  timeStyle: short

# default values for custom tags.
# These tags cannot be functions, but you may choose to have nested objects.
# feel free to edit this value however you see fit.
tagValue:
  me:
    # Can be used as {{me.firstName}}
    firstName: John
    # Can be used as {{me.lastName}}
    lastName: Doe
  # ... add any of your own keys here
\`\`\`

If you prefer TOML instead of JSON5 or YAML, delete the two code blocks above and use this one instead:

\`\`\`ini
# configuration for dates, heavily based on javascript's Intl module
# https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat
[date]
# Default timezone for date and time.
timezone = "automatic"
# Default locale to format date and time.
# e.g. en-US will result in mm/dd/yyyy, while en_GB will be dd/mm/yyyy
locale = "en-US"
# can be "short", "medium", "long" or "full"
dateStyle = "short"
# can be null (to skip time), "short", "medium", "long" or "full"
timeStyle = "short"

# default values for custom tags.
[tagValue]
# These tags cannot be functions, but you may choose to have nested objects.
# feel free to edit this value however you see fit.

[tagValue.me]
# Can be used as {{me.firstName}}
firstName = "John"
# Can be used as {{me.lastName}}
lastName = "Doe"
\`\`\`
`

/**
 * 
 * The following should be added to the default configuration
 * once the weather function works.
 * 
 // configuration for weather data
  weather: {
    // API key for https://openweathermap.org/
    // !!REQUIRED!!
    apiKey: '... put your API key here ...',
    // Default location for weather forcast
    lattitude: 0,
    longitude: 0,
    // Default temperature unit. Can be "C" (Celcius), "K" (Kelvin) or "F" (Fahrenheit)
    unit: 'C',
    // When using a weather tag, you can customize these options.
  },
*/
