/**
 * @dwertheimer's custom Jest reporter to keep Jest output noise to a minimum */
// Just summarize the results and failures at the end of the test run
// run like so:
//     jest **/*.test.js --reporters jest-silent-reporter --reporters ./jest.customSummaryReporter.js

// const chalk = require('chalk')
import colors from 'chalk'

class CustomReporter {
  constructor(globalConfig, reporterOptions, reporterContext) {
    this._globalConfig = globalConfig
    this._options = reporterOptions
    this._context = reporterContext
  }

  onRunComplete(testContexts, results) {
    // console.log('Custom reporter output:')
    // console.log('global config: ', this._globalConfig)
    // console.log('options for this reporter from Jest config: ', this._options)
    // console.log('reporter context passed from test scheduler: ', this._context)
    // console.log('\n\ntest testContexts: \n', testContexts)
    // console.log('\n\ntest results: \n', results)
    const activeTests = results.numTotalTests - results.numPendingTests
    const fails = results.numFailedTests ? colors.red.inverse(` ${results.numFailedTests} failed `) : ``
    const pct = results.numFailedTests ? ` (100%)` : ''
    const pass = `${results.numFailedTests ? ', ' : ' 100% '}${colors.green(`${results.numPassedTests}/${activeTests} passed${pct}`)}, `
    const outOf = `out of ${results.numTotalTests} tests in ${results.numTotalTestSuites} suites (${results.numPendingTests} tests skipped)`
    const msg = `Test Results: ${fails}${results.numFailedTests ? ' ' : ''}${pass} ${outOf}}`
    console.log(msg)
  }
}

export default CustomReporter
