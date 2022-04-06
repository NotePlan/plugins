const DataStore = {
  async newNote(title = '', folder = '') {
    return `# ${title}`
  },
}

module.exports = DataStore
