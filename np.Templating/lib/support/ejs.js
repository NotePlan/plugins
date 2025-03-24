;(function (f) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = f()
  } else if (typeof define === 'function' && define.amd) {
    define([], f)
  } else {
    var g
    if (typeof window !== 'undefined') {
      g = window
    } else if (typeof global !== 'undefined') {
      g = global
    } else if (typeof self !== 'undefined') {
      g = self
    } else {
      g = this
    }
    g.ejs = f()
  }
})(function () {
  var define, module, exports
  return (function () {
    function r(e, n, t) {
      function o(i, f) {
        if (!n[i]) {
          if (!e[i]) {
            var c = 'function' == typeof require && require
            if (!f && c) return c(i, !0)
            if (u) return u(i, !0)
            var a = new Error("Cannot find module '" + i + "'")
            throw ((a.code = 'MODULE_NOT_FOUND'), a)
          }
          var p = (n[i] = { exports: {} })
          e[i][0].call(
            p.exports,
            function (r) {
              var n = e[i][1][r]
              return o(n || r)
            },
            p,
            p.exports,
            r,
            e,
            n,
            t,
          )
        }
        return n[i].exports
      }
      for (var u = 'function' == typeof require && require, i = 0; i < t.length; i++) o(t[i])
      return o
    }
    return r
  })()(
    {
      1: [
        function (require, module, exports) {
          /*
           * EJS Embedded JavaScript templates
           * Copyright 2112 Matthew Eernisse (mde@fleegix.org)
           *
           * Licensed under the Apache License, Version 2.0 (the "License");
           * you may not use this file except in compliance with the License.
           * You may obtain a copy of the License at
           *
           *         http://www.apache.org/licenses/LICENSE-2.0
           *
           * Unless required by applicable law or agreed to in writing, software
           * distributed under the License is distributed on an "AS IS" BASIS,
           * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
           * See the License for the specific language governing permissions and
           * limitations under the License.
           *
           */

          'use strict'

          /**
           * @file Embedded JavaScript templating engine. {@link http://ejs.co}
           * @author Matthew Eernisse <mde@fleegix.org>
           * @author Tiancheng "Timothy" Gu <timothygu99@gmail.com>
           * @project EJS
           * @license {@link http://www.apache.org/licenses/LICENSE-2.0 Apache License, Version 2.0}
           */

          /**
           * EJS internal functions.
           *
           * Technically this "module" lies in the same file as {@link module:ejs}, for
           * the sake of organization all the private functions re grouped into this
           * module.
           *
           * @module ejs-internal
           * @private
           */

          /**
           * Embedded JavaScript templating engine.
           *
           * @module ejs
           * @public
           */

          var fs = require('fs')
          var path = require('path')
          var utils = require('./utils')

          var scopeOptionWarned = false
          /** @type {string} */
          var _VERSION_STRING = require('../package.json').version
          var _DEFAULT_OPEN_DELIMITER = '<'
          var _DEFAULT_CLOSE_DELIMITER = '>'
          var _DEFAULT_DELIMITER = '%'
          var _DEFAULT_LOCALS_NAME = 'locals'
          var _NAME = 'ejs'
          var _REGEX_STRING = '(<%%|%%>|<%=|<%-|<%_|<%#|<%|%>|-%>|_%>)'
          var _OPTS_PASSABLE_WITH_DATA = ['delimiter', 'scope', 'context', 'debug', 'compileDebug', 'client', '_with', 'rmWhitespace', 'strict', 'filename', 'async']
          // We don't allow 'cache' option to be passed in the data obj for
          // the normal `render` call, but this is where Express 2 & 3 put it
          // so we make an exception for `renderFile`
          var _OPTS_PASSABLE_WITH_DATA_EXPRESS = _OPTS_PASSABLE_WITH_DATA.concat('cache')
          var _BOM = /^\uFEFF/

          /**
           * EJS template function cache. This can be a LRU object from lru-cache NPM
           * module. By default, it is {@link module:utils.cache}, a simple in-process
           * cache that grows continuously.
           *
           * @type {Cache}
           */

          exports.cache = utils.cache

          /**
           * Custom file loader. Useful for template preprocessing or restricting access
           * to a certain part of the filesystem.
           *
           * @type {fileLoader}
           */

          exports.fileLoader = fs.readFileSync

          /**
           * Name of the object containing the locals.
           *
           * This variable is overridden by {@link Options}`.localsName` if it is not
           * `undefined`.
           *
           * @type {String}
           * @public
           */

          exports.localsName = _DEFAULT_LOCALS_NAME

          /**
           * Promise implementation -- defaults to the native implementation if available
           * This is mostly just for testability
           *
           * @type {PromiseConstructorLike}
           * @public
           */

          exports.promiseImpl = new Function('return this;')().Promise

          /**
           * Get the path to the included file from the parent file path and the
           * specified path.
           *
           * @param {String}  name     specified path
           * @param {String}  filename parent file path
           * @param {Boolean} [isDir=false] whether the parent file path is a directory
           * @return {String}
           */
          exports.resolveInclude = function (name, filename, isDir) {
            var dirname = path.dirname
            var extname = path.extname
            var resolve = path.resolve
            var includePath = resolve(isDir ? filename : dirname(filename), name)
            var ext = extname(name)
            if (!ext) {
              includePath += '.ejs'
            }
            return includePath
          }

          /**
           * Try to resolve file path on multiple directories
           *
           * @param  {String}        name  specified path
           * @param  {Array<String>} paths list of possible parent directory paths
           * @return {String}
           */
          function resolvePaths(name, paths) {
            var filePath
            if (
              paths.some(function (v) {
                filePath = exports.resolveInclude(name, v, true)
                return fs.existsSync(filePath)
              })
            ) {
              return filePath
            }
          }

          /**
           * Get the path to the included file by Options
           *
           * @param  {String}  path    specified path
           * @param  {Options} options compilation options
           * @return {String}
           */
          function getIncludePath(path, options) {
            var includePath
            var filePath
            var views = options.views
            var match = /^[A-Za-z]+:\\|^\//.exec(path)

            // Abs path
            if (match && match.length) {
              path = path.replace(/^\/*/, '')
              if (Array.isArray(options.root)) {
                includePath = resolvePaths(path, options.root)
              } else {
                includePath = exports.resolveInclude(path, options.root || '/', true)
              }
            }
            // Relative paths
            else {
              // Look relative to a passed filename first
              if (options.filename) {
                filePath = exports.resolveInclude(path, options.filename)
                if (fs.existsSync(filePath)) {
                  includePath = filePath
                }
              }
              // Then look in any views directories
              if (!includePath && Array.isArray(views)) {
                includePath = resolvePaths(path, views)
              }
              if (!includePath && typeof options.includer !== 'function') {
                throw new Error('Could not find the include file "' + options.escapeFunction(path) + '"')
              }
            }
            return includePath
          }

          /**
           * Get the template from a string or a file, either compiled on-the-fly or
           * read from cache (if enabled), and cache the template if needed.
           *
           * If `template` is not set, the file specified in `options.filename` will be
           * read.
           *
           * If `options.cache` is true, this function reads the file from
           * `options.filename` so it must be set prior to calling this function.
           *
           * @memberof module:ejs-internal
           * @param {Options} options   compilation options
           * @param {String} [template] template source
           * @return {(TemplateFunction|ClientFunction)}
           * Depending on the value of `options.client`, either type might be returned.
           * @static
           */

          function handleCache(options, template) {
            var func
            var filename = options.filename
            var hasTemplate = arguments.length > 1

            if (options.cache) {
              if (!filename) {
                throw new Error('cache option requires a filename')
              }
              func = exports.cache.get(filename)
              if (func) {
                return func
              }
              if (!hasTemplate) {
                template = fileLoader(filename).toString().replace(_BOM, '')
              }
            } else if (!hasTemplate) {
              // istanbul ignore if: should not happen at all
              if (!filename) {
                throw new Error('Internal EJS error: no file name or template ' + 'provided')
              }
              template = fileLoader(filename).toString().replace(_BOM, '')
            }
            func = exports.compile(template, options)
            if (options.cache) {
              exports.cache.set(filename, func)
            }
            return func
          }

          /**
           * Try calling handleCache with the given options and data and call the
           * callback with the result. If an error occurs, call the callback with
           * the error. Used by renderFile().
           *
           * @memberof module:ejs-internal
           * @param {Options} options    compilation options
           * @param {Object} data        template data
           * @param {RenderFileCallback} cb callback
           * @static
           */

          function tryHandleCache(options, data, cb) {
            var result
            if (!cb) {
              if (typeof exports.promiseImpl == 'function') {
                return new exports.promiseImpl(function (resolve, reject) {
                  try {
                    result = handleCache(options)(data)
                    resolve(result)
                  } catch (err) {
                    reject(err)
                  }
                })
              } else {
                throw new Error('Please provide a callback function')
              }
            } else {
              try {
                result = handleCache(options)(data)
              } catch (err) {
                return cb(err)
              }

              cb(null, result)
            }
          }

          /**
           * fileLoader is independent
           *
           * @param {String} filePath ejs file path.
           * @return {String} The contents of the specified file.
           * @static
           */

          function fileLoader(filePath) {
            return exports.fileLoader(filePath)
          }

          /**
           * Get the template function.
           *
           * If `options.cache` is `true`, then the template is cached.
           *
           * @memberof module:ejs-internal
           * @param {String}  path    path for the specified file
           * @param {Options} options compilation options
           * @return {(TemplateFunction|ClientFunction)}
           * Depending on the value of `options.client`, either type might be returned
           * @static
           */

          function includeFile(path, options) {
            var opts = utils.shallowCopy({}, options)
            opts.filename = getIncludePath(path, opts)
            if (typeof options.includer === 'function') {
              var includerResult = options.includer(path, opts.filename)
              if (includerResult) {
                if (includerResult.filename) {
                  opts.filename = includerResult.filename
                }
                if (includerResult.template) {
                  return handleCache(opts, includerResult.template)
                }
              }
            }
            return handleCache(opts)
          }

          /**
           * Analyzes JavaScript errors and provides better diagnostic information
           * for common syntax and runtime errors found in EJS templates.
           *
           * @param {Error} err The error object
           * @param {string} templateText The original template text
           * @param {number} lineNo The current best guess at line number
           * @param {Object} [opts] Additional options
           * @param {string} [opts.source] The generated JavaScript source
           * @return {Object} Object with updated lineNo, errorContext and suggestedFix
           */
          function analyzeJavaScriptError(err, templateText, lineNo, opts = {}) {
            let errorContext = ''
            let suggestedFix = ''
            let updatedLineNo = lineNo
            let errorInFunction = false

            const lines = templateText.split('\n')

            // Look for specific identifiers mentioned in the error message
            if (err instanceof SyntaxError) {
              // Extract identifiers from the error message
              let identifiers = []

              // Match for "Unexpected identifier 'X'" pattern
              const unexpectedIdentifier = err.message.match(/Unexpected identifier ['"]?([^'"\s]+)['"]?/)
              if (unexpectedIdentifier && unexpectedIdentifier[1]) {
                identifiers.push(unexpectedIdentifier[1])
              }

              // Match for "Cannot use the keyword 'X'" pattern
              const cannotUseKeyword = err.message.match(/Cannot use the keyword ['"]?([^'"\s]+)['"]?/)
              if (cannotUseKeyword && cannotUseKeyword[1]) {
                identifiers.push(cannotUseKeyword[1])
              }

              // Search for these identifiers in the template
              let foundInTemplate = false
              let identifierLineNo = 0

              if (identifiers.length > 0) {
                for (let identifier of identifiers) {
                  for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(identifier)) {
                      foundInTemplate = true
                      identifierLineNo = i + 1
                      break
                    }
                  }
                  if (foundInTemplate) break
                }

                // If we found the identifier in the template, use that line
                if (foundInTemplate) {
                  updatedLineNo = identifierLineNo
                }
                // If we didn't find the identifier in the template, it's likely in a function call
                else {
                  errorInFunction = true

                  // Find function calls in the template that might contain the error
                  let functionCalls = []
                  for (let i = 0; i < lines.length; i++) {
                    // Look for function call patterns
                    const matches = lines[i].match(/(\w+\.\w+\()|(\w+\()/g)
                    if (matches) {
                      functionCalls.push({ line: i + 1, calls: matches })
                    }
                  }

                  // If we have function calls and we're on the first line by default,
                  // use the first function call's line instead
                  if (functionCalls.length > 0 && lineNo <= 1) {
                    updatedLineNo = functionCalls[0].line

                    // Find the identifier mentioned in error message
                    const identifier = identifiers[0]
                    errorContext = `Syntax error mentioning "${identifier}" - this error is occurring inside a function call, not in your template code directly.`
                    suggestedFix = `Check the arguments passed to functions on this line.`
                  }
                }
              }
            }

            // Mapping from syntax error patterns to possible locations in template
            const syntaxErrorMapping = {
              'Unexpected token': (err, lines) => {
                // Find code blocks in template
                let blockStartLines = []
                let lineCounter = 0
                let inJsBlock = false

                lines.forEach((line, i) => {
                  if (line.includes('<%') && !line.includes('<%=') && !line.includes('<%-')) {
                    blockStartLines.push(i + 1)
                    inJsBlock = true
                  } else if (line.includes('%>') && inJsBlock) {
                    inJsBlock = false
                  }
                })

                // Look for the token in error message
                const tokenMatch = err.message.match(/Unexpected token '?([\[\]{}(),.;:+\-*\/=<>!&|^%]|[a-zA-Z0-9_$]+)'?/)
                if (!tokenMatch) return lineNo

                const token = tokenMatch[1]

                // Search for the token in each JS block
                for (let startLine of blockStartLines) {
                  let currentLine = startLine
                  while (currentLine < lines.length && !lines[currentLine - 1].includes('%>')) {
                    if (lines[currentLine - 1].includes(token)) {
                      return currentLine
                    }
                    currentLine++
                  }
                }

                return lineNo
              },
              'Unexpected identifier': (err, lines) => {
                // Similar to Unexpected token logic
                return findTokenInTemplate(err, lines, /[a-zA-Z0-9_$]+/)
              },
              'Cannot use the keyword': (err, lines) => {
                const keywordMatch = err.message.match(/Cannot use the keyword '([^']+)'/)
                if (!keywordMatch) return lineNo

                const keyword = keywordMatch[1]

                // Find the line using the keyword
                for (let i = 0; i < lines.length; i++) {
                  if (lines[i].includes('<%') && lines[i].includes(keyword)) {
                    return i + 1
                  }
                }

                return lineNo
              },
            }

            /**
             * Helper to find a token in template lines
             */
            function findTokenInTemplate(err, lines, tokenPattern) {
              // Extract token from error message or use pattern to find it
              let token = ''
              const tokenMatch = err.message.match(/token '?([^']+)'?/)
              if (tokenMatch) {
                token = tokenMatch[1]
              }

              // Find code blocks in template
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('<%') && (token ? lines[i].includes(token) : tokenPattern.test(lines[i]))) {
                  return i + 1
                }
              }

              return lineNo
            }

            // Only try to infer a different line if we don't have a clear indication
            // and we haven't already identified an error in a function call
            if (!errorInFunction && err instanceof SyntaxError) {
              // Try to find a more accurate line number for syntax errors
              for (const pattern in syntaxErrorMapping) {
                if (err.message.includes(pattern)) {
                  updatedLineNo = syntaxErrorMapping[pattern](err, lines)
                  break
                }
              }

              // Check for reserved word errors
              if (err.message.includes('Cannot use the keyword')) {
                const keyword = err.message.match(/Cannot use the keyword '([^']+)'/)
                if (keyword && keyword[1]) {
                  // First check current line for the keyword
                  if (lineNo > 0 && lineNo <= lines.length && lines[lineNo - 1].includes(keyword[1] + ' ')) {
                    errorContext = `Found "${keyword[1]}" used as a variable name on line ${lineNo}.`
                    suggestedFix = `Change the variable name ${keyword[1]} to avoid conflict with JavaScript reserved keywords.`
                  } else {
                    // Search nearby lines for the keyword
                    for (let i = Math.max(0, lineNo - 5); i < Math.min(lines.length, lineNo + 5); i++) {
                      if (lines[i].includes(keyword[1] + ' ')) {
                        errorContext = `Found "${keyword[1]}" used as a variable name on line ${i + 1}.`
                        suggestedFix = `Change the variable name ${keyword[1]} to avoid conflict with JavaScript reserved keywords.`
                        updatedLineNo = i + 1
                        break
                      }
                    }
                  }
                }
              }
              // Check for unexpected token errors
              else if (err.message.includes('Unexpected token')) {
                const token = err.message.match(/Unexpected token '?([\[\]{}(),.;:+\-*\/=<>!&|^%]|[a-zA-Z0-9_$]+)'?/)
                if (token && token[1]) {
                  // Check current line first
                  if (lineNo > 0 && lineNo <= lines.length && lines[lineNo - 1].includes(token[1])) {
                    errorContext = `Unexpected syntax on line ${lineNo} involving "${token[1]}".`
                    suggestedFix = `Check for mismatched brackets, parentheses, or missing semicolons.`
                  } else {
                    // Look through nearby lines
                    for (let i = Math.max(0, lineNo - 3); i <= lineNo; i++) {
                      if (i < lines.length && lines[i].includes(token[1])) {
                        errorContext = `Unexpected syntax on line ${i + 1} involving "${token[1]}".`
                        suggestedFix = `Check for mismatched brackets, parentheses, or missing semicolons.`
                        updatedLineNo = i + 1
                        break
                      }
                    }
                  }
                }
              }
              // Check for unexpected identifier
              else if (err.message.includes('Unexpected identifier') && !errorContext) {
                // We only set this if we haven't already set a more specific error context above
                errorContext = `Unexpected identifier on line ${updatedLineNo}.`
                suggestedFix = `Check for incorrect or unbalanced quotation marks, incorrect JSON parameters, or missing operators, semicolons, or commas.`

                // Look for common mistakes like missing semicolons or operators
                if (updatedLineNo > 0 && updatedLineNo <= lines.length) {
                  const matches = lines[updatedLineNo - 1].match(/(\w+)(\s+)(\w+)/g)
                  if (matches && matches.length) {
                    errorContext += ` Found "${matches[0]}".`
                    suggestedFix += ` You might be missing an operator or semicolon between words.`
                  }
                }
              }
              // Missing closing brackets/parentheses
              else if (err.message.includes('Unexpected end of input')) {
                errorContext = `Your code has unclosed brackets, braces, or parentheses.`
                suggestedFix = `Check for matching pairs of (), [], and {}.`
              }
            }
            // Handle reference errors
            else if (err.name === 'ReferenceError') {
              const varName = err.message.match(/(\w+) is not defined/)
              if (varName && varName[1]) {
                errorContext = `Reference to undefined variable "${varName[1]}" on line ${updatedLineNo}.`
                suggestedFix = `Make sure "${varName[1]}" is properly defined before use or check for typos.`

                // Look through nearby lines for similar variable names (typo detection)
                const similarVars = []
                const searchPattern = new RegExp(`\\b${varName[1].substring(0, Math.max(3, varName[1].length - 1))}\\w+\\b`, 'g')

                for (let i = Math.max(0, updatedLineNo - 5); i < Math.min(lines.length, updatedLineNo + 5); i++) {
                  const matches = lines[i].match(searchPattern)
                  if (matches) {
                    matches.forEach((match) => {
                      if (match !== varName[1] && !similarVars.includes(match)) {
                        similarVars.push(match)
                      }
                    })
                  }
                }

                if (similarVars.length) {
                  suggestedFix += ` Did you mean: ${similarVars.join(', ')}?`
                }
              }
            }
            // Handle type errors
            else if (err.name === 'TypeError') {
              // Cannot read property of undefined/null
              if (err.message.includes('Cannot read') && (err.message.includes('undefined') || err.message.includes('null'))) {
                const prop = err.message.match(/property '?(\w+)'? of/)
                if (prop && prop[1]) {
                  errorContext = `Trying to access property "${prop[1]}" of undefined or null on line ${updatedLineNo}.`
                  suggestedFix = `Make sure the object is properly defined before accessing its properties.`
                }
              }
              // Not a function
              else if (err.message.includes('is not a function')) {
                const func = err.message.match(/(\w+) is not a function/)
                if (func && func[1]) {
                  errorContext = `Trying to call "${func[1]}" as a function on line ${updatedLineNo}, but it's not a function.`
                  suggestedFix = `Check the spelling of the function name or make sure it's properly defined.`
                }
              }
            }

            // If we have source code, try to extract line info from stack trace
            if (opts.source && err.stack && (updatedLineNo === 1 || !updatedLineNo) && !errorInFunction) {
              const sourceLines = opts.source.split('\n')
              const stackLines = err.stack.split('\n')

              // Look for line references in the stack trace
              for (const stackLine of stackLines) {
                const lineMatch = stackLine.match(/<anonymous>:(\d+):(\d+)/)
                if (lineMatch) {
                  const errorLineInSource = parseInt(lineMatch[1], 10)

                  // Now find the corresponding __line assignment before this line
                  let templateLine = 1
                  for (let i = 0; i < errorLineInSource; i++) {
                    const lineAssignment = sourceLines[i]?.match(/__line = (\d+)/)
                    if (lineAssignment) {
                      templateLine = parseInt(lineAssignment[1], 10)
                    }
                  }

                  if (templateLine > 1) {
                    updatedLineNo = templateLine
                    break
                  }
                }
              }
            }

            return {
              lineNo: updatedLineNo,
              errorContext,
              suggestedFix,
              errorInFunction,
            }
          }

          /**
           * Re-throw the given `err` in context to the `str` of ejs, `filename`, and
           * `lineno`.
           *
           * @implements {RethrowCallback}
           * @memberof module:ejs-internal
           * @param {Error}  err      Error object
           * @param {String} str      EJS source
           * @param {String} flnm     file name of the EJS file
           * @param {Number} lineno   line number of the error
           * @param {EscapeCallback} esc
           * @param {Object} [opts]   Additional options
           * @static
           */
          function rethrow(err, str, flnm, lineno, esc, opts = {}) {
            const lines = str.split('\n')

            // We need to track if we have a reliable line number
            let lineReliable = true
            let originalLineNo = lineno
            let errorContext = ''

            // If this is a syntax error, try to find a more accurate line number
            if (err instanceof SyntaxError || err.name === 'SyntaxError') {
              // Try to extract line info from stack trace if available
              const errorAnalysis = analyzeJavaScriptError(err, str, lineno || 1, {
                source: opts.source,
              })

              // If the error is in a function call, the line might not contain the actual error
              if (errorAnalysis.errorInFunction) {
                lineReliable = false
              }
              // If the error mentions an identifier that doesn't appear in the line we identified,
              // we might have the wrong line
              else if (err.message.includes('Unexpected identifier')) {
                const identifierMatch = err.message.match(/Unexpected identifier ['"]?([^'")\s]+)['"]?/i)
                if (identifierMatch && identifierMatch[1]) {
                  const identifier = identifierMatch[1]
                  // Check if this identifier appears in the line we've identified
                  if (lineno > 0 && lineno <= lines.length && !lines[lineno - 1].includes(identifier)) {
                    // The identifier isn't on this line, so our line number might be wrong
                    lineReliable = false
                  }
                }
              }

              // Store error context from analysis if available, but only if line is reliable
              if (errorAnalysis.errorContext) {
                if (!lineReliable) {
                  // For unreliable line numbers, prefer simplified error context
                  errorContext = 'Syntax error in template'
                  if (errorAnalysis.errorInFunction) {
                    errorContext += ' - likely in a function call or parameter.'
                  }
                } else {
                  errorContext = errorAnalysis.errorContext
                  if (errorAnalysis.suggestedFix) {
                    errorContext += '\nSuggestion: ' + errorAnalysis.suggestedFix
                  }
                }
              }

              lineno = errorAnalysis.lineNo
            }

            // Check if line number is within bounds
            if (lineno > lines.length) {
              console.log(`EJS Warning: Error reported at line ${lineno} but template only has ${lines.length} lines`)
              // If the line is out of bounds, use the last line instead
              lineno = lines.length
              lineReliable = false
            }

            // Always ensure lineno is at least 1 to provide context
            lineno = Math.max(lineno || 1, 1)

            // Check for mismatch between error message content and identified line
            if (err.message && lineno > 0 && lineno <= lines.length) {
              // Extract code snippets from the error message (like variable names, tokens)
              const codeSnippets = err.message.match(/['"`][^'"`]+['"`]/g) || []
              let foundMatch = false

              // Check if any snippets appear in the identified line
              for (const snippet of codeSnippets) {
                const content = snippet.substring(1, snippet.length - 1)
                if (content.length > 2 && lines[lineno - 1].includes(content)) {
                  foundMatch = true
                  break
                }
              }

              // If we found no matches between error snippets and the line, our line might be wrong
              if (codeSnippets.length > 0 && !foundMatch) {
                lineReliable = false
              }
            }

            // Only generate context if we have a reliable line number
            let theMessage = ''
            if (lineReliable) {
              var start = Math.max(lineno - 4, 0)
              var end = Math.min(lines.length, lineno + 3)
              var filename = esc(flnm)
              // Error context
              var context = lines
                .slice(start, end)
                .map(function (line, i) {
                  var curr = i + start + 1
                  return (curr == lineno ? ' >> ' : '    ') + curr + '| ' + line
                })
                .join('\n')

              theMessage = context + '\n\n'
            } else {
              // Even for unreliable line numbers, show template context with a warning
              // We'll show a wider range of lines to help the user find the error
              var start = Math.max(originalLineNo - 5, 0)
              var end = Math.min(lines.length, originalLineNo + 5)
              var filename = esc(flnm)

              // Context with a note about approximate line number
              theMessage = `Templating error around line ${originalLineNo} (line number is an approximate):\n\n`

              // Show more context when line number is unreliable
              var context = lines
                .slice(start, end)
                .map(function (line, i) {
                  var curr = i + start + 1
                  return (curr == originalLineNo ? ' >> ' : '    ') + curr + '| ' + line
                })
                .join('\n')

              theMessage += context + '\n\n'
            }

            theMessage += 'Error: "' + err.toString().trim() + '"'

            // Add the error context info if we have it and it's relevant
            if (errorContext && lineReliable) {
              theMessage += '\n' + errorContext
            } else if (!lineReliable && err.message.includes('Unexpected identifier')) {
              // For unreliable line numbers with identifier errors, add specific guidance
              theMessage += '\n\nThe error is likely in a JSON object or function parameter.'
              theMessage += '\nCheck for these common issues:'
              theMessage += '\n- Unbalanced quotes or brackets in JSON objects'
              theMessage += '\n- Missing commas between properties or mixed quote styles (e.g., using both \' and ")'
              theMessage += '\n- Invalid syntax in DataStore.invokePluginCommandByName arguments'
              theMessage += '\n- Nested JSON objects that are not properly formatted'
            } else if (!lineReliable) {
              // Generic guidance for other unreliable line errors
              theMessage += '\n\nCheck your template for syntax errors around this area.'
              theMessage += '\nCommon template issues:'
              theMessage += '\n- Unbalanced <%= %> tags or <% %> blocks'
              theMessage += '\n- Unterminated strings or comments'
              theMessage += '\n- Invalid JavaScript syntax in template expressions'
            }

            const errObj = {
              lineNo: lineReliable ? lineno : undefined,
              message: theMessage,
              toString: () => theMessage,
            }

            throw errObj
          }

          function stripSemi(str) {
            return str.replace(/;$/, '')
          }

          /**
           * Compile the given `str` of ejs into a template function.
           *
           * @param {String}  template EJS template
           *
           * @param {Options} [opts] compilation options
           *
           * @return {(TemplateFunction|ClientFunction)}
           * Depending on the value of `opts.client`, either type might be returned.
           * Note that the return type of the function also depends on the value of `opts.async`.
           * @public
           */

          /**
           * Try to detect and fix common JSON formatting issues
           * @param {String} str - The string that might contain JSON
           * @returns {String} The fixed string if possible
           */
          function detectAndFixJSON(str) {
            // Don't try to process empty strings
            if (!str || typeof str !== 'string') return str

            // Look for DataStore.invokePluginCommandByName calls with potential JSON
            const dataStoreRegex = /DataStore\.invokePluginCommandByName\s*\(\s*'[^']*'\s*,\s*'[^']*'\s*,\s*\[\s*(['"])((?:(?!\1).)*)\1\s*\]\s*\)/g

            return str.replace(dataStoreRegex, (match, quoteType, jsonContent) => {
              try {
                // Check if this looks like JSON
                if (jsonContent.trim().startsWith('{') && jsonContent.trim().endsWith('}')) {
                  // Try to fix common JSON issues
                  let fixed = jsonContent

                  // Fix property names with single quotes
                  fixed = fixed.replace(/'([^']+)':/g, '"$1":')

                  // Fix string values with single quotes
                  fixed = fixed.replace(/:\s*'([^']*?)'/g, ': "$1"')

                  // Try to parse the fixed JSON to verify it's valid
                  try {
                    JSON.parse(fixed)

                    // If we got here, the fixed JSON is valid
                    const prefix = match.substring(0, match.lastIndexOf('[') + 2)
                    const suffix = match.substring(match.lastIndexOf(quoteType) + 1)

                    return `${prefix}${fixed}${suffix}`
                  } catch (e) {
                    // If we can't parse it, return the original match
                    return match
                  }
                }
              } catch (e) {
                // If any error occurs, just return the original match
                return match
              }

              return match
            })
          }

          exports.compile = function compile(template, opts) {
            var templ
            var preProcessedTemplate = template

            // opts is the definitive options object
            // Preprocess template if validateJSON option is enabled
            if (opts && opts.validateJSON) {
              try {
                preProcessedTemplate = detectAndFixJSON(template)
              } catch (e) {
                // If preprocessing fails, just use the original template
                console.error('Error preprocessing template JSON:', e)
              }
            }

            // v1 compat
            // 'scope' is 'context'
            // FIXME: Remove this in a future version
            if (opts && opts.scope) {
              if (!scopeOptionWarned) {
                console.warn('`scope` option is deprecated and will be removed in EJS 3')
                scopeOptionWarned = true
              }
              if (!opts.context) {
                opts.context = opts.scope
              }
              delete opts.scope
            }
            templ = new Template(preProcessedTemplate, opts)
            return templ.compile()
          }

          /**
           * Render the given `template` of ejs.
           *
           * If you would like to include options but not data, you need to explicitly
           * call this function with `data` being an empty object or `null`.
           *
           * @param {String}   template EJS template
           * @param {Object}  [data={}] template data
           * @param {Options} [opts={}] compilation and rendering options
           * @return {(String|Promise<String>)}
           * Return value type depends on `opts.async`.
           * @public
           */

          exports.render = function (template, d, o) {
            var data = d || {}
            var opts = o || {}

            // No options object -- if there are optiony names
            // in the data, copy them to options
            if (arguments.length == 2) {
              utils.shallowCopyFromList(opts, data, _OPTS_PASSABLE_WITH_DATA)
            }

            return handleCache(opts, template)(data)
          }

          /**
           * Render an EJS file at the given `path` and callback `cb(err, str)`.
           *
           * If you would like to include options but not data, you need to explicitly
           * call this function with `data` being an empty object or `null`.
           *
           * @param {String}             path     path to the EJS file
           * @param {Object}            [data={}] template data
           * @param {Options}           [opts={}] compilation and rendering options
           * @param {RenderFileCallback} cb callback
           * @public
           */

          exports.renderFile = function () {
            var args = Array.prototype.slice.call(arguments)
            var filename = args.shift()
            var cb
            var opts = { filename: filename }
            var data
            var viewOpts

            // Do we have a callback?
            if (typeof arguments[arguments.length - 1] == 'function') {
              cb = args.pop()
            }
            // Do we have data/opts?
            if (args.length) {
              // Should always have data obj
              data = args.shift()
              // Normal passed opts (data obj + opts obj)
              if (args.length) {
                // Use shallowCopy so we don't pollute passed in opts obj with new vals
                utils.shallowCopy(opts, args.pop())
              }
              // Special casing for Express (settings + opts-in-data)
              else {
                // Express 3 and 4
                if (data.settings) {
                  // Pull a few things from known locations
                  if (data.settings.views) {
                    opts.views = data.settings.views
                  }
                  if (data.settings['view cache']) {
                    opts.cache = true
                  }
                  // Undocumented after Express 2, but still usable, esp. for
                  // items that are unsafe to be passed along with data, like `root`
                  viewOpts = data.settings['view options']
                  if (viewOpts) {
                    utils.shallowCopy(opts, viewOpts)
                  }
                }
                // Express 2 and lower, values set in app.locals, or people who just
                // want to pass options in their data. NOTE: These values will override
                // anything previously set in settings  or settings['view options']
                utils.shallowCopyFromList(opts, data, _OPTS_PASSABLE_WITH_DATA_EXPRESS)
              }
              opts.filename = filename
            } else {
              data = {}
            }

            return tryHandleCache(opts, data, cb)
          }

          /**
           * Clear intermediate JavaScript cache. Calls {@link Cache#reset}.
           * @public
           */

          /**
           * EJS template class
           * @public
           */
          exports.Template = Template

          exports.clearCache = function () {
            exports.cache.reset()
          }

          function Template(text, opts) {
            opts = opts || {}
            var options = {}
            this.templateText = text
            /** @type {string | null} */
            this.mode = null
            this.truncate = false
            this.currentLine = 1
            this.source = ''
            options.client = opts.client || false
            options.escapeFunction = opts.escape || opts.escapeFunction || utils.escapeXML
            options.compileDebug = opts.compileDebug !== false
            options.debug = !!opts.debug
            options.filename = opts.filename
            options.openDelimiter = opts.openDelimiter || exports.openDelimiter || _DEFAULT_OPEN_DELIMITER
            options.closeDelimiter = opts.closeDelimiter || exports.closeDelimiter || _DEFAULT_CLOSE_DELIMITER
            options.delimiter = opts.delimiter || exports.delimiter || _DEFAULT_DELIMITER
            options.strict = opts.strict || false
            options.context = opts.context
            options.cache = opts.cache || false
            options.rmWhitespace = opts.rmWhitespace
            options.root = opts.root
            options.includer = opts.includer
            options.outputFunctionName = opts.outputFunctionName
            options.localsName = opts.localsName || exports.localsName || _DEFAULT_LOCALS_NAME
            options.views = opts.views
            options.async = opts.async
            options.destructuredLocals = opts.destructuredLocals
            options.legacyInclude = typeof opts.legacyInclude != 'undefined' ? !!opts.legacyInclude : true

            if (options.strict) {
              options._with = false
            } else {
              options._with = typeof opts._with != 'undefined' ? opts._with : true
            }

            this.opts = options

            this.regex = this.createRegex()
          }

          Template.modes = {
            EVAL: 'eval',
            ESCAPED: 'escaped',
            RAW: 'raw',
            COMMENT: 'comment',
            LITERAL: 'literal',
          }

          Template.prototype = {
            createRegex: function () {
              var str = _REGEX_STRING
              var delim = utils.escapeRegExpChars(this.opts.delimiter)
              var open = utils.escapeRegExpChars(this.opts.openDelimiter)
              var close = utils.escapeRegExpChars(this.opts.closeDelimiter)
              str = str.replace(/%/g, delim).replace(/</g, open).replace(/>/g, close)
              return new RegExp(str)
            },

            compile: function () {
              /** @type {string} */
              var src
              /** @type {ClientFunction} */
              var fn
              var opts = this.opts
              var prepended = ''
              var appended = ''
              /** @type {EscapeCallback} */
              var escapeFn = opts.escapeFunction
              /** @type {FunctionConstructor} */
              var ctor
              /** @type {string} */
              var sanitizedFilename = opts.filename ? JSON.stringify(opts.filename) : 'undefined'

              if (!this.source) {
                this.generateSource()
                prepended += '  var __output = "";\n' + '  function __append(s) { if (s !== undefined && s !== null) __output += s }\n'
                if (opts.outputFunctionName) {
                  prepended += '  var ' + opts.outputFunctionName + ' = __append;' + '\n'
                }
                prepended +=
                  '  function __safeEval(val) {\n' +
                  '    if (typeof val === "function") {\n' +
                  '      try {\n' +
                  '        return val();\n' +
                  '      } catch (e) {\n' +
                  '        return "[Function error: " + e.message + ". Did you forget to call the function with parentheses ()?]";\n' +
                  '      }\n' +
                  '    }\n' +
                  '    return val;\n' +
                  '  }\n'
                if (opts.destructuredLocals && opts.destructuredLocals.length) {
                  var destructuring = '  var __locals = (' + opts.localsName + ' || {}),\n'
                  for (var i = 0; i < opts.destructuredLocals.length; i++) {
                    var name = opts.destructuredLocals[i]
                    if (i > 0) {
                      destructuring += ',\n  '
                    }
                    destructuring += name + ' = __locals.' + name
                  }
                  prepended += destructuring + ';\n'
                }
                if (opts._with !== false) {
                  prepended += '  with (' + opts.localsName + ' || {}) {' + '\n'
                  appended += '  }' + '\n'
                }
                appended += '  return __output;' + '\n'
                this.source = prepended + this.source + appended
              }

              if (opts.compileDebug) {
                src =
                  'var __line = 1' +
                  '\n' +
                  '  , __lines = ' +
                  JSON.stringify(this.templateText) +
                  '\n' +
                  '  , __filename = ' +
                  sanitizedFilename +
                  ';' +
                  '\n' +
                  'try {' +
                  '\n' +
                  this.source +
                  '} catch (e) {' +
                  '\n' +
                  '  rethrow(e, __lines, __filename, __line, escapeFn, { source: ' +
                  JSON.stringify(this.source) +
                  ' });' +
                  '\n' +
                  '}' +
                  '\n'
              } else {
                src = this.source
              }

              if (opts.client) {
                src = 'escapeFn = escapeFn || ' + escapeFn.toString() + ';' + '\n' + src
                if (opts.compileDebug) {
                  src = 'rethrow = rethrow || ' + rethrow.toString() + ';' + '\n' + src
                }
              }

              if (opts.strict) {
                src = '"use strict";\n' + src
              }
              if (opts.debug) {
                console.log(src)
              }
              if (opts.compileDebug && opts.filename) {
                src = src + '\n' + '//# sourceURL=' + sanitizedFilename + '\n'
              }

              try {
                if (opts.async) {
                  // Have to use generated function for this, since in envs without support,
                  // it breaks in parsing
                  try {
                    ctor = new Function('return (async function(){}).constructor;')()
                  } catch (e) {
                    if (e instanceof SyntaxError) {
                      throw new Error('This environment does not support async/await')
                    } else {
                      throw e
                    }
                  }
                } else {
                  ctor = Function
                }
                fn = new ctor(opts.localsName + ', escapeFn, include, rethrow', src)
              } catch (e) {
                // IMPORTANT: Restore original error line extraction
                console.log(`EJS: ejs error encountered ${e} ${e.message} ${e.toString()} @ line: ${e.line}`)

                // Try to extract the actual template line number
                let templateLineNo = e.line || 0

                if (!templateLineNo) {
                  // Check if we have an error stack
                  if (e.stack) {
                    // Look for the last line assignment in the stack
                    const lineMatch = e.stack.match(/__line = (\d+)/)
                    if (lineMatch && lineMatch[1]) {
                      templateLineNo = parseInt(lineMatch[1], 10)
                    }
                  }

                  // If we couldn't get it from stack, try from source context

                  if (!templateLineNo && src) {
                    // Find the line in the source that's causing the error
                    const errorLine = e.line || e.lineNumber

                    if (errorLine) {
                      // Get a few lines around the error
                      const srcLines = src.split('\n')
                      const contextRange = 5
                      const start = Math.max(0, errorLine - contextRange)
                      const end = Math.min(srcLines.length, errorLine + contextRange)

                      // Look for __line assignments in this context
                      for (let i = start; i < end; i++) {
                        const lineAssignMatch = srcLines[i].match(/__line = (\d+)/)
                        if (lineAssignMatch && lineAssignMatch[1]) {
                          templateLineNo = parseInt(lineAssignMatch[1], 10)
                          // Keep the highest line number we find before the error line
                          if (i > errorLine) break
                        }
                      }
                    }
                  }
                }

                // Now, enhance the error with our analysis
                try {
                  const errorAnalysis = analyzeJavaScriptError(e, this.templateText, templateLineNo || e.line || e.lineno || 1, {
                    source: this.source,
                  })

                  // Only use analysis result if we couldn't get a line directly
                  if (!templateLineNo) {
                    templateLineNo = errorAnalysis.lineNo
                  }

                  if (errorAnalysis.errorContext) {
                    e.message = `${e.message}\n${errorAnalysis.errorContext}`
                    if (errorAnalysis.suggestedFix) {
                      e.message += `\nSuggestion: ${errorAnalysis.suggestedFix}`
                    }
                  }
                } catch (innerErr) {
                  console.log('Error analyzing syntax error:', innerErr)
                }

                // Use the template line number if we found it, otherwise fall back to original behavior
                rethrow(e, this.templateText, opts.filename, templateLineNo || 1, escapeFn, { source: this.source })
              }

              // Return a callable function which will execute the function
              // created by the source-code, with the passed data as locals
              // Adds a local `include` function which allows full recursive include
              var returnedFn = opts.client
                ? fn
                : function anonymous(data) {
                    var include = function (path, includeData) {
                      var d = utils.shallowCopy({}, data)
                      if (includeData) {
                        d = utils.shallowCopy(d, includeData)
                      }
                      return includeFile(path, opts)(d)
                    }
                    // Remove the __safeEval function since it's now in the prepended code
                    return fn.apply(opts.context, [data || {}, escapeFn, include, rethrow])
                  }
              if (opts.filename && typeof Object.defineProperty === 'function') {
                var filename = opts.filename
                var basename = path.basename(filename, path.extname(filename))
                try {
                  Object.defineProperty(returnedFn, 'name', {
                    value: basename,
                    writable: false,
                    enumerable: false,
                    configurable: true,
                  })
                } catch (e) {
                  /* ignore */
                }
              }
              return returnedFn
            },

            generateSource: function () {
              var opts = this.opts

              if (opts.rmWhitespace) {
                // Have to use two separate replace here as `^` and `$` operators don't
                // work well with `\r` and empty lines don't work well with the `m` flag.
                this.templateText = this.templateText.replace(/[\r\n]+/g, '\n').replace(/^\s+|\s+$/gm, '')
              }

              // Slurp spaces and tabs before <%_ and after _%>
              this.templateText = this.templateText.replace(/[ \t]*<%_/gm, '<%_').replace(/_%>[ \t]*/gm, '_%>')

              var self = this
              var matches = this.parseTemplateText()
              var d = this.opts.delimiter
              var o = this.opts.openDelimiter
              var c = this.opts.closeDelimiter

              if (matches && matches.length) {
                matches.forEach(function (line, index) {
                  var closing
                  // If this is an opening tag, check for closing tags
                  // FIXME: May end up with some false positives here
                  // Better to store modes as k/v with openDelimiter + delimiter as key
                  // Then this can simply check against the map
                  if (
                    line.indexOf(o + d) === 0 && // If it is a tag
                    line.indexOf(o + d + d) !== 0
                  ) {
                    // and is not escaped
                    closing = matches[index + 2]
                    if (!(closing == d + c || closing == '-' + d + c || closing == '_' + d + c)) {
                      throw new Error('Could not find matching close tag for "' + line + '".')
                    }
                  }
                  self.scanLine(line)
                })
              }
            },

            parseTemplateText: function () {
              var str = this.templateText
              var pat = this.regex
              var result = pat.exec(str)
              var arr = []
              var firstPos

              while (result) {
                firstPos = result.index

                if (firstPos !== 0) {
                  arr.push(str.substring(0, firstPos))
                  str = str.slice(firstPos)
                }

                arr.push(result[0])
                str = str.slice(result[0].length)
                result = pat.exec(str)
              }

              if (str) {
                arr.push(str)
              }

              return arr
            },

            _addOutput: function (line) {
              if (this.truncate) {
                // Only replace single leading linebreak in the line after
                // -%> tag -- this is the single, trailing linebreak
                // after the tag that the truncation mode replaces
                // Handle Win / Unix / old Mac linebreaks -- do the \r\n
                // combo first in the regex-or
                line = line.replace(/^(?:\r\n|\r|\n)/, '')
                this.truncate = false
              }
              if (!line) {
                return line
              }

              // Preserve literal slashes
              line = line.replace(/\\/g, '\\\\')

              // Convert linebreaks
              line = line.replace(/\n/g, '\\n')
              line = line.replace(/\r/g, '\\r')

              // Escape double-quotes
              // - this will be the delimiter during execution
              line = line.replace(/"/g, '\\"')
              this.source += '    ; __append("' + line + '")' + '\n'
            },

            scanLine: function (line) {
              var self = this
              var d = this.opts.delimiter
              var o = this.opts.openDelimiter
              var c = this.opts.closeDelimiter
              var newLineCount = 0

              newLineCount = line.split('\n').length - 1

              switch (line) {
                case o + d:
                case o + d + '_':
                  this.mode = Template.modes.EVAL
                  break
                case o + d + '=':
                  this.mode = Template.modes.ESCAPED
                  break
                case o + d + '-':
                  this.mode = Template.modes.RAW
                  break
                case o + d + '#':
                  this.mode = Template.modes.COMMENT
                  break
                case o + d + d:
                  this.mode = Template.modes.LITERAL
                  this.source += '    ; __append("' + line.replace(o + d + d, o + d) + '")' + '\n'
                  break
                case d + d + c:
                  this.mode = Template.modes.LITERAL
                  this.source += '    ; __append("' + line.replace(d + d + c, d + c) + '")' + '\n'
                  break
                case d + c:
                case '-' + d + c:
                case '_' + d + c:
                  if (this.mode == Template.modes.LITERAL) {
                    this._addOutput(line)
                  }

                  this.mode = null
                  this.truncate = line.indexOf('-') === 0 || line.indexOf('_') === 0
                  break
                default:
                  // In script mode, depends on type of tag
                  if (this.mode) {
                    // If '//' is found without a line break, add a line break.
                    switch (this.mode) {
                      case Template.modes.EVAL:
                      case Template.modes.ESCAPED:
                      case Template.modes.RAW:
                        if (line.lastIndexOf('//') > line.lastIndexOf('\n')) {
                          line += '\n'
                        }
                    }
                    switch (this.mode) {
                      // Just executing code
                      case Template.modes.EVAL:
                        // For multi-line script blocks, insert line tracking at each newline
                        if (self.opts.compileDebug && newLineCount > 0) {
                          // Split the line by newlines, process each line, and update currentLine
                          var lines = line.split('\n')
                          var processedLines = []

                          for (var i = 0; i < lines.length; i++) {
                            // For all lines except the last one
                            if (i < lines.length - 1) {
                              processedLines.push(lines[i])
                              this.currentLine++
                              processedLines.push('__line = ' + this.currentLine + ';')
                            } else {
                              // For the last line
                              processedLines.push(lines[i])
                            }
                          }
                          this.source += '    ; ' + processedLines.join('\n') + '\n'
                        } else {
                          this.source += '    ; ' + line + '\n'
                        }
                        break
                      // Exec, esc, and output
                      case Template.modes.ESCAPED:
                        // Handle multi-line escaped blocks similarly
                        if (self.opts.compileDebug && newLineCount > 0) {
                          var lines = line.split('\n')
                          var processedLines = []

                          for (var i = 0; i < lines.length; i++) {
                            if (i < lines.length - 1) {
                              processedLines.push(lines[i])
                              this.currentLine++
                              processedLines.push('__line = ' + this.currentLine + ';')
                            } else {
                              processedLines.push(lines[i])
                            }
                          }
                          // Add function auto-call detection
                          this.source += '    ; __append(escapeFn(__safeEval(' + stripSemi(processedLines.join('\n')) + ')))' + '\n'
                        } else {
                          // Add function auto-call detection
                          this.source += '    ; __append(escapeFn(__safeEval(' + stripSemi(line) + ')))' + '\n'
                        }
                        break
                      // Exec and output
                      case Template.modes.RAW:
                        // Handle multi-line raw blocks similarly
                        if (self.opts.compileDebug && newLineCount > 0) {
                          var lines = line.split('\n')
                          var processedLines = []

                          for (var i = 0; i < lines.length; i++) {
                            if (i < lines.length - 1) {
                              processedLines.push(lines[i])
                              this.currentLine++
                              processedLines.push('__line = ' + this.currentLine + ';')
                            } else {
                              processedLines.push(lines[i])
                            }
                          }
                          // Add function auto-call detection
                          this.source += '    ; __append(__safeEval(' + stripSemi(processedLines.join('\n')) + '))' + '\n'
                        } else {
                          // Add function auto-call detection
                          this.source += '    ; __append(__safeEval(' + stripSemi(line) + '))' + '\n'
                        }
                        break
                      case Template.modes.COMMENT:
                        // Do nothing
                        break
                      // Literal <%% mode, append as raw output
                      case Template.modes.LITERAL:
                        this._addOutput(line)
                        break
                    }
                  }
                  // In string mode, just add the output
                  else {
                    this._addOutput(line)
                  }
              }

              // We've already tracked line numbers within the code blocks, so we don't need this
              // except for non-JS template parts
              if (self.opts.compileDebug && newLineCount && !this.mode) {
                this.currentLine += newLineCount
                this.source += '    ; __line = ' + this.currentLine + '\n'
              }
            },
          }

          /**
           * Escape characters reserved in XML.
           *
           * This is simply an export of {@link module:utils.escapeXML}.
           *
           * If `markup` is `undefined` or `null`, the empty string is returned.
           *
           * @param {String} markup Input string
           * @return {String} Escaped string
           * @public
           * @func
           * */
          exports.escapeXML = utils.escapeXML

          /**
           * Express.js support.
           *
           * This is an alias for {@link module:ejs.renderFile}, in order to support
           * Express.js out-of-the-box.
           *
           * @func
           */

          exports.__express = exports.renderFile

          /**
           * Version of EJS.
           *
           * @readonly
           * @type {String}
           * @public
           */

          exports.VERSION = _VERSION_STRING

          /**
           * Name for detection of EJS.
           *
           * @readonly
           * @type {String}
           * @public
           */

          exports.name = _NAME

          /* istanbul ignore if */
          if (typeof window != 'undefined') {
            window.ejs = exports
          }
        },
        { '../package.json': 6, './utils': 2, fs: 3, path: 4 },
      ],
      2: [
        function (require, module, exports) {
          /*
           * EJS Embedded JavaScript templates
           * Copyright 2112 Matthew Eernisse (mde@fleegix.org)
           *
           * Licensed under the Apache License, Version 2.0 (the "License");
           * you may not use this file except in compliance with the License.
           * You may obtain a copy of the License at
           *
           *         http://www.apache.org/licenses/LICENSE-2.0
           *
           * Unless required by applicable law or agreed to in writing, software
           * distributed under the License is distributed on an "AS IS" BASIS,
           * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
           * See the License for the specific language governing permissions and
           * limitations under the License.
           *
           */

          /**
           * Private utility functions
           * @module utils
           * @private
           */

          'use strict'

          var regExpChars = /[|\\{}()[\]^$+*?.]/g

          /**
           * Escape characters reserved in regular expressions.
           *
           * If `string` is `undefined` or `null`, the empty string is returned.
           *
           * @param {String} string Input string
           * @return {String} Escaped string
           * @static
           * @private
           */
          exports.escapeRegExpChars = function (string) {
            // istanbul ignore if
            if (!string) {
              return ''
            }
            return String(string).replace(regExpChars, '\\$&')
          }

          var _ENCODE_HTML_RULES = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&#34;',
            "'": '&#39;',
          }
          var _MATCH_HTML = /[&<>'"]/g

          function encode_char(c) {
            return _ENCODE_HTML_RULES[c] || c
          }

          /**
           * Stringified version of constants used by {@link module:utils.escapeXML}.
           *
           * It is used in the process of generating {@link ClientFunction}s.
           *
           * @readonly
           * @type {String}
           */

          var escapeFuncStr =
            'var _ENCODE_HTML_RULES = {\n' +
            '      "&": "&amp;"\n' +
            '    , "<": "&lt;"\n' +
            '    , ">": "&gt;"\n' +
            '    , \'"\': "&#34;"\n' +
            '    , "\'": "&#39;"\n' +
            '    }\n' +
            '  , _MATCH_HTML = /[&<>\'"]/g;\n' +
            'function encode_char(c) {\n' +
            '  return _ENCODE_HTML_RULES[c] || c;\n' +
            '};\n'

          /**
           * Escape characters reserved in XML.
           *
           * If `markup` is `undefined` or `null`, the empty string is returned.
           *
           * @implements {EscapeCallback}
           * @param {String} markup Input string
           * @return {String} Escaped string
           * @static
           * @private
           */

          exports.escapeXML = function (markup) {
            return markup == undefined ? '' : String(markup).replace(_MATCH_HTML, encode_char)
          }
          exports.escapeXML.toString = function () {
            return Function.prototype.toString.call(this) + ';\n' + escapeFuncStr
          }

          /**
           * Naive copy of properties from one object to another.
           * Does not recurse into non-scalar properties
           * Does not check to see if the property has a value before copying
           *
           * @param  {Object} to   Destination object
           * @param  {Object} from Source object
           * @return {Object}      Destination object
           * @static
           * @private
           */
          exports.shallowCopy = function (to, from) {
            from = from || {}
            for (var p in from) {
              to[p] = from[p]
            }
            return to
          }

          /**
           * Naive copy of a list of key names, from one object to another.
           * Only copies property if it is actually defined
           * Does not recurse into non-scalar properties
           *
           * @param  {Object} to   Destination object
           * @param  {Object} from Source object
           * @param  {Array} list List of properties to copy
           * @return {Object}      Destination object
           * @static
           * @private
           */
          exports.shallowCopyFromList = function (to, from, list) {
            for (var i = 0; i < list.length; i++) {
              var p = list[i]
              if (typeof from[p] != 'undefined') {
                to[p] = from[p]
              }
            }
            return to
          }

          /**
           * Simple in-process cache implementation. Does not implement limits of any
           * sort.
           *
           * @implements {Cache}
           * @static
           * @private
           */
          exports.cache = {
            _data: {},
            set: function (key, val) {
              this._data[key] = val
            },
            get: function (key) {
              return this._data[key]
            },
            remove: function (key) {
              delete this._data[key]
            },
            reset: function () {
              this._data = {}
            },
          }

          /**
           * Transforms hyphen case variable into camel case.
           *
           * @param {String} string Hyphen case string
           * @return {String} Camel case string
           * @static
           * @private
           */
          exports.hyphenToCamel = function (str) {
            return str.replace(/-[a-z]/g, function (match) {
              return match[1].toUpperCase()
            })
          }
        },
        {},
      ],
      3: [function (require, module, exports) {}, {}],
      4: [
        function (require, module, exports) {
          ;(function (process) {
            // .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
            // backported and transplited with Babel, with backwards-compat fixes

            // Copyright Joyent, Inc. and other Node contributors.
            //
            // Permission is hereby granted, free of charge, to any person obtaining a
            // copy of this software and associated documentation files (the
            // "Software"), to deal in the Software without restriction, including
            // without limitation the rights to use, copy, modify, merge, publish,
            // distribute, sublicense, and/or sell copies of the Software, and to permit
            // persons to whom the Software is furnished to do so, subject to the
            // following conditions:
            //
            // The above copyright notice and this permission notice shall be included
            // in all copies or substantial portions of the Software.
            //
            // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
            // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
            // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
            // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
            // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
            // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
            // USE OR OTHER DEALINGS IN THE SOFTWARE.

            // resolves . and .. elements in a path array with directory names there
            // must be no slashes, empty elements, or device names (c:\) in the array
            // (so also no leading and trailing slashes - it does not distinguish
            // relative and absolute paths)
            function normalizeArray(parts, allowAboveRoot) {
              // if the path tries to go above the root, `up` ends up > 0
              var up = 0
              for (var i = parts.length - 1; i >= 0; i--) {
                var last = parts[i]
                if (last === '.') {
                  parts.splice(i, 1)
                } else if (last === '..') {
                  parts.splice(i, 1)
                  up++
                } else if (up) {
                  parts.splice(i, 1)
                  up--
                }
              }

              // if the path is allowed to go above the root, restore leading ..s
              if (allowAboveRoot) {
                for (; up--; up) {
                  parts.unshift('..')
                }
              }

              return parts
            }

            // path.resolve([from ...], to)
            // posix version
            exports.resolve = function () {
              var resolvedPath = '',
                resolvedAbsolute = false

              for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
                var path = i >= 0 ? arguments[i] : process.cwd()

                // Skip empty and invalid entries
                if (typeof path !== 'string') {
                  throw new TypeError('Arguments to path.resolve must be strings')
                } else if (!path) {
                  continue
                }

                resolvedPath = path + '/' + resolvedPath
                resolvedAbsolute = path.charAt(0) === '/'
              }

              // At this point the path should be resolved to a full absolute path, but
              // handle relative paths to be safe (might happen when process.cwd() fails)

              // Normalize the path
              resolvedPath = normalizeArray(
                filter(resolvedPath.split('/'), function (p) {
                  return !!p
                }),
                !resolvedAbsolute,
              ).join('/')

              return (resolvedAbsolute ? '/' : '') + resolvedPath || '.'
            }

            // path.normalize(path)
            // posix version
            exports.normalize = function (path) {
              var isAbsolute = exports.isAbsolute(path),
                trailingSlash = substr(path, -1) === '/'

              // Normalize the path
              path = normalizeArray(
                filter(path.split('/'), function (p) {
                  return !!p
                }),
                !isAbsolute,
              ).join('/')

              if (!path && !isAbsolute) {
                path = '.'
              }
              if (path && trailingSlash) {
                path += '/'
              }

              return (isAbsolute ? '/' : '') + path
            }

            // posix version
            exports.isAbsolute = function (path) {
              return path.charAt(0) === '/'
            }

            // posix version
            exports.join = function () {
              var paths = Array.prototype.slice.call(arguments, 0)
              return exports.normalize(
                filter(paths, function (p, index) {
                  if (typeof p !== 'string') {
                    throw new TypeError('Arguments to path.join must be strings')
                  }
                  return p
                }).join('/'),
              )
            }

            // path.relative(from, to)
            // posix version
            exports.relative = function (from, to) {
              from = exports.resolve(from).substr(1)
              to = exports.resolve(to).substr(1)

              function trim(arr) {
                var start = 0
                for (; start < arr.length; start++) {
                  if (arr[start] !== '') break
                }

                var end = arr.length - 1
                for (; end >= 0; end--) {
                  if (arr[end] !== '') break
                }

                if (start > end) return []
                return arr.slice(start, end - start + 1)
              }

              var fromParts = trim(from.split('/'))
              var toParts = trim(to.split('/'))

              var length = Math.min(fromParts.length, toParts.length)
              var samePartsLength = length
              for (var i = 0; i < length; i++) {
                if (fromParts[i] !== toParts[i]) {
                  samePartsLength = i
                  break
                }
              }

              var outputParts = []
              for (var i = samePartsLength; i < fromParts.length; i++) {
                outputParts.push('..')
              }

              outputParts = outputParts.concat(toParts.slice(samePartsLength))

              return outputParts.join('/')
            }

            exports.sep = '/'
            exports.delimiter = ':'

            exports.dirname = function (path) {
              if (typeof path !== 'string') path = path + ''
              if (path.length === 0) return '.'
              var code = path.charCodeAt(0)
              var hasRoot = code === 47 /*/*/
              var end = -1
              var matchedSlash = true
              for (var i = path.length - 1; i >= 1; --i) {
                code = path.charCodeAt(i)
                if (code === 47 /*/*/) {
                  if (!matchedSlash) {
                    end = i
                    break
                  }
                } else {
                  // We saw the first non-path separator
                  matchedSlash = false
                }
              }

              if (end === -1) return hasRoot ? '/' : '.'
              if (hasRoot && end === 1) {
                // return '//';
                // Backwards-compat fix:
                return '/'
              }
              return path.slice(0, end)
            }

            function basename(path) {
              if (typeof path !== 'string') path = path + ''

              var start = 0
              var end = -1
              var matchedSlash = true
              var i

              for (i = path.length - 1; i >= 0; --i) {
                if (path.charCodeAt(i) === 47 /*/*/) {
                  // If we reached a path separator that was not part of a set of path
                  // separators at the end of the string, stop now
                  if (!matchedSlash) {
                    start = i + 1
                    break
                  }
                } else if (end === -1) {
                  // We saw the first non-path separator, mark this as the end of our
                  // path component
                  matchedSlash = false
                  end = i + 1
                }
              }

              if (end === -1) return ''
              return path.slice(start, end)
            }

            // Uses a mixed approach for backwards-compatibility, as ext behavior changed
            // in new Node.js versions, so only basename() above is backported here
            exports.basename = function (path, ext) {
              var f = basename(path)
              if (ext && f.substr(-1 * ext.length) === ext) {
                f = f.substr(0, f.length - ext.length)
              }
              return f
            }

            exports.extname = function (path) {
              if (typeof path !== 'string') path = path + ''
              var startDot = -1
              var startPart = 0
              var end = -1
              var matchedSlash = true
              // Track the state of characters (if any) we see before our first dot and
              // after any path separator we find
              var preDotState = 0
              for (var i = path.length - 1; i >= 0; --i) {
                var code = path.charCodeAt(i)
                if (code === 47 /*/*/) {
                  // If we reached a path separator that was not part of a set of path
                  // separators at the end of the string, stop now
                  if (!matchedSlash) {
                    startPart = i + 1
                    break
                  }
                  continue
                }
                if (end === -1) {
                  // We saw the first non-path separator, mark this as the end of our
                  // extension
                  matchedSlash = false
                  end = i + 1
                }
                if (code === 46 /*.*/) {
                  // If this is our first dot, mark it as the start of our extension
                  if (startDot === -1) startDot = i
                  else if (preDotState !== 1) preDotState = 1
                } else if (startDot !== -1) {
                  // We saw a non-dot and non-path separator before our dot, so we should
                  // have a good chance at having a non-empty extension
                  preDotState = -1
                }
              }

              if (
                startDot === -1 ||
                end === -1 ||
                // We saw a non-dot character immediately before the dot
                preDotState === 0 ||
                // The (right-most) trimmed path component is exactly '..'
                (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
              ) {
                return ''
              }
              return path.slice(startDot, end)
            }

            function filter(xs, f) {
              if (xs.filter) return xs.filter(f)
              var res = []
              for (var i = 0; i < xs.length; i++) {
                if (f(xs[i], i, xs)) res.push(xs[i])
              }
              return res
            }

            // String.prototype.substr - negative index don't work in IE8
            var substr =
              'ab'.substr(-1) === 'b'
                ? function (str, start, len) {
                    return str.substr(start, len)
                  }
                : function (str, start, len) {
                    if (start < 0) start = str.length + start
                    return str.substr(start, len)
                  }
          }).call(this, require('_process'))
        },
        { _process: 5 },
      ],
      5: [
        function (require, module, exports) {
          // shim for using process in browser
          var process = (module.exports = {})

          // cached from whatever global is present so that test runners that stub it
          // don't break things.  But we need to wrap it in a try catch in case it is
          // wrapped in strict mode code which doesn't define any globals.  It's inside a
          // function because try/catches deoptimize in certain engines.

          var cachedSetTimeout
          var cachedClearTimeout

          function defaultSetTimout() {
            throw new Error('setTimeout has not been defined')
          }
          function defaultClearTimeout() {
            throw new Error('clearTimeout has not been defined')
          }
          ;(function () {
            try {
              if (typeof setTimeout === 'function') {
                cachedSetTimeout = setTimeout
              } else {
                cachedSetTimeout = defaultSetTimout
              }
            } catch (e) {
              cachedSetTimeout = defaultSetTimout
            }
            try {
              if (typeof clearTimeout === 'function') {
                cachedClearTimeout = clearTimeout
              } else {
                cachedClearTimeout = defaultClearTimeout
              }
            } catch (e) {
              cachedClearTimeout = defaultClearTimeout
            }
          })()
          function runTimeout(fun) {
            if (cachedSetTimeout === setTimeout) {
              //normal enviroments in sane situations
              return setTimeout(fun, 0)
            }
            // if setTimeout wasn't available but was latter defined
            if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
              cachedSetTimeout = setTimeout
              return setTimeout(fun, 0)
            }
            try {
              // when when somebody has screwed with setTimeout but no I.E. maddness
              return cachedSetTimeout(fun, 0)
            } catch (e) {
              try {
                // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
                return cachedSetTimeout.call(null, fun, 0)
              } catch (e) {
                // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
                return cachedSetTimeout.call(this, fun, 0)
              }
            }
          }
          function runClearTimeout(marker) {
            if (cachedClearTimeout === clearTimeout) {
              //normal enviroments in sane situations
              return clearTimeout(marker)
            }
            // if clearTimeout wasn't available but was latter defined
            if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
              cachedClearTimeout = clearTimeout
              return clearTimeout(marker)
            }
            try {
              // when when somebody has screwed with setTimeout but no I.E. maddness
              return cachedClearTimeout(marker)
            } catch (e) {
              try {
                // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
                return cachedClearTimeout.call(null, marker)
              } catch (e) {
                // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
                // Some versions of I.E. have different rules for clearTimeout vs setTimeout
                return cachedClearTimeout.call(this, marker)
              }
            }
          }
          var queue = []
          var draining = false
          var currentQueue
          var queueIndex = -1

          function cleanUpNextTick() {
            if (!draining || !currentQueue) {
              return
            }
            draining = false
            if (currentQueue.length) {
              queue = currentQueue.concat(queue)
            } else {
              queueIndex = -1
            }
            if (queue.length) {
              drainQueue()
            }
          }

          function drainQueue() {
            if (draining) {
              return
            }
            var timeout = runTimeout(cleanUpNextTick)
            draining = true

            var len = queue.length
            while (len) {
              currentQueue = queue
              queue = []
              while (++queueIndex < len) {
                if (currentQueue) {
                  currentQueue[queueIndex].run()
                }
              }
              queueIndex = -1
              len = queue.length
            }
            currentQueue = null
            draining = false
            runClearTimeout(timeout)
          }

          process.nextTick = function (fun) {
            var args = new Array(arguments.length - 1)
            if (arguments.length > 1) {
              for (var i = 1; i < arguments.length; i++) {
                args[i - 1] = arguments[i]
              }
            }
            queue.push(new Item(fun, args))
            if (queue.length === 1 && !draining) {
              runTimeout(drainQueue)
            }
          }

          // v8 likes predictible objects
          function Item(fun, array) {
            this.fun = fun
            this.array = array
          }
          Item.prototype.run = function () {
            this.fun.apply(null, this.array)
          }
          process.title = 'browser'
          process.browser = true
          process.env = {}
          process.argv = []
          process.version = '' // empty string to avoid regexp issues
          process.versions = {}

          function noop() {}

          process.on = noop
          process.addListener = noop
          process.once = noop
          process.off = noop
          process.removeListener = noop
          process.removeAllListeners = noop
          process.emit = noop
          process.prependListener = noop
          process.prependOnceListener = noop

          process.listeners = function (name) {
            return []
          }

          process.binding = function (name) {
            throw new Error('process.binding is not supported')
          }

          process.cwd = function () {
            return '/'
          }
          process.chdir = function (dir) {
            throw new Error('process.chdir is not supported')
          }
          process.umask = function () {
            return 0
          }
        },
        {},
      ],
      6: [
        function (require, module, exports) {
          module.exports = {
            name: 'ejs',
            description: 'Embedded JavaScript templates',
            keywords: ['template', 'engine', 'ejs'],
            version: '3.1.6',
            author: 'Matthew Eernisse <mde@fleegix.org> (http://fleegix.org)',
            license: 'Apache-2.0',
            bin: {
              ejs: './bin/cli.js',
            },
            main: './lib/ejs.js',
            jsdelivr: 'ejs.min.js',
            unpkg: 'ejs.min.js',
            repository: {
              type: 'git',
              url: 'git://github.com/mde/ejs.git',
            },
            bugs: 'https://github.com/mde/ejs/issues',
            homepage: 'https://github.com/mde/ejs',
            dependencies: {
              jake: '^10.6.1',
            },
            devDependencies: {
              browserify: '^16.5.1',
              eslint: '^6.8.0',
              'git-directory-deploy': '^1.5.1',
              jsdoc: '^3.6.4',
              'lru-cache': '^4.0.1',
              mocha: '^7.1.1',
              'uglify-js': '^3.3.16',
            },
            engines: {
              node: '>=0.10.0',
            },
            scripts: {
              test: 'mocha',
            },
          }
        },
        {},
      ],
    },
    {},
    [1],
  )(1)
})
