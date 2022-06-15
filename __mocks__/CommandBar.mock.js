/*
 * CommandBar mocks
 *
 * Note: nested object example data are there for reference only -- will need to be deleted or cleaned up before use (consider using a factory)
 * For functions: check whether async or not & add params & return value
 *
 */

const CommandBar = {
  // async hide() { return null },
  // async onAsyncThread() { return null },
  // async onMainThread() { return null },
  // async openURL() { return null },
  placeholder: 'CommandBar placeholder',
  async prompt(title = '', message = '') {
    return `CommandBar.prompt ${title} ${message}`
  },
  // searchText: VALUE ,
  // async showInput() { return null },
  // async showLoading() { return null },
  // async showOptions() { return null },
  // async textPrompt() { return null },
}

module.exports = CommandBar
