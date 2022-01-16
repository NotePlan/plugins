// @flow

import {
  clo,
  JSP,
  logAllPropertyNames
} from './dev'

/**
 * Print to the console log all contents of the environment variable, introduced in v3.3.2
 * @author @dwertheimer
 */
export function logAllEnvironmentSettings(): void {
  if (NotePlan.environment) {
    // TODO: don't know why this is no longer working for me:
    clo(NotePlan.environment, 'NotePlan.environment:')
    // TODO: when the following simple case *is* working:
    // console.log(NotePlan.environment.platform)
  } else {
    console.log(`  NotePlan.environment not defined; it isn't available in NP until v3.3.2.`)
  }
}
