// @flow

import { logDebug } from './dev'

/**
 * Check whether this config meets a minimum defined spec of keys and types. This function replaces
 * the old validateMinimumConfig function
 * @author @dwertheimer
 * @param {object} config - configuration object as structured JSON5 object
 * @param {object} validations - JSON5 object to use as types for this configuration section (see example below). All properties are required unless set as optional
 * @return {object} return config if it passes OR throws an error with description of what failed (wrap call to this function in tr/catch)
 * @example validations = {
 *   // the format of the validations object is:
 *   fieldName: 'type' // where type is one of: string, number, boolean, regex, array, object
 *   // type can be 'string' for any string, or a /regex/ if the string must match the regex
 *   propertyThatShouldBeAnyString: 'string',
 *   propertyThatIsStringButShouldMatchRegex: /^[a-zA-Z0-9]+$/,
 *   propertyThatShouldBeNumber: 'number',
 *   propertyThatShouldBeBoolean: 'boolean',
 *   propertyThatShouldBeArray: 'array',
 *   propertyThatShouldBeObject: 'object',
 * // all the aforementioned properties are required. here's an optional property:
 *   propertyThatIsOptional: {type: 'string', optional: true},
 * }
 * try {
 *  validateConfigProperties(config, validations)
 * } catch (e) {
 *  console.log(e.message)
 * }
 */
export function validateConfigProperties(config: { [string]: mixed }, validations: { [string]: mixed }): { [string]: mixed } {
  let failed = ''
  const propsToValidate = Object.keys(validations)
  if (propsToValidate.length) {
    propsToValidate.forEach((v) => {
      // A validation entry is either a bare type name / RegExp, or a `{ type, optional }` wrapper. Refine it once into a
      // local so both `.optional` and `.type` can be read; a RegExp is also `typeof 'object'` but has neither property.
      const validation = validations[v]
      const validationObject = typeof validation === 'object' && validation !== null ? validation : null
      const isOptional = Boolean(validationObject?.optional)
      const requiredType = isOptional && validationObject?.type ? validationObject.type : validation
      const configFieldValue = config[v]

      if (configFieldValue === null || configFieldValue === undefined) {
        if (!isOptional) {
          logDebug(`validateConfigProperties: configFieldValue: ${configFieldValue ?? 'null'} for ${v} is null or undefined`)
          failed = `Config required field: "${v}" is missing;\n`
        }
      } else {
        if (requiredType instanceof RegExp) {
          if (typeof configFieldValue !== 'string' || !requiredType.test(configFieldValue)) {
            failed += `Config field: "${v}" (${String(config[v])}) is not the proper type;\n`
          }
        } else {
          const test = requiredType === 'array' ? Array.isArray(configFieldValue) : typeof configFieldValue === requiredType
          if (!test) {
            failed += `Config required field: "${v}" is not of type "${String(requiredType)}";\n`
          }
        }
      }
    })
  } else {
    // failed += 'No validations provided'
  }
  if (failed !== '') {
    // console.log(`Config failed minimum validation spec!\n>${failed}`)
    throw new Error(failed)
  } else {
    return config
  }
}
