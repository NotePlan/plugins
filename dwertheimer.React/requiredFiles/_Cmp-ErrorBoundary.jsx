const ErrorFallback = ({ error, resetErrorBoundary }) => {
  return (
    <div role="alert">
      <h1>Something went wrong in React:</h1>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  )
}
