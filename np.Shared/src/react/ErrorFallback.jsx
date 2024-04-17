export const ErrorFallback = ({ error }) => {
  return (
    <div role="alert">
      <h1>Something went wrong in React:</h1>
      <pre>{error.message}</pre>
      <p></p>
      <p>More detail:</p>
      <pre>{JSON.stringify(error, null, 2)}</pre>
    </div>
  )
}
