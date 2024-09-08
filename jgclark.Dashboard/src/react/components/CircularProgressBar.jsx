// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a Progress Circle
// Called by ProjectIcon component
// Last updated 2024-08-25 for v2.0.6 by @jgclark
//
// Note: based on https://dev.to/jackherizsmith/making-a-progress-circle-in-react-3o65
//--------------------------------------------------------------------------

import { type Node } from 'react'

type ProgressBarProps = {
  size: number,
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
    trackWidth = 10,
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
  const hideLabel = (size < 100 || !label.length || spinnerMode) ? true : false

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