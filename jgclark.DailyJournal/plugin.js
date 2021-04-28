//--------------------------------------------------------------------------------------------------------------------
// Daily Journal plugin for NotePlan
// Jonathan Clark
// v0.4.0, 24.4.2021
//--------------------------------------------------------------------------------------------------------------------

// Settings
// Items that should come from the Preference framework in time:
var pref_templateText = "\n### Media\n\n### Journal\n"
var pref_reviewSectionHeading = "Journal"
var pref_reviewQuestions = "@work(<int>)\n@fruitveg(<int>)\nMood:: <mood>\nGratitude:: <string>\nGod was:: <string>\nAlive:: <string>\nNot Great:: <string>\nWife:: <string>\nRemember:: <string>"
var pref_mood = "🤩 Great,🙂 Good,😇 Blessed,🥱 Tired,😫 Stressed,😤 Frustrated,😔 Low,🥵 Sick,Other"
var pref_moodArray = pref_mood.split(",")
// Leave following blank if don't want to get weather
var pref_openWeatherAPIKey = "b8041917d91a7e0e1418485bbd3f1b1f" // need to get your own  API key: don't use mine!
var pref_latPosition = "51.3"
var pref_longPosition = "-1"
var pref_openWeatherUnits = "metric"

// Globals
var todaysDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')

//------------------------------------------------------------------
// Start today's daily note with a template, including local weather lookup
async function dayStart() {
  console.log("\ndayStart for " + todaysDate)
  await Editor.openNoteByDate(new Date(), false) // open today's date in the main window
  var existingContent = Editor.content
  console.log("\tbefore: " + existingContent.length + " bytes")
  var newContent = existingContent + "\n" + pref_templateText + "\n" // WAITING: Plugin.preference.template_text
  if (pref_openWeatherAPIKey != "") {
    var getWeatherURL = "https://api.openweathermap.org/data/2.5/onecall?lat=" + pref_latPosition + "&lon=" + pref_longPosition + "&exclude=current,hourly,minutely&units=" + pref_openWeatherUnits + "&appid=" + pref_openWeatherAPIKey
    fetch(getWeatherURL)
      .then(jsonIn => {
        var weatherTodayAll = (JSON.parse(jsonIn)).daily["0"]
        var maxTemp = weatherTodayAll.feels_like.day.toFixed(0)
        var minTemp = weatherTodayAll.feels_like.night.toFixed(0)
        var weatherDesc = weatherTodayAll.weather["0"].description
        var weatherLine = "Weather:: " + maxTemp + "/" + minTemp + " " + weatherDesc
        console.log("Weather summary: " + weatherLine)
        Editor.content = newContent + weatherLine
        console.log("\tafter: " + newContent.length + " bytes")
      })
      .catch(e => {
        console.log("\tHTTP lookup error: " + e)
      })
  } else {
    Editor.content = newContent
    console.log("\tafter: " + newContent.length + " bytes")
  }
}

//TODO use in the above ------------------------------------------------------------------
// Get summary of today's weather in a line
// Using https://openweathermap.org/api/one-call-api#data, for which you can get a free API key
function getWeatherSummary() {
  var getWeatherURL = "https://api.openweathermap.org/data/2.5/onecall?lat=" + pref_latPosition + "&lon=" + pref_longPosition + "&exclude=current,hourly,minutely&units=" + pref_openWeatherUnits + "&appid=" + pref_openWeatherAPIKey
  fetch(getWeatherURL)
    .then(jsonIn => {
      var weatherTodayAll = (JSON.parse(jsonIn)).daily["0"]
      var maxTemp = weatherTodayAll.feels_like.day.toFixed(0)
      var minTemp = weatherTodayAll.feels_like.night.toFixed(0)
      var weatherDesc = weatherTodayAll.weather["0"].description
      var summaryLine = "Weather:: " + maxTemp + "/" + minTemp + " " + weatherDesc
      console.log("Weather summary: " + summaryLine)
      return summaryLine
    })
    .catch(e => {
      console.log("\tHTTP lookup error: " + e)
    })
}


//------------------------------------------------------------------
// Helper function to test for integer
// taken from https://stackoverflow.com/questions/14636536/how-to-check-if-a-variable-is-an-integer-in-javascript
function isInt(value) {
  var x = parseFloat(value);
  return !isNaN(value) && (x | 0) === x;
}

//------------------------------------------------------------------
// Gather answers to set questions, and append to 
async function dayReview() {
  console.log("\ndailyReview for " + todaysDate)
  Editor.openNoteByDate(new Date()) // open today's date in main window

  var questionsString = pref_reviewQuestions // Plugin.preference.review_questions
  var question = []
  var questionType = []
  var output = ""
  var i = 0

  // Parse preference string to make array of questions and input types
  var typeRE = new RegExp('<(.*)>')
  var questionLine = questionsString.split("\n")
  var numQs = questionLine.length
  console.log("\tFound " + numQs + " question lines")
  for (i = 0; i < numQs; i++) {
    // remove type indicators from the question string
    question[i] = questionLine[i].replace(/:|\(|\)|<string>|<int>|<mood>/g, '').trim()
    reArray = questionLine[i].match(typeRE)
    questionType[i] = reArray[1]
    // console.log("\t" + i + ": " + question[i] + " / " + questionType[i])
  }
  // Ask each question in turn
  for (i = 0; i < numQs; i++) {
    // Each question type is handled slightly differently, but in all cases a blank
    // or invalid answer means the question is ignored.
    var reviewLine = ""
    console.log("\t" + i + ": " + question[i] + " / " + questionType[i])
    switch (questionType[i]) {
      case "int":
        var reply = await CommandBar.showInput(questionType[i], question[i] + ": %@")
        if (reply != undefined && isInt(reply)) {
          // console.log(reply)
          reviewLine = questionLine[i].replace(/<int>/, reply)
        } else {
          console.log("\tERROR trying to get integer answer for question '"+question[i]+"'")
        }
        break
      case "string":
        var replyString = await CommandBar.showInput(questionType[i], question[i] + ": %@")
        if (replyString != undefined) {
          // console.log(replyString)
          reviewLine = (replyString != "") ? questionLine[i].replace(/<string>/, replyString) : ""
        } else {
          console.log("\tERROR trying to get string answer for question '"+question[i]+"'")
        }
        break
      case "mood":
        var reply = await CommandBar.showOptions(pref_moodArray, "Choose appropriate mood")
        var replyMood = pref_moodArray[reply.index]
        if (replyMood != undefined && replyMood != "") {
          // console.log(replyMood)
          reviewLine = questionLine[i].replace(/<mood>/, replyMood)
        } else {
          console.log("\tERROR trying to get mood answer")
        }
        break
    }
    // console.log("\tAnswer to '" + question[i] + "' = " + reviewLine[i])
    if (reviewLine != "") {
      output += reviewLine + "\n"
    }
  }

  // add the finished review text to the current daily note,
  // appending after the line found in pref_reviewSectionHeading. 
  // If this doesn't exist, then append it first.
  console.log("Appending to heading '" + pref_reviewSectionHeading + "' the text:" + output) 
  Editor.note.addParagraphBelowHeadingTitle(output, "", pref_reviewSectionHeading, true, true)
}
