// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a Progress Circle
// Called by ProjectIcon component
// Last updated 2024-09-21 for v2.0.6+ by @jgclark
//
// Note: based on https://dev.to/jackherizsmith/making-a-progress-circle-in-react-3o65
//--------------------------------------------------------------------------

import React, { type Node } from 'react'

type ProgressBarProps = {
  // Both call sites pass a CSS length string ('0.9rem' / '1.0rem'), which is what actually renders;
  // `size` is only ever used as a CSS width/height, plus the numeric `size < 100` test below.
  size: number | string,
  progress: number,
  backgroundColor: string,
  trackWidth: number,
  trackColor: string,
  indicatorRadius: number,
  indicatorWidth: number,
  indicatorColor: string,
  indicatorCap: string,
  label?: string,
  labelColor?: string,
  spinnerMode?: boolean,
  spinnerSpeed?: number,
}

function CircularProgressBar(props: ProgressBarProps): Node {
  const {
    size = 100,
    progress = 0,
    backgroundColor = `#eee`,
    trackWidth = 8,
    trackColor = `#ddd`,
    indicatorRadius = 25,
    indicatorWidth = 20,
    indicatorColor = `#07c`,
    indicatorCap = `round`,
    label = `Loading...`,
    labelColor = `#333`,
    spinnerMode = false,
    spinnerSpeed = 1
  } = props

  const trackRadius = (100 - trackWidth) / 2
  const dashArray = 2 * Math.PI * indicatorRadius
  const dashOffset = dashArray * ((100 - progress) / 100)
  // Cast: `size` can be a CSS length string, and JS makes any `'0.9rem' < 100` comparison false;
  // this test is only meaningful for the numeric form, which is the pre-existing behaviour.
  const hideLabel = ((size: any) < 100 || !label.length || spinnerMode) ? true : false

  return (
    <>
      <div
        className="svg-pi-wrapper"
        style={{ width: size, height: size }}
      >
        <svg
          className="svg-pi"
          viewBox="0 0 100 100"
        // style={{ width: size, height: size }}
        >
          <circle
            className="svg-pi-track"
            cx="50%"
            cy="50%"
            fill={backgroundColor}
            r={`${trackRadius}%`}
            strokeWidth={`${trackWidth}%`}
            stroke={trackColor}
          />
          <circle
            className={`svg-pi-indicator ${spinnerMode ? "svg-pi-indicator--spinner" : ""
              }`}
            style={{ animationDuration: spinnerSpeed * 1000 }}
            cx="50%"
            cy="50%"
            fill="transparent"
            r={`${indicatorRadius}%`}
            stroke={indicatorColor}
            strokeWidth={`${indicatorWidth}%`}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap={indicatorCap}
          />
        </svg>

        {!hideLabel && (
          <div
            className="svg-pi-label"
            style={{ color: labelColor }}
          >
            <span className="svg-pi-label__loading">
              {label}
            </span>

            {!spinnerMode && (
              <span className="svg-pi-label__progress">
                {`${progress > 100 ? 100 : progress
                  }%`}
              </span>
            )}
          </div>
        )}

      </div>
    </>
  )
}

export default CircularProgressBar