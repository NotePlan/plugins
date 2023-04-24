// @flow

import pluginJson from '../../plugin.json'
import * as helpers from './helpers'

export function getFrontmatter(noteContent)
{
  let matches = noteContent.match(/^(#[^\n]+\n)?(\-{3,}\n(\-?[^\-]+)*\-{3,})/);
  if (!matches) return '';
  return matches[2];  
}

export function withoutFrontmatter(noteContent)
{
  let frontmatter = getFrontmatter(noteContent);
  if (frontmatter) {
    return noteContent.replace(frontmatter, '');
  } else {
    return noteContent;
  }
}

export function getPublishedPageGuid(noteContent)
{
  let frontmatter = getFrontmatter(noteContent);
  if (!frontmatter) return '';
  
  let baseUrl = helpers.noteBaseUrl();
  let start = frontmatter.indexOf(baseUrl);
  if (start == -1) return '';
  
  let end = frontmatter.indexOf(')', start);
  if (end == -1) return '';
  
  let slash = frontmatter.indexOf('/', start + baseUrl.length);
  if (slash != -1 && slash < end) end = slash;
  
  return frontmatter.substring(start + baseUrl.length, end);
}

function getTitle(noteContent)
{
  let matches = noteContent.match(/^(#+[^\n]+)/);
  if (!matches) return '';
  return matches[1];
}

export function setFrontmatter(noteContent, frontmatter)
{
  let title = getTitle(noteContent);
  let oldFrontmatter = getFrontmatter(noteContent);
  if (!oldFrontmatter) {
    return (title ? title + '\n' : '') + frontmatter + noteContent.substring(title.length);
  }
  return noteContent.replace(oldFrontmatter, frontmatter);
}

function setFrontmatterKey(frontmatter, key, value)
{
  if (!frontmatter) {
    frontmatter = '---\n---\n';
  }
  
  let index = frontmatter.indexOf(key);
  if (index === -1) {
    let lastLineStart = frontmatter.lastIndexOf('\n---');
    return frontmatter.substring(0, lastLineStart) + '\n' + key + ': ' + value + frontmatter.substring(lastLineStart);
  }
  
  let eol = frontmatter.indexOf('\n', index);
  return frontmatter.substring(0, index) + key + ': ' + value + frontmatter.substring(eol);
}

function removeFrontmatterKey(frontmatter, key)
{
  if (!frontmatter) return frontmatter;
  
  let index = frontmatter.indexOf(key);
  if (index == -1) return frontmatter;
  
  let eol = frontmatter.indexOf('\n', index);
  return frontmatter.substring(0, index) + frontmatter.substring(eol + 1);
}

export function removePublishInfo(frontmatter, config)
{
  frontmatter = removeFrontmatterKey(frontmatter, config.frontmatterLink);
  frontmatter = removeFrontmatterKey(frontmatter, config.frontmatterDate);
  frontmatter = removeFrontmatterKey(frontmatter, config.frontmatterXCallback);
  return frontmatter;
}

export function insertPublishDate(frontmatter, config)
{
  let date = new Date();
  let key = config.frontmatterDate;
  let value = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  return setFrontmatterKey(frontmatter, key, value);
}

export function insertPublishUrl(frontmatter, config, url)
{
  let key = config.frontmatterLink;
  let value = '[' + config.linkText + '](' + url + ')';
  return setFrontmatterKey(frontmatter, key, value);
}

export function insertXCallback(frontmatter, config)
{
  let pluginID = pluginJson['plugin.id'];
  let republishCommand = '[Republish](noteplan://x-callback-url/runPlugin?pluginID=' + pluginID + '&command=publish)';
  let unpublishCommand = '[Unpublish](noteplan://x-callback-url/runPlugin?pluginID=' + pluginID + '&command=unpublish)';
  
  let key = config.frontmatterXCallback;
  if (!key) return frontmatter;
  
  let value = republishCommand + ' ' + unpublishCommand;
  return setFrontmatterKey(frontmatter, key, value);
}