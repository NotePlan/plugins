// @flow

import toml from 'toml';
import json5 from 'json5';
import yaml from 'yaml';
import { showMessage } from '../../nmn.sweep/src/userInput';
import { getTemplateFolder } from './template-folder';

const ALLOWED_FORMATS = ['javascript', 'json', 'json5', 'yaml', 'toml', 'ini'];
const FORMAT_MAP = {
  javascript: 'json5',
  ini: 'toml',
};

export async function getDefaultConfiguration(): Promise<?{
  [string]: ?mixed,
}> {
  const templateFolder = await getTemplateFolder();
  if (templateFolder == null) {
    return {};
  }

  const configFile = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(templateFolder))
    .find((n) => !!n.title?.startsWith('_configuration'));

  const content: ?string = configFile?.content;
  if (content == null) {
    return {};
  }

  const firstCodeblock = content.split('\n```')[1];
  if (firstCodeblock == null) {
    await showMessage('No configuration found in configuration file.');
    return {};
  }

  let [format, ...contents] = firstCodeblock.split('\n');
  contents = contents.join('\n');
  format = format.trim();

  if (!ALLOWED_FORMATS.includes(format)) {
    await showMessage('Invalid configuration format in the config file.');
    return {};
  }
  format = FORMAT_MAP[format] ?? format;

  switch (format) {
    case 'json':
      return parseJSON(contents);
    case 'json5':
      return parseJSON5(contents);
    case 'yaml':
      return parseYAML(contents);
    case 'toml':
      return parseTOML(contents);
  }
}

async function parseJSON(contents: string): Promise<?{ [string]: ?mixed }> {
  try {
    return JSON.parse(contents);
  } catch (e) {
    console.log(e);
    await showMessage(
      'Invalid JSON in your configuration. Please fix it to use configuration',
    );
    return {};
  }
}

export async function parseJSON5(
  contents: string,
): Promise<?{ [string]: ?mixed }> {
  try {
    const value = json5.parse(contents);
    return (value: any);
  } catch (e) {
    console.log(e);
    await showMessage(
      'Invalid JSON5 in your configuration. Please fix it to use configuration',
    );
    return {};
  }
}

async function parseYAML(contents: string): Promise<?{ [string]: ?mixed }> {
  try {
    const value = yaml.parse(contents);
    if (typeof value === 'object') {
      return (value: any);
    } else {
      return {};
    }
  } catch (e) {
    console.log(e);
    await showMessage(
      'Invalid YAML in your configuration. Please fix it to use configuration',
    );
    return {};
  }
}

async function parseTOML(contents: string): Promise<?{ [string]: ?mixed }> {
  try {
    const value = toml.parse(contents);
    if (typeof value === 'object') {
      return (value: any);
    } else {
      return {};
    }
  } catch (e) {
    console.log(e);
    await showMessage(
      'Invalid TOML in your configuration. Please fix it to use configuration',
    );
    return {};
  }
}
