/* eslint-disable require-await */
/* eslint-disable prefer-template */
// @flow
//-----------------------------------------------------------------------------
// Commands for Reviewing project-style notes, GTD-style.
// Barrel re-exports from reviewsList.js and reviewsActions.js.
//
// The major part is creating HTML view for the review list.
// This doesn't require any comms back to the plugin through bridges;
// all such activity happens via x-callback calls for simplicity.
//
// It draws its data from an intermediate 'full review list' CSV file, which is (re)computed as necessary.
//
// by @jgclark
// Last updated 2026-08-17 for v2.0.6+, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

export { RICH_PROJECT_LIST_WIN_ID } from './reviewsConstants'

export {
  clearProjectReviewingInHTML,
  displayProjectLists,
  generateProjectListsAndRenderIfOpen,
  generateReviewOutputLines,
  onDashboardFolderFiltersChanged,
  redisplayProjectListHTML,
  renderProjectLists,
  renderProjectListsHTML,
  renderProjectListsIfOpen,
  renderProjectListsMarkdown,
  saveDisplayFilters,
  saveHiddenProjectTypeTags,
  setReviewingProjectInHTML,
  toggleDisplayFinished,
  toggleDisplayNextActions,
  toggleDisplayOnlyDue,
} from './reviewsList'

export {
  finishReview,
  finishReviewAndStartNextReview,
  finishReviewForNote,
  nextReview,
  setNewReviewInterval,
  skipReview,
  skipReviewForNote,
  startReviewForNote,
  startReviews,
} from './reviewsActions'
