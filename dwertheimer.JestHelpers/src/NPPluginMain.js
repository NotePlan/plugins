// @flow
// Plugin code goes in files like this. Can be one per command, or several in a file.
// `export async function [name of jsFunction called by Noteplan]`
// then include that function name as an export in the index.js file also
// About Flow: https://flow.org/en/docs/usage/#toc-write-flow-code
// Getting started with Flow in NotePlan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

// NOTE: This file is named NPPluginMain.js (you could change that name and change the reference to it in index.js)
// As a matter of convention, we use NP at the beginning of files which contain calls to NotePlan APIs (Editor, DataStore, etc.)
// Because you cannot easily write tests for code that calls NotePlan APIs, we try to keep the code in the NP files as lean as possible
// and put the majority of the work in the /support folder files which have Jest tests for each function
// support/helpers is an example of a testable file that is used by the plugin command
// REMINDER, to build this plugin as you work on it:
// From the command line:
// `noteplan-cli plugin:dev dwertheimer.JestHelpers --test --watch --coverage`

import pluginJson from '../plugin.json'
// import * as helpers from './support/helpers'
import { log, logError, clo, JSP, getFilteredProps } from '@helpers/dev'
// import { createRunPluginCallbackUrl } from '@helpers/general'
import { getInput } from '@helpers/userInput'

/**
 * A convenience function for creating Jest __mocks__ stubs for a NP API function
 * Outputs result to console where it can be pasted into a __mocks__ file and edited
 * @param {*} object
 * @param {*} name
 */
export function createMockOutput(object: any, name: string): void {
  // log(`NPdev::createMockOutput object type is: `, `${typeof object}`)
  const props = getFilteredProps(object).sort()
  const output = props.map((prop) => {
    let propType,
      value = ''
    if (typeof object[prop] === 'object') {
      if (Array.isArray(object[prop])) {
        propType = 'array'
        let objdetail = ' SOMETHING '
        if (object[prop].length) {
          objdetail = `{ return ${JSP(object[prop][0], `\t\t`)} }`
        }
        value = `
\t/* ${prop}: [${objdetail}], */`
      } else {
        propType = 'object'
        let objdetail = '{ SOME_OBJECT_DATA }'
        if (object[prop] && !(object[prop] instanceof Date)) {
          objdetail = `${JSP(object[prop], `\t\t`)} `
        } else {
          objdetail = `${object[prop].toString()} // (Date object)`
        }
        value = `
\t/* ${prop}: ${objdetail},  */`
      }
    } else if (typeof object[prop] === 'function') {
      propType = 'function'
      value = `
\t// async ${prop}() { return null }, `
    } else {
      propType = 'value'
      value = `
\t// ${prop}: VALUE,`
    }
    return `${value}`
  })
  console.log(
    `/*\n * ${name} mocks\n *\n * Note: nested object example data are there for reference only -- will need to be deleted or cleaned up before use (consider using a factory)\n * For functions: check whether async or not & add params & return value\n * \n */\n\nconst ${name} = {\n${output.join(
      '\n',
    )}\n}\n\nmodule.exports = ${name}`,
  )
}

function getMockClassText(name: string, props: Array<string>, methods: Array<string>): string {
  const template = `
/* 
 * ${name} mock class
 *
 * Usage: const my${name} = new ${name}({ param changes here })
 *
 */

export class ${name} {

  // Properties
  ${props.sort().join('\n')}

  // Methods
  ${methods.sort().join('\n')}

  constructor(data?: any = {}) {
    this.__update(data)
  }

  __update(data?: any = {}) {
    Object.keys(data).forEach((key) => {
      this[key] = data[key]
    })
    return this
  }
}
`
  return template
}

export function createMockClass(object: any, name: string): void {
  log(`NPdev::createMockOutput object type is: `, `${typeof object}`)
  const classProps = [],
    classMethods = []
  const properties = getFilteredProps(object).sort()
  properties.forEach((prop) => {
    let propType,
      value = ''
    if (typeof object[prop] === 'object') {
      if (Array.isArray(object[prop])) {
        propType = 'array'
        let objdetail = ''
        if (object[prop].length) {
          objdetail = `${JSP(object[prop][0], ' ')} `
        }
        classProps.push(`${prop} = [] ${objdetail.length ? `/* sample:  [${objdetail}] */` : ''}`)
      } else {
        propType = 'object'
        let objdetail = '{ SOME_OBJECT_DATA }'
        if (object[prop] && !(object[prop] instanceof Date)) {
          objdetail = `${JSP(object[prop], `\t\t`)} `
        } else {
          objdetail = `new Date("${object[prop].toString()}")`
        }
        classProps.push(`${prop} = {} /* ${objdetail},  */`)
      }
    } else if (typeof object[prop] === 'function') {
      propType = 'function'
      classMethods.push(`async ${prop}() { throw("${name} :: ${prop} Not implemented yet") } `)
    } else {
      propType = 'value'
      classProps.push(`${prop} = 'PLACEHOLDER' // TODO: add value`)
    }
    return `${value}`
  })
  console.log(getMockClassText(name, classProps, classMethods))
}

export async function generateMock(incoming: ?string = ''): Promise<void> {
  // every command/plugin entry point should always be wrapped in a try/catch block
  try {
    // MUST BE A CLASS YOU ARE SENDING, NOT AN ARRAY!!!

    // EXAMPLE to create a subitem class:
    // const pl = await DataStore.installedPlugins()
    // createMockClass(pl[0].commands[0], 'PluginCommandObjectMock')

    const name = await getInput('What is the name of the mock?')
    // console.log(this[name])
    if (name && this[name]) createMockOutput(this[name], name)
    else console.log(`No object for ${name || ''}`)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

// Returns NP object to prove that the mock is working from inside NP calls
export function getCalendar(): any {
  return Calendar
}

// Returns NP object to prove that the mock is working from inside NP calls
export function getClipboard(): any {
  return Clipboard
}

// Returns NP object to prove that the mock is working from inside NP calls
export function getCommandBar(): any {
  return CommandBar
}

// Returns NP object to prove that the mock is working from inside NP calls
export function getDataStore(): any {
  return DataStore
}

// Returns NP object to prove that the mock is working from inside NP calls
export function getEditor(): any {
  return Editor
}

// Returns NP object to prove that the mock is working from inside NP calls
export function getNotePlan(): any {
  return NotePlan
}

/**
 * outputEditorJson
 * Plugin entrypoint for "/Output Editor Doc as JSON"
 */
export function outputEditorJson() {
  try {
    const e = Editor
    const nObj = { title: e.title, filename: e.filename, type: e.type, paragraphs: [] }
    nObj.paragraphs = e.paragraphs.map((p) => ({
      content: p.content,
      rawContent: p.rawContent,
      type: p.type,
      heading: p.heading,
      headingLevel: p.headingLevel,
      lineIndex: p.lineIndex,
      isRecurring: p.isRecurring,
      indents: p.indents,
      noteType: p.noteType,
    }))
    console.log(`--- Editor ---`)
    console.log(JSON.stringify(nObj, null, 2))
    console.log(`--- /Editor ---`)
    console.log(`--- For debugging paras ---`)
    nObj.paragraphs.forEach((p) => console.log(`[${p.lineIndex}]: type=${p.type} content="${p.content}" heading:"${p.heading}"`))
  } catch (error) {
    logError(pluginJson, JSON.stringify(error))
  }
}
