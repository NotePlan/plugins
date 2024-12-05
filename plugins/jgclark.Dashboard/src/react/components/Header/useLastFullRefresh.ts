// @flow
import { useState, useEffect } from 'react'
import { getTimeAgoString } from '@np/helpers/dateTime.js'
 
const useLastFullRefresh = (lastFullRefresh: Date): string => {
  const [timeAgo, setTimeAgo] = useState<string>(getTimeAgoString(lastFullRefresh))
 
  useEffect(() => {
    setTimeAgo(getTimeAgoString(lastFullRefresh)) // Update timeAgo immediately when lastFullRefresh changes

    const timer = setInterval(() => {
      setTimeAgo(getTimeAgoString(lastFullRefresh))
    }, 20000)

    return () => clearInterval(timer)
  }, [lastFullRefresh])

  return timeAgo
}

export default useLastFullRefresh
