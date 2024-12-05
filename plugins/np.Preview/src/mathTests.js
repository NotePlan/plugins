// @flow

import { logDebug, logError } from '@helpers/dev'
import { showHTML } from '@helpers/HTMLView'

//--------------------------------------------------------------
// MathML syntax
//--------------------------------------------------------------
/**
 * Simplest version from https://docs.mathjax.org/en/latest/basic/mathematics.html, in one file with library drawn live from CDN
 */
export function testMathML1(): void {
  try {

    // Use single HTML string
    logDebug('testMathML1', `writing results to HTML output ...`)
    HTMLView.showWindow(`<!DOCTYPE html>
<html>
<head>
<title>MathJax MathML Test 1</title>
<script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
<script type="text/javascript" id="MathJax-script" async
  src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/mml-chtml.js">
</script>
</head>
<body>
<h3>MathJax MathML Test 1</h3>
<p>
When
<math xmlns="http://www.w3.org/1998/Math/MathML">
  <mi>a</mi><mo>&#x2260;</mo><mn>0</mn>
</math>,
there are two solutions to
<math xmlns="http://www.w3.org/1998/Math/MathML">
  <mi>a</mi><msup><mi>x</mi><mn>2</mn></msup>
  <mo>+</mo> <mi>b</mi><mi>x</mi>
  <mo>+</mo> <mi>c</mi> <mo>=</mo> <mn>0</mn>
</math>
and they are
<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mi>x</mi> <mo>=</mo>
  <mrow>
    <mfrac>
      <mrow>
        <mo>&#x2212;</mo>
        <mi>b</mi>
        <mo>&#x00B1;</mo>
        <msqrt>
          <msup><mi>b</mi><mn>2</mn></msup>
          <mo>&#x2212;</mo>
          <mn>4</mn><mi>a</mi><mi>c</mi>
        </msqrt>
      </mrow>
      <mrow>
        <mn>2</mn><mi>a</mi>
      </mrow>
    </mfrac>
  </mrow>
  <mtext>.</mtext>
</math>
</p>

</body>
</html>`, 'testMathML1') // not giving window dimensions
    logDebug('testMathML1', `written results to HTML`)
  }
  catch (error) {
    logError('testMathML1', error.message)
  }
}

/**
 * As test1 above, but now using my showHTML() helper
 * Works in NP and saved output in Safari.
 */
export function testMathML2(): void {
  try {
    // Show the list(s) as HTML, and save a copy as file
    logDebug('testMathML2', `writing results to HTML output ...`)
    showHTML('MathML TeX Test Page 2',
      '', // no extra header tags
      `<h3>MathJax MathML Test 2</h3>
<p>
When
<math xmlns="http://www.w3.org/1998/Math/MathML">
  <mi>a</mi><mo>&#x2260;</mo><mn>0</mn>
</math>,
there are two solutions to
<math xmlns="http://www.w3.org/1998/Math/MathML">
  <mi>a</mi><msup><mi>x</mi><mn>2</mn></msup>
  <mo>+</mo> <mi>b</mi><mi>x</mi>
  <mo>+</mo> <mi>c</mi> <mo>=</mo> <mn>0</mn>
</math>
and they are
<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mi>x</mi> <mo>=</mo>
  <mrow>
    <mfrac>
      <mrow>
        <mo>&#x2212;</mo>
        <mi>b</mi>
        <mo>&#x00B1;</mo>
        <msqrt>
          <msup><mi>b</mi><mn>2</mn></msup>
          <mo>&#x2212;</mo>
          <mn>4</mn><mi>a</mi><mi>c</mi>
        </msqrt>
      </mrow>
      <mrow>
        <mn>2</mn><mi>a</mi>
      </mrow>
    </mfrac>
  </mrow>
  <mtext>.</mtext>
</math>
</p>
`,
      '', // get general CSS set automatically
      '',
      false, // = not modal window
      `<script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
<script type="text/javascript" id="MathJax-script" async
  src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/mml-chtml.js">
</script>
`,
      ``,
      'mathml-test2.html',
      600,
      400
    )
    logDebug('testMathML2', `written results to HTML`)
  }
  catch (error) {
    logError('testMathML2', error.message)
  }
}

//--------------------------------------------------------------
// MathJax syntax
//--------------------------------------------------------------
/**
 * Simplest version in one file with library drawn live from CDN
 * FIXME: Doesn't fully work in NP
 */
export function testMathJax1(): void {
  try {

    // Use single HTML string
    logDebug('testMathJax1', `writing results to HTML output ...`)
    HTMLView.showWindow(`<!DOCTYPE html>
<html>
<head>
<title>MathJax TeX Test Page</title>
<script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
<script type="text/javascript" id="MathJax-script" async
  src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js">
</script>
</head>
<body>
When \(a \ne 0\), there are two solutions to \(ax^2 + bx + c = 0\) and they are
$$x = {-b \pm \sqrt{b^2-4ac} \over 2a}.$$
</body>
</html>`, 'testMathJax1') // not giving window dimensions
    logDebug('testMathJax1', `written results to HTML`)
  }
  catch (error) {
    logError('testMathJax1', error.message)
  }
}

/**
 * More complex version using my showHTML() helper
 * FIXME: Doesn't fully work in NP or Safari
 */
export function testMathJax2(): void {
  try {
    // Show the list(s) as HTML, and save a copy as file
    logDebug('testMathJax2', `writing results to HTML output ...`)
    showHTML('MathJax TeX Test Page 2',
      '', // no extra header tags
      `<h3>Some example MathJax</h3>
When \(a \ne 0\), there are two solutions to \(ax^2 + bx + c = 0\) and they are
$$x = {-b \pm \sqrt{b^2-4ac} \over 2a}.$$
`,
      '', // get general CSS set automatically
      '',
      false, // = not modal window
      `<script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
<script type="text/javascript" id="MathJax-script" async
  src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js">
</script>`,
      ``,
      'mathjax-test2.html',
      600, 400)
    logDebug('testMathJax2', `written results to HTML`)
  }
  catch (error) {
    logError('testMathJax2', error.message)
  }
}

/**
 * As test2 but now using local version of MathJax libraries
 * FIXME: Doesn't fully work in NP and output doesn't work at all in Safari
 */
export function testMathJax3(): void {
  try {

    // Show the list(s) as HTML, and save a copy as file
    logDebug('testMathJax3', `writing results to HTML output ...`)
    showHTML('MathJax TeX Test Page 3',
      '', // no extra header tags
      `<h3>Some example MathJax</h3>
When \(a \ne 0\), there are two solutions to \(ax^2 + bx + c = 0\) and they are
$$x = {-b \pm \sqrt{b^2-4ac} \over 2a}.$$
`,
      '', // get general CSS set automatically
      '',
      false, // = not modal window
      `<script src="polyfill.min.js"></script>
<script type="text/javascript" id="MathJax-script" async
  src="tex-chtml.js">
</script>`,
      ``,
      'mathjax-test3.html',
      600, 400)
    logDebug('testMathJax3', `written results to HTML`)
  }
  catch (error) {
    logError('testMathJax3', error.message)
  }
}
