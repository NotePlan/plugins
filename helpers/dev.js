// Development-related helper functions

/**
 * JSON.stringify() with support for Prototype properties
 * @param {object} obj
 * @param {boolean} prettyPrint - if true, will return a string with newlines and indentation
 * @returns {string} stringified object
 * @example console.log(JSP(obj, true)) // prints the full object with newlines and indentation
 */
export function JSP(obj, prettyPrint = 2) {
  const propNames = getAllPropertyNames(obj)
  const fullObj = propNames.reduce((acc, propName) => {
    acc[propName] = obj[propName]
    return acc
  }, {})
  return JSON.stringify(fullObj, null, prettyPrint ?? null)
}

/**
 * @description Create a list of the properties of an object, including inherited properties (which are not typically visible in JSON.stringify)
 * @param {object} obj
 * @returns [string]
 * @reference https://stackoverflow.com/questions/13796360/javascript-get-all-properties-of-an-object
 */
export function getAllPropertyNames(obj) {
  const p = []
  for (; obj != null; obj = Object.getPrototypeOf(obj)) {
    const op = Object.getOwnPropertyNames(obj)
    for (let i = 0; i < op.length; i++)
      if (/^__/.test(op[i]) === false && op[i] !== 'constructor' && p.indexOf(op[i]) === -1) p.push(op[i])
  }
  return p
}

/**
 * @description Print to the console log, the properties of an object (including its prototype/private methods). This works and is good if you want to know which properties are on the object vs the prototype because it will display in two lines, but it's more succinct to use getAllPropertyNames()
 * @param {object} obj
 * @returns {void}
 */
// This works and is good if you want to know which properties are on the object vs the prototype
// because it will display in two lines
export function logAllPropertyNames(obj) {
  if (obj == null) return // recursive approach
  console.log(Object.getOwnPropertyNames(obj).filter((x) => /^__/.test(x) === false))
  logAllPropertyNames(Object.getPrototypeOf(obj))
}
