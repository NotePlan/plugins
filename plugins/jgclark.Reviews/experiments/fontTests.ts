// @flow
// --------------------------------
// HTML Test functions
// --------------------------------

// Callable from jgclark.Reviews plugin (at the moment)
export function testFonts(): void {
  const HTML = `<html>
<title>Font Tests</title>
<head>
  <style>
    @font-face { 
      font-family: "noteplanstate"; src: url('noteplanstate.ttf') format('truetype');
    }
    @font-face { 
      font-family: "FontAwesome6Pro-Regular"; src: url('Font Awesome 6 Pro-Regular-400.otf') format('opentype'); 
    }
    @font-face { 
      font-family: "FontAwesome6Pro-Solid"; src: url('Font Awesome 6 Pro-Solid-900.otf') format('opentype'); 
    }
    @font-face { 
      font-family: "FontAwesome6Duotone-Solid"; src: url('Font Awesome 6 Duotone-Solid-900.otf') format('opentype'); 
    }
    html { font-size: 16px; }
    body { font: "Avenir Next" }
    h1 { font: bold 26px; }
    .states { font-family: "noteplanstate"; }
    <!-- .fa-icon { font-family: "FontAwesome6Pro-Regular"; } -->
    .fa-icon { font-family: "FontAwesome6Pro-Solid"; } 
    <!-- .fa-icon { font-family: "FontAwesome6Duotone-Solid"; } -->
  </style>
</head>
<body>
  <h1>Font tests</h1>
  <h2>fontawesome test 1</h2>
  <p><span class="fa-icon">&#x25B6;</span> Start<p>
  <p><span class="fa-icon">&#x23F8;</span> Pause<p>
  <p><span class="fa-icon">&#x23F9;</span> Stop<p>
  <p><span class="fa-icon">&#xF057;</span> Cancel<p>
  <p><span class="fa-icon">&#xF058;</span> Complete<p>
  <p><span class="fa-icon">&#xF361;</span> Refresh 1<p>
  <p><span class="fa-icon">&#xF364;</span> Refresh 2<p>

  <h2>noteplanstate test</h2>
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
