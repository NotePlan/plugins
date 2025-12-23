// @flow
//--------------------------------------------------------------------------
// FormPreview Component - Right column showing live preview of the form
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
import DynamicDialog from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import { type TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'
import { type NoteOption } from '@helpers/react/DynamicDialog/NoteChooser.jsx'
import { stripDoubleQuotes } from '@helpers/stringTransforms'

type FormPreviewProps = {
  frontmatter: { [key: string]: any },
  fields: Array<TSettingItem>,
  folders: Array<string>,
  notes: Array<NoteOption>,
  requestFromPlugin: (command: string, data?: any) => Promise<any>,
}

export function FormPreview({ frontmatter, fields, folders, notes, requestFromPlugin }: FormPreviewProps): Node {
  return (
    <div className="form-builder-preview">
      <div className="form-section-header">
        <h3>Preview</h3>
      </div>
      <div className="form-preview-container">
        <div className="form-preview-window">
          <div className="form-preview-window-titlebar">
            <span className="form-preview-window-title">{stripDoubleQuotes(frontmatter.windowTitle || '') || 'Form Window'}</span>
          </div>
          <div className="form-preview-window-content">
            <DynamicDialog
              isOpen={true}
              isModal={false}
              title={stripDoubleQuotes(frontmatter.formTitle || '') || 'Form Heading'}
              items={fields}
              hideHeaderButtons={true}
              onSave={() => {}}
              onCancel={() => {}}
              handleButtonClick={() => {}}
              style={{ width: '100%', maxWidth: '100%', margin: 0 }}
              allowEmptySubmit={frontmatter.allowEmptySubmit || false}
              hideDependentItems={frontmatter.hideDependentItems || false}
              folders={folders}
              notes={(notes: any)} // NoteOption array - cast to any to avoid Flow invariant array type issues
              requestFromPlugin={requestFromPlugin}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default FormPreview

