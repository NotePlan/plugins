// @flow

import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { showHTML } from '@helpers/HTMLView'

//--------------------------------------------------------------
/**
 * Simplest version in one file with library drawn live from CDN
 */
export function testMermaid1(): void {
  try {

    // Show the list(s) as HTML, and save a copy as file
    logDebug('testMermaid1', `writing results to HTML output ...`)
    showHTML('testMermaid1',
      '', // no extra header tags
      `<html>
    <body>
        <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
        <script>
            mermaid.initialize({ startOnLoad: true });
        </script>

        Here is one mermaid diagram:
        <div class="mermaid">
          graph TD 
          A[Client] --> B[Load Balancer] 
          B --> C[Server1] 
          B --> D[Server2]
        </div>

        And here is another:
        <div class="mermaid">
          flowchart LR
          A[Init] -->|Start| B(Active)
          B --> C{Review}
          C -->|Cancel| E[Cancelled]
          C -->|Complete| F[Completed]
        </div>
    </body>
</html>
`,
      '', // get general CSS set automatically
      '',
      false, // = not modal window
      '',
      '',
      'mermaid.test1') // not giving window dimensions
    logDebug('testMermaid1', `written results to HTML`)
  }
  catch (error) {
    logError('testMermaid1', error.message)
  }
}

/**
 * More complex version using my showHTML() helper
 */
export function testMermaid2(): void {
  try {
    // Show the list(s) as HTML, and save a copy as file
    logDebug('testMermaid2', `writing results to HTML output ...`)
    showHTML('testMermaid2',
      '', // no extra header tags
      `Here is one mermaid diagram:
        <div class="mermaid">
            graph TD 
            A[Client] --> B[Load Balancer] 
            B --> C[Server1] 
            B --> D[Server2]
        </div>

        And here is another:
        <div class="mermaid">
          flowchart LR
          A[Init] -->|Start| B(Active)
          B --> C{Review}
          C -->|Incomplete| B
          C -->|Cancel| E[Cancelled]
          C -->|Complete| F[Completed]
        </div>
`,
      '', // get general CSS set automatically
      '',
      false, // = not modal window
      `<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>`,
      `<script>
mermaid.initialize({ startOnLoad: true });
</script>`,
      'mermaid.test2') // not giving window dimensions
    logDebug('testMermaid2', `written results to HTML`)
  }
  catch (error) {
    logError('testMermaid2', error.message)
  }
}

/**
 * As test2 but now using local version of Mermaid library
 */
export function testMermaid3(): void {
  try {

    // Show the list(s) as HTML, and save a copy as file
    logDebug('testMermaid3', `writing results to HTML output ...`)
    showHTML('testMermaid3',
      '', // no extra header tags
      `Here is one mermaid diagram:
      <div class="mermaid">
        graph TD 
            A[Client] --> B[Load Balancer] 
            B --> C[Server1] 
            B --> D[Server2]
      </div>

        And here is another:
      <div class="mermaid">
        flowchart LR
          A[Project Initiation] -->|Start| B(Active)
          B --> C{Review}
          C -->|Incomplete| B
          C -->|Cancel| E[Cancelled]
          C -->|Complete| F[Completed]
      </div>
`,
      '', // get general CSS set automatically
      '',
      false, // = not modal window
      `<script src="mermaid.min.js"></script>`,
      `<script>
mermaid.initialize({ startOnLoad: true });
</script>`,
      'mermaid.test3') // not giving window dimensions
    logDebug('testMermaid3', `written results to HTML`)
  }
  catch (error) {
    logError('testMermaid3', error.message)
  }
}

/**
 * As test3 but now drawing from a real NP note
 */
export function testMermaid4(): void {
  try {
    const noteTitleToPreview = 'Mermaid Chart TEST'
    const noteArray = DataStore.projectNoteByTitle(noteTitleToPreview, true, false)
    if (noteArray) {
      // Get content
      const content = noteArray[0].content ?? ''
      const lines = content.split('\n')

      // Update mermaid fenced code blocks to suitable <divs>
      let inMermaidCodeblock = false
      for (let i = 0; i < lines.length; i++) {
        if (inMermaidCodeblock && lines[i].trim() === "```") {
          lines[i] = "</div>"
          inMermaidCodeblock = false
        }
        if (!inMermaidCodeblock && lines[i].trim().match(/```\s*mermaid/)) {
          lines[i] = "<div class='mermaid'>"
          inMermaidCodeblock = true
        }
        // And to make things look just a little more like proper HTML ...
        if (!inMermaidCodeblock && lines[i].match(/^#{1,5}\s+/)) {
          const headerLevel = lines[i].split(' ', 1)[0].length
          const headerText = lines[i].slice(headerLevel + 1)
          lines[i] = `<h${headerLevel}>${headerText}</h${headerLevel}>`
        }

        // TODO: Make this proper Markdown -> HTML
      }
      const updatedContent = lines.join(`\n`)

      logDebug('testMermaid4', `Writing basic HTML Preview ...`)
      showHTML('Testing Preview of a Mermaid-containing Note',
        '', // no extra header tags
        updatedContent,
        '', // get general CSS set automatically
        '',
        false, // = not modal window
        `<script src="mermaid.min.js"></script>`,
        `<script>
mermaid.initialize({ startOnLoad: true });
</script>`,
        'mermaid.test4') // not giving window dimensions
      logDebug('testMermaid4', `written results to HTML`)
    }
  }
  catch (error) {
    logError('testMermaid4', error.message)
  }
}
