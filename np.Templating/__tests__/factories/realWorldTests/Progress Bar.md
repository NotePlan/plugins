---
title: Progress Bar
type: template-fragment
---
```templatejs
/**
 * Generates a string representation of a block-style progress bar with an optional caption.
 *
 * The progress bar is rendered using solid ("█") and hollow ("░") block characters,
 * with the number of solid blocks representing completed progress. An optional caption
 * (e.g. "(3/10)") can be added to the right side of the bar via the `rightSideCaption` parameter.
 *
 * @param {number} progressBarWidth - Total number of blocks in the progress bar.
 * @param {number} progressBarProgress - Number of blocks that should be rendered as "complete".
 * @param {string} [rightSideCaption] - Optional text to append to the right of the progress bar.
 * @returns {string} The progress bar string, composed of "█" for completed progress and "░" for remaining,
 *                   optionally followed by a right-side caption.
 *
 * @example
 * getProgressBarString(10, 4, '(4/10)'); // returns "████░░░░░░ (4/10)"
 * getProgressBarString(5, 2); // returns "██░░░"
 */
function getProgressBarString(progressBarWidth, progressBarProgress, rightSideCaption = '') {
	let progressBar = "";
	for (let i = 0; i < progressBarWidth; i++) {
		progressBar += i < progressBarProgress ? "█" : "░";
	}
	return progressBar + (rightSideCaption ? ` ${rightSideCaption}` : '');
}

```