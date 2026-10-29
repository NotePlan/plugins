// @flow
//--------------------------------------------------------------------------
// Due date chip for a task row: flag + "N days" / "today" / "N days ago".
// Due-soon sits at the end of the task text. Today and overdue follow OVERDUE_CHIP_PLACE in ItemContent.
// Last updated 2026-10-11
//--------------------------------------------------------------------------
import React, { type Node } from 'react'
import { type dueDateSoonChip as dueDateChipInfo } from '@helpers/dueStartDates'

type Props = {
  chip: dueDateChipInfo,
  /** 'start' is before the task words. 'end' is after them. */
  place: 'start' | 'end',
}

/**
 * Countdown chip in the task text. Caller decides whether a chip applies.
 */
function DueDateChip({ chip, place }: Props): Node {
  const className = `${chip.urgent ? 'dueDateOverdueChip' : 'dueDateSoonChip'}${place === 'start' ? ' dueDateChipAtStart' : ' dueDateChipAtEnd'}`
  return (
    <span className={className}>
      <i className="fa-regular fa-flag pad-right" aria-hidden="true" />
      {chip.label}
    </span>
  )
}

export default DueDateChip
