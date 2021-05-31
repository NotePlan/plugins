//--------------------------------------------------------------------------------------------------------------------
// Daily Journal plugin for NotePlan
// Jonathan Clark
// v0.5.0, 27.5.2021
//--------------------------------------------------------------------------------------------------------------------

// Title of template note to use as Daily template
const pref_templateTitle = 'Daily Note Template'
// Settings that should come from the Preference framework in time:
const pref_reviewSectionHeading = 'Journal'
const pref_reviewQuestions = [
  '@work(<int>)',
  '@fruitveg(<int>)',
  'Mood:: <mood>',
  'Gratitude:: <string>',
  'God was:: <string>',
  'Alive:: <string>',
  'Not Great:: <string>',
  'Wife:: <string>',
  'Remember:: <string>',
].join('\n')

const pref_moods = [
  '🤩 Great',
  '🙂 Good',
  '😇 Blessed',
  '🥱 Tired',
  '😫 Stressed',
  '😤 Frustrated',
  '😡 Angry',
  '😔 Low',
  '🥵 Sick',
  'Other',
].join(',')

// Leave following as empty strings ('') if you don't want to get weather from openweathermap.org
const pref_openWeatherAPIKey = 'b8041917d91a7e0e1418485bbd3f1b1f' // need to get your own  API key: don't use mine!
const pref_latPosition = '51.3' // need to use your own latitude!
const pref_longPosition = '-1' // need to use your own longitude!
const pref_openWeatherUnits = 'metric'

// Globals
const staticTemplateFolder = '📋 Templates'
const todaysDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const pref_moodArray = pref_moods.split(',') // with a proper config system, this won't be needed

//------------------------------------------------------------------
// Helper functions

function templateFolder() {
  return DataStore.folders.find((f) => f.includes(staticTemplateFolder))
}

async function getTemplateContent(templateTitle) {
  const folder = templateFolder()
  if (folder == null) {
    // template folder not found
    console.log("Error: Failed to find the '📋 Templates' folder")
    return
  }

  // Get list of templates from its folder
  const templateNotes = DataStore.projectNotes.filter((n) =>
    n.filename.includes(folder),
  )
  const templateNote = templateNotes.find(
    (note) => note.title === templateTitle,
  )
  // Now cut out everything above "---" (second line), which is there so we can have a more meaningful title for the template note
  if (templateNote != null) {
    const lines = [...templateNote.paragraphs]

    if (lines.length > 0 && lines[1].content == '---') {
      lines.splice(1, 1)
      lines.splice(0, 1)
    }

    return lines.map((l) => l.rawContent).join('\n')
  } else {
    console.log(
      "Error: Failed to get template note '" +
        templateTitle +
        "' from the index",
    )
  }
}

// Get summary of today's weather in a line
// Using https://openweathermap.org/api/one-call-api#data, for which you can get a free API key
async function getWeatherSummary() {
  const getWeatherURL =
    'https://api.openweathermap.org/data/2.5/onecall?lat=' +
    pref_latPosition +
    '&lon=' +
    pref_longPosition +
    '&exclude=current,hourly,minutely&units=' +
    pref_openWeatherUnits +
    '&appid=' +
    pref_openWeatherAPIKey

  // TODO: add icons, according to returned description. Main terms are:
  // thunderstorm, drizzle, shower > rain, snow, sleet, clear sky, mist, fog, dust, tornado, overcast > clouds
  // with 'light' modifier for rain and snow
  // const weatherDescIcons = [
  //   "Rain 🌧️",
  //   "Rain & Showers 🌦️",
  //   "Sunny intervals 🌤",
  //   "Partly sunny ⛅",
  //   "Sunny ☀️",
  //   "Snow 🌨️",
  //   "Thunderstorm ⛈",
  //   "Tornado 🌪",
  // ].join(",");

  const jsonIn = await fetch(getWeatherURL)
  const weatherTodayAll = JSON.parse(jsonIn).daily['0']
  const maxTemp = weatherTodayAll.feels_like.day.toFixed(0)
  const minTemp = weatherTodayAll.feels_like.night.toFixed(0)
  const weatherDesc = weatherTodayAll.weather['0'].description
  const summaryLine = 'Weather: ' + maxTemp + '/' + minTemp + ' ' + weatherDesc
  console.log('Weather summary: ' + summaryLine)
  return summaryLine
}

