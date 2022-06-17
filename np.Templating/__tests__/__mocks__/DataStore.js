const DataStore = {
  async newNote(title = '', folder = '') {
    return `# ${title}`
  },

  async preference(key = '') {
    switch (key) {
      case 'themeLight':
        return 'Orange'
        break
      case 'isAsteriskTodo':
        return true
        break

      default:
        return ''
        break
    }
  },
}

module.exports = DataStore
