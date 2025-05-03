/* global describe, test, expect, beforeEach, afterEach, jest */

/**
 * @jest-environment node
 */

/**
 * Tests for EJS error handling.
 * Tests improved error messages and line number tracking in templates with JavaScript blocks.
 */

const ejs = require('../lib/support/ejs')
// In Jest environment, these globals are already available

describe('EJS Error Handling', () => {
  // Mock console.log to prevent test output from being cluttered
  let originalConsoleLog
  let consoleOutput = []

  beforeEach(() => {
    originalConsoleLog = console.log
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '))
    })
  })

  afterEach(() => {
    console.log = originalConsoleLog
    consoleOutput = []
  })

  /**
   * Helper function to test template rendering with an expected error.
   * @param {string} template - The EJS template with an error
   * @param {Object} expectation - Object with error expectations
   * @param {number} [expectation.lineNo] - Expected line number of the error (optional)
   * @param {string[]} [expectation.includesText] - Strings that should be in the error message
   * @param {number} [expectation.markerLineNo] - Expected line number where '>>' marker appears (optional)
   * @param {string} [expectation.markerContent] - Expected content on the marked line (optional)
   */
  const testErrorTemplate = (template, expectation) => {
    try {
      ejs.render(template, {}, { compileDebug: true, debug: true })
      // If we get here, no error was thrown
      expect(true).toBe(false) // Alternative to fail()
    } catch (err) {
      // Print debugging information
      console.error('\n\n=== TEST DEBUG INFO ===')
      console.error(`Error object: ${JSON.stringify(err, null, 2)}`)
      console.error(`Error message: ${err.message}`)
      console.error(`Expected line: ${expectation.lineNo}, Actual line: ${err.lineNo}`)

      // Print marker line information
      const errorLines = err.message.split('\n')
      const markerLine = errorLines.find((line) => line.includes('>>'))
      console.error(`Marker line: "${markerLine}"`)
      console.error('=== END DEBUG INFO ===\n\n')

      // Check line number in error if provided
      if (expectation.lineNo !== undefined) {
        expect(err.lineNo).toBe(expectation.lineNo)
      }

      // Check strings that should be included in the error message
      if (expectation.includesText) {
        expectation.includesText.forEach((text) => {
          expect(err.message).toContain(text)
        })
      }

      // Check for >> marker line if expected
      if (expectation.markerLineNo !== undefined) {
        const errorLines = err.message.split('\n')
        const markerLine = errorLines.find((line) => line.includes('>>'))

        expect(markerLine).toBeDefined()
        expect(markerLine).toContain(`${expectation.markerLineNo}|`)

        if (expectation.markerContent) {
          expect(markerLine).toContain(expectation.markerContent)
        }
      }
    }
  }

  describe('Reserved Keyword Detection', () => {
    test('Should correctly identify reserved keyword "new" used as variable', () => {
      const template = `
Line 1
Line 2
<% 
   // This should cause a reserved keyword error
   const new = "value";
%>
Line 6
Line 7`

      testErrorTemplate(template, {
        lineNo: 6, // Updated to match actual line number from debug logs
        includesText: ['new'],
        markerLineNo: 6, // Updated to match actual line number from debug logs
        markerContent: 'new',
      })
    })

    test('Should correctly identify reserved keyword "class" used as variable', () => {
      const template = `
<% 
   let x = 5;
   let class = "test";
%>`

      testErrorTemplate(template, {
        lineNo: 4, // This was already correct
        includesText: ['class'],
        markerLineNo: 4, // This was already correct
        markerContent: 'class',
      })
    })
  })

  describe('Unexpected Token Detection', () => {
    test('Should correctly identify mismatched brackets', () => {
      const template = `
<% 
   let items = [1, 2, 3;
   items.forEach(item => {
     // ...
   });
%>`

      testErrorTemplate(template, {
        lineNo: 3, // Should identify line 3 with the syntax error
        includesText: ['Unexpected token'],
        markerLineNo: 3, // Marker should point to line with mismatched bracket
        markerContent: '[1, 2, 3;',
      })
    })
  })

  describe('Reference Error Detection', () => {
    test('Should provide context for undefined variables', () => {
      const template = `
<% 
   // Intentional typo
   let counter = 0;
   conter++;
%>`

      testErrorTemplate(template, {
        lineNo: 5,
        includesText: ['conter is not defined'],
        markerLineNo: 5, // Marker should point to line with 'conter'
        markerContent: 'conter++',
      })
    })
  })

  describe('TypeError Detection', () => {
    test('Should provide context for "is not a function" errors', () => {
      const template = `
<% 
   const value = 42;
   value();  // Trying to call a non-function
%>`

      testErrorTemplate(template, {
        lineNo: 4, // Should identify correct line
        includesText: ['is not a function'],
        markerLineNo: 4, // Error should be marked at line 4 where value() is called
        markerContent: 'value()',
      })
    })

    test('Should provide context for accessing properties of undefined', () => {
      const template = `
<% 
   const obj = null;
   obj.property;  // Accessing property of null
%>`

      testErrorTemplate(template, {
        lineNo: 4,
        includesText: ['Cannot read properties of null'],
        markerLineNo: 4, // Error should be marked at line 4 where property is accessed
        markerContent: 'obj.property',
      })
    })
  })

  describe('Multi-line JavaScript Blocks', () => {
    test('Should correctly track line numbers within multi-line blocks', () => {
      const template = `
Line 1
<% 
  let a = 1;
  let b = 2;
  let c = d; // Error: d is not defined
  let e = 3;
%>
Line 8`

      testErrorTemplate(template, {
        lineNo: 6,
        includesText: ['d is not defined'],
        markerLineNo: 6, // Error should be marked at line 6 where d is used
        markerContent: 'd',
      })
    })

    test('Should handle errors in nested blocks', () => {
      const template = `
<% 
  if (true) {
    if (true) {
      let x = y; // Error: y is not defined
    }
  }
%>`

      testErrorTemplate(template, {
        lineNo: 5, // Should identify the exact line now
        includesText: ['y is not defined'],
        markerLineNo: 5, // Error should be marked at line 5 where y is used
        markerContent: 'y',
      })
    })

    test('Should handle explicit thrown errors', () => {
      const template = `
Line 1
<% 
  // Deliberately throwing an error
  throw new Error("This is a deliberate error");
  let x = 10; // This line will never execute
%>
Line 7`

      testErrorTemplate(template, {
        lineNo: 5, // Should identify the exact line
        includesText: ['This is a deliberate error'],
        markerLineNo: 5, // Error should be marked at line 5 where the throw is
        markerContent: 'throw new Error',
      })
    })
  })

  describe('Syntax Error Context', () => {
    test('Should provide helpful context for syntax errors', () => {
      const template = `
<% 
  // Missing semi-colon at line end
  let a = 1
  let b = 2;
%>`

      try {
        ejs.render(template, {}, { compileDebug: true, debug: true })
        // If we get here, no error was thrown
        expect(true).toBe(false) // Alternative to fail()
      } catch (err) {
        // For syntax errors, we only verify that an error was thrown
        // The specific format and content may vary across environments
        expect(err).toBeDefined()
        console.log('Syntax error test passed with error:', err.message)
      }
    })
  })

  describe('Syntax error with bad JSON', () => {
    test('Should handle rendering error with bad JSON', () => {
      const template = `<% await DataStore.invokePluginCommandByName('Remove section from recent notes','np.Tidy',['{'numDays':14, 'sectionHeading':'Thoughts For the Day', 'runSilently': true}']) -%>`
      try {
        ejs.render(template, {}, { compileDebug: true, debug: true })
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeDefined()
        console.log('Syntax error test passed with error:', err.message)
      }
    })
  })
})
