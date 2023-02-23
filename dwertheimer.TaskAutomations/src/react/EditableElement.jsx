// https://javascript.plainenglish.io/editable-html-in-react-6dd67dd7e302

export const EditableElement = (props) => {
  console.log(`WebView: EditableElement props=`, props)
  const { onChange } = props
  const element = React.useRef()
  let elements = React.Children.toArray(props.children)
  if (elements.length > 1) {
    throw Error("Can't have more than one child")
  }
  const onMouseUp = () => {
    const value = element.current?.value || element.current?.innerText
    onChange(value)
  }
  useEffect(() => {
    const value = element.current?.value || element.current?.innerText
    onChange(value)
  }, [])
  elements = React.cloneElement(elements[0], {
    contentEditable: true,
    suppressContentEditableWarning: true,
    ref: element,
    onKeyUp: onMouseUp,
  })
  // console.log(`WebView: EditableElement elements=`, elements)
  return elements
}

export default EditableElement
