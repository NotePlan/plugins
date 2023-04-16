// @flow

export function doPublish(title, content, secret, accessKey)
{
    return fetch('https://noteplan-publish.test/api/notes', {
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
    return fetch('https://noteplan-publish.test/api/notes/' + guid, {
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
    return fetch('https://noteplan-publish.test/api/notes/' + guid, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + accessKey
        }
    });
}
