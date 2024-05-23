// @flow
import { useState, useEffect } from 'react'
import { getTimeAgo } from '../support/showTimeAgo.js'

const useLastFullRefresh = (lastFullRefresh: Date): string => {
  const [timeAgo, setTimeAgo] = useState<string>(getTimeAgo(lastFullRefresh))

  useEffect(() => {
    setTimeAgo(getTimeAgo(lastFullRefresh)) // Update timeAgo immediately when lastFullRefresh changes

    const timer = setInterval(() => {
      setTimeAgo(getTimeAgo(lastFullRefresh))
    }, 20000)

    return () => clearInterval(timer)
  }, [lastFullRefresh])

  return timeAgo
}

export default useLastFullRefresh
