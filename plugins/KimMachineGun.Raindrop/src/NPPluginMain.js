// @flow
// Plugin code goes in files like this. Can be one per command, or several in a file.
// `export async function [name of jsFunction called by Noteplan]`
// then include that function name as an export in the index.js file also
// About Flow: https://flow.org/en/docs/usage/#toc-write-flow-code
// Getting started with Flow in NotePlan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

// NOTE: This file is named NPPluginMain.js (you could change that name and change the reference to it in index.js)
// As a matter of convention, we use NP at the beginning of files which contain calls to NotePlan APIs (Editor, DataStore, etc.)
// Because you cannot easily write tests for code that calls NotePlan APIs, we try to keep the code in the NP files as lean as possible
// and put the majority of the work in the /support folder files which have Jest tests for each function
// support/helpers is an example of a testable file that is used by the plugin command
// REMINDER, to build this plugin as you work on it:
// From the command line:
// `noteplan-cli plugin:dev KimMachineGun.Raindrop --test --watch --coverage`

/**
 * LOGGING
 * A user will be able to set their logging level in the plugin's settings (if you used the plugin:create command)
 * As a general rule, you should use logDebug (see below) for messages while you're developing. As developer,
 * you will set your log level in your plugin preferences to DEBUG and you will see these messages but
 * an ordinary user will not. When you want to output a message,you can use the following
 * logging level commands for different levels of messages:
 *
 * logDebug(pluginJson,"Only developers or people helping debug will see these messages")
 * log(pluginJson,"Ordinary users will see these informational messages")
 * logWarn(pluginJson,"All users will see these warning/non-fatal messages")
 * logError(pluginJson,"All users will see these fatal/error messages")
 */
import pluginJson from '../plugin.json'
import {JSP, logError} from '@helpers/dev'


export async function searchAndInsertOrCopy(): Promise<void> {
    await searchInRaindrop(insertOrCopyRaindropTitle)
}

export async function searchAndCreateNote(): Promise<void> {
    await searchInRaindrop(createRaindropNote)
}

async function searchInRaindrop(cb: (raindrop: Raindrop) => Promise<void>): Promise<void> {
    const settings = DataStore.settings
    const accessToken = settings.accessToken ?? ''
    if (accessToken === '') {
        logError(pluginJson, `Please configure your access token first.`)
        return
    }

    // every command/plugin entry point should always be wrapped in a try/catch block
    try {
        const search = await CommandBar.showInput(`Search`, `Search in Raindrop.io with '%@'`) ?? ''
        if (search === '') {
            logError(pluginJson, `Too short search term.`)
            return
        }

        let raindrops = []
        for (let i = 0; ; i++) {
            const raw = await requestToRaindrop('GET', `https://api.raindrop.io/rest/v1/raindrops/0?search=${encodeURIComponent(search)}&page=${encodeURIComponent(i)}&perPage=50`)

            const response = JSON.parse(raw)
            if (!response.result) {
                logError(pluginJson, `An error occurred during searching.`)
                return
            }

            const raindropsInPage: Array<Raindrop> = response.items ?? []
            raindrops = raindrops.concat(raindropsInPage)
            if (raindrops.length === 0) {
                await CommandBar.prompt(
                    'Not Found',
                    `Nothing found in all raindrops with '${search}'`,
                )
                logError(pluginJson, `Nothing found in all raindrops.`)
                return
            }

            const titles: string[] = raindrops.map((x) => {
                if (x.tags.length === 0) {
                    return x.title
                }
                const tags = x.tags.map(x => `#${x}`).join(',')
                return `${x.title} / ${tags}`
            })
            titles.push('Load More...')

            const selected = await CommandBar.showOptions(titles, `Found ${raindrops.length} raindrops`)
            if (selected.index === titles.length - 1) {
                continue
            }

            await cb(raindrops[selected.index])
            break
        }
    } catch (error) {
        logError(pluginJson, JSP(error))
    }
}

async function insertOrCopyRaindropTitle(rd: Raindrop) {
    let linkedTitle = `[${rd.title}](${rd.link})`
    if (rd.tags.length > 0) {
        linkedTitle = `${linkedTitle} ${rd.tags.map(formatTag).join(' ')}`
    }

    if (Editor.note == null) {
        Clipboard.string = linkedTitle
        await CommandBar.prompt(
            'Note Not Opened',
            `Copy '${linkedTitle}' to your clipboard.`,
        )
    } else {
        Editor.insertTextAtCursor(linkedTitle)
    }
}

async function createRaindropNote(rd: Raindrop) {
    const settings = DataStore.settings
    const noteFolder = settings.noteFolder ?? ''

    const title = `[${rd.title}](${rd.link})`

    let body = ''
    const collection = await fetchCollection(rd.collection.$id)
    if (collection) {
        body = `${body}**Collection:** \`${collection._id === -1 ? 'Unsorted' : collection.title}\`\n`
    }
    if (rd.excerpt !== '' || rd.highlight.body !== '') {
        body = `${body}**Description:**\n> ${rd.excerpt || rd.highlight.body}\n`
    }
    if (rd.tags.length !== 0) {
        body = `${body}**Tags:**\n${rd.tags.map(formatTag).map(x => `- ${x}`).join('\n')}\n`
    }
    body = `${body}---\n`

    const filename = await createNoteIfNotExists(title, noteFolder, body)
    await Editor.openNoteByFilename(filename)
}

async function createNoteIfNotExists(title: string, folder: string, content?: string): string {
    const existingNotes = DataStore.projectNoteByTitle(title, true, false) ?? []
    if (existingNotes.length === 0) {
        if (content) {
            content = `# ${title}\n${content}`
            return await DataStore.newNoteWithContent(content, folder)
        } else {
            return await DataStore.newNote(title, folder)
        }
    }
}

function formatTag(tag: string): string {
    const prefix = DataStore.settings.tagPrefix ?? ''
    return `#${prefix}${tag.replaceAll(' ', '_').toLowerCase()}`
}

async function fetchCollection(id: number): ?Collection {
    const raw = await requestToRaindrop('GET', `https://api.raindrop.io/rest/v1/collection/${id}`)
    const response = JSON.parse(raw)
    if (!response.result) {
        logError(pluginJson, `An error occurred during fetching collection.`)
        return null
    }
    return response.item
}

async function requestToRaindrop(method: string, url: string, init?: RequestInit): Promise<Response> {
    const settings = DataStore.settings
    const accessToken = settings.accessToken ?? ''
    if (accessToken === '') {
        logError(pluginJson, `Please configure your access token first.`)
    }

    return await fetch(url, {
        method: method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
        ...init
    })
}
