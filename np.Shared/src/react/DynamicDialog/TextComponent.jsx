// @flow
import React from 'react'

type TextComponentProps = {
  label: string,
  textType: 'title' | 'description' | 'separator' | 'header',
};

const TextComponent = ({ label, textType }: TextComponentProps): React$Node => {
  switch (textType) {
    case 'title':
      return <div className="dropdown-title">{label}</div>
    case 'header':
      return <div className="dropdown-header">{label}</div>
    case 'description':
      return <p>{label}</p>
    case 'separator':
      return <hr />
    default:
      return null
  }
}

export default TextComponent
