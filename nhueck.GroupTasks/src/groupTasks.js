
//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
// Noteplan Plugin groupTasks
// groups all open tasks of the current note according to their first #tag
// and adds them below a heading "Tag"
// Author: Nikolaus Hueck twitter: @nikolaushueck
//------------------------------------------------------------------------------
//------------------------------------------------------------------------------

import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

const DEFAULT_GROUPTASKS_OPTIONS = `  groupTasks: {
    allTasksHeading: "Tasks",
    noHashtagName: "NoTag",
    deleteEmptyLines: true,
    taggedTasksHeadingsLevel: 4,
    deleteEmptyTasksHeadings: true,
  },
`
let groupTasksConfig = {
  allTasksHeading : "Tasks", 
  noHashtagName: "NoTag",
  deleteEmptyLines : true, 
  taggedTasksHeadingsLevel: 4, 
  deleteEmptyTasksHeadings: true
}

//---------------------------------------
// helper function: getPriority(string)
// get the priority og a given task
// returns a number (1 - 3) 3 beeing the highest priority
//---------------------------------------
function getPriority(s) {
  
}


//---------------------------------------
// helper function: lineSpaceHeadings()
// 1. delete multiple empty lines above headings
// 2. delete headings of level 4 that aren't followed by text paragraphs
//---------------------------------------

