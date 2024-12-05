// @flow
import React from 'react'

type TextComponentProps = {
  textType: 'title' | 'description' | 'separator',
  label: string,
  disabled?: boolean, // Add disabled prop
}

const TextComponent = ({ textType, label, disabled }: TextComponentProps): React.ReactNode => {
  const className = `text-component ${textType} ${disabled ? 'disabled' : ''}`
  return <div className={className}>{label}</div>
}

export default TextComponent
