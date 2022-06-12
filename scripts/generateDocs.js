const fs = require('fs/promises')
const path = require('path')
const { parse } = require('@babel/parser')
const generate = require('@babel/generator').default
const mkdirp = require('mkdirp')

const pathToNoteplanTypeDefs = path.resolve(__dirname, '../flow-typed/Noteplan.js')
const pathToDocs = path.resolve(__dirname, '../../plugin-docs/docs/plugin-api')

const backtick = '`'
const typescriptStart = '```typescript'
const codeblockFence = '```'

async function generateSimpleTypeAlias(node, index, folderPath = pathToDocs) {
  const title = node.id.name
  const value = node.id.typeAnnotation.typeAnnotation.id.name
  let docs = node.leadingComments?.[node.leadingComments.length - 1]?.value ?? ''

  if (docs) {
    docs = docs
      .split('\n')
      .map((line) => line.trim())
      .map((line) => (line.startsWith('*') ? line.slice(1).trim() : line))
      .join('\n')
  }

  const fileName = `${title}.md`
  const filePath = path.resolve(folderPath, fileName)

  let file = `---
sidebar_position: ${index + 1}
---

# ${title}

${typescriptStart}
declare var ${title}: ${value}
${codeblockFence}

${docs}
`
  await fs.writeFile(filePath, file)
}

async function genDocsForValue(node, index, folderPath = pathToDocs) {
  if (
    node.type === 'DeclareVariable' &&
    node.id.typeAnnotation.type === 'TypeAnnotation' &&
    node.id.typeAnnotation.typeAnnotation.type === 'GenericTypeAnnotation'
  ) {
    await generateSimpleTypeAlias(node, index, folderPath)
  } else if (
    node.type === 'DeclareVariable' &&
    node.id.typeAnnotation.type === 'TypeAnnotation' &&
    node.id.typeAnnotation.typeAnnotation.type === 'ObjectTypeAnnotation'
  ) {
    for (let indexer of node.id.typeAnnotation.typeAnnotation.indexers) {
      console.log(generate(indexer).code)
    }

    for (let prop of node.id.typeAnnotation.typeAnnotation.properties) {
      console.log(generate(prop).code)
    }

    // console.log(node.id.typeAnnotation.typeAnnotation)
  }
}

async function printDocs() {
  const noteplanFlowTypes = await fs.readFile(pathToNoteplanTypeDefs, 'utf8')

  const parsedTypes = parse(noteplanFlowTypes, {
    plugins: ['flow'],
  })

  //   console.log(parsedTypes.program.body[0])
  await mkdirp(pathToDocs)
  await fs.writeFile(path.join(pathToDocs, '_category_.json'), JSON.stringify({ position: 2 }, null, 2))
  for (let i = 0; i < parsedTypes.program.body.length; i++) {
    await genDocsForValue(parsedTypes.program.body[i], i)
  }
}

printDocs()
