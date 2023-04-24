// @flow

import * as helpers from './helpers'

export function doPublish(title, content, secret, accessKey)
{
    return fetch(helpers.apiUrl('notes'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + accessKey
        },
        body: JSON.stringify({
            'password': secret,
            'title': title,
            'content': content
        })
    });
}

export function doUpdatePublished(guid, title, content, secret, accessKey)
{
    return fetch(helpers.apiUrl('notes/' + guid), {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + accessKey
        },
        body: JSON.stringify({
            'guid': guid,
            'password': secret,
            'title': title,
            'content': content
        })
    });
}

export function doUnpublish(guid, accessKey)
{
    return fetch(helpers.apiUrl('notes/' + guid), {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + accessKey
        }
    });
}
