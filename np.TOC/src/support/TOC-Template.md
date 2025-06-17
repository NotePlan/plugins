---
title: TOC - Table of Contents Creator
type: templateRunner
launchLink: noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=TOC%20-%20Table%20of%20Contents%20Creator&arg1=false
getNoteTitled: <current>
NOTE1: Change the Table of Contents text below to your own language preferences
writeUnderHeading: [ Table of Contents ](noteplan://x-callback-url/runPlugin?pluginID=np.Templating&command=templateRunner&arg0=TOC%20-%20Table%20of%20Contents%20Creator&arg1=false)
location: replace
NOTE2: WARNING: will replace any text from TOC header down to a ### or ## header
includeH1BlankLineUnder: true
padTextWithSpaces: true
CAPS: true
highlight: false
horizontal: false
indented: true
bullet: "-"
NOTE3: indents and bullet only apply when in vertical output mode (horizontal: false)
NOTE4: Does not work for headings that have links in the text
---

```templatejs
/**
 * Processes the heading text based on settings.
 *
 * @param {string} text - The original heading text.
 * @param {boolean|string} capsSetting - If true, converts text to uppercase.
 * @param {boolean|string} highlightSetting - If true, wraps text with '=='.
 * @returns {string} Processed heading text.
 */
function processHeading(text, capsSetting, highlightSetting) {
  const caps = (capsSetting === true || capsSetting === 'true');
  const highlight = (highlightSetting === true || highlightSetting === 'true');

  // Remove markdown links and keep only the text within square brackets
  let safeText = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Escape brackets for markdown by adding a backslash before [ and ]
  safeText = safeText.replace(/[\[\(]/g, '{').replace(/[\]\)]/g, '}');

  if (caps) {
    safeText = safeText.toUpperCase();
  }
  if (highlight) {
    safeText = '==' + safeText + '==';
  }
  return safeText;
}

/**
 * Extracts the text portion from a markdown link.
 *
 * @param {string} text - The text that may contain markdown links
 * @returns {string} The text with markdown links replaced by their text portion
 */
function extractLinkText(text) {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

let paragraphs = Editor.paragraphs;

// Ensure we have a TOC header; if not, add it.
const head = paragraphs.find(p => p.content === writeUnderHeading);
if (!head) {
  Editor.prependParagraph(`### ${writeUnderHeading}`, "text");
  return;
}

// Capture the pre-existing TOC lines (if any) that follow the TOC header.
// We capture every paragraph's content until we hit a title with headingLevel
// equal to or less than the writeUnderHeading's level.
const headerIndex = paragraphs.findIndex(p => p.content === writeUnderHeading);
const existingTOCLines = [];
if (headerIndex >= 0) {
  const tocHeaderLevel = paragraphs[headerIndex].headingLevel || Infinity;
  for (let i = headerIndex + 1; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    if (para.type === 'title' && para.headingLevel <= tocHeaderLevel) {
      break;
    }
    existingTOCLines.push(para.content);
  }
}

// Check for an existing blank H1 after the TOC header (only if includeH1BlankLineUnder is true).
let blankH1Exists = false;
if ( includeH1BlankLineUnder === true || includeH1BlankLineUnder === 'true') {
  if (headerIndex >= 0) {
    for (let i = headerIndex + 1; i < paragraphs.length; i++) {
      let para = paragraphs[i];
      if (para.type === 'title') {
        if (para.content.trim() === "" && para.headingLevel === 1) {
          blankH1Exists = true;
        }
        break;
      }
    }
  }
}

// Custom filtering: Include all paragraphs of type 'title' that are non-empty and not the TOC header.
// Skip the very first encountered title if its headingLevel is 1.
let firstTitleFound = false;
const headings = paragraphs.filter(p => {
  if (p.type !== 'title' || p.content.trim() === "") return false;
  if (p.content === writeUnderHeading) return false;
  if (!firstTitleFound) {
    firstTitleFound = true;
    if (p.headingLevel === 1) return false;
  }
  return true;
});

