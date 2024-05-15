import { JSP, formatReactError, clo } from '@helpers/react/reactDev'

export const ErrorFallback = (props) => {
  clo(props)
  const { error } = props
  const formatted = formatReactError(error)
  return (
    <div role="alert">
      <h1>Something went wrong in React:</h1>
      <pre>
        {formatted.name}: {formatted.message}
      </pre>
      <p></p>
      <p>See more detail in the console</p>
    </div>
  )
}
