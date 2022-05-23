// @Flow

// import {  } from './support/runSearch-helpers'
import pluginJson from '../plugin.json'
import { log, logError, clo, timer, JSP, copyObject } from '../../helpers/dev'

/**
 * Run search on template fields in note passed in argument
 * (entry point for /runSearch)
 */
export async function runSearch(filename) {
  log(pluginJson, `Starting execution of runSearch...yippee filename=${filename}`)
}
