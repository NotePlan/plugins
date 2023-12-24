// @flow
import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { todaysDateISOString } from '@helpers/dateTime'

// How many last used choices to float to the top of the list
export const getNumLastUsedChoices = (): number => Number(DataStore.settings.numLastUsedChoices || 0)

// The last used choices as a JSON string
export const getAllLastUsedChoices = (): { [key: string]: number } => JSON.parse(DataStore.settings.lastUsedChoicesJsonStr || '{}')

/**
 * Get the last used choices, limited by the number of last used choices the user chose in settings
 * @returns {Array<string>} - an array of the last used choices highest first
 */
export function getLimitedLastUsedChoices(): Array<string> {
  const howMany = getNumLastUsedChoices()
  if (!howMany) return []
  const lastUsedChoices = getAllLastUsedChoices()
  // find the "howMany" highest values in the lastUsedChoices object
  // instead of the reduce below, output as an ordered list with the highest number at the top
  const limitedLastUsedChoices = Object.keys(lastUsedChoices)
    .sort((a, b) => lastUsedChoices[b] - lastUsedChoices[a])
    .slice(0, howMany)
    .reverse() // highest number at the top
  return limitedLastUsedChoices
}

/**
 * For use in floating the most recently used commands to the top, if a recent command
 * is a relative date, calculate the relative date from today and return it as an >date
 * if it's not a relative date, just return the date passed
 * @param {string} inputDate
 * @returns {string} - the >date if it was a relative date, otherwise the date passed in
 */
export function getArrowDateFromRelativeDate(inputDate: string): string {
  // relative dates look like: `rel${days > 0 ? '+' : ''}${days}`
  if (!inputDate.startsWith('rel')) return inputDate
  const days = Number(inputDate.slice(4))
  // if there is a plus, use moment .add otherwise use subtract
  if (inputDate[3] === '+') return moment().add(days, 'days').format('>YYYY-MM-DD')
  return moment().subtract(days, 'days').format('>YYYY-MM-DD')
}

type CommandBarSelection = {
  label: string,
  value: string,
  index: number,
  keyModifiers: Array<string>,
}

/**
 * Convert an arrow date to a relative date (e.g. "rel+5")
 * Not currently used but may need it in the future
 * WARNING: not clear to me that the date diff is working correctly depending on your time of day, the diff may come
 * back as zero. i added true as the 3rd parameter to give a floating point value for debugging, but did not finish debugging
 */
export function convertArrowDateToRelativeDate(input: string): string {
  let choice = input
  // if choice starts with a ">" then find the date after the > and calculate the relative date from today
  if (choice[0] === '>') {
    //TODO: need to deal with Yearly, Monthly, Quarterly etc. which are not 'YYYY-MM-DD'
    const date = choice.slice(1)
    // use moment to calculate how many days since today
    const theMomentDate = moment(date, 'YYYY-MM-DD')
    const today = moment(todaysDateISOString, 'YYYY-MM-DD')
    const days = moment().diff(theMomentDate, 'days', true)
    logDebug(pluginJson, `updateLastUSedChoices: days (floating point) = ${days}, theMomentDate = ${theMomentDate.format('YYYY-MM-DD')}, today = ${today.format('YYYY-MM-DD')}`)
    const sign = today.isAfter(theMomentDate) ? '-' : '+'
    choice = `rel${sign}${days}`
  }
  return choice
}

/**
 * We should save only certain choices to the last used choices, not specific dates or week notes etc
 * @param {CommandBarSelection} commandBarSelection
 * @returns {boolean} - true if the choice should be saved
 */
export function shouldSaveChoice(commandBarSelection: CommandBarSelection): boolean {
  const { label, value } = commandBarSelection
  const isSpecificDateChoice = /^>[0-9]/.test(value)
  const isSpecificWeekChoice = label.includes('Weekly Note') && !label.includes('thisweek') && !label.includes('nextweek')
  const typesToNotSave = ['__opentask__', '__skip__']
  // don't save these
  if (isSpecificWeekChoice || isSpecificDateChoice || typesToNotSave.includes(value)) {
    logDebug(
      pluginJson,
      `shouldSaveChoice(): "${label}" is a specific day/week choice. Not currently saving these. At some point, maybe calculate the offset days (this code was started but not finished)`,
    )
    return false
  }
  return true
}

/**
 * Update the setting that keeps track of the reschedule chosen by the user
 * @param {string} userSelected
 */
export function updateLastUsedChoices(commandBarSelection: CommandBarSelection): void {
  if (!shouldSaveChoice(commandBarSelection)) return
  let { label } = commandBarSelection
  const { value } = commandBarSelection
  // if label has a parentheses (e.g. "⬇︎ Change date to Today (Sat, 2023-11-11)"), use regex to replace the parentheses, its contents and the space before it with nothing
  if (label.includes(' (')) {
    label = label.replace(/\s*\(.*\)\s*/g, '')
  }
  //TODO: Maybe at some point do date math to figure out the relative week date (if any users ask for it)
  //   convertArrowDateToRelativeDate(value)
  const choice = value
  const choices = getAllLastUsedChoices()
  if (choice) {
    clo(choices, `updateLastUsedChoices choices prior to setting`)
    if (choices[choice]) choices[choice]++
    else choices[choice] = 1
    const settings = DataStore.settings
    settings.lastUsedChoicesJsonStr = JSON.stringify(choices)
    // NOTE: At one point, had to comment out the following line because NP was crashing the plugin - need to bring it back after the fix
    logDebug(pluginJson, `updateLastUsedChoices: saving choice:${value} to DataStore.settings`)
    DataStore.settings = settings
  }
}
