// use browserify to create the bundle of these included files
/**
 * Using browserify to create a single bundle of included files which have require() statements
 * To re-bundle, from project root:
 browserify dwertheimer.React/requiredFiles/browserify.createReactBundle.js -r react -r react-dom -r babel-core -o dwertheimer.React/requiredFiles/_reactBundle.js
 **/

const react = require('react')
const reactDOM = require('react-dom')
// const reactDOMClient = require('react-dom/client')
// Had to comment babel out because it was halting execution of the code as soon as it would load
// Hopefully come back and look at another way to load babel this way. Maybe roll up the local'./_babel.min.js' file into this bundle?
// const babel = require('babel-core')

module.exports = function (n) {
  return n * 111 // just a dummy function
}
