// @flow

import React from 'react'

type Props = {
  index?: number,
  onClick?: Function,
  onChange?: Function,
  className?: string,
  children?: any,
}

/**
 * Basic button using w3.css
 * @param {*} props
 * @returns a simple w3 styled button
 */
export function Button(props: Props): any {
  const { onClick, className, index } = props
  const cls = className ?? 'w3-btn w3-white w3-border w3-border-blue w3-round'
  return (
    <button className={cls} onClick={(e) => (onClick ? onClick(e, index) : null)} key={index}>
      {props.children}
    </button>
  )
}
export default Button
