/* eslint-disable */
/*
 * CommandBar mocks
 *
 * Note: nested object example data are there for reference only -- will need to be deleted or cleaned up before use (consider using a factory)
 * For functions: check whether async or not & add params & return value
 *
 */

const CommandBar = {
  async hide() {
    return
  },
  async onAsyncThread() {
    return
  },
  async onMainThread() {
    return
  },
  async openURL() {
    return
  },
  placeholder: 'CommandBar placeholder',
  async prompt(title = '', message = '') {
    console.log(`CommandBar prompt: ${title}: ${message}`)
    return `CommandBar.prompt ${title} ${message}`
  },
  searchText: 'some text',
  async showInput(placeholder, submitText) {
    return placeholder //return the placeholder string as input
  },

  async showLoading(visible, text, progress) {
    return
  },
  async showOptions(options, placeholder) {
    return { index: 0, value: options[0], keyModifiers: ['cmd', 'opt', 'shift', 'ctrl'] }
  },
  async prompt(title, message, buttons) {
    return message //return the message string as input
  },
  async textPrompt(title, message, defaultText) {
    return message //return the message string as input
  },
}

module.exports = CommandBar
