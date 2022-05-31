// @flow
// Development-related helper functions

/**
 * A helper function to make promises (especially fetch promises) work better with async/await
 * Typically using await with fetch will fail silently if the fetch fails.
 * @param { Promise } promise 
 * @returns { ok: boolean, data: any, error: any }
 * @author @dwertheimer
 * @example
 * 
  const {ok,data,error} = await guarantee(fetch("https://noteplan.co", { timeout: 1000 }))
  if (ok) {
    // do something with data
  } else {
    console.log(error)
    // output some error inline so you know which tag/web call failed
  }
 */
// $FlowIgnore
export const guarantee: { ok: boolean, data: any, error: any } = (promise: Promise<any>) =>
  promise
    .then((data) => ({ ok: true, data, error: null }))
    .catch((error) => Promise.resolve({ ok: false, data: null, error }))

/**
 * Returns ISO formatted date time
 * @author @codedungeon
 * @return {string} formatted date time
 */

const dt = (): string => {
  const d = new Date()

  const pad = (value: number): string => {
    return value < 10 ? '0' + value : value.toString()
  }

  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + d.toLocaleTimeString('en-GB')
}

/**
 * JSON.stringify() with support for Prototype properties
 * @author @dwertheimer
 *
 * @param {object} obj
 * @param {string | number} space - A String or Number of spaces that's used to insert white space (including indentation, line break characters, etc.) into the output JSON string for readability purposes.
 * @returns {string} stringified object
 * @example console.log(JSP(obj, '\t')) // prints the full object with newlines and tabs for indentation
 */
export function JSP(obj: any, space: string | number = 2): string {
  const PARAM_BLACKLIST = ['referencedBlocks'] // fields not to be traversed (e.g. circular references)
  if (typeof obj !== 'object') {
    return String(obj)
  } else {
    if (Array.isArray(obj)) {
      const arrInfo = []
      let isValues = false
      obj.forEach((item, i) => {
        if (typeof item === 'object') {
          arrInfo.push(`[${i}] = ${JSP(item, space)}`)
        } else {
          isValues = true
          arrInfo.push(`${item}`)
        }
      })
      return `${isValues ? '[' : ''}${arrInfo.join(isValues ? ', ' : ',\n')}${isValues ? ']' : ''}`
    }
    const propNames = getAllPropertyNames(obj)
    const fullObj = propNames.reduce((acc, propName) => {
      if (!/^__/.test(propName)) {
        if (Array.isArray(obj[propName])) {
          try {
            if (PARAM_BLACKLIST.indexOf(propName) === -1) {
              acc[propName] = obj[propName].map((x) => {
                if (typeof x === 'object' && !(x instanceof Date)) {
                  return JSP(x, '')
                } else {
                  return x
                }
              })
            } else {
              acc[propName] = obj[propName] //do not traverse any further
            }
          } catch (error) {
            console.log(
              `Caught error in JSP for propname=${propName} : ${error} typeof obj[propName]=${typeof obj[
                propName
              ]} isArray=${String(Array.isArray(obj[propName]))} len=${
                obj[propName]?.length
              } \n VALUE: ${JSON.stringify(obj[propName])}`,
            )
          }
        } else {
          acc[propName] = obj[propName]
        }
      }
      return acc
    }, {})
    return cleanStrigifiedResults(JSON.stringify(fullObj, null, space ?? null))
  }
}

/**
 * Remove quoted and escaped characters from a string
 * @param {*} str
 * @returns
 */
