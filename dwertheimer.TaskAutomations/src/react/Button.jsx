/**
 * Basic button using w3.css
 * @param {*} props
 * @returns a simple w3 styled button
 */
export function Button(props) {
  const className = props.className ?? 'w3-btn w3-white w3-border w3-border-blue w3-round'
  return (
    <button className={className} {...props}>
      {props.children}
    </button>
  )
}
export default Button
