// @flow
// TODO: This needs more thought on classNames of what it returns, as it is now being used by Settings more than Dropdowns (if at all).
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
      return <div className="ui-heading">{label}</div>
    case 'description':
      return <p className="item-description">{label}</p>
    case 'separator':
      return <hr className="ui-separator" />
    default:
      return null
  }
}

export default TextComponent
