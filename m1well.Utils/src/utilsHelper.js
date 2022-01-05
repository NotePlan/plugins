// @flow

import { isFuture, isMatch, parse, startOfTomorrow } from 'date-fns'
import { showMessage } from '../../helpers/userInput'

const DATE_FORMAT_ISO = 'yyyy-MM-dd'

export type Config = {
  archiveNotesTag: string,
  archiveNotesLifeInDays: number,
}

/**
 * cast string from the config mixed
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {string} casted value
 */
export const castStringFromMixed = (val: { [string]: ?mixed }, key: string): string => {
  const result = findPropertyInMixed(val, key)
  return result ? ((result: any): string) : ''
}

/**
 * cast number from the config mixed
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {string} casted value
 */
export const castNumberFromMixed = (val: { [string]: ?mixed }, key: string): number => {
  const result = findPropertyInMixed(val, key)
  return result ? ((result: any): number) : 0
}

/**
 * Currently there is no function to create a daily note in the future, if it doesn't exist
 * Hopefully this is coming very soon - then add this here to this function
 *
 * @param day future date
 * @returns {?TNote} note if it exists
 */
export const getDailyNote = (day: Date): ?TNote => {
  return DataStore.calendarNoteByDate(day)
}

/**
 * sort function for paragraphs by prio `!!!`, `!!` and `!`
 *
 * @returns {(function(TParagraph, TParagraph): (number))}
 */
export const sortByPrio = (): Function => {
  return (second: TParagraph, first: TParagraph) => {
    if (haveSameTypes(first, second)) {
      if (isFlaggedThrice(first) || isFlaggedThrice(second)) {
        return isFlaggedThrice(first) ? 1 : -1
      }
      if (isFlaggedTwice(first)) {
        return isFlaggedThrice(second) ? -1 : 1
      }
      if (isFlaggedTwice(second)) {
        return isFlaggedThrice(first) ? 1 : -1
      }
      if (isFlaggedOnce(first)) {
        return (isFlaggedTwice(second) || isFlaggedThrice(second)) ? -1 : 1
      }
      if (isFlaggedOnce(second)) {
        return (isFlaggedTwice(second) || isFlaggedThrice(first)) ? 1 : -1
      }
    }
    return 0
  }
}

/**
 * sort by type (open, scheduled, cancelled, done, list, text) by it's type
 *
 * @returns {(function(TParagraph, TParagraph): (number))} sorted paragraphs
 */
export const sortByType = (): Function => {
  return (second: TParagraph, first: TParagraph) => {
    if (first.type === 'text' || second.type === 'text') {
      // handle text first
      return first.type === 'text' ? -1 : 1
    } else if (first.type === 'list' || second.type === 'list') {
      // handle list second
      return first.type === 'list' ? -1 : 1
    } else {
      // then handle all tasks
      if (first.type === 'done') {
        return second.type === 'list' ? 1 : -1
      }
      if (second.type === 'done') {
        return first.type === 'list' ? -1 : 1
      }
      if (first.type === 'cancelled') {
        return -1
      }
      if (second.type === 'cancelled') {
        return 1
      }
      if (first.type === 'scheduled') {
        return second.type === 'open' ? -1 : 1
      }
      if (second.type === 'scheduled') {
        return first.type === 'open' ? 1 : -1
      }
    }
    return 0
  }
}

/**
 * get future date from user input or return tomorrow
 *
 * @param question question to ask user
 * @returns {Promise<Date>} the input date or tomorrow
 */
export const futureDateFromInputOrTomorrow = async (question: string): Promise<Date> => {
  let input = '-'

  while (input && !checkIsFutureDateWithFormat(input, DATE_FORMAT_ISO)) {
    input = await CommandBar.showInput(question, 'Enter future date')
  }
  return input ? parse(input, DATE_FORMAT_ISO, new Date()) : startOfTomorrow()
}

export const logMessage = (msg: string): void => {
  console.log(`\tutils log: ${msg}`)
}

export const logError = async (msg: string): Promise<void> => {
  console.log(`\tutils error: ${msg}`)
  await showMessage(`ERROR: ${msg}`)
}

/**
 * find property with key in mixed object
 *
 * @private
 */
const findPropertyInMixed = (val: { [string]: ?mixed }, key: string): any | null => {
  let foundProperty = val
  const properties = key.split('.')

  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i]
    if (!foundProperty || !foundProperty.hasOwnProperty(prop)) {
      return null
    } else {
      foundProperty = foundProperty[prop]
    }
  }
  return foundProperty
}

/**
 * check if paragrphs have same type
 *
 * @private
 */
const haveSameTypes = (paragraphOne: TParagraph, paragraphTwo: TParagraph): boolean => {
  return paragraphOne.type === paragraphTwo.type
}

/**
 * check if paragraph is flagged thrice
 *
 * @private
 */
const isFlaggedThrice = (paragraph: TParagraph): boolean => {
  return paragraph.content.startsWith('!!!')
}

/**
 * check if paragraph is flagged twice
 *
 * @private
 */
const isFlaggedTwice = (paragraph: TParagraph): boolean => {
  return paragraph.content.startsWith('!!')
}

/**
 * check if paragraph is flagged once
 *
 * @private
 */
const isFlaggedOnce = (paragraph: TParagraph): boolean => {
  return paragraph.content.startsWith('!')
}

/**
 * check if date has given format and is in the future
 *
 * @private
 */
const checkIsFutureDateWithFormat = (dateStr: string, format: string): boolean => {
  return isMatch(dateStr, format) && isFuture(parse(dateStr, format, new Date()))
}

