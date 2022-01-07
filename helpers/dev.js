// Development-related helper functions

/**
 * JSON.stringify() with support for Prototype properties
 * @author @dwertheimer
 * 
 * @param {object} obj
 * @param {boolean} prettyPrint - if true, will return a string with newlines and indentation
 * @returns {string} stringified object
 * @example console.log(JSP(obj, true)) // prints the full object with newlines and indentation
 */
export function JSP(obj, prettyPrint = 2): string {
  const propNames = getAllPropertyNames(obj)
  const fullObj = propNames.reduce((acc, propName) => {
    acc[propName] = obj[propName]
    return acc
  }, {})
  return JSON.stringify(fullObj, null, prettyPrint ?? null)
}

/**
 * Create a list of the properties of an object, including inherited properties (which are not typically visible in JSON.stringify)
 * @author @dwertheimer
 * 
 * @param {object} obj
 * @returns [string]
 * @reference https://stackoverflow.com/questions/13796360/javascript-get-all-properties-of-an-object
 */
export function getAllPropertyNames(obj): string {
  const p = []
  for (; obj != null; obj = Object.getPrototypeOf(obj)) {
    const op = Object.getOwnPropertyNames(obj)
    for (let i = 0; i < op.length; i++)
      if (/^__/.test(op[i]) === false && op[i] !== 'constructor' && p.indexOf(op[i]) === -1) p.push(op[i])
  }
  return p
}

/**
 * Print to the console log, the properties of an object (including its prototype/private methods). This works and is good if you want to know which properties are on the object vs the prototype because it will display in two lines, but it's more succinct to use getAllPropertyNames()
 * @author @dwertheimer
 * 
 * @param {object} obj
 * @returns {void}
 */
// This works and is good if you want to know which properties are on the object vs the prototype
// because it will display in two lines
export function logAllPropertyNames(obj): void {
  if (obj == null) return // recursive approach
  console.log(Object.getOwnPropertyNames(obj).filter((x) => /^__/.test(x) === false))
  logAllPropertyNames(Object.getPrototypeOf(obj))
}

/**
 * Print to the console log all contents of the environment function, introduced in v3.3.2
 * @author @jgclark
 */
export function logAllEnvironmentSettings(): void {
  console.log(`Contents of environment()...:`)
  console.log("- .languageCode: " + environment().languageCode)
  console.log("- .preferredLanguages: " + environment().preferredLanguages)
  console.log("- .regionCode: " + environment().regionCode)
  console.log("- .is12hFormat: " + environment().is12hFormat)
  console.log("- .secondsFromGMT: " + environment().secondsFromGMT)
  console.log("- .localTimeZoneAbbreviation: " + environment().localTimeZoneAbbreviation)
  console.log("- .localTimeZoneIdentifier: " + environment().localTimeZoneIdentifier)
  console.log("- .isDaylightSavingTime: " + environment().isDaylightSavingTime)
  console.log("- .daylightSavingTimeOffset: " + environment().daylightSavingTimeOffset)
  console.log("- .nextDaylightSavingTimeTransition: " + environment().nextDaylightSavingTimeTransition)
}
