---
title: Refreshable Content Section
type: template-fragment
---
```templatejs
/**************************************
 *  REFRESHABLE CONTENT SECTION SNIPPET *
 **************************************/
/*
 * Works with Template Runner to create a refreshable content section with a refresh header in writeUnderHeading
 * Does not write if the results have not changed
 * Requires the following vars to be exist ahead of this code import
 * writeUnderHeading - the name of the heading (probably a refresh link) - likely in the frontmatter of TR temp
 * getOutputText() - a function that outputs the string of output text that should be output
 */

/**************************************
 *       I/O MANAGEMENT SECTION       *
 **************************************/

// Get the current paragraphs from the Editor.
let paragraphs = Editor.paragraphs;

// Ensure we have a header; if not, add it.
const head = paragraphs.find(p => p.content === writeUnderHeading);
if (!head) {
  Editor.prependParagraph(`### ${writeUnderHeading}`, "text");
  return;
}

/**
 * Captures the existing section lines from the document.
 *
 * @returns {string} The existing section content.
 */
function getExistingLineText() {
  const headerIndex = paragraphs.findIndex(p => p.content === writeUnderHeading);
  const existingLines = [];
  if (headerIndex >= 0) {
    const sectionHeadingLevel = paragraphs[headerIndex].headingLevel || Infinity;
    for (let i = headerIndex + 1; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      if (para.type === 'title' && para.headingLevel <= sectionHeadingLevel) {
        break;
      }
      existingLines.push(para.content);
    }
  }
  return existingLines.join("\n") || "";
}

// Move blankH1AlreadyExists here.
/**
 * Checks for an existing blank H1 immediately under the Section header.
 *
 * @returns {boolean} True if a blank H1 exists, false otherwise.
 */
function blankH1AlreadyExists() {
  const headerIndex = paragraphs.findIndex(p => p.content === writeUnderHeading);
  if (headerIndex >= 0) {
    for (let i = headerIndex + 1; i < paragraphs.length; i++) {
      let para = paragraphs[i];
      if (para.type === 'title') {
        if (para.content.trim() === "" && para.headingLevel === 1) {
          return true;
        }
        break;
      }
    }
  }
  return false;
}

// Build the new Section using our Section Builder.
let output = getOutputText();
console.log(`Inside Refreshable Content Section: output was ${output}`);

const existingStr = getExistingLineText()||"";

// Compare the existing section with the new output.
const isSame = output.trim() === "" || (existingStr.trim() === output.trim());
if (!isSame) {
  // Log differences line by line.
  const newLines = output.split("\n");
  const existingLines = existingStr.split("\n");
  console.log("\n\n**************\n\ntemplateRunner Refreshable Content Differences between existing and new:");
  for (let i = 0; i < Math.max(newLines.length, existingLines.length); i++) {
    if (newLines[i] !== existingLines[i]) {
      console.log(`Line ${i + 1}:\n\texisting: "${existingLines[i] || ''}"\n\tnew: "${newLines[i] || ''}"`);
    }
  }
  console.log("\n\n**************\n\n");
  output = blankH1AlreadyExists() ? output : `\n${output}\n# `;
} else {
  output = "";
  console.log("templateRunner Refreshable Content: No differences. Doing nothing");
}
```
<%- output -%>