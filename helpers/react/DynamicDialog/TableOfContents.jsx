// @flow
//--------------------------------------------------------------------------
// TableOfContents Component
// Creates a clickable table of contents from headings in the form
//--------------------------------------------------------------------------

import React, { useEffect, useState, useRef } from 'react'
import './TableOfContents.css'

export type TableOfContentsProps = {
  label?: string,
  description?: string,
  compactDisplay?: boolean,
}

/**
 * Generate a URL-safe ID from a heading label
 */
function generateHeadingId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Scroll to a heading element by ID
 */
function scrollToHeading(headingId: string): void {
  const element = document.getElementById(headingId)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Add a highlight effect
    element.classList.add('toc-highlight')
    setTimeout(() => {
      element.classList.remove('toc-highlight')
    }, 1000)
  }
}

/**
 * Scroll to the top of the form (TOC container)
 */
function scrollToTop(containerRef: React$RefObject<?HTMLDivElement>): void {
  if (containerRef && containerRef.current) {
    containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } else {
    // Fallback: find the TOC container or scroll to top of page
    const tocContainer = document.querySelector('.table-of-contents-container')
    if (tocContainer) {
      tocContainer.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
}

export function TableOfContents({ label, description, compactDisplay = false }: TableOfContentsProps): React$Node {
  const [headings, setHeadings] = useState<Array<{ id: string, label: string }>>([])
  const containerRef = useRef<?HTMLDivElement>(null)

  useEffect(() => {
    // Function to scroll back to TOC
    const scrollToTOC = () => {
      const tocContainer = document.querySelector('.table-of-contents-container')
      if (tocContainer) {
        tocContainer.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }

    // Find all heading elements in the form and add scroll-to-top buttons
    const findHeadings = (): Array<{ id: string, label: string }> => {
      const headingElements = document.querySelectorAll('.ui-heading')
      const foundHeadings: Array<{ id: string, label: string }> = []

      headingElements.forEach((element, index) => {
        // Extract heading text, excluding any buttons
        let headingText = ''
        const textNodes: Array<string> = []
        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              // Skip text nodes that are inside buttons
              let parent = node.parentNode
              while (parent && parent !== element) {
                if (parent instanceof HTMLElement && parent.classList.contains('ui-heading-scroll-top')) {
                  return NodeFilter.FILTER_REJECT
                }
                parent = parent.parentNode
              }
              return NodeFilter.FILTER_ACCEPT
            },
          },
        )
        let textNode
        while ((textNode = walker.nextNode())) {
          if (textNode.textContent) {
            textNodes.push(textNode.textContent)
          }
        }
        headingText = textNodes.join('').trim()

        // Fallback: if no text found, use textContent and remove button text
        if (!headingText) {
          headingText = element.textContent?.trim() || ''
          // Remove any button text (chevron icons, etc.)
          headingText = headingText.replace(/[\u2191\u2193\u2190\u2192\u25B2\u25BC\u25C0\u25B6]/g, '').trim()
        }

        if (headingText) {
          // Generate ID from heading text
          let headingId = generateHeadingId(headingText)
          // Ensure unique ID by appending index if needed
          let uniqueId = headingId
          let counter = 0
          while (document.getElementById(uniqueId)) {
            counter++
            uniqueId = `${headingId}-${counter}`
          }

          // Set the ID on the heading element if it doesn't have one
          if (!element.id) {
            element.id = uniqueId
          } else {
            uniqueId = element.id
          }

          // Check if heading already has a scroll-to-top button
          const existingButton = element.querySelector('.ui-heading-scroll-top')
          if (!existingButton) {
            // Create and add the scroll-to-top button
            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'ui-heading-scroll-top'
            button.title = 'Scroll back to Table of Contents'
            button.innerHTML = '<i class="fa-solid fa-chevron-up"></i>'
            button.onclick = (e) => {
              e.preventDefault()
              e.stopPropagation()
              scrollToTOC()
            }
            // Ensure the heading has flex layout
            if (!element.classList.contains('ui-heading-with-button')) {
              element.classList.add('ui-heading-with-button')
            }
            element.appendChild(button)
          }

          foundHeadings.push({
            id: uniqueId,
            label: headingText,
          })
        }
      })

      return foundHeadings
    }

    // Initial scan
    const initialHeadings = findHeadings()
    setHeadings(initialHeadings)

    // Set up a MutationObserver to watch for heading changes
    const observer = new MutationObserver(() => {
      const updatedHeadings = findHeadings()
      setHeadings(updatedHeadings)
    })

    // Observe the entire document for changes
    const bodyElement = document.body
    if (bodyElement) {
      observer.observe(bodyElement, {
        childList: true,
        subtree: true,
      })
    }

    // Also scan periodically as a fallback (in case headings are added after initial render)
    const intervalId = setInterval(() => {
      const updatedHeadings = findHeadings()
      if (updatedHeadings.length !== headings.length) {
        setHeadings(updatedHeadings)
      }
    }, 500)

    return () => {
      observer.disconnect()
      clearInterval(intervalId)
    }
  }, [headings.length])

  const handleHeadingClick = (headingId: string) => {
    scrollToHeading(headingId)
  }

  if (headings.length === 0) {
    return null // Don't render if no headings found
  }

  return (
    <div
      ref={containerRef}
      className={`table-of-contents-container ${compactDisplay ? 'compact' : ''}`}
      data-field-type="table-of-contents"
    >
      {label && <div className="table-of-contents-label">{label}</div>}
      <nav className="table-of-contents-nav">
        <ul className="table-of-contents-list">
          {headings.map((heading) => (
            <li key={heading.id} className="table-of-contents-item">
              <button
                type="button"
                className="table-of-contents-link"
                onClick={() => handleHeadingClick(heading.id)}
                title={`Scroll to: ${heading.label}`}
              >
                {heading.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {description && <div className="table-of-contents-description">{description}</div>}
    </div>
  )
}

export default TableOfContents

