/* eslint-disable no-cond-assign */
// @flow

/**
 * Text parsing code based on: https://github.com/LorenzoCorbella74/soulver-web (licensed under the ISC License)
 */

/**
 * TODO:
 * actually call removeParentheticals() and ensure they get into expressions
 * - Should multiple "total(s)" in a note restart the counting? Right now they work like subtotals
 * Look at createUnit() function and checkIfUnit() which seems like it's not finished
 * - Line 472+ (relations) doesn't seem to work right (looking at the tests, you seem get blank arrays, etc.) but maybe that doesn't matter for our purposes - we don't really use it that much I don't think
 */

/**
 * Parsed line metadata
 * {string} typeOfResult: H for header/comment, N per normal number line, S per subtotal, T per total, A for assignment, E for Error
 * {string} typeOfResultFormat: N for normal, % for percentage, B for assigned total (A=total)
 */

const pluginJson = 'dwertheimer.MathSolver/solver.js'

export type LineInfo = {
  lineValue: number | null | { mathjs: string, value: number, unit: string, fixPrefix: string },
  originalText: string,
  expression: string,
  row: number,
  typeOfResult: string, //"H" (Heading/comment)|"N" (Number)|"S" (Subtotal)|"T" (Total)|"A" (Assignment) |"E" (Error)| "B" (Assignment of Total Line - A=total)
  typeOfResultFormat: string, //"N"|"%" /* Does not appear the % is ever used */,
  complete: boolean,
  value?: string,
  error?: string,
}

/**
 * Running data
 */
export type CurrentData = {
  info: Array<LineInfo>,
  variables: { [string]: any },
  relations: Array<Array<string> | null>,
  expressions: Array<string>,
  rows: number,
  precision: ?number,
}

import math from './math.min'
// import {create, all} from 'mathjs/lib/esm/number'
// const math = create(all)

import { log, logDebug, logError, clo, JSP } from '@helpers/dev'

// whitespace (not-colon maybe) = (not-colon not-space) chars
// const reAssignmentSides = /\s*([^:]*?)\s*=\s*([^:\s]*)/g //original version (only grabs first number after =)
const reAssignmentSides = /\s*([^:]*?)\s*=(.*)/g // dbw version: allows for math on right side

const functionNames = ['sin', 'cos', 'tan', 'exp', 'sqrt', 'ceil', 'floor', 'abs', 'acos', 'asin', 'atan', 'log', 'round']
const specialOperator = ['in\\b', 'k\\b', 'M\\b', 'mm\\b', 'cm\\b', 'm\\b', 'km\\b', 'mg\\b', 'g\\b', 'kg\\b', 'cm2\\b', 'm2\\b', 'km2\\b']
const currencies = ['$']

// let rows = 0;
// let selectedRow = 0;
// const expressions = [];
// let variables = {};
// let results = [];
// let relations = []; // indicates in which row the totals are to be reloaded
// let info = [];
// let importedFile = {};
// const APP_VERSION = 'V 0.1.6';
// let isDark = false;
// let statusListening = 'stop';

/**
 * Remove items enclosed in quotes or square brackets to be sent directly to mathjs
 * @param {string} inString
 * @returns {[string,string]} [stringFound, stringWithoutFoundText]
 */
