//--------------------------------------------------------------------------------------------------------------------
// Daily Journal plugin for NotePlan
// Jonathan Clark
// v0.6.0, 8.6.2021
//--------------------------------------------------------------------------------------------------------------------

// Title of template note to use as Daily template
// const staticTemplateFolder = '📋 Templates';
const pref_templateTitle = 'Daily Note Template'

// Settings that should come from the Preference framework in time:
const pref_reviewSectionHeading = 'Journal'
const pref_reviewQuestions = [
  '@work(<int>)',
  '@fruitveg(<int>)',
  'Exercise:: <string>',
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


// Globals
const todaysDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const pref_moodArray = pref_moods.split(',') // with a proper config system, this won't be needed

//------------------------------------------------------------------
// Helper functions

import { applyNamedTemplate } from '../../nmn.Templates/src/index'
// import getWeatherSummary from 'weather'

// test for integer
// taken from https://stackoverflow.com/questions/14636536/how-to-check-if-a-variable-is-an-integer-in-javascript
function isInt(value) {
  const x = parseFloat(value)
  return !isNaN(value) && (x | 0) === x
}

// function templateFolder() {
//   return DataStore.folders.find((f) => f.includes(staticTemplateFolder));
// }

// async function getTemplateContent(templateTitle) {
//   const folder = templateFolder();
//   if (folder == null) {
//     // template folder not found
//         console.log("Error: Failed to find the '📋 Templates' folder");
//     return;
//   }

//   // Get list of templates from its folder
//   const templateNotes = DataStore.projectNotes.filter((n) =>
//     n.filename.includes(folder),
//   );
//   const templateNote = templateNotes.find((note) => note.title === templateTitle);
//   // Now cut out everything above "---" (second line), which is there so we can have a more meaningful title for the template note
//   if (templateNote != null) {
//     const lines = [...templateNote.paragraphs];

//     if (lines.length > 0 && lines[1].content == '---') {
//       lines.splice(1, 1);
//       lines.splice(0, 1);
//     }

//     return lines.map((l) => l.rawContent).join('\n');
//   } else {
//     console.log(`Error: Failed to get template note '${  templateTitle  }' from the index`);
//   }
// }

//------------------------------------------------------------------
// Start today's daily note with a template, including local weather lookup if configured
export async function dayStart() {
  console.log(`\ndayStart for ${  todaysDate}`)

  // open today's date in the main window, and read content
  await Editor.openNoteByDate(new Date(), false)

  // get daily template's content - NB: deprecating this in favour of newer nmn.Templates plugin
  // const templateText = await getTemplateContent(pref_templateTitle);
  // console.log(`\tRead template text from Template '${  pref_templateTitle  }'`);
  // let newContent = `${templateText  }\n`;
  
  await applyNamedTemplate(pref_templateTitle)
  // Now add the weather, if wanted
  // if (pref_openWeatherAPIKey != "") {
  //   const weatherLine = await getWeatherSummary()
  //   Editor.insertParagraph(`${weatherLine  }\n`, 0, 'empty')
  // }
}

//------------------------------------------------------------------
// Gather answers to set questions, and append to the daily note
// TODO: use NP API function calls which are now available.
// TODO: can this use nmn.Template functions at all?
export async function dayReview() {
  console.log(`\ndailyReview for ${  todaysDate}`)
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
  console.log(`\tFound ${  numQs  } question lines`)
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
    console.log(`\t${  i  }: ${  question[i]  } / ${  questionType[i]}`)
    switch (questionType[i]) {
      case 'int': {
        const reply = await CommandBar.showInput(
          questionType[i],
          `${question[i]  }: %@`,
        )
        if (reply != undefined && isInt(reply)) {
          // console.log(reply)
          reviewLine = questionLine[i].replace(/<int>/, reply)
        } else {
          console.log(
            `\tERROR trying to get integer answer for question '${ 
              question[i] 
              }'`,
          )
        }
        break
      }
      case 'string': {
        const replyString = await CommandBar.showInput(
          questionType[i],
          `${question[i]  }: %@`,
        )
        if (replyString != undefined) {
          // console.log(replyString)
          reviewLine =
            replyString != ''
              ? questionLine[i].replace(/<string>/, replyString)
              : ''
        } else {
          console.log(
            `\tERROR trying to get string answer for question '${ 
              question[i] 
              }'`,
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
      output += `${reviewLine  }\n`
    }
  }

  // add the finished review text to the current daily note,
  // appending after the line found in pref_reviewSectionHeading.
  // If this doesn't exist, then append it first.
  console.log(
    `Appending to heading '${ 
      pref_reviewSectionHeading 
      }' the text:${ 
      output}`,
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
globalThis.dayReview = dayReview
