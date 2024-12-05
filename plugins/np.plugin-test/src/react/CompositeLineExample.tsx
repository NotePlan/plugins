import React from 'react'
import Button from './Button.jsx'

// @flow

type Props = {
  index: number,
  textValue: string,
  buttonText: String,
  onSubmitClick?: Function,
  textValue: String,
}

const w3cssColors = [
  'red',
  'pink',
  'purple',
  'deep-purple',
  'indigo',
  'blue',
  'light-blue',
  'cyan',
  'aqua',
  'teal',
  'green',
  'light-green',
  'lime',
  'sand',
  'khaki',
  'yellow',
  'amber',
  'orange',
  'deep-orange',
  'blue-gray',
  'brown',
  'light-gray',
  'gray',
  'dark-gray',
  'pale-red',
  'pale-yellow',
  'pale-green',
  'pale-blue',
]

const CompositeLineExample = (props: Props): any => {
  const { index, onSubmitClick, buttonText, textValue } = props
  return (
    <div className={`w3-cell-row w3-${w3cssColors[index]}`}>
      <div className="w3-cell">
        <div>{textValue}</div>
      </div>
      <div className="w3-cell">
        <Button index={index} onClick={onSubmitClick}>
          {buttonText}
        </Button>
      </div>
    </div>
  )
}

export default CompositeLineExample