export function removeParentheticals(inString: string): [string, Array<string>] {
  const reParens = /(?:\"|{)(.*?)(?:\"|})/g
  const matches = inString.match(reParens)
  // matches[0] includes the delimiter, matches[1] is the inside string
  // NEED TO DO A doWhile to get them all
  // FIXME: I AM HERE
  let match,
    quotedContent = [],
    newStr = inString
  while ((match = reParens.exec(inString))) {
    newStr = newStr.replace(match[0], '').replace(/ {2,}/g, ' ').trim()
    quotedContent.push(match[1])
  }
  return [quotedContent.length ? quotedContent : [], newStr]
}

/**
 * Is line type included in the array?
 * @param {line} - the info line to search in
 * @param {string|Array<string>} - the type to compare against
 */
export function isLineType(line: LineInfo, searchForType: string | Array<string>) {
  const lineTypes = Array.isArray(searchForType) ? searchForType : [searchForType]
  return lineTypes.indexOf(line.typeOfResult) > -1
}

export function checkIfUnit(obj) {
  return typeof obj === 'object' && obj !== null && obj.value
}

// update each line according to the presence of the variables present in 'relations'
// function updateRelated(data) {
//   for (let numRow = 0; numRow < data.rows; numRow++) {
//     // for all the rows you see those that include the variables in the relationships
//     const who = data.relations.map((e) => e && (e.includes(`R${numRow}`) || Object.keys(data.variables).findIndex((a) => a === e) > -1)) // FIXME: to be reviewed...
//     if (who && who.length > 0) {
//       who.forEach((element) => {
//         if (element) {
//           try {
//             const results = math.evaluate(data.expressions, data.variables)
//             results.map((e, i) => (data.variables[`R${i}`] = checkIfUnit(e) ? math.unit(e) : e)) // put the row results in the variables
//             // updateResultInRow(results[index] ? formatResults(results[index]) : '', index)  // the current row is updated
//           } catch (error) {
//             // updateResultInRow('', index)
//             console.log('Completing expression', error)
//           }
//         }
//       })
//     }
//   }
//   return data
// }

// assegna ad ogni riga le variabili presenti
/*
    [ 
        null,
        [R0],
        [R0,R1]
    ]
*/
function setRelation(selectedRow, presences, relations) {
  relations[selectedRow] = presences
  return relations
}

export function removeTextPlusColon(strToBeParsed: string): string {
  const isTotal = /(sub)?total:/i.test(strToBeParsed) // allow total: or subtotal:
  return isTotal ? strToBeParsed : strToBeParsed.replace(/^.*:/gm, '').trim()
}

function removeTextFromStr(strToBeParsed, variables) {
  // remove all characters but not the substrings of variables, function names and units of measure
  const varConcatenated = Object.keys(variables).concat(functionNames).concat(currencies).concat(specialOperator).join('|')
  const re = varConcatenated ? `\\b(?!${varConcatenated})\\b([a-zA-Z:])+` : '[a-zA-Z:]+'
  return strToBeParsed
    .replace(new RegExp(re, 'g'), '')
    .replace(/\&nbsp;/g, '')
    .replace(/\&;/g, '')
}

function removeComments(incomingString: string, currentData: CurrentData, selectedRow: number): string {
  let strToBeParsed = incomingString
  if (currentData.info[selectedRow].complete !== true) {
    // Remove comment+colon
    strToBeParsed = removeTextPlusColon(strToBeParsed)
    if (/(^|\s)#(.*)/g.test(strToBeParsed)) {
      strToBeParsed = strToBeParsed
        .replace(/(^|\s)#(.*)/g, '$1')
        .replace('\t', '')
        .trim() // remove anything beyond double slashes
    } else if (/\/\/(.*)/g.test(strToBeParsed)) {
      strToBeParsed = strToBeParsed.replace(/\/\/(.*)/g, '').trim() // remove anything beyond double slashes
    }
    if (strToBeParsed.trim() === '') {
      currentData.info[selectedRow].typeOfResult = 'H'
      currentData.info[selectedRow].complete = true
    }
    // logDebug(pluginJson,`str="${strToBeParsed}" = ${info[selectedRow].typeOfResult}`)
    // edit outStr & set .complete if finished
  }
  return strToBeParsed
}

export function parse(thisLineStr: string, lineIndex: number, cd: CurrentData): CurrentData {
  const currentData = cd
  const pluginJson = 'solver::parse'
  let strToBeParsed = thisLineStr.trim()
  const { info, variables, expressions, rows, precision } = currentData
  // let relations = currentData.relations // we need to be able to write this one
  let match
  const selectedRow = lineIndex
  currentData.info[selectedRow] = {
    row: selectedRow,
    typeOfResult: 'N',
    typeOfResultFormat: 'N',
    originalText: strToBeParsed,
    expression: '',
    lineValue: 0,
    error: '',
    complete: false,
  }

  // Remove comments/headers $FlowIgnore
  strToBeParsed = removeComments(strToBeParsed, currentData, selectedRow)

  // let preProcessedValue = null
  try {
    logDebug(pluginJson, `---`)
    logDebug(pluginJson, `about to preproc str = "${strToBeParsed}"`)
    clo(currentData, `currentData before pre-process`)
    logDebug(pluginJson, `str = now will pre-proc "${strToBeParsed}"`)
    const results = math.evaluate([strToBeParsed], variables)
    clo(results, `solver::parse math.js pre-process success on: "${strToBeParsed}" Result is Array<${typeof results[0]}> =`)
    // preProcessedValue = results[0]
  } catch (error) {
    // errors are to be expected since we are pre-processing
    // error messages: "Undefined symbol total", "Unexpected part "4" (char 7)"
    logDebug(pluginJson, `math.js pre-process FAILED on "${strToBeParsed}" with message: "${error.message}"`)
  }

  // Look for passthroughs (quoted or square brackets)
  // const [foundStr, strWithoutFound] = removeParentheticals(strToBeParsed)
  // if (foundStr) {
  //   strToBeParsed = strWithoutFound
  //   const results = math.evaluate([foundStr], variables)
  //   info[selectedRow].typeOfResult = 'H'
  //   info[selectedRow].lineValue = results[0]
  //   clo(results, `passtrhough ${foundStr}`)
  // }

  let out = '0' // used for subtotals and totals

  // Subtotals
  if (!/((sub)?total\s*={1,})/.test(strToBeParsed)) {
    // guard against someone using "total = a + b"
    if (/(subtotal\b).*/gi.test(strToBeParsed)) {
      info[selectedRow].typeOfResult = 'S'
      for (let i = selectedRow - 1; i >= 0; i--) {
        if (info[i].typeOfResult === 'N') {
          out += `+ R${i}`
          // H for header, S per subtotal, T per total
        } else if (info[i].typeOfResult === 'S' || info[i].typeOfResult === 'T' || info[i].typeOfResult === 'B') {
          break
        }
      }
      // Totals
    } else if (/(total\b).*/gi.test(strToBeParsed)) {
      info[selectedRow].typeOfResult = 'T'
      for (let i = 0; i <= rows - 2; i++) {
        if (info[i].typeOfResult === 'N') {
          out += `+ R${i}`
        }
      }
    }
    if (out !== '0') {
      if (/[=]/.test(strToBeParsed)) {
        while ((match = reAssignmentSides.exec(strToBeParsed))) {
          if (match[1]?.trim() !== '' && match[2]?.trim() !== '') {
            strToBeParsed = strToBeParsed.replace(match[0], `${match[1]} = ${out}`)
          }
        }
        info[selectedRow].typeOfResult = 'B' // for Assign-Equal-(sub)Total
      } else {
        strToBeParsed = out // build the string for the totals
      }
    }
  }

  // k - A number can have a little "k" behind it to denote 1,000 * the number (e.g. `4k`)
  // if (/(?<=\d)([k])/g.test(strToBeParsed)) { // positive lookbehind was crashing NP plugin. trying without. i am not sure why it was necessary
  if (/(\d+(?:\.\d+)?)(k)/g.test(strToBeParsed)) {
    // strToBeParsed = strToBeParsed.replace(/(?<=\d)([k])/g, "*1000").trim() // see note above
    strToBeParsed = strToBeParsed.replace(/(\d+(?:\.\d+)?)(k)/g, '$1*1000').trim()
  }
  // M - a number can have an uppercase "M" behind it to denote 1,000,000 * the number (e.g. `5M`)
  if (/(\d+(?:\.\d+)?)(M)/g.test(strToBeParsed)) {
    strToBeParsed = strToBeParsed.replace(/(\d+(?:\.\d+)?)(M)/g, '$1*1000000').trim()
  }

  // variable assignment
  if (/[=]/.test(strToBeParsed)) {
    // TODO: expression management inside the DX of an assignment ...
    let match
    while ((match = reAssignmentSides.exec(strToBeParsed))) {
      // logDebug(`solver::parse/assignment`,`strToBeParsed="${strToBeParsed}"; matches = ${match.toString()}`)
      if (match[1]?.trim() !== '' && match[2]?.trim() !== '') {
        if (info[selectedRow].typeOfResult !== 'B') {
          info[selectedRow].typeOfResult = 'A'
        }
        variables[match[1]] = match[2]
      } else {
        // incomplete assigments (e.g. in progress) will be ignored
        info[selectedRow].typeOfResult = 'H'
      }
    }
  }

  // 10.5% of 100.5   TODO: 10.5% di (espressione) non funziona
  // SOURCE: https://stackoverflow.com/questions/12812902/javascript-regular-expression-matching-cityname // how to take only specific parts
  const reg = /(\d*[\.,])?(\d+)(\s?%)(\s+)(of)(\s+)(\d*[\.,])?(\d+\s?)/g
  while ((match = reg.exec(strToBeParsed))) {
    // console.log(match);
    const num = match[1] ? match[1] + match[2] : match[2]
    const dest = match[7] ? match[7] + match[8] : match[8]
    const sostituzione = (Number(dest) * (Number(num) / 100)).toString()
    strToBeParsed = strToBeParsed.replace(/(\d*[\.,])?(\d+)(\s?%)(\s+)(di|of)(\s+)(\d*[\.,])?(\d+\s?)/g, sostituzione)
  }

  // +/- 10 % TODO: (2 + 22%)% non funziona!
  const add = /\+\s?(\d*[\.,])?(\d+\s?)(%)/g
  while ((match = add.exec(strToBeParsed))) {
    const num = match[1] ? match[1] + match[2] : match[2]
    const sostituzione = ((Number(num) + 100) / 100).toString()
    strToBeParsed = strToBeParsed.replace(/\+\s?(\d*[\.,])?(\d+\s?)(%)/g, `*${sostituzione}`)
  }
  const sub = /\-\s?(\d*[\.,])?(\d+\s?)(%)/g
  while ((match = sub.exec(strToBeParsed))) {
    const num = match[1] ? match[1] + match[2] : match[2]
    const sostituzione = ((100 - Number(num)) / 100).toString()
    strToBeParsed = strToBeParsed.replace(/\-\s?(\d*[\.,])?(\d+\s?)(%)/g, `*${sostituzione}`)
  }

  // 10.1 as % of 1000
  const as = /(\d*[\.,])?(\d+\s?)(as|as a)(\s+%)(\s+(of)\s+)(\d*[\.,])?(\d+\s?)/g
  while ((match = as.exec(strToBeParsed))) {
    const num1 = match[1] ? match[1] + match[2] : match[2]
    const num2 = match[7] ? match[7] + match[8] : match[8]
    const sostituzione = (Number(num1) / Number(num2)).toString()
    strToBeParsed = strToBeParsed.replace(/(\d*[\.,])?(\d+\s?)(as|as a)(\s+%)(\s+(of)\s+)(\d*[\.,])?(\d+\s?)/g, `${sostituzione}`)
  }

  //    logDebug(`String before mathOnlyStr: ${strToBeParsed}`)
  let mathOnlyStr = removeTextFromStr(strToBeParsed, variables).replace(/ +/g, ' ')
  if (mathOnlyStr.trim() === '=') {
    mathOnlyStr = ''
  }
  // logDebug(`String after mathOnlyStr for ${strToBeParsed}: ${mathOnlyStr}`)

  // if there are variables used, relations are defined so the proper lines can be updated later
  const vars = Object.keys(variables)
  const relRegStr = `\\b(${vars.join('|')})\\b`
  const relReg = new RegExp(relRegStr, 'g')
  const matches = mathOnlyStr.match(relReg)
  //FIXME: dbw figure out what is going on in this line, because it seems to be a problem
  let presences = matches ? (/\b(sub)?total(e)?\b/g.exec(strToBeParsed) ? matches.map((e) => e.replace(/\+/g, '')) : matches) : null
  if (Array.isArray(presences) && presences.length > 0) presences = presences.filter((f) => f !== '')
  expressions[selectedRow] = mathOnlyStr.replace(/^0\+/g, '').trim() || '0' // it removes the 0+ fix sums with units
  // logDebug(`solver::parse Relations:`,relations)
  // relations = setRelation(selectedRow, presences, relations)

  try {
    const results = math.evaluate(expressions, variables)
    // results.map((e, i) => variables[`R${i}`] = checkIfUnit(e) ? math.unit(e) : e)  // you put the row results in the variables
    results.map((e, i) => {
      clo(expressions[i], `parse:expressions[${i}]`)
      const rounded = precision ? Number(math.format(e, { precision })) : e
      variables[`R${i}`] = checkIfUnit(e) ? math.unit(e) : isNaN(rounded) ? e : rounded
      info[i].lineValue = variables[`R${i}`]
      if (info[i].typeOfResult === 'N' && mathOnlyStr.trim() === '' && info[i].expression === '0') {
        logDebug(`solver::parse`, `R${i}: "${info[i].originalText}" is a number; info[i].typeOfResult=${info[i].typeOfResult} expressions[i]=${expressions[i]}`)
        if (info[i].originalText.trim() !== '') {
          info[i].error = `was not a number, equation, variable or comment`
          info[i].typeOfResult === 'H' // remove it from calculations
        }
        info[i].expression = ''
      } else {
        info[i].expression = expressions[i]
      }
    }) // keep for NP output metadata
    // let data = { info, variables, relations, expressions, rows }
    // data = updateRelated(data)
    //    logDebug(`solver::parse`,`Returning (one-line):\n${JSON.stringify(data)}`)
    //    logDebug(`solver::parse`,`Returning (Pretty):\n${JSON.stringify(data,null,2)}`)
    return currentData // all variables inside have been updated because the desctructuring just creates references
    // createOrUpdateResult(results[selectedRow] ? formatResults(results[selectedRow]) : '') // the current row is updated
  } catch (error) {
    // createOrUpdateResult('')
    logDebug(pluginJson, `Error completing expression in: ${String(expressions)} ${error}`)
    clo(expressions && expressions.length ? expressions : {}, `parse--expressions`)
    info[selectedRow].error = error.toString()
    info[selectedRow].typeOfResult = 'E'
    expressions[selectedRow] = ''
    return currentData
  }
}

// function formatResults (result) {
//     let output, check
//     if (checkIfUnit(result)) {
//         check = result.value
//     } else {
//         check = result
//     }
//     if (check % 1 != 0) {
//         output = format(result, 2)
//     } else {
//         output = result
//     }
//     return output
// }

// function initSpeechRecognition () {
//     try {
//         SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
//         recognition = null
//         // mostra btn
//         listenBtn.classList.add('show')
//         listenBtn.classList.remove('hide')
//         statusListening = 'stop'
//     } catch (e) {
//         console.error(e)
//     }
// }

// function formatDate (date) {
//     let d = new Date(date),
//         month = `${  d.getMonth() + 1}`,
//         day = `${  d.getDate()}`,
//         year = d.getFullYear()

//     if (month.length < 2)
//         {month = `0${  month}`}
//     if (day.length < 2)
//         {day = `0${  day}`}

//     return [year, month, day].join('-')
// }

// function getCurrencies () {
//     const data = {
//         "success": true,
//         "timestamp": 1519296206,
//         "base": "EUR",
//         "date": "2021-03-17",
//         "rates": {
//             "AUD": 1.566015,
//             "CAD": 1.560132,
//             "CHF": 1.154727,
//             "CNY": 7.827874,
//             "GBP": 0.882047,
//             "JPY": 132.360679,
//             "USD": 1.23396,
//         }
//     }
//     /* return fetch('https://api.exchangeratesapi.io/latest')
//         .then(function (response) {
//             return response.json()
//         })
//         .then(function (data) {
//         */
//             console.log('Currencies:', data)
//             localStorage.setItem(`currencies-${data.date}`, JSON.stringify(data))
//             return createUnit(data)
//        /*  }); */
// }

// function createUnit (data) {
//     math.createUnit(data.base, { aliases: ['€'] })
//     Object.keys(data.rates)
//         .forEach(function (currency) {
//             math.createUnit(currency, math.unit(1 / data.rates[currency], data.base))
//         })
//     // return an array with all available currencies
//     return Object.keys(data.rates).concat(data.base)
// }

// function format (value) {
//     const precision = 4
//     return math.format(value, precision)
// }

// function setAppVersion () {
//     document.querySelector('.version').innerText = APP_VERSION
// }

// function init () {
//     currencies = localStorage.getItem(`currencies-${formatDate(new Date())}`) // only a call a day/browser!!!
//     if (!currencies) {
//         currencies = getCurrencies()
//     } else {
//         currencies = createUnit(JSON.parse(currencies))
//     }
//     // Turn the theme of if the 'dark-theme' key exists in localStorage
//     if (localStorage.getItem('dark-theme')) {
//         document.body.classList.add('dark-theme')
//         isDark = true
//     }

//     setAppVersion()

//     initSpeechRecognition()
//     // si crea la 1° riga
//     createRowFromTemplate()
// }

// init()
/*
    TODO:
    [] classe per la gestione del caret
    [] classe per la gestione della view e classe per la gestione del parsing e calcoli (in file separati)
    [] formattazione di numeri con separazione per migliaia e virgola
    [] colori custom definiti nelle preferenze tramite modale
    [] totale in fondo alla pagina
    [] percentuali
        NUM +/- 20%
        40 come % di 50 (N as a % of N)
        20 che % è di 50 (N is what % of N)
    [] matematica per le date
        Today + 3 weeks 2 days
        3:35 am + 9 hours 20 minutes
        From March 12 to July 30
    [] json export / inport tramite modale
    [] variabili globali
    [] progressive web app ed electron
    [] internalizzazione e formati numerici

    NOTES:
    https://stackoverflow.com/questions/6249095/how-to-set-caretcursor-position-in-contenteditable-element-div
    https://stackoverflow.com/questions/10778291/move-the-cursor-position-with-javascript
    https://stackoverflow.com/questions/18884262/regular-expression-match-string-not-preceded-by-another-string-javascript


*/