const pad = padTextWithSpaces === "true" || padTextWithSpaces === true ? " " : "";
const tocItems = [];
const horizontalMode = ( horizontal === true || horizontal === 'true');
// Retrieve bullet from frontmatter (defaulting to "-" if not set).
const defaultBullet = (typeof bullet !== 'undefined' ? bullet : "-");

headings.forEach((h) => {
  // Process the heading text (CAPS & highlight, plus escaping)
  const processedText = processHeading(h.content, CAPS, highlight);
  // Build the markdown link using the original heading text (for the anchor)
  // First split into text and URL parts
  const match = h.content.match(/\[(.*?)\]\((.*?)\)/);
  if (match) {
    const [_, text, url] = match;
    // Encode the text portion (including spaces)
    const encodedText = text.replace(/ /g, '%20');
    // Replace the URL with U+FFFC (Object Replacement Character)
    const encodedContent = `%5B${encodedText}%5D%28%EF%BF%BC%29`;
    const encLink = `noteplan://x-callback-url/openNote?noteTitle=${encodeURIComponent(Editor.title)}%23${encodedContent}`;
    const markdownLink = `[${pad}${processedText}${pad}](${encLink})`;

    if (horizontalMode) {
      // In horizontal mode, simply add the markdown link.
      tocItems.push(markdownLink);
    } else {
      // For non-horizontal mode, compute indentation.
      let tabs = "";
      if ( indented === true || indented === 'true') {
        // Reduce indent by one level: for headingLevel n, indent with (n - 2) tabs (min 0).
        let numTabs = h.headingLevel - 2;
        if (numTabs < 0) numTabs = 0;
        for (let i = 0; i < numTabs; i++) {
          tabs += "\t";
        }
      }
      // Build the bullet: indentation (if any) plus the bullet text plus a trailing space.
      const indentedBullet = tabs + defaultBullet + " ";
      tocItems.push(indentedBullet + markdownLink);
    }
  } else {
    // If no markdown link found, handle as regular text
    const encodedContent = h.content.replace(/ /g, '%20');
    const encLink = `noteplan://x-callback-url/openNote?noteTitle=${encodeURIComponent(Editor.title)}%23${encodedContent}`;
    const markdownLink = `[${pad}${processedText}${pad}](${encLink})`;

    if (horizontalMode) {
      tocItems.push(markdownLink);
    } else {
      let tabs = "";
      if (indented === true || indented === 'true') {
        let numTabs = h.headingLevel - 2;
        if (numTabs < 0) numTabs = 0;
        for (let i = 0; i < numTabs; i++) {
          tabs += "\t";
        }
      }
      const indentedBullet = tabs + defaultBullet + " ";
      tocItems.push(indentedBullet + markdownLink);
    }
  }
});

// If includeH1BlankLineUnder is true and no blank H1 exists, add a blank H1.
if (( includeH1BlankLineUnder === true || includeH1BlankLineUnder === 'true') && !blankH1Exists) {
  tocItems.push("# ");
}

// Join the items: In horizontal mode, separate with ' | ', otherwise join with newlines.
let output = horizontalMode ? tocItems.join(' | ') : tocItems.join("\n");

// Reassemble the pre-existing TOC lines using the same separator.
const existing = horizontalMode ? existingTOCLines.join(' | ') : existingTOCLines.join("\n");

// Compare the existing TOC with the new output.
const isSame = (existing === output);
if (!isSame) {
  // Log differences line by line.
  const newLines = output.split(horizontalMode ? ' | ' : "\n");
  const existingLines = existing.split(horizontalMode ? ' | ' : "\n");
  console.log("\n\n**************\n\ntemplateRunner TOC Differences between existing and new TOC:");
  for (let i = 0; i < Math.max(newLines.length, existingLines.length); i++) {
    if (newLines[i] !== existingLines[i]) {
      console.log(`Line ${i + 1}:\n\texisting: "${existingLines[i] || ''}"\n\tnew: "${newLines[i] || ''}"`);
    }
  }
  console.log("\n\n**************\n\n");
} else {
  output = "";
  console.log("templateRunner TOC Creator: No differences. Doing nothing")
}

```

<%- output %>