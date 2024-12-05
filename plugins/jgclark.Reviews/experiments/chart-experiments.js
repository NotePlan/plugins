// @flow
//-----------------------------------------------------------------------------
// chart.js experiments

import { logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'

export function basicChartTest() {
  try {
    HTMLView.showSheet(
      `<html>
          <head>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.4/Chart.js"></script>
          </head>
          <body>
            <canvas id="myChart" style="width:100%;max-width:700px"></canvas>

            <script>
              var xyValues = [
                {x:50, y:7},
                {x:60, y:8},
                {x:70, y:8},
                {x:80, y:9},
                {x:90, y:9},
                {x:100, y:9},
                {x:110, y:10},
                {x:120, y:11},
                {x:130, y:14},
                {x:140, y:14},
                {x:150, y:15}
              ];

              new Chart("myChart", {
                type: "scatter",
                data: {
                  datasets: [{
                    pointRadius: 4,
                    pointBackgroundColor: "rgb(0,0,255)",
                    data: xyValues
                  }]
                },
                options: {
                  legend: {display: false},
                  scales: {
                    xAxes: [{ticks: {min: 40, max:160}}],
                    yAxes: [{ticks: {min: 6, max:16}}],
                  }
                }
              });
              </script>
          </body>
        </html>
    
    `)
  }
  catch (error) {
    logError('basicChartTest', error.message)
  }
}