//------------------------------------------------------------------
// Start today's daily note with a template, including local weather lookup if configured
async function dayStart() {
  console.log('\ndayStart for ' + todaysDate)

  // open today's date in the main window, and read content
  await Editor.openNoteByDate(new Date(), false)
  // const existingContent = Editor.content;

  // get daily template's content
  const templateText = await getTemplateContent(pref_templateTitle)
  console.log("\tRead template text from Template '" + pref_templateTitle + "'")
  let newContent = templateText + '\n'
  if (pref_openWeatherAPIKey != '') {
    const weatherLine = await getWeatherSummary()
    newContent += weatherLine + '\n'
  }
  Editor.insertParagraph(newContent, 0, 'empty')
}

//------------------------------------------------------------------
// Helper function to test for integer
// taken from https://stackoverflow.com/questions/14636536/how-to-check-if-a-variable-is-an-integer-in-javascript
function isInt(value) {
  const x = parseFloat(value)
  return !isNaN(value) && (x | 0) === x
}

//------------------------------------------------------------------
// Gather answers to set questions, and append to the daily note
// TODO: use NP API function calls which are now available
async function dayReview() {
  console.log('\ndailyReview for ' + todaysDate)
  Editor.openNoteByDate(new Date()) // open today's date in main window

  const questionsString = pref_reviewQuestions // Plugin.preference.review_questions
  const question = []
  const questionType = []
  let output = ''
  let i = 0

  // Parse preference string to make array of questions and input types
  const typeRE = new RegExp('<(.*)>')
  const questionLine = questionsString.split('\n')
  const numQs = questionLine.length
  console.log('\tFound ' + numQs + ' question lines')
  for (i = 0; i < numQs; i++) {
    // remove type indicators from the question string
    question[i] = questionLine[i]
      .replace(/:|\(|\)|<string>|<int>|<mood>/g, '')
      .trim()
    const reArray = questionLine[i].match(typeRE)
    questionType[i] = reArray[1]
    // console.log("\t" + i + ": " + question[i] + " / " + questionType[i])
  }
  // Ask each question in turn
  for (i = 0; i < numQs; i++) {
    // Each question type is handled slightly differently, but in all cases a blank
    // or invalid answer means the question is ignored.
    let reviewLine = ''
    console.log('\t' + i + ': ' + question[i] + ' / ' + questionType[i])
    switch (questionType[i]) {
      case 'int': {
        const reply = await CommandBar.showInput(
          questionType[i],
          question[i] + ': %@',
        )
        if (reply != undefined && isInt(reply)) {
          // console.log(reply)
          reviewLine = questionLine[i].replace(/<int>/, reply)
        } else {
          console.log(
            "\tERROR trying to get integer answer for question '" +
              question[i] +
              "'",
          )
        }
        break
      }
      case 'string': {
        const replyString = await CommandBar.showInput(
          questionType[i],
          question[i] + ': %@',
        )
        if (replyString != undefined) {
          // console.log(replyString)
          reviewLine =
            replyString != ''
              ? questionLine[i].replace(/<string>/, replyString)
              : ''
        } else {
          console.log(
            "\tERROR trying to get string answer for question '" +
              question[i] +
              "'",
          )
        }
        break
      }
      case 'mood': {
        const reply = await CommandBar.showOptions(
          pref_moodArray,
          'Choose appropriate mood',
        )
        const replyMood = pref_moodArray[reply.index]
        if (replyMood != undefined && replyMood != '') {
          // console.log(replyMood)
          reviewLine = questionLine[i].replace(/<mood>/, replyMood)
        } else {
          console.log('\tERROR trying to get mood answer')
        }
        break
      }
    }
    // console.log("\tAnswer to '" + question[i] + "' = " + reviewLine[i])
    if (reviewLine != '') {
      output += reviewLine + '\n'
    }
  }

  // add the finished review text to the current daily note,
  // appending after the line found in pref_reviewSectionHeading.
  // If this doesn't exist, then append it first.
  console.log(
    "Appending to heading '" +
      pref_reviewSectionHeading +
      "' the text:" +
      output,
  )
  Editor.note.addParagraphBelowHeadingTitle(
    output,
    '',
    pref_reviewSectionHeading,
    true,
    true,
  )
}

globalThis.dayStart = dayStart
globalThis.getWeatherSummary = getWeatherSummary
globalThis.dayReview = dayReview
