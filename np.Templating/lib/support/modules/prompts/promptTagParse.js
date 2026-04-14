// @flow
/**
 * @fileoverview Parse EJS tag shape for prompt processing (shared by PromptRegistry and Command Bar form batching).
 */

/**
 * Extract content from a template tag based on its type
 * @param {string} tag - The full tag string
 * @returns {{content: string, isOutputTag: boolean, isExecutionTag: boolean}} Parsed tag info
 */
export function parseTagContent(tag: string): { content: string, isOutputTag: boolean, isExecutionTag: boolean } {
  let content = ''
  let isOutputTag = false
  let isExecutionTag = false

  if (tag.startsWith('<%- ')) {
    // Extract the content between <%- and %> (or -%>)
    const endOffset = tag.endsWith('-%>') ? 3 : 2
    content = tag.substring(3, tag.length - endOffset).trim()
    isOutputTag = true
  } else if (tag.startsWith('<%=')) {
    // Extract the content between <%= and %> (or -%>)
    const endOffset = tag.endsWith('-%>') ? 3 : 2
    content = tag.substring(3, tag.length - endOffset).trim()
    isOutputTag = true
  } else if (tag.startsWith('<%')) {
    // Extract the content between <% and %> (or -%>)
    const endOffset = tag.endsWith('-%>') ? 3 : 2
    content = tag.substring(2, tag.length - endOffset).trim()
    isExecutionTag = true
  }

  return { content, isOutputTag, isExecutionTag }
}
