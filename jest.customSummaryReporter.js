/**
 * @dwertheimer's custom Jest reporter to keep Jest output noise to a minimum */
// Just summarize the results and failures at the end of the test run
// run like so:
//     jest **/*.test.js --reporters jest-silent-reporter --reporters ./jest.customSummaryReporter.js

const chalk = require('chalk')
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
    const fails = results.numFailedTests ? chalk.red.inverse(` ${results.numFailedTests} failed `) : chalk.green(` (100%) `)
    const pass = `${chalk.green(`${results.numPassedTests}/${activeTests} passed`)}`
    const msg = `Test Results: ${pass}${fails}out of ${results.numTotalTests} tests in ${results.numTotalTestSuites} suites (${results.numPendingTests} tests skipped)`
    console.log(msg)
  }
}

module.exports = CustomReporter
