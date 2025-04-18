// @flow
import { useState, useEffect, useCallback } from 'react'
import { getTimeAgoString } from '@helpers/dateTime.js'

const useLastFullRefresh = (lastFullRefresh: Date): string => {
  const [timeAgo, setTimeAgo] = useState<string>(getTimeAgoString(lastFullRefresh))

  // Memoize the update function to prevent unnecessary re-renders
  const updateTimeAgo = useCallback(() => {
    const newTimeAgo = getTimeAgoString(lastFullRefresh)
    // Only update if the display would actually change
    if (newTimeAgo !== timeAgo) {
      setTimeAgo(newTimeAgo)
    }
  }, [lastFullRefresh, timeAgo])

  useEffect(() => {
    updateTimeAgo() // Update timeAgo immediately when lastFullRefresh changes

    const timer = setInterval(updateTimeAgo, 20000)

    return () => clearInterval(timer)
  }, [lastFullRefresh, updateTimeAgo])

  return timeAgo
}

export default useLastFullRefresh
