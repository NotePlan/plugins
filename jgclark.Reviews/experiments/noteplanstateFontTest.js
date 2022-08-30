// @flow
// --------------------------------
// HTML Test functions
// --------------------------------

// Callable from jgclark.Reviews plugin (at the moment)
export function testNoteplanStateFont(): void {
  const HTML = `
<html>
<title>noteplanstate font test</title>
<head>
  <style>
    html { font-size: 16px; }
    body { font: "Avenir Next" }
    h1 { font: bold 26px; }
    .states { font-family: "noteplanstate"; }
  </style>
</head>
<body>
  <h1>noteplanstate test</h1>
  <p>All of these are available as single characters using the 'noteplanstate' font:</p>
  <p>'*' &rightarrow; <span class="states">*</span> open</p>
  <p>'c' &rightarrow; <span class="states">c</span> cancelled</p>
  <p>'b' &rightarrow; <span class="states">b</span> scheduled</p>
  <p>'a' &rightarrow; <span class="states">a</span> done</p>
  <p>'x' &rightarrow; <span class="states">x</span></p>
  <p>'-' &rightarrow; <span class="states">-</span> bullet</p>
  <p>']' &rightarrow; <span class="states">]</span></p>
  <p>'[' &rightarrow; <span class="states">[</span></p>
</body>
</html>
`
  HTMLView.showSheet(HTML)
}
