import React from 'react'

// @flow

type Props = {
  onChange?: Function,
  onClick?: Function,
  index?: number,
  checked?: boolean,
}

const Checkbox = (props: Props): any => {
  const { onChange, onClick, index, checked } = props
  return <input className="w3-check" onChange={(e) => onChange(e, index)} onClick={(e) => onClick(e, index)} type="checkbox" checked={checked} key={index} />
}

export default Checkbox
