// @flow
 
import pluginJson from '../plugin.json'
import * as helpers from './support/helpers'
import * as api from './support/api'
import * as parser from './support/parser'
import { log, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'
import { createRunPluginCallbackUrl } from '@helpers/general'

function processApiResponse(response)
{
    response = JSON.parse(response);
    let config = helpers.getOrSetupSettings();
    let url = helpers.getPreviewUrl(response, config);
    
    let content = Editor.content;
    let frontmatter = parser.getFrontmatter(content);
    
    frontmatter = parser.insertPublishUrl(frontmatter, config, url);
    frontmatter = parser.insertPublishDate(frontmatter, config);
    frontmatter = parser.insertXCallback(frontmatter, config);
    content = parser.setFrontmatter(content, frontmatter);
    
    Editor.content = content;
    NotePlan.openURL(url);
}

// eslint-disable-next-line require-await
export async function publish(): Promise<void> {
    let config = helpers.getOrSetupSettings();
    let secret = config.secret;
    let accessKey = config.accessKey;

    let noteTitle = Editor.title;
    let noteContent = Editor.content;
    let guid = parser.getPublishedPageGuid(noteContent);    
    let publishedContent = parser.withoutFrontmatter(noteContent);
    
    if (guid) {
        logDebug(pluginJson, 'Calling update API for a note ' + guid + '...');
        api.doUpdatePublished(guid, noteTitle, publishedContent, secret, accessKey)
            .then(function(response) {
                processApiResponse(response);
            })
            .catch(function(error) {
                logWarn(pluginJson, 'Updating request failed: ' + error);
            });
    } else {
        logDebug(pluginJson, 'Calling publish API...');
        api.doPublish(noteTitle, publishedContent, secret, accessKey)
            .then(function(response) {
                processApiResponse(response);
            })
            .catch(function(error) {
                logWarn(pluginJson, 'Publishing request failed: ' + error);
            });
    }
}

// eslint-disable-next-line require-await
export async function unpublish(): Promise<void> {
    let config = helpers.getOrSetupSettings();
    let accessKey = config.accessKey;
    let noteContent = Editor.content;
    let guid = parser.getPublishedPageGuid(noteContent);
    if (!guid) {
        logWarn(pluginJson, 'No published note detected.');
        return;
    }

    api.doUnpublish(guid, accessKey)
        .then(function(response) {
            logDebug(pluginJson, 'Unpublished successfully');
            
            let config = helpers.getOrSetupSettings();
            let noteContent = Editor.content;
            let frontmatter = parser.getFrontmatter(noteContent);
            frontmatter = parser.removePublishInfo(frontmatter, config);
            if (frontmatter == '---\n---\n') frontmatter = '';
            Editor.content = parser.setFrontmatter(noteContent, frontmatter);
        })
        .catch(function(error) {
            logWarn(pluginJson, 'Unpublish failed: ' + error);
        });
}

