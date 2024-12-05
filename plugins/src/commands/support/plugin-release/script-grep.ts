var fs = require('fs')

module.exports = {
  existsInFile: function (path, searchFor) {
    return new Promise((resolve) => {
      var stream = fs.createReadStream(path)
      var found = false
      stream.on('data', function (d) {
        if (!found) found = !!('' + d).match(searchFor)
        if (found) {
          stream.destroy()
          resolve(found)
        }
      })

      stream.on('error', function (err) {
        resolve(found)
      })

      stream.on('close', function (err) {
        resolve(found)
      })
    })
  },
}