function cleanStrigifiedResults(str: string): string {
  let retStr = str
  retStr = retStr.replace(/","/gm, ',')
  retStr = retStr.replace(/"\{"/gm, '{').replace(/"\}"/gm, '}')
  retStr = str.replace(/\\n/gm, '\n')
  // retStr = retStr.replace(/\\"/gm, '"')
  retStr = retStr.replace(/\\"/gm, '"')
  // retStr = str.replace(/\\n/gm, '\n')
  return retStr
}

/**
 * Console.logs all property names/values of an object to console with text preamble
 * @author @dwertheimer
 *
 * @param {object} obj - array or object
 * @param {string} preamble - (optional) text to prepend to the output
 * @param {string | number} space - A String or Number of spaces that's used to insert white space (including indentation, line break characters, etc.) into the output JSON string for readability purposes.
 * @example clo(obj, 'myObj:')
 */
export function clo(obj: any, preamble: string = '', space: string | number = 2): void {
  if (typeof obj !== 'object') {
    console.log(`${obj} ${preamble}`)
  } else {
    console.log(`${preamble !== '' ? `${preamble} ` : ''}${JSP(obj, space)}`)
  }
}

export function dump(
  pluginInfo: any,
  obj: { [string]: mixed },
  preamble: string = '',
  space: string | number = 2,
): void {
  log(pluginInfo, '-------------------------------------------')
  clo(obj, preamble, space)
  log(pluginInfo, '-------------------------------------------')
}

/**
 * Create a list of the properties of an object, including inherited properties (which are not typically visible in JSON.stringify)
 * @author @dwertheimer (via StackOverflow)
 *
 * @param {object} inObj
 * @returns [string]
 * @reference https://stackoverflow.com/questions/59228638/console-log-an-object-does-not-log-the-method-added-via-prototype-in-node-js-c
 */

export function getAllPropertyNames(inObj: { [string]: mixed }): Array<string> {
  let obj = inObj
  var props = []
  do {
    Object.getOwnPropertyNames(obj).forEach(function (prop) {
      if (props.indexOf(prop) === -1) {
        props.push(prop)
      }
    })
  } while ((obj = Object.getPrototypeOf(obj)))
  return props
}

/**
 * Copy an object and its prototypes as well, return as a normal object
 * with no prototypes. This is useful for copying objects that have
 * prototypes that are not normally visible in JSON.stringify
 * (e.g. most objects that come from the NotePlan API)
 * @author @dwertheimer
 * @param {*} obj
 */
export function copyObject(obj: any): any {
  const props = getAllPropertyNames(obj)
  return props.reduce((acc, p) => {
    acc[p] = obj[p]
    return acc
  }, {})
}

/**
 * Print to the console log, the properties of an object (including its prototype/private methods). This is useful if you want to know which properties are on the object vs the prototype because it will display in two lines, but it's more succinct to use getAllPropertyNames()
 * @author @dwertheimer
 *
 * @param {object} obj
 * @returns {void}
 */
// This works and is good if you want to know which properties are on the object vs the prototype
// because it will display in two lines
export function logAllPropertyNames(obj?: mixed): void {
  if (typeof obj !== 'object' || obj == null) return // recursive approach
  console.log(Object.getOwnPropertyNames(obj).filter((x) => /^__/.test(x) === false))
  logAllPropertyNames(obj.__proto__)
}

/**
 * Converts any to message string
 * @author @codedungeon
 * @param {any} message
 * @returns {string}
 */
const _message = (message: any): string => {
  let logMessage = ''

  switch (typeof message) {
    case 'string':
      logMessage = message
      break
    case 'object':
      if (Array.isArray(message)) {
        logMessage = message.toString()
      } else {
        logMessage = message instanceof Date ? message.toString() : JSON.stringify(message)
      }
      break
    default:
      logMessage = message.toString()
      break
  }

  return logMessage
}
/**
 * Formats log output to include timestamp pluginId, pluginVersion
 * @author @codedungeon
 * @param {any} pluginInfo
 * @param {any} message
 * @param {string} type
 * @returns {string}
 */
export function log(pluginInfo: any, message: any = '', type: string = 'LOG'): string {
  let msg = ''
  let pluginId = ''
  let pluginVersion = ''
  let msgType = ''
  let isPluginJson = typeof pluginInfo === 'object' && pluginInfo.hasOwnProperty('plugin.id')

  if (isPluginJson) {
    pluginId = pluginInfo.hasOwnProperty('plugin.id') ? pluginInfo['plugin.id'] : 'INVALID_PLUGIN_ID'
    pluginVersion = pluginInfo.hasOwnProperty('plugin.version')
      ? pluginInfo['plugin.version']
      : 'INVALID_PLUGIN_VERSION'
    msg = `${dt().padEnd(19)} | ${type.padEnd(5)} | ${pluginId} v${pluginVersion} :: ${_message(message)}`
  } else {
    if (message.length > 0) {
      msg = `${dt().padEnd(19)} | ${type.padEnd(5)} | ${pluginInfo} :: ${_message(message)}`
    } else {
      msg = `${dt().padEnd(19)} | ${type.padEnd(5)} | ${_message(pluginInfo)}`
    }
  }

  console.log(msg)
  return msg
}

/**
 * Formats log output as ERROR to include timestamp pluginId, pluginVersion
 * @author @codedungeon
 * @param {any} pluginInfo
 * @param {any} message
 * @returns {string}
 */
export function logError(pluginInfo: any, error?: any): string {
  if (typeof error === 'object' && error != null) {
    let msg = `${error.filename ?? '<unknown file>'} ${error.lineNumber ?? '<unkonwn line>'}: ${error.message}`
    return log(pluginInfo, msg, 'ERROR')
  }
  return log(pluginInfo, error, 'ERROR')
}

/**
 * Formats log output as WARN to include timestamp pluginId, pluginVersion
 * @author @codedungeon
 * @param {any} pluginInfo
 * @param {any} message
 * @returns {void}
 */
export function logWarn(pluginInfo: any, message: any = ''): string {
  return log(pluginInfo, message, 'WARN')
}

/**
 * Time a function
 * @param {*} startTime - the date object from when timer started (using Date.now())
 * @returns {string} - the formatted elapsed time
 * @author @dwertheimer
 * @example
 * const startTime = Date.now()
 * ...some long-running stuff here...
 * const elapsedTime = timer(startTime)
 */
export function timer(startTime: Date): string {
  const timeStart = startTime ?? new Date()
  const timeEnd = new Date()
  const difference = timeEnd - timeStart
  const d = new Date(difference)
  const diffText = `${d.getMinutes()}m${d.getSeconds()}s.${d.getMilliseconds()}ms`
  return diffText
}
