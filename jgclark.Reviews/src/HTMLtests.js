// @flow
//-------------------------------------------------------
// Tests for various HTML developments
//-------------------------------------------------------

import { makeSVGPercentRing, redToGreenInterpolation, showHTML } from '@helpers/HTMLView'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { setPercentRingJSFunc } from './reviews'

export function testGenerateCSSFromTheme(): void {
  let themeName = ''
  console.log(`\ngenerateCSSFromTheme ->\n${generateCSSFromTheme(themeName)}`)
  themeName = 'Orange'
  console.log(`\ngenerateCSSFromTheme ->\n${generateCSSFromTheme(themeName)}`)
  themeName = 'Invalid Theme Name'
  console.log(`\ngenerateCSSFromTheme ->\n${generateCSSFromTheme(themeName)}`)
}

/**
 * Show progress circle, just using HTML and CSS
 * Adapted by @jgclark from https://codeconvey.com/css-percentage-circle/
 *
 * Positives: This works in NP!
 * Negatives:
  - Not set up well to adapt to changing sizes
  - Doesn't work as is for more than one circle on the page
 */

export function testCSSCircle(): void {
  HTMLView.showWindow(CSSCircleHTML, 'CSS Circle test', 300, 300)
}

const faLinksInHeader = `<link href="../requiredFiles/projectList.css" rel="stylesheet">
`

const CSSCircleHTML = `
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pure CSS Percentage Circle Demo</title>

<style type="text/css" />
body {
  font-family: "Roboto", sans-serif;
  background:#d7bd94;
}

.circle-wrap { /* outside circle background */
  display: block;
  margin: 0.1rem; /* 50px auto; */
  margin-right: 0.8rem;
  width: 3rem;
  height: 3rem;
  background: #e6e2e7;
  border-radius: 50%;
}

.circle-wrap .circle .mask,
.circle-wrap .circle .fill {
  width: 3rem;
  height: 3rem;
  position: absolute;
  border-radius: 50%;
}

.circle-wrap .circle .mask {
  clip: rect(0px, 3rem, 3rem, 1.5rem);
}

.circle-wrap .circle .mask .fill {
  clip: rect(0px, 1.5rem, 3rem, 0px);
  background-color: #9e00b1;
}

.circle-wrap .circle .mask.fill,
.circle-wrap .circle .fill {
  animation: fill ease-in-out 3s;
  transform: rotate(126deg);
}

@keyframes fill {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(126deg);
  }
}

.circle-wrap .inside-circle { /* Inner white circle, also holding text */
  position: absolute;
  width: 2rem;
  height: 2rem;
  margin: 0.5rem;
  border-radius: 50%;
  background: #fff;
  line-height: 2rem;
  text-align: center;
  z-index: 100;
  font-weight: 500;
  font-size: 0.9rem;
}
</style>
</head>

<body>
<h2>Percentage Circle CSS Only (no JS)</h2>

<div class="circle-wrap">
  <div class="circle">
    <div class="mask full">
      <div class="fill"></div>
    </div>
    <div class="mask half">
      <div class="fill"></div>
    </div>
    <div class="inside-circle">70%</div>
  </div>
</div>
</body>
</html>
`

//-------------------------------------------------------
/**
 * test Red To Green Interpolation by displaying a set of 21
 * circles 0-100%
 */
export function testRedToGreenInterpolation(): void {
  let body = '<p>Testing out the red to green colour interpolation.</p>'
  for (let i = 0; i <= 100; i = i + 5) {
    body += `${redToGreenInterpolation(i)}: ${makeSVGPercentRing(100, redToGreenInterpolation(i), `${i}`, `id${i}`)}
`
  }
  showHTML(
    'Red to Green test',
    faLinksInHeader,
    body,
    '',
    '', // reviewListCSS is now in requiredFiles/projectList.css
    false, // not modal
    setPercentRingJSFunc,
    '',
    'redToGreenInterpolation.test.html',
    300, 300
  )
}

//-------------------------------------------------------
/**
 * Test getting a button to trigger a plugin command
 * Based on what @Eduard has published at ???
 */
export function testButtonTriggerOpenNote(): void {
  try {
    HTMLView.showWindow(openNoteHTML, "testButtonTriggerOpenNote", 200, 200)
  } catch (error) {
    console.log(error)
  }
}

const openSpecificNoteAPICall = JSON.stringify(`
(function() {
  Editor.openNoteByFilename("NotePlan/NotePlan Plugins.md");
})()
`)

const openNoteHTML = `
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <p id="openNoteResultLabel">0</p>
  <button onclick=openNote()>Open Note</button>
</body>
<script>
  const openNote = () => {
    window.webkit.messageHandlers.jsBridge.postMessage({
      code: ${openSpecificNoteAPICall},
      onHandle: "onHandleuUpdateNoteCount",
      id: "1"
    });
  };

  function onHandleuUpdateNoteCount(re, id) {
    document.getElementById("openNoteResultLabel").innerHTML = "done";
  };
</script>
</html>
`

//-------------------------------------------------------
/**
 * Test getting a button to trigger a plugin command
 * Based on the above
 */
export function testButtonTriggerCommand(): void {
  try {
    HTMLView.showWindow(triggerCommandHTML, "testButtonTriggerCommand", 200, 200)
  } catch (error) {
    console.log(error)
  }
}

const startReviewsCommandCall = JSON.stringify(`
  (function() {
    DataStore.invokePluginCommandByName("start reviews", "jgclark.Reviews");
  })()
`)

const triggerCommandHTML = `
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <p id="Label1">Not started</p>
  <button onclick=callCommand()>Start reviews</button>
</body>
<script>
  const callCommand = () => {
    window.webkit.messageHandlers.jsBridge.postMessage({
      code: ${startReviewsCommandCall},
      onHandle: "onHandleUpdateLabel",
      id: "1"
    });
  };

  function onHandleUpdateLabel(re, id) {
    document.getElementById("Label1").innerHTML = "Started!";
  };
</script>
</html>
`
