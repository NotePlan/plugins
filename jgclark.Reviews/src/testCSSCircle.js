/**
 * Show progress circle, just using HTML and CSS
 * Adapted by @jgclark from https://codeconvey.com/css-percentage-circle/
 * 
 * Positives: This works in NP!
 * Negatives: 
  - Not set up well to adapt to changing sizes
  - Doesn't work as is for more than one circle on the page
 */

const rawHTML = `
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

export function testCSSCircle(): void {
  HTMLView.showSheet(rawHTML)
}
