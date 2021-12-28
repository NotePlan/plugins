const test = [
  {
    autoTimeBlocking: {
      todoChar: '-',
      timeBlockTag: '#🕑',
      timeBlockHeading: 'Time Blocks',
      workDayStart: '08:00',
      workDayEnd: '18:00',
      durationMarker: "'",
      intervalMins: 5,
      removeDuration: true,
      defaultDuration: 15,
      mode: 'PRIORITY_FIRST',
      allowEventSplits: false,
      insertIntoEditor: true,
      passBackResults: false,
      createCalendarEntries: false,
      eventEnteredOnCalTag: '#event_created',
      deletePreviousCalendarEntries: false,
      includeTasksWithText: [],
      excludeTasksWithText: [],
      presets: [
        {
          label: 'Weekend (start @10a)',
          workDayStart: '10:00',
        },
        {
          label: 'No Workday Time Limits',
          workDayStart: '00:00',
          workDayEnd: '23:59',
        },
        {
          label: 'Create Timeblocks on Calendar',
          createCalendarEntries: true,
          deletePreviousCalendarEntries: true,
        },
      ],
    },
    review: {
      folderToStore: 'Reviews',
      foldersToIgnore: ['📋 Templates', 'Reviews', 'Summaries'], // can be empty list
      noteTypeTags: ['#test', '#test1'], // array of hashtags without spaces
      displayOrder: 'alpha', // in '/project lists' the sort options  are "due" date, "review" date or "alpha"
      displayGroupedByFolder: true, // in '/project lists' whether to group the notes by folder
      displayArchivedProjects: true, // in '/project lists' whether to display project notes marked #archive
    },

    inbox: {
      inboxTitle: '📥 Inbox',
      addInboxPosition: 'append',
      textToAppendToTasks: '@review',
    },

    quickNotes: [
      {
        template: 'Title',
        label: 'Label',
        title: 'Title Meeting with {{askForName}} on {{date8601()}}',
        folder: '* 📥 Inbox',
      },
    ],

    statistics: {
      folderToStore: 'Summaries',
      hashtagCountsHeading: '#hashtag counts',
      mentionCountsHeading: '@mention counts',
      countsHeadingLevel: 3, // headings use H3 (or ...)
      showAsHashtagOrMention: true, // or false to hide # and @ characters
      // In the following the includes (if specified) takes precedence over excludes ...
      includeHashtags: [], // e.g. ['#holiday','#jog','#commute','#webinar']
      excludeHashtags: [],
      includeMentions: [], // e.g. ['@work','@fruitveg','@words']
      excludeMentions: ['@done'],
    },

    events: {
      addEventID: false, // whether to add an [[event:ID]] internal link when creating an event from a time block
      processedTagName: '#event_created', // optional tag to add after making a time block an event
      removeTimeBlocksWhenProcessed: true, // whether to remove time block after making an event from it
      eventsHeading: '### Events today', // optional heading to put before list of today's events
      addMatchingEvents: {
        // match events with string on left, and then the string on the right is the template for how to insert this event (see README for details)
        meeting: '### *|TITLE|* (*|START|*)\n*|NOTES|*',
        webinar: '### *|TITLE|* (*|START|*) *|URL|*',
        holiday: '*|TITLE|* *|NOTES|*',
      },
      locale: 'en-US',
      timeOptions: { hour: '2-digit', minute: '2-digit', hour12: false },
    },

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
      // time format when invoking dwertheimer.DateAutomations/formatted
      // see https://www.strfti.me/ to aid in creating custom formats)
      format: '%Y-%m-%d %I:%M:%S %p',
    },

    // configuration for weather data (used in Daily Note Template, for example)
    // 19a11168bcc123dc86c1b92682bfb74f
    weather: {
      // API key for https://openweathermap.org/
      // !!REQUIRED!!
      openWeatherAPIKey: '19a11168bcc123dc86c1b92682bfb74f',
      // Required location for weather forecast
      latPosition: 0.0,
      longPosition: 0.0,
      // Default units. Can be 'metric' (for Celsius), or 'imperial' (for Fahrenheit)
      openWeatherUnits: 'imperial',
    },

    // configuration for daily quote (used in Daily Note Template, for example)
    quote: {
      // Available modes: [random (default), today, author]
      mode: '',
      // API key required, available authors: https://premium.zenquotes.io/available-authors/
      author: '',
      // Required for mode: 'author' (from https://premium.zenquotes.io/)
      apiKey: '53c9ddcab1e1def708bf52ff915a1ca626c864ab',
    },

    // default values for custom tags.
    // These tags cannot be functions, but you may choose to have nested objects.
    // feel free to edit this value however you see fit.
    tagValue: {
      me: {
        // Can be used as {{me.firstName}}
        firstName: 'Mike',
        // Can be used as {{me.lastName}}
        lastName: 'Erickson',
      },
      // ...
    },

    // template variables and formats
    templates: {
      // check https://github.com/public-apis/public-apis for other services
      services: {
        // https://public-apis.io/
        apple:
          'https://api.stockdata.org/v1/data/quote?symbols=AAPL&api_token=cvQvzjIxPx9MRRq69qG7HCKi4jhAe236xIzXFbyy',
        open: 'https://api.stockdata.org/v1/data/quote?symbols=OPEN&api_token=cvQvzjIxPx9MRRq69qG7HCKi4jhAe236xIzXFbyy',
        // can also use web.affirmation()
        affirmation: 'https://affirmations.dev',
        // can also use web.advice()
        advice: 'https://api.adviceslip.com/advice',
        // can also use web.quote()
        quote: {
          url: 'https://zenquotes.io/api/random',
          keys: ['"', '[0].q', '"', ' - ', '*', '[0].a', '*'],
        },
        // can also use web.weather()
        weather: 'https://wttr.in?format=3',
        // bible with variable
        verse: {
          url: 'https://labs.bible.org/api/?passage=random&type=json',
          keys: ['> 🙏🏻 ', '[0].bookname', ' ', '[0].chapter', ':', '[0].verse', '\n> 🗣 "', '[0].text', '"'],
        },
        developerQuote: {
          url: 'https://programming-quotes-api.herokuapp.com/quotes/random',
          keys: ['"', 'en', '"', ' - ', '*', 'author', '*'],
        },
      },
      locale: '',
      defaultFormats: {
        date: 'YYYY-MM-DD',
        time: 'h:mm A',
      },
      user: {
        first: 'Mike',
        last: 'Erickson',
        email: 'codedungeon@gmail.com',
        phone: '714.454.4236',
      },
    },
  },
]
