// @flow
/**
 * CSS helpers for np.Preview
 * @module previewStyles
 */

/**
 * Return preview-specific CSS so global helpers can stay generic
 * @returns {string}
 */
export function getPreviewSpecificCSS(): string {
  return `
body {
  line-height: var(--body-line-height, 1.6);
  padding: 3rem;
}
p {
  line-height: var(--body-line-height, 1.6);
  margin-bottom: 0.8em;
}
h1 {
  line-height: 1.3;
}
br::after {
  content: "";
  display: block;
  margin-bottom: 0.75em;
}
br + * {
  margin-top: 0.5em;
}
img {
  background: white;
  max-width: 100%;
  max-height: 100%;
}
hr {
  margin-top: 1.5em;
  margin-bottom: 1em;
  border: none;
  height: 0;
  border-top: 1px solid rgba(var(--fg-main-color-rgb, 120, 120, 120), 0.8);
}
hr.with-extra-space {
  margin-top: 3em;
}
.internal-note-link {
  color: var(--tint-color);
  text-decoration: none;
  font-weight: 500;
}
.internal-note-link:hover {
  font-weight: 700;
}
.stickyButton {
  position: sticky;
  float: right;
  top: 6px;
  right: 8px;
}
Button a {
  text-decoration: none;
  font-size: 0.9rem;
}
.frontmatter {
  border-radius: 8px;
  border: 1px solid var(--tint-color);
  padding: 0rem 0.4rem;
  background-color: var(--bg-alt-color);
}
ul,
ol {
  padding-inline-start: 1.5rem;
  margin-inline-start: 0;
}
ul li,
ol li {
  line-height: calc(var(--body-line-height, 2.0));
}
@media print {
  .nonPrinting {
    display: none;
  }
}
`
}
