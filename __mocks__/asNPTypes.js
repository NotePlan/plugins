// @flow
//-----------------------------------------------------------------------------
// Casts for handing mock objects to functions that take real NotePlan API types.
//
// WHY THIS EXISTS
// `.flowconfig` sets `exact_by_default=true`, so a hand-rolled mock type like
//
//   type MockNote = { filename: string, title: string }
//
// is an *exact* object type. `CoreNoteFields` has ~59 members, and Flow reports one error per
// missing member *per call site* — so a single mock feeding 19 call sites produced 1,121 errors
// in one test file. Writing a fresh `type MockNote` in each test file is what caused the bulk of
// this repo's Flow noise.
//
// Instead: build mocks with the `Note` / `Paragraph` classes from `@mocks/index` (which actually
// implement the API surface), and wrap them at the call site with the casts below.
//
//   import { Note } from '@mocks/index'
//   import { asTNote } from '@mocks/asNPTypes'
//
//   const note = new Note({ filename: 'test.md', content: '# Title\n- task' })
//   const result = someFunctionTakingATNote(asTNote(note))
//
// These are type-level no-ops: they compile away entirely and cost nothing at runtime. Prefer
// them to sprinkling `$FlowIgnore[prop-missing]` above every call — a suppression hides *all*
// errors on the line, including real ones, and (as several files in this repo show) is easy to
// place on the wrong line where it silently suppresses nothing at all.
//-----------------------------------------------------------------------------

/**
 * Present a mock (or partial object literal) as a TNote.
 * @param {any} note
 * @returns {TNote}
 */
export function asTNote(note: any): TNote {
  return (note: any)
}

/**
 * Present a mock (or partial object literal) as a CoreNoteFields.
 * Use when the function under test accepts Editor as well as a Note.
 * @param {any} note
 * @returns {CoreNoteFields}
 */
export function asCoreNoteFields(note: any): CoreNoteFields {
  return (note: any)
}

/**
 * Present a mock (or partial object literal) as a TParagraph.
 * @param {any} para
 * @returns {TParagraph}
 */
export function asTParagraph(para: any): TParagraph {
  return (para: any)
}

/**
 * Present an array of mocks as an array of TNotes.
 * Arrays are invariantly typed, so casting the array itself is required — casting each element
 * is not enough.
 * @param {Array<any>} notes
 * @returns {Array<TNote>}
 */
export function asTNotes(notes: Array<any>): Array<TNote> {
  return (notes: any)
}

/**
 * Present an array of mocks as an array of TParagraphs.
 * @param {Array<any>} paras
 * @returns {Array<TParagraph>}
 */
export function asTParagraphs(paras: Array<any>): Array<TParagraph> {
  return (paras: any)
}