// eslint-disable-next-line max-len
function lineSpaceHeadings(level, deleteEmptyLines, deleteEmptyTasksHeadings) {
  // console.log("lineSpaceHeadings wird ausgeführt")
  
  if(deleteEmptyLines) { 
    console.log("delete empty lines")
    Editor.content = Editor.content.replace(/(\n)+#/g, "\n#")  // delete multiple empty lines above headings
  } 
  if(deleteEmptyTasksHeadings) {  
    const re = "(\n)+"+"#".repeat(level)+" .+(?=\n*?((# )|(##)))"
    const re1 = "(\n)+"+"#".repeat(level)+" .+(\n)*$"  //$
    console.log("deleting last line: "+re)
    const taskHeadingSearch = new RegExp(re,"g")
    const taskHeadingSearch1 = new RegExp(re1,"g")
    Editor.content = Editor.content.replace(taskHeadingSearch, "")  // delete headings of the tasksHeadings level that aren't followed by any text
    Editor.content = Editor.content.replace(taskHeadingSearch1, "")
  }
}

//---------------------------------------
// helper function: capitalizeFirstLetter(s)
// Capitalize the first letter of a string
//---------------------------------------

function capitalizeFirstLetter(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

//---------------------------------------
// helper function: stripHashFromHashtag(s)
// Deletes all "#"s from a string
//---------------------------------------

function stripHashFromHashtag(s) {
  return s.replace('#', '')
}

//---------------------------------------
// helper function: stripAsteriskFromTodo(s)
// Deletes all "*{space}"s in a string
//---------------------------------------

function stripAsteriskFromTodo(s) {
  return s.replace('* ', '')
}

//---------------------------------------
// helper function: getHashtagTitleArray(task)
// Get all #tags from the line task an return an Array title, firsttag
//---------------------------------------

function getHashtagTitleArray(task) {
  let hashtags = []
  let hashtag = groupTasksConfig.noHashtagName
  let title = ''
  hashtags = task.rawContent.match(/(#[a-zA-Z0-9]+\b)/g)
                                // get all hashtags from task (the /global search is for future functions)
  if (hashtags != null) {
    // if there are hashtags
    // eslint-disable-next-line max-len
    hashtag = capitalizeFirstLetter(stripHashFromHashtag(hashtags[0]))
    // read the first hashtag
  }
  title = stripAsteriskFromTodo(task.rawContent)
  console.log("hashtag, title: "+hashtag+","+title)
  return [hashtag, title]
}

//---------------------------------------
// helper function: deleteHeading(text,level)
// Delete a heading a given text and level
//---------------------------------------
function deleteHeading(text,level) {
  const levelstring = "#".repeat(level)
  console.log("deleting title: "+text+" level: "+ level)
  const replace = '(\n)*?'+levelstring+' '+text+' *?(\n)*?'
  const re = new RegExp(replace,"g")
  Editor.content = Editor.content.replace(re,'')
  // console.log (replace)
}


//---------------------------------------
// helper function: getGroupTasksConfig()
// Get settings from config note
//---------------------------------------

async function getGroupTasksConfig() {  


// Get config settings from Template folder _configuration note
  groupTasksConfig = await getOrMakeConfigurationSection(
    'groupTasks',
    DEFAULT_GROUPTASKS_OPTIONS
  )
  if (groupTasksConfig == null) {
    console.log("\tCouldn't find 'groupTasks' settings in _configuration note. Using defaults")
    groupTasksConfig.allTasksHeading = "Tasks" // default
    groupTasksConfig.noHashtagName = "NoTag"   // default
    groupTasksConfig.deleteEmptyLines = true, // default
    groupTasksConfig.taggedTasksHeadingsLevel = 4, // default
    groupTasksConfig.deleteEmptyTasksHeadings = true // default
  }

  if (typeof groupTasksConfig.allTasksHeading != 'string') {
    groupTasksConfig.allTasksHeading = "Tasks"
    console.log("\tCouldn't find 'sortTaggedTasks.allTasksHeading' setting in _configuration note. Using default")
  }

  if (typeof groupTasksConfig.noHashtagName != 'string') {
    groupTasksConfig.noHashtagName = "NoTag"
    console.log("\tCouldn't find 'sortTaggedTasks.NoHashtagName' setting in _configuration note. Using default")
  }

  if (typeof groupTasksConfig.deleteEmptyLines != 'boolean') {
    groupTasksConfig.deleteEmptyLines = true
    console.log("\tCouldn't find 'deleteEmptyLines' setting in _configuration note. Using default")
  }

  if (typeof groupTasksConfig.taggedTasksHeadingsLevel != 'number') {
    groupTasksConfig.taggedTasksHeadingsLevel = 4 
    console.log("\tCouldn't find 'taggedTasksHeadingLevel' setting in _configuration note. Using default")
  }
  
  if (typeof groupTasksConfig.deleteEmptyTasksHeadings != 'boolean') {
    groupTasksConfig.deleteEmptyTasksHeadings = true
    console.log("\tCouldn't find 'deleteEmptyTasksHeadings' setting in _configuration note. Using default")
  } 
  return groupTasksConfig
}


//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
// main function: groupTasks
// groups all open tasks of the current note according to their first #tag
// and adds them below a heading "Tag"
//------------------------------------------------------------------------------
//------------------------------------------------------------------------------

export async function groupTasks() {
  const groupTasksConfig = await getGroupTasksConfig()
  const openTasks = [] // array to store all open tasks of the note
  const otherParas = [] // array to store all other lines if the note
  const openTasksHashtagTitleArray = []
  let paras = []
  paras = Editor.paragraphs // loop through all paragraphs of the current note
  paras.forEach(function (line) {
    if (line.type === 'open') {
      // if open task
      openTasks.push(line) // store the line in openTasks
    } else {
      // else
      otherParas.push(line) // store contents of line in otherParas
    }
  }) // end of loop through all lines
  Editor.paragraphs = otherParas
     // save all lines except open tasks to note in editor

  openTasks.forEach(function (task) {
    // loop through all open tasks
    openTasksHashtagTitleArray.push(getHashtagTitleArray(task))
    // push hashtag and title to array
  })

  openTasksHashtagTitleArray.sort(
    (a, b) => b[0].localeCompare(a[0]) || b[1].localeCompare(a[1]),
  ) // sort array by tag and by title
 
    // loop through array, delete existing headings (=hashtags) and create them in order under heading "Aufgaben"
  let oldHashtag = ''
  openTasksHashtagTitleArray.forEach(function(task){
    // console.log("Hashtag: " + task[0])
    // console.log("Titel: " + task[1])
    // console.log("..................")
    const hashtag = task[0]
    if (hashtag !== oldHashtag) {
      deleteHeading(hashtag, groupTasksConfig.taggedTasksHeadingsLevel)
      Editor.addParagraphBelowHeadingTitle("#".repeat(groupTasksConfig.taggedTasksHeadingsLevel)+" "+hashtag, "text", groupTasksConfig.allTasksHeading, false, true)
      Editor.content = Editor.content.replace('# ##', '##')  // because of an error in the API
      oldHashtag = hashtag
    }
  })

  openTasksHashtagTitleArray.forEach(function (task) {
    // loop through all sorted tasks
    const titel = task[1]
    const hashtag = task[0]
    // add task to editor, if not present, create heading
    Editor.addTodoBelowHeadingTitle(titel, hashtag, false, true)
  })
  lineSpaceHeadings(
    groupTasksConfig.taggedTasksHeadingsLevel,
    groupTasksConfig.deleteEmptyLines,
    groupTasksConfig.deleteEmptyTasksHeadings
    )  // delete blank lines and "empty" level headings
